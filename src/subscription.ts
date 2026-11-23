import { doc, getDoc, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from './firebase.ts';

/**
 * Subscription Infrastructure (Dormant / Feature-Flagged OFF by default)
 * ----------------------------------------------------------------------
 * When VITE_SUBSCRIPTIONS_ENABLED !== 'true':
 * - Zero UI changes, zero paywall prompts, zero access restrictions.
 * - Zero extra Firestore reads or listeners are created.
 * - All entitlement checks (`hasFeatureAccess`, `canAccessKurul`) return `true`.
 *
 * Security model:
 * - Subscription state lives in `/users/{uid}/subscription/current`.
 * - Clients have READ-ONLY access to their own subscription doc.
 * - Only server-side webhooks (iyzico / Stripe / Paddle / LemonSqueezy) using
 *   Firebase Admin SDK can write or update subscription documents.
 */

const env = (typeof import.meta !== 'undefined' ? (import.meta as unknown as { env?: Record<string, string> }).env : {}) || {};

export const SUBSCRIPTIONS_ENABLED: boolean = env.VITE_SUBSCRIPTIONS_ENABLED === 'true';

export type SubscriptionPlan = 'free' | 'monthly' | 'semester' | 'yearly' | 'lifetime';

export type SubscriptionStatus =
  | 'inactive'
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'expired';

export type SubscriptionProvider =
  | 'none'
  | 'iyzico'
  | 'stripe'
  | 'paddle'
  | 'lemonsqueezy'
  | 'manual';

export type SubscriptionFeature =
  | 'unlimited_questions'
  | 'explanations'
  | 'exam_mode'
  | 'cloud_sync'
  | 'analytics'
  | 'grade_calculator';

export interface UserSubscription {
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  provider: SubscriptionProvider;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  cancelAtPeriodEnd?: boolean;
  updatedAt?: string;
}

export interface PlanEntitlement {
  plan: SubscriptionPlan;
  dailyQuestionLimit: number | null; // null = unlimited
  features: ReadonlySet<SubscriptionFeature>;
}

const ALL_FEATURES: ReadonlySet<SubscriptionFeature> = new Set([
  'unlimited_questions',
  'explanations',
  'exam_mode',
  'cloud_sync',
  'analytics',
  'grade_calculator',
]);

const FREE_FEATURES: ReadonlySet<SubscriptionFeature> = new Set([
  'cloud_sync',
  'grade_calculator',
]);

export const PLAN_ENTITLEMENTS: Record<SubscriptionPlan, PlanEntitlement> = {
  free: {
    plan: 'free',
    dailyQuestionLimit: 25,
    features: FREE_FEATURES,
  },
  monthly: {
    plan: 'monthly',
    dailyQuestionLimit: null,
    features: ALL_FEATURES,
  },
  semester: {
    plan: 'semester',
    dailyQuestionLimit: null,
    features: ALL_FEATURES,
  },
  yearly: {
    plan: 'yearly',
    dailyQuestionLimit: null,
    features: ALL_FEATURES,
  },
  lifetime: {
    plan: 'lifetime',
    dailyQuestionLimit: null,
    features: ALL_FEATURES,
  },
};

/**
 * Extension point for future payment provider integrations (iyzico, Stripe, Paddle, etc.).
 * Checkout creation must happen on a secure backend endpoint (e.g. Vercel Serverless / Cloud Function).
 */
export interface CheckoutSessionRequest {
  userId: string;
  email: string;
  plan: Exclude<SubscriptionPlan, 'free'>;
  successUrl: string;
  cancelUrl: string;
}

export interface CheckoutSessionResponse {
  checkoutUrl: string;
  sessionId?: string;
}

export interface CheckoutProviderAdapter {
  readonly provider: SubscriptionProvider;
  createCheckoutSession(req: CheckoutSessionRequest): Promise<CheckoutSessionResponse>;
  createBillingPortalUrl?(userId: string, returnUrl: string): Promise<string>;
}

const DEFAULT_FREE_SUBSCRIPTION = (userId = ''): UserSubscription => ({
  userId,
  plan: 'free',
  status: 'inactive',
  provider: 'none',
});

let currentSubscription: UserSubscription | null = null;
let unsubscribeListener: Unsubscribe | null = null;
const changeSubscribers = new Set<(sub: UserSubscription | null) => void>();

function notifyListeners(): void {
  changeSubscribers.forEach((cb) => {
    try {
      cb(currentSubscription);
    } catch {
      // Isolate listener errors
    }
  });
}

function parseSubscriptionDoc(uid: string, raw: Record<string, unknown>): UserSubscription {
  const validPlans: SubscriptionPlan[] = ['free', 'monthly', 'semester', 'yearly', 'lifetime'];
  const validStatuses: SubscriptionStatus[] = ['inactive', 'trialing', 'active', 'past_due', 'canceled', 'expired'];
  const validProviders: SubscriptionProvider[] = ['none', 'iyzico', 'stripe', 'paddle', 'lemonsqueezy', 'manual'];

  const plan = validPlans.includes(raw.plan as SubscriptionPlan) ? (raw.plan as SubscriptionPlan) : 'free';
  const status = validStatuses.includes(raw.status as SubscriptionStatus)
    ? (raw.status as SubscriptionStatus)
    : 'inactive';
  const provider = validProviders.includes(raw.provider as SubscriptionProvider)
    ? (raw.provider as SubscriptionProvider)
    : 'none';

  return {
    userId: typeof raw.userId === 'string' ? raw.userId : uid,
    plan,
    status,
    provider,
    providerCustomerId: typeof raw.providerCustomerId === 'string' ? raw.providerCustomerId : undefined,
    providerSubscriptionId: typeof raw.providerSubscriptionId === 'string' ? raw.providerSubscriptionId : undefined,
    currentPeriodStart: typeof raw.currentPeriodStart === 'string' ? raw.currentPeriodStart : undefined,
    currentPeriodEnd: typeof raw.currentPeriodEnd === 'string' ? raw.currentPeriodEnd : undefined,
    trialEndsAt: typeof raw.trialEndsAt === 'string' ? raw.trialEndsAt : undefined,
    cancelAtPeriodEnd: typeof raw.cancelAtPeriodEnd === 'boolean' ? raw.cancelAtPeriodEnd : undefined,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  };
}

export function isSubscriptionActive(sub: UserSubscription | null): boolean {
  if (!sub) return false;
  if (sub.plan === 'lifetime' && sub.status === 'active') return true;
  if (sub.status !== 'active' && sub.status !== 'trialing') return false;

  const endIso = sub.status === 'trialing' ? (sub.trialEndsAt || sub.currentPeriodEnd) : sub.currentPeriodEnd;
  if (!endIso) return true;

  const endMs = new Date(endIso).getTime();
  if (Number.isNaN(endMs)) return false;
  return endMs > Date.now();
}

export function getEffectivePlan(sub: UserSubscription | null = currentSubscription): SubscriptionPlan {
  if (!SUBSCRIPTIONS_ENABLED) return 'lifetime';
  if (!sub || !isSubscriptionActive(sub)) return 'free';
  return sub.plan;
}

export function hasFeatureAccess(feature: SubscriptionFeature): boolean {
  if (!SUBSCRIPTIONS_ENABLED) return true;
  const plan = getEffectivePlan(currentSubscription);
  return PLAN_ENTITLEMENTS[plan].features.has(feature);
}

export function canAccessKurul(_kurulId: string): boolean {
  if (!SUBSCRIPTIONS_ENABLED) return true;
  return hasFeatureAccess('unlimited_questions');
}

export function getCurrentSubscription(): UserSubscription | null {
  return currentSubscription;
}

export function onSubscriptionChange(cb: (sub: UserSubscription | null) => void): () => void {
  changeSubscribers.add(cb);
  return () => {
    changeSubscribers.delete(cb);
  };
}

export async function loadUserSubscription(uid: string): Promise<UserSubscription> {
  if (!SUBSCRIPTIONS_ENABLED) {
    currentSubscription = DEFAULT_FREE_SUBSCRIPTION(uid);
    return currentSubscription;
  }

  try {
    const subRef = doc(db, 'users', uid, 'subscription', 'current');
    const snap = await getDoc(subRef);
    currentSubscription = snap.exists()
      ? parseSubscriptionDoc(uid, snap.data() as Record<string, unknown>)
      : DEFAULT_FREE_SUBSCRIPTION(uid);
  } catch {
    currentSubscription = DEFAULT_FREE_SUBSCRIPTION(uid);
  }

  notifyListeners();
  return currentSubscription;
}

export function initSubscriptionForUser(uid: string): void {
  clearSubscriptionState();

  // Strictly dormant while feature flag is off: no Firestore reads or listeners.
  if (!SUBSCRIPTIONS_ENABLED) {
    currentSubscription = DEFAULT_FREE_SUBSCRIPTION(uid);
    return;
  }

  const subRef = doc(db, 'users', uid, 'subscription', 'current');
  unsubscribeListener = onSnapshot(
    subRef,
    (snap) => {
      currentSubscription = snap.exists()
        ? parseSubscriptionDoc(uid, snap.data() as Record<string, unknown>)
        : DEFAULT_FREE_SUBSCRIPTION(uid);
      notifyListeners();
    },
    () => {
      // Fail safely without disrupting user experience
    }
  );
}

export function clearSubscriptionState(): void {
  if (unsubscribeListener) {
    try {
      unsubscribeListener();
    } catch {
      // Ignore cleanup errors
    }
    unsubscribeListener = null;
  }
  currentSubscription = null;
  notifyListeners();
}

export const subscriptionService = {
  isEnabled: () => SUBSCRIPTIONS_ENABLED,
  getCurrent: getCurrentSubscription,
  getEffectivePlan,
  isActive: () => (SUBSCRIPTIONS_ENABLED ? isSubscriptionActive(currentSubscription) : true),
  hasFeatureAccess,
  canAccessKurul,
  load: loadUserSubscription,
  onChange: onSubscriptionChange,
};
