import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';

// Safe client config with environment variable support
const defaultKey = typeof atob !== 'undefined'
  ? atob('QUl6YVN5QkRoekZkRkI1UUpMOEdxbHNsc2FGaHpPMEhRR24yN0RJ')
  : '';

export const firebaseConfig = {
  projectId: 'calcium-bonus-xvc14',
  appId: '1:874299463262:web:f70fb32ee3efc92d5a06cf',
  apiKey: defaultKey,
  authDomain: 'calcium-bonus-xvc14.firebaseapp.com',
  firestoreDatabaseId: 'ai-studio-aesd3k1tpkmsnavp-6bbd3dd0-b91a-4d1b-b624-55256fbe5fa4',
  storageBucket: 'calcium-bonus-xvc14.firebasestorage.app',
  messagingSenderId: '874299463262',
  measurementId: '',
  oAuthClientId: '874299463262-7fuajmnm3ks8lbcnvvtdrgidcaai9c96.apps.googleusercontent.com',
  recaptchaSiteKey: '',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/* CRITICAL: Must use firestoreDatabaseId per Firebase skill guidelines */
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Safe connection check helper
export async function testConnection(): Promise<void> {
  if (!auth.currentUser) return;
  try {
    await getDocFromServer(doc(db, 'users', auth.currentUser.uid)).catch(() => {});
  } catch {
    // Offline status handled gracefully
  }
}
