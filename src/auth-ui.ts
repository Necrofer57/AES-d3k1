import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged,
  EmailAuthProvider,
  linkWithCredential,
  User,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  writeBatch,
  deleteDoc,
  addDoc,
} from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase.ts';

// Designated Read-Only Admin Email
export const ADMIN_EMAIL = 'sezgin45efe@gmail.com';

export function isCurrentUserAdmin(): boolean {
  if (!auth.currentUser) return false;
  const email = (auth.currentUser.email || '').toLowerCase();
  return email === ADMIN_EMAIL.toLowerCase();
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function requireAuth(message?: string): void {
  openAuthModal(
    'register',
    message || '🔒 Soru çözmek ve ilerlemenizi kaydetmek için lütfen ücretsiz giriş yapın veya kayıt olun.'
  );
}

// User profile interface matching firebase-blueprint.json
export interface UserProfileData {
  userId: string;
  email: string;
  displayName?: string;
  createdAt?: string;
  updatedAt?: string;
  studySeconds?: number;
  lastActiveAt?: string;
  isOnline?: boolean;
}

let hadPreviousUser = false;
let isCloudTimeLoaded = false;
let currentStudySeconds = 0;
let sessionStudySeconds = 0;
let isUserActive = true;
let lastInteractionTime = Date.now();
let studyTimerInterval: number | null = null;
let studyCloudSyncInterval: number | null = null;
let activityListenersInitialized = false;
const cloudBookmarkIds = new Set<string>();

export function formatStudyTime(seconds?: number): string {
  if (!seconds || seconds <= 0) return '0 dk';
  const totalMin = Math.floor(seconds / 60);
  if (totalMin < 1) return '< 1 dk';
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours === 0) return `${mins} dk`;
  return `${hours} sa ${mins} dk`;
}

export function formatLastActive(lastActiveAt?: string, isOnline?: boolean): { label: string; badgeClass: string; isHot: boolean } {
  if (!lastActiveAt) {
    return { label: 'Bilinmiyor', badgeClass: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', isHot: false };
  }
  const diffMs = Date.now() - new Date(lastActiveAt).getTime();
  const diffMin = Math.max(0, Math.floor(diffMs / 60000));

  // A user is truly online only if their heartbeat is within the last 2 minutes AND they haven't explicitly gone offline/logged out
  const isTrulyOnline = isOnline !== false && diffMs >= -60000 && diffMs < 2 * 60 * 1000;

  if (isTrulyOnline) {
    return {
      label: '🟢 Şu An Aktif',
      badgeClass: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold',
      isHot: true,
    };
  }
  if (diffMin < 1) {
    return {
      label: '🟡 Az önce ayrıldı',
      badgeClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
      isHot: false,
    };
  }
  if (diffMin < 60) {
    return {
      label: `🟡 ${diffMin} dk önce`,
      badgeClass: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
      isHot: false,
    };
  }
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) {
    return {
      label: `🔵 ${diffHour} saat önce`,
      badgeClass: 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800',
      isHot: false,
    };
  }
  const days = Math.floor(diffHour / 24);
  return {
    label: `⚪ ${days} gün önce`,
    badgeClass: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
    isHot: false,
  };
}

export function saveUserToLocalRegistry(profile: UserProfileData): void {
  try {
    const raw = localStorage.getItem('d3k1_user_registry_cache') || '[]';
    const list: UserProfileData[] = JSON.parse(raw);
    const targetEmail = (profile.email || '').toLowerCase().trim();
    const idx = list.findIndex(u => (u.userId && u.userId === profile.userId) || (targetEmail && (u.email || '').toLowerCase().trim() === targetEmail));
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...profile };
    } else {
      list.push(profile);
    }
    localStorage.setItem('d3k1_user_registry_cache', JSON.stringify(list));
  } catch {
    // Ignore storage errors
  }
}

export function getLocalUserRegistry(): UserProfileData[] {
  try {
    const raw = localStorage.getItem('d3k1_user_registry_cache') || '[]';
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function updateStudyUI(): void {
  const formattedTotal = formatStudyTime(currentStudySeconds);
  const formattedSession = formatStudyTime(sessionStudySeconds);

  // Header study pill
  const hdrStudyPill = document.getElementById('header-study-timer');
  const hdrStudyEl = document.getElementById('hdr-study-time');
  if (hdrStudyPill) {
    if (auth.currentUser) {
      hdrStudyPill.classList.remove('hidden');
      hdrStudyPill.classList.add('flex');
    } else {
      hdrStudyPill.classList.add('hidden');
      hdrStudyPill.classList.remove('flex');
    }
  }
  if (hdrStudyEl) {
    hdrStudyEl.textContent = formattedTotal;
    hdrStudyEl.title = `Toplam Çalışma: ${formattedTotal} • Bu Oturum: ${formattedSession} (${isUserActive ? 'Aktif' : 'Mola'})`;
  }

  // Home screen banner study stats
  const homeTotalEl = document.getElementById('home-study-total');
  const homeSessionEl = document.getElementById('home-study-session');
  const homeStatusEl = document.getElementById('home-study-status');
  if (homeTotalEl) homeTotalEl.textContent = formattedTotal;
  if (homeSessionEl) homeSessionEl.textContent = formattedSession;
  if (homeStatusEl) {
    if (isUserActive) {
      homeStatusEl.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
        <span class="text-emerald-700 dark:text-emerald-300">Aktif Çalışılıyor</span>
      `;
    } else {
      homeStatusEl.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-amber-400"></span>
        <span class="text-amber-700 dark:text-amber-300">Mola / Beklemede</span>
      `;
    }
  }

  // Profile modal study stats
  const profTotalEl = document.getElementById('profile-stat-study-total');
  const profSessionEl = document.getElementById('profile-stat-study-session');
  const profStatusEl = document.getElementById('profile-stat-activity');
  if (profTotalEl) profTotalEl.textContent = formattedTotal;
  if (profSessionEl) profSessionEl.textContent = formattedSession;
  if (profStatusEl) {
    profStatusEl.textContent = isUserActive ? '🟢 Şu An Aktif' : '🟡 Mola / Beklemede';
  }
}

async function syncStudyTimeToCloud(isOnlineState: boolean): Promise<void> {
  if (!auth.currentUser) return;
  const uid = auth.currentUser.uid;
  const now = new Date().toISOString();

  if (isCloudTimeLoaded) {
    try {
      localStorage.setItem(`d3_study_sec_${uid}`, String(currentStudySeconds));
    } catch {
      // Ignore storage quota or private browsing errors
    }
  }

  try {
    const userDocRef = doc(db, 'users', uid);
    if (!isCloudTimeLoaded) {
      // If cloud study time hasn't finished loading yet, never overwrite studySeconds!
      await setDoc(userDocRef, {
        userId: uid,
        email: auth.currentUser.email || '',
        isOnline: isOnlineState,
        lastActiveAt: now,
        updatedAt: now,
      }, { merge: true });
    } else {
      await setDoc(userDocRef, {
        userId: uid,
        email: auth.currentUser.email || '',
        studySeconds: currentStudySeconds,
        lastActiveAt: now,
        isOnline: isOnlineState,
        updatedAt: now,
      }, { merge: true });
    }
  } catch {
    // Silently continue if network is momentarily unavailable
  }
}

function startStudyTracker(user: User): void {
  stopStudyTracker();
  isCloudTimeLoaded = false;

  try {
    const cached = localStorage.getItem(`d3_study_sec_${user.uid}`);
    if (cached) {
      const val = parseInt(cached, 10);
      if (!isNaN(val) && val > 0) {
        currentStudySeconds = val;
      }
    }
  } catch {
    // Ignore storage quota
  }

  sessionStudySeconds = 0;
  isUserActive = true;
  lastInteractionTime = Date.now();
  updateStudyUI();

  const userRef = doc(db, 'users', user.uid);
  getDoc(userRef).then((snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (typeof data.studySeconds === 'number') {
        currentStudySeconds = Math.max(currentStudySeconds, data.studySeconds);
        updateStudyUI();
      }
    }
    isCloudTimeLoaded = true;
  }).catch(() => {
    // Offline or initial fetch fallback handled gracefully
  });

  studyTimerInterval = window.setInterval(() => {
    if (document.hidden || Date.now() - lastInteractionTime > 180000) {
      if (isUserActive) {
        isUserActive = false;
        updateStudyUI();
      }
      return;
    }

    if (!isUserActive) {
      isUserActive = true;
    }

    currentStudySeconds++;
    sessionStudySeconds++;
    updateStudyUI();
  }, 1000);

  studyCloudSyncInterval = window.setInterval(() => {
    syncStudyTimeToCloud(isUserActive);
  }, 30000);
}

function stopStudyTracker(): void {
  isCloudTimeLoaded = false;
  if (studyTimerInterval) {
    clearInterval(studyTimerInterval);
    studyTimerInterval = null;
  }
  if (studyCloudSyncInterval) {
    clearInterval(studyCloudSyncInterval);
    studyCloudSyncInterval = null;
  }
}

function initActivityListeners(): void {
  if (activityListenersInitialized) return;
  activityListenersInitialized = true;

  const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
  let throttleTimer: number | null = null;
  events.forEach((ev) => {
    window.addEventListener(ev, () => {
      if (throttleTimer) return;
      throttleTimer = window.setTimeout(() => {
        throttleTimer = null;
        lastInteractionTime = Date.now();
        if (!isUserActive) {
          isUserActive = true;
          updateStudyUI();
        }
      }, 1000);
    }, { passive: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      isUserActive = false;
      updateStudyUI();
      syncStudyTimeToCloud(false);
    } else {
      lastInteractionTime = Date.now();
      isUserActive = true;
      updateStudyUI();
      syncStudyTimeToCloud(true);
    }
  });

  window.addEventListener('beforeunload', () => {
    syncStudyTimeToCloud(false);
  });
}

export function initAuthUI(): void {
  // Inject Auth Modal HTML into DOM if not present
  if (!document.getElementById('auth-modal-root')) {
    injectAuthModalDOM();
  }

  // Setup Event Listeners
  setupAuthEventListeners();
  initActivityListeners();

  // Listen to Auth state changes
  onAuthStateChanged(auth, async (user) => {
    updateHeaderUserUI(user);
    updateHomeBannerUI(user);

    if (user) {
      hadPreviousUser = true;
      startStudyTracker(user);
      await onUserSignedIn(user);
    } else {
      stopStudyTracker();
      currentStudySeconds = 0;
      sessionStudySeconds = 0;
      updateStudyUI();
      if (hadPreviousUser) {
        onUserSignedOut();
      }
      hadPreviousUser = false;
    }
  });

  // Listen to local progress saves to sync to cloud
  window.addEventListener('d3k1-save-progress', ((e: CustomEvent) => {
    if (auth.currentUser) {
      syncProgressToCloud(auth.currentUser, e.detail?.favorites, e.detail?.userAnswers);
    }
  }) as EventListener);

  // Expose d3k1Auth globally
  (window as unknown as { d3k1Auth: unknown }).d3k1Auth = {
    auth,
    ADMIN_EMAIL,
    isCurrentUserAdmin,
    isAuthenticated: () => Boolean(auth.currentUser),
    requireAuth,
    openAuthModal,
    fetchUsersForAdmin,
    formatStudyTime,
    formatLastActive,
    getStudySeconds: () => currentStudySeconds,
    getSessionStudySeconds: () => sessionStudySeconds,
    isUserActive: () => isUserActive,
    saveExamResultToCloud,
    syncProgressToCloud,
    loadCloudBookmarks,
    escapeHtml,
  };
}

function updateHeaderUserUI(user: User | null): void {
  const triggerBtn = document.getElementById('btn-auth-trigger');
  const btnIcon = document.getElementById('auth-btn-icon');
  const btnText = document.getElementById('auth-btn-text');
  const adminNavBtn = document.getElementById('btn-admin-nav');

  if (adminNavBtn) {
    if (user && isCurrentUserAdmin()) {
      adminNavBtn.classList.remove('hidden');
      adminNavBtn.classList.add('flex');
    } else {
      adminNavBtn.classList.add('hidden');
      adminNavBtn.classList.remove('flex');
    }
  }

  // Also control visibility of admin quick-access in modal
  const adminQuickAccess = document.getElementById('admin-quick-access-box');
  if (adminQuickAccess) {
    if (user && isCurrentUserAdmin()) {
      adminQuickAccess.classList.remove('hidden');
    } else {
      adminQuickAccess.classList.add('hidden');
    }
  }

  if (!triggerBtn || !btnText || !btnIcon) return;

  if (user) {
    const isAdmin = isCurrentUserAdmin();
    const name = user.displayName || user.email?.split('@')[0] || 'Kullanıcı';
    btnIcon.textContent = isAdmin ? '👑' : '✅';
    btnText.textContent = isAdmin
      ? 'Admin (İzleme)'
      : (name.length > 10 ? name.substring(0, 9) + '..' : name);
    triggerBtn.className = isAdmin
      ? 'px-3 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-600 hover:bg-amber-700 text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition-all shrink-0 cursor-pointer'
      : 'px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition-all shrink-0 cursor-pointer';
    triggerBtn.title = isAdmin
      ? `👑 Yönetici Paneli (${user.email}) - Açmak için tıklayın`
      : `Giriş yapıldı: ${user.email}`;
  } else {
    btnIcon.textContent = '👤';
    btnText.textContent = 'Giriş Yap / Kayıt';
    triggerBtn.className =
      'px-3 py-1.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition-all shrink-0 cursor-pointer';
    triggerBtn.title = 'Kullanıcı Girişi / E-posta ile Kayıt Ol';
  }
}

function updateHomeBannerUI(user: User | null): void {
  const loggedOutBanner = document.getElementById('home-auth-logged-out');
  const loggedInBanner = document.getElementById('home-auth-logged-in');
  const userNameEl = document.getElementById('home-user-name');
  const userEmailEl = document.getElementById('home-user-email');
  const homeAdminBox = document.getElementById('home-admin-box');

  if (!loggedOutBanner || !loggedInBanner) return;

  if (user) {
    loggedOutBanner.classList.add('hidden');
    loggedInBanner.classList.remove('hidden');
    const isAdmin = isCurrentUserAdmin();
    if (userNameEl) {
      userNameEl.textContent = isAdmin
        ? (user.displayName || 'Sezgin (Yönetici)')
        : (user.displayName || user.email?.split('@')[0] || 'Öğrenci');
    }
    if (userEmailEl) userEmailEl.textContent = user.email || '';

    if (homeAdminBox) {
      if (isAdmin) {
        homeAdminBox.classList.remove('hidden');
        homeAdminBox.classList.add('flex');
      } else {
        homeAdminBox.classList.add('hidden');
        homeAdminBox.classList.remove('flex');
      }
    }
  } else {
    loggedOutBanner.classList.remove('hidden');
    loggedInBanner.classList.add('hidden');
    if (homeAdminBox) {
      homeAdminBox.classList.add('hidden');
      homeAdminBox.classList.remove('flex');
    }
  }
}

async function onUserSignedIn(user: User): Promise<void> {
  const toast = getToastFunction();
  if (toast) {
    toast(`👋 Hoş geldiniz, ${user.displayName || user.email}!`);
  }

  // 1. Sync / Save user profile to Firestore & local registry
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);
    const existing = snap.exists() ? snap.data() : null;

    const email = user.email || existing?.email || '';
    const rawName = user.displayName || existing?.displayName;
    const finalDisplayName = (rawName && rawName !== 'Öğrenci')
      ? rawName
      : (email ? email.split('@')[0] : 'Öğrenci');

    const profileData: UserProfileData = {
      userId: user.uid,
      email: email,
      displayName: finalDisplayName,
      createdAt: existing?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      studySeconds: typeof existing?.studySeconds === 'number' ? existing.studySeconds : currentStudySeconds,
      lastActiveAt: new Date().toISOString(),
      isOnline: true,
    };

    await setDoc(userDocRef, profileData, { merge: true });
    saveUserToLocalRegistry(profileData);
  } catch {
    // Handled gracefully
  }

  // 2. Load cloud bookmarks into local state
  await loadCloudBookmarks(user);
}

function onUserSignedOut(): void {
  try {
    localStorage.removeItem('d3k1_user_answers_v1');
    localStorage.removeItem('d3k1_favorites_v1');
    localStorage.removeItem('d3k1_active_exam_v1');
  } catch {
    // Ignore storage errors
  }
  cloudBookmarkIds.clear();

  const app = (window as unknown as {
    d3k1App?: {
      state?: { userAnswers: Record<string, string>; favorites: Set<string>; revealedIds?: Set<string> };
      updateStats?: () => void;
      updateHeaderScores?: () => void;
      updateHeaderAndToolbarStats?: () => void;
      renderQuestions?: () => void;
      renderMainArea?: () => void;
      renderQuestionMap?: () => void;
    };
  }).d3k1App;

  if (app?.state) {
    app.state.userAnswers = {};
    app.state.favorites.clear();
    if (app.state.revealedIds) {
      app.state.revealedIds.clear();
    }
    app.updateStats?.();
    app.updateHeaderScores?.();
    app.updateHeaderAndToolbarStats?.();
    app.renderQuestions?.();
    app.renderMainArea?.();
    app.renderQuestionMap?.();
  }

  const toast = getToastFunction();
  if (toast) {
    toast('Oturum kapatıldı.');
  }
}

async function loadCloudBookmarks(user: User): Promise<void> {
  try {
    cloudBookmarkIds.clear();
    const bookmarksRef = collection(db, 'users', user.uid, 'bookmarks');
    const snap = await getDocs(bookmarksRef);
    const cloudFavs: string[] = [];
    snap.forEach((d) => {
      cloudBookmarkIds.add(d.id);
      const data = d.data();
      if (data.questionId) cloudFavs.push(data.questionId);
    });

    const app = (window as unknown as {
      d3k1App?: {
        state: { favorites: Set<string>; userAnswers: Record<string, string> };
        saveUserProgress: () => void;
        updateHeaderScores?: () => void;
        updateHeaderAndToolbarStats?: () => void;
        updateStats?: () => void;
        renderQuestions?: () => void;
        renderMainArea?: () => void;
        renderQuestionMap?: () => void;
      };
    }).d3k1App;

    let mergedFavCount = 0;
    if (app && app.state) {
      cloudFavs.forEach((qid) => {
        if (!app.state.favorites.has(qid)) {
          app.state.favorites.add(qid);
          mergedFavCount++;
        }
      });
    }

    // Also read user profile doc for cloud-synced userAnswers
    let mergedAnsCount = 0;
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        const uData = userSnap.data();
        if (uData?.userAnswers && typeof uData.userAnswers === 'object' && !Array.isArray(uData.userAnswers)) {
          if (app && app.state) {
            if (!app.state.userAnswers) {
              app.state.userAnswers = {};
            }
            for (const [qid, ans] of Object.entries(uData.userAnswers as Record<string, string>)) {
              if (typeof ans === 'string' && !app.state.userAnswers[qid]) {
                app.state.userAnswers[qid] = ans;
                mergedAnsCount++;
              }
            }
            try {
              localStorage.setItem('d3k1_user_answers_v1', JSON.stringify(app.state.userAnswers));
            } catch {
              // Ignore storage errors
            }
          }
        }
      }
    } catch {
      // Ignore userAnswers fetch error
    }

    if (app && app.state) {
      if (mergedFavCount > 0 || mergedAnsCount > 0) {
        try {
          localStorage.setItem('d3k1_favorites_v1', JSON.stringify(Array.from(app.state.favorites)));
        } catch {
          // Ignore storage errors
        }
        app.updateStats?.();
        app.updateHeaderScores?.();
        app.updateHeaderAndToolbarStats?.();
        app.renderQuestions?.();
        app.renderMainArea?.();
        app.renderQuestionMap?.();

        const toast = getToastFunction();
        if (toast) {
          const parts: string[] = [];
          if (mergedFavCount > 0) parts.push(`${mergedFavCount} favori`);
          if (mergedAnsCount > 0) parts.push(`${mergedAnsCount} yanıt`);
          toast(`☁️ Buluttan ${parts.join(', ')} senkronize edildi!`);
        }
      }
    }
  } catch {
    // Offline or initial load handled without noise
  }
}

let syncTimeout: number | null = null;
export function syncProgressToCloud(userArg?: User, favsArg?: string[], userAnswersArg?: Record<string, string>): void {
  if (syncTimeout) window.clearTimeout(syncTimeout);

  syncTimeout = window.setTimeout(async () => {
    const user = userArg || auth.currentUser;
    if (!user) return;

    try {
      const app = (window as unknown as {
        d3k1App?: {
          state?: { favorites?: Set<string>; userAnswers?: Record<string, string> };
        };
      }).d3k1App;

      // Determine current favorites
      const favList: string[] = (favsArg && Array.isArray(favsArg))
        ? favsArg
        : (app?.state?.favorites ? Array.from(app.state.favorites) : []);

      // Build sanitized ID map: sanitizedId -> original qid
      const currentSanitizedMap = new Map<string, string>();
      for (const qid of favList) {
        const sanitizedId = String(qid).replace(/[^a-zA-Z0-9_-]/g, '_');
        if (sanitizedId) {
          currentSanitizedMap.set(sanitizedId, String(qid));
        }
      }

      const currentSanitizedIds = new Set(currentSanitizedMap.keys());
      const now = new Date().toISOString();

      // Find new bookmarks to add (in currentSanitizedIds but not in cloudBookmarkIds)
      const toAdd: { id: string; qid: string }[] = [];
      currentSanitizedMap.forEach((qid, sId) => {
        if (!cloudBookmarkIds.has(sId)) {
          toAdd.push({ id: sId, qid });
        }
      });

      // Find removed bookmarks to delete (in cloudBookmarkIds but not in currentSanitizedIds)
      const toDelete: string[] = [];
      cloudBookmarkIds.forEach((sId) => {
        if (!currentSanitizedIds.has(sId)) {
          toDelete.push(sId);
        }
      });

      // Execute batch operations if there are bookmarks to add or delete
      if (toAdd.length > 0 || toDelete.length > 0) {
        const batch = writeBatch(db);
        // Limit batch operations to stay safely below 500
        const batchAdd = toAdd.slice(0, 200);
        const batchDelete = toDelete.slice(0, 200);

        for (const item of batchAdd) {
          const bmRef = doc(db, 'users', user.uid, 'bookmarks', item.id);
          batch.set(bmRef, {
            userId: user.uid,
            questionId: item.qid,
            createdAt: now,
          }, { merge: true });
        }

        for (const delId of batchDelete) {
          const bmRef = doc(db, 'users', user.uid, 'bookmarks', delId);
          batch.delete(bmRef);
        }

        await batch.commit();

        // Update local tracking set
        batchAdd.forEach(item => cloudBookmarkIds.add(item.id));
        batchDelete.forEach(delId => cloudBookmarkIds.delete(delId));
      }

      // Sync user profile document (including userAnswers if present)
      const userRef = doc(db, 'users', user.uid);
      const userUpdatePayload: Record<string, unknown> = {
        userId: user.uid,
        email: user.email || '',
        updatedAt: now,
        lastActiveAt: now,
      };

      if (userAnswersArg && typeof userAnswersArg === 'object') {
        userUpdatePayload.userAnswers = userAnswersArg;
      } else if (app?.state?.userAnswers && typeof app.state.userAnswers === 'object') {
        userUpdatePayload.userAnswers = app.state.userAnswers;
      }

      await setDoc(userRef, userUpdatePayload, { merge: true });

      const syncBadge = document.getElementById('cloud-sync-status');
      if (syncBadge) {
        syncBadge.textContent = '🟢 Senkronize Edildi';
      }
    } catch {
      // Quiet background sync catch
    }
  }, 1200);
}

export interface UserExamResultData {
  userId?: string;
  kurul?: string;
  kurulId?: string;
  donem?: string;
  score?: number;
  correctCount: number;
  wrongCount?: number;
  emptyCount?: number;
  totalQuestions: number;
  durationSeconds?: number;
  completedAt?: string;
}

export async function saveExamResultToCloud(result: UserExamResultData): Promise<string | null> {
  if (!auth.currentUser) return null;
  const uid = auth.currentUser.uid;

  try {
    const examResultsCol = collection(db, 'users', uid, 'examResults');
    const total = Number(result.totalQuestions) || 0;
    const correct = Number(result.correctCount) || 0;
    const wrong = Number(result.wrongCount) || 0;
    const empty = Number(result.emptyCount) || 0;
    const score = typeof result.score === 'number'
      ? result.score
      : (total > 0 ? Math.round((correct / total) * 100) : 0);

    const docData: Record<string, unknown> = {
      userId: uid,
      totalQuestions: total,
      correctCount: correct,
      wrongCount: wrong,
      emptyCount: empty,
      score: score,
      completedAt: result.completedAt || new Date().toISOString(),
    };

    if (result.kurul) {
      docData.kurul = String(result.kurul);
    }
    if (result.kurulId) {
      docData.kurulId = String(result.kurulId);
    }
    if (result.donem) {
      docData.donem = String(result.donem);
    }
    if (typeof result.durationSeconds === 'number') {
      docData.durationSeconds = result.durationSeconds;
    }

    const docRef = await addDoc(examResultsCol, docData);
    return docRef.id;
  } catch (err) {
    console.warn('Failed to save exam result to cloud:', err);
    return null;
  }
}

function getToastFunction(): ((msg: string) => void) | null {
  const app = (window as unknown as { d3k1App?: { showToast: (msg: string) => void } }).d3k1App;
  if (app && typeof app.showToast === 'function') {
    return app.showToast;
  }
  return null;
}

export async function fetchUsersForAdmin(): Promise<UserProfileData[]> {
  if (!isCurrentUserAdmin()) {
    return [];
  }
  const map = new Map<string, UserProfileData>();

  // Fetch real students directly from Firestore 'users' collection
  try {
    const snap = await getDocs(collection(db, 'users'));
    snap.forEach((d) => {
      const data = d.data();
      const isCurrent = d.id === auth.currentUser?.uid;
      const email = (data.email || '').trim();
      const rawName = (data.displayName || '').trim();
      const displayName = (rawName && rawName !== 'Öğrenci')
        ? rawName
        : (email && email.includes('@') ? email.split('@')[0] : 'Öğrenci');

      const userItem: UserProfileData = {
        userId: d.id,
        email: email || 'E-posta Kayıtlı Değil',
        displayName: displayName,
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.updatedAt || new Date().toISOString(),
        studySeconds: isCurrent ? currentStudySeconds : (typeof data.studySeconds === 'number' ? data.studySeconds : 0),
        lastActiveAt: isCurrent ? new Date().toISOString() : (data.lastActiveAt || data.updatedAt || new Date().toISOString()),
        isOnline: isCurrent ? isUserActive : (typeof data.isOnline === 'boolean' ? data.isOnline : false),
      };
      map.set(d.id, userItem);
    });
  } catch (err) {
    console.error('Failed to fetch users for admin:', err);
    return [];
  }

  // Ensure current logged-in admin user is included/updated with live memory stats
  if (auth.currentUser) {
    const curUid = auth.currentUser.uid;
    const curEmail = auth.currentUser.email || ADMIN_EMAIL;
    const curName = auth.currentUser.displayName || 'Sezgin Efe (Yönetici)';

    const existing = map.get(curUid);
    if (existing) {
      existing.displayName = (existing.displayName && existing.displayName !== 'Öğrenci') ? existing.displayName : curName;
      existing.email = existing.email || curEmail;
      existing.studySeconds = currentStudySeconds > 0 ? currentStudySeconds : (existing.studySeconds || 0);
      existing.isOnline = isUserActive;
      existing.lastActiveAt = new Date().toISOString();
    } else {
      map.set(curUid, {
        userId: curUid,
        email: curEmail,
        displayName: curName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        studySeconds: currentStudySeconds,
        lastActiveAt: new Date().toISOString(),
        isOnline: isUserActive,
      });
    }
  }

  return Array.from(map.values());
}

export function openAuthModal(defaultTab: 'login' | 'register' = 'login', customNotice?: string): void {
  clearFeedback();
  const modalRoot = document.getElementById('auth-modal-root');
  const user = auth.currentUser;
  const formsContainer = document.getElementById('auth-forms-container');
  const profileContainer = document.getElementById('auth-profile-container');
  const noticeBox = document.getElementById('auth-mandatory-notice');

  if (noticeBox) {
    if (customNotice) {
      const safeNotice = escapeHtml(customNotice);
      noticeBox.innerHTML = `
        <div class="p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/70 dark:to-orange-950/70 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 text-xs flex items-start gap-2.5 shadow-sm">
          <span class="text-base shrink-0">🔒</span>
          <div class="leading-relaxed">
            <span class="font-extrabold block text-amber-950 dark:text-amber-100 mb-0.5">Soru Çözmek İçin Hesap Zorunludur</span>
            <span>${safeNotice}</span>
          </div>
        </div>
      `;
      noticeBox.classList.remove('hidden');
    } else {
      noticeBox.classList.add('hidden');
      noticeBox.innerHTML = '';
    }
  }

  if (user) {
    formsContainer?.classList.add('hidden');
    profileContainer?.classList.remove('hidden');

    const nameEl = document.getElementById('profile-display-name');
    const emailEl = document.getElementById('profile-display-email');
    const favsEl = document.getElementById('profile-stat-favs');
    const ansEl = document.getElementById('profile-stat-answers');
    const adminBox = document.getElementById('profile-admin-badge-box');

    if (nameEl) nameEl.textContent = user.displayName || user.email?.split('@')[0] || 'Kullanıcı';
    if (emailEl) emailEl.textContent = user.email || '';

    const isAdmin = isCurrentUserAdmin();
    if (adminBox) {
      if (isAdmin) {
        adminBox.classList.remove('hidden');
      } else {
        adminBox.classList.add('hidden');
      }
    }

    const app = (window as unknown as { d3k1App?: { state: { favorites: Set<string>; userAnswers: Record<string, string> } } }).d3k1App;
    if (app && app.state) {
      if (favsEl) favsEl.textContent = String(app.state.favorites.size);
      if (ansEl) ansEl.textContent = String(Object.keys(app.state.userAnswers).length);
    }
    updateStudyUI();
  } else {
    formsContainer?.classList.remove('hidden');
    profileContainer?.classList.add('hidden');

    // Switch to desired tab
    if (defaultTab === 'register') {
      switchToTab('register');
    } else {
      switchToTab('login');
    }
  }

  modalRoot?.classList.remove('hidden');
}

function switchToTab(tab: 'login' | 'register'): void {
  clearFeedback();
  const tabLogin = document.getElementById('tab-auth-login');
  const tabRegister = document.getElementById('tab-auth-register');
  const formLogin = document.getElementById('form-login');
  const formRegister = document.getElementById('form-register');
  const formForgot = document.getElementById('form-forgot');

  if (tab === 'login') {
    if (tabLogin) tabLogin.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm';
    if (tabRegister) tabRegister.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200';
    formLogin?.classList.remove('hidden');
    formRegister?.classList.add('hidden');
    formForgot?.classList.add('hidden');
  } else {
    if (tabRegister) tabRegister.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm';
    if (tabLogin) tabLogin.className = 'flex-1 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200';
    formRegister?.classList.remove('hidden');
    formLogin?.classList.add('hidden');
    formForgot?.classList.add('hidden');
  }
}

function injectAuthModalDOM(): void {
  const modalHTML = `
    <!-- Auth & Profile Modal Container -->
    <div id="auth-modal-root" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div class="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6 text-slate-900 dark:text-slate-100">
        
        <!-- Modal Kapatma Butonu -->
        <button id="btn-close-auth-modal" type="button" class="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>

        <!-- Başlık ve İkon -->
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white text-xl shadow-md">
            🩺
          </div>
          <div>
            <h3 class="text-lg font-bold tracking-tight">Tıp Öğrencisi Hesabı</h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">Çıkmış soru çözümlerinizi ve favorilerinizi bulutta saklayın</p>
          </div>
        </div>

        <!-- Zorunlu Giriş Uyarısı -->
        <div id="auth-mandatory-notice" class="hidden mb-4"></div>

        <!-- Bildirim / Hata Mesajı Alanı -->
        <div id="auth-feedback-box" class="hidden mb-4 p-3 rounded-xl text-xs font-medium border"></div>

        <!-- 1. GİRİŞ YAP & KAYIT OL GÖRÜNÜMÜ (Oturum Açık Değilken) -->
        <div id="auth-forms-container">
          <!-- Sekme Başlıkları -->
          <div class="flex rounded-xl bg-slate-100 dark:bg-slate-800 p-1 mb-5 border border-slate-200 dark:border-slate-700">
            <button id="tab-auth-login" type="button" class="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm">
              Giriş Yap
            </button>
            <button id="tab-auth-register" type="button" class="flex-1 py-1.5 rounded-lg text-xs font-bold transition-all text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
              Kayıt Ol
            </button>
          </div>

          <!-- Form: GİRİŞ YAP -->
          <form id="form-login" class="space-y-3.5">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">E-posta Adresi</label>
              <input id="login-email" type="email" required placeholder="ornek@ogrenci.edu.tr" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
            </div>
            <div>
              <div class="flex items-center justify-between mb-1">
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300">Şifre</label>
                <button id="btn-show-forgot" type="button" class="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Şifremi Unuttum?</button>
              </div>
              <input id="login-password" type="password" required placeholder="••••••••" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
            </div>

            <button id="btn-submit-login" type="submit" class="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2">
              <span>Giriş Yap</span>
            </button>
          </form>

          <!-- Form: KAYIT OL -->
          <form id="form-register" class="space-y-3.5 hidden">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">İsim</label>
              <input id="reg-name" type="text" required placeholder="İsim" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">E-posta Adresi</label>
              <input id="reg-email" type="email" required placeholder="ornek@ogrenci.edu.tr" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
            </div>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Şifre (En az 6 karakter)</label>
              <input id="reg-password" type="password" required minlength="6" placeholder="••••••••" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
            </div>

            <button id="btn-submit-register" type="submit" class="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 active:scale-[0.99] text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2">
              <span>Hesap Oluştur ve Başla</span>
            </button>
          </form>

          <!-- Form: ŞİFREMİ UNUTTUM -->
          <form id="form-forgot" class="space-y-3.5 hidden">
            <p class="text-xs text-slate-600 dark:text-slate-400">Kayıtlı e-posta adresinizi girin, size şifre sıfırlama bağlantısı gönderelim.</p>
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">E-posta Adresi</label>
              <input id="forgot-email" type="email" required placeholder="ornek@ogrenci.edu.tr" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
            </div>
            <button id="btn-submit-forgot" type="submit" class="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold shadow-md transition-all">
              Şifre Sıfırlama E-postası Gönder
            </button>
            <button id="btn-back-to-login" type="button" class="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
              ← Giriş Ekranına Dön
            </button>
          </form>

          <!-- Ayraç -->
          <div class="my-4 flex items-center gap-3">
            <div class="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
            <span class="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">veya</span>
            <div class="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
          </div>

          <!-- Google ile Giriş -->
          <button id="btn-google-login" type="button" class="w-full py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 text-slate-700 dark:text-slate-200 text-xs sm:text-sm font-bold shadow-sm transition-all flex items-center justify-center gap-2.5">
            <svg class="w-4 h-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/></svg>
            <span>Google ile Hızlı Giriş</span>
          </button>

          <!-- Geri Bildirim ve Öneri Kutusu -->
          <div class="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 text-center space-y-1">
            <div class="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              💡 Öneri, soru veya geri bildirimleriniz için:
            </div>
            <a href="mailto:${ADMIN_EMAIL}?subject=AES%20d3k1%20Öneri%20ve%20Geri%20Bildirim" class="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline">
              <span>✉️</span>
              <span class="font-mono">${ADMIN_EMAIL}</span>
            </a>
          </div>
        </div>

        <!-- 2. PROFİL DETAYLARI GÖRÜNÜMÜ (Oturum Açıkken) -->
        <div id="auth-profile-container" class="hidden space-y-4">
          <!-- Yönetici Rozeti ve Yönlendirme -->
          <div id="profile-admin-badge-box" class="hidden p-3.5 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border border-amber-300 dark:border-amber-700/60 flex items-center justify-between gap-3">
            <div>
              <div class="text-xs font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <span>👑</span>
                <span>Yönetici Hesabı (Salt Okunur)</span>
              </div>
              <div class="text-[11px] text-amber-700 dark:text-amber-400">Kullanıcıları ve istatistikleri izleme modundasınız.</div>
            </div>
            <button id="btn-profile-go-admin" type="button" class="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-sm transition-all cursor-pointer shrink-0">
              Paneli Aç →
            </button>
          </div>

          <div class="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Giriş Yapılan Hesap</span>
              <span id="cloud-sync-status" class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">🟢 Bulut Senkronizasyonu Aktif</span>
            </div>
            <div class="font-bold text-slate-900 dark:text-slate-100" id="profile-display-name">Öğrenci</div>
            <div class="text-xs text-slate-600 dark:text-slate-300 font-mono" id="profile-display-email">ogrenci@tip.edu.tr</div>
          </div>

          <div class="grid grid-cols-2 gap-2 text-center">
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div class="text-lg font-black text-indigo-600 dark:text-indigo-400" id="profile-stat-favs">0</div>
              <div class="text-[11px] text-slate-500">Kayıtlı Favori Soru</div>
            </div>
            <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div class="text-lg font-black text-emerald-600 dark:text-emerald-400" id="profile-stat-answers">0</div>
              <div class="text-[11px] text-slate-500">Çözülen Soru Sayısı</div>
            </div>
          </div>

          <!-- Çalışma Süresi ve Canlı Durum Kartı -->
          <div class="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 space-y-2">
            <div class="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span class="flex items-center gap-1.5">
                <span>⏱️</span>
                <span>Çalışma Süresi Takibi</span>
              </span>
              <span id="profile-stat-activity" class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">🟢 Şu An Aktif</span>
            </div>
            <div class="grid grid-cols-2 gap-2 text-center pt-1">
              <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                <div class="text-base font-black text-indigo-600 dark:text-indigo-400" id="profile-stat-study-total">0 dk</div>
                <div class="text-[10px] text-slate-500 font-semibold">Toplam Çalışma</div>
              </div>
              <div class="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                <div class="text-base font-black text-emerald-600 dark:text-emerald-400" id="profile-stat-study-session">0 dk</div>
                <div class="text-[10px] text-slate-500 font-semibold">Bu Oturum</div>
              </div>
            </div>
          </div>

          <div class="space-y-2 pt-2">
            <button id="btn-send-reset-from-profile" type="button" class="w-full py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors">
              🔑 Şifremi Değiştir (E-posta İste)
            </button>
            <button id="btn-logout" type="button" class="w-full py-2.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/50 text-xs sm:text-sm font-bold transition-colors">
              🚪 Oturumu Kapat
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function showFeedback(msg: string, isError = false): void {
  const box = document.getElementById('auth-feedback-box');
  if (!box) return;
  box.textContent = msg;
  box.className = isError
    ? 'mb-4 p-3 rounded-xl text-xs font-medium border bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-200 border-rose-200 dark:border-rose-800'
    : 'mb-4 p-3 rounded-xl text-xs font-medium border bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800';
  box.classList.remove('hidden');
}

function clearFeedback(): void {
  const box = document.getElementById('auth-feedback-box');
  if (box) box.classList.add('hidden');
}

function setupAuthEventListeners(): void {
  const modalRoot = document.getElementById('auth-modal-root');
  const triggerBtn = document.getElementById('btn-auth-trigger');
  const closeBtn = document.getElementById('btn-close-auth-modal');

  // Header trigger button:
  // Admin tıklandığında doğrudan Yönetici Paneline geçiş yapar!
  triggerBtn?.addEventListener('click', () => {
    if (auth.currentUser && isCurrentUserAdmin()) {
      const app = (window as unknown as { d3k1App?: { showAdminScreen: () => void } }).d3k1App;
      if (app && typeof app.showAdminScreen === 'function') {
        app.showAdminScreen();
        return;
      }
    }
    openAuthModal(auth.currentUser ? 'login' : 'login');
  });

  // Home banner direct button to Admin
  document.getElementById('btn-home-go-admin')?.addEventListener('click', () => {
    const app = (window as unknown as { d3k1App?: { showAdminScreen: () => void } }).d3k1App;
    if (app && typeof app.showAdminScreen === 'function') {
      app.showAdminScreen();
    }
  });

  // Home banner buttons
  document.getElementById('btn-home-open-register')?.addEventListener('click', () => openAuthModal('register'));
  document.getElementById('btn-home-open-login')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('btn-home-open-profile')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('btn-home-logout')?.addEventListener('click', async () => {
    try {
      await syncStudyTimeToCloud(false);
      await signOut(auth);
    } catch {
      // Graceful signout catch
    }
  });

  // Close modal
  closeBtn?.addEventListener('click', () => {
    modalRoot?.classList.add('hidden');
  });

  modalRoot?.addEventListener('click', (e) => {
    if (e.target === modalRoot) {
      modalRoot.classList.add('hidden');
    }
  });

  // Switch tabs
  const tabLogin = document.getElementById('tab-auth-login');
  const tabRegister = document.getElementById('tab-auth-register');
  tabLogin?.addEventListener('click', () => switchToTab('login'));
  tabRegister?.addEventListener('click', () => switchToTab('register'));

  // Show forgot password form
  const btnShowForgot = document.getElementById('btn-show-forgot');
  btnShowForgot?.addEventListener('click', () => {
    clearFeedback();
    document.getElementById('form-login')?.classList.add('hidden');
    document.getElementById('form-register')?.classList.add('hidden');
    document.getElementById('form-forgot')?.classList.remove('hidden');
  });

  // Back to login form from forgot password
  const btnBackLogin = document.getElementById('btn-back-to-login');
  btnBackLogin?.addEventListener('click', () => {
    clearFeedback();
    document.getElementById('form-forgot')?.classList.add('hidden');
    document.getElementById('form-login')?.classList.remove('hidden');
  });

  // Submit Login
  document.getElementById('form-login')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFeedback();
    const email = (document.getElementById('login-email') as HTMLInputElement).value.trim();
    const password = (document.getElementById('login-password') as HTMLInputElement).value;
    const submitBtn = document.getElementById('btn-submit-login') as HTMLButtonElement;

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Giriş yapılıyor...';
      await signInWithEmailAndPassword(auth, email, password);
      modalRoot?.classList.add('hidden');
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      // If admin account was previously created with Google Sign-In only, sign in via Google and link password automatically
      if (
        email.toLowerCase() === ADMIN_EMAIL.toLowerCase() &&
        (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found')
      ) {
        try {
          googleProvider.setCustomParameters({ login_hint: ADMIN_EMAIL });
          const gCred = await signInWithPopup(auth, googleProvider);
          if (gCred.user && password.length >= 6) {
            try {
              const emailCred = EmailAuthProvider.credential(email, password);
              await linkWithCredential(gCred.user, emailCred);
            } catch {
              // Ignore if already linked
            }
          }
          modalRoot?.classList.add('hidden');
          return;
        } catch {
          // Fall through to standard message
        }
      }
      console.error('Login error:', error);
      let msg = 'Giriş yapılamadı. Lütfen e-posta ve şifrenizi kontrol ediniz.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        msg = 'Hatalı e-posta veya şifre girdiniz (Google ile kayıt olduysanız alttaki "Google ile Hızlı Giriş" butonunu kullanabilirsiniz).';
      } else if (error.code === 'auth/operation-not-allowed') {
        msg = 'Firebase projenizde E-posta/Şifre sağlayıcısı henüz aktif edilmemiş. Lütfen alttaki "Google ile Hızlı Giriş" seçeneğini kullanınız.';
      }
      showFeedback(msg, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Giriş Yap';
    }
  });

  // Submit Register
  document.getElementById('form-register')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFeedback();
    const name = (document.getElementById('reg-name') as HTMLInputElement).value.trim();
    const email = (document.getElementById('reg-email') as HTMLInputElement).value.trim();
    const password = (document.getElementById('reg-password') as HTMLInputElement).value;
    const submitBtn = document.getElementById('btn-submit-register') as HTMLButtonElement;

    if (password.length < 6) {
      showFeedback('Şifreniz en az 6 karakter olmalıdır.', true);
      return;
    }

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Hesap oluşturuluyor...';
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      if (name) {
        try {
          await updateProfile(userCred.user, { displayName: name });
        } catch {
          // ignore
        }
      }

      const finalName = name || (email.includes('@') ? email.split('@')[0] : 'Öğrenci');
      const profileData: UserProfileData = {
        userId: userCred.user.uid,
        email: email,
        displayName: finalName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        studySeconds: 0,
        lastActiveAt: new Date().toISOString(),
        isOnline: true,
      };

      try {
        const userDocRef = doc(db, 'users', userCred.user.uid);
        await setDoc(userDocRef, profileData, { merge: true });
      } catch {
        // Handled
      }

      saveUserToLocalRegistry(profileData);
      modalRoot?.classList.add('hidden');
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error('Registration error:', error);
      let msg = 'Kayıt oluşturulurken bir hata oluştu.';
      if (error.code === 'auth/email-already-in-use') {
        msg = 'Bu e-posta adresiyle kayıtlı bir hesap zaten var. Giriş yapmayı deneyebilirsiniz.';
      } else if (error.code === 'auth/invalid-email') {
        msg = 'Geçersiz bir e-posta adresi girdiniz.';
      } else if (error.code === 'auth/operation-not-allowed') {
        msg = 'Firebase projenizde E-posta sağlayıcısı henüz aktif edilmemiş. Hemen "Google ile Hızlı Giriş" yapabilir veya Firebase Console\'dan Email/Password sağlayıcısını açabilirsiniz.';
      }
      showFeedback(msg, true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Hesap Oluştur ve Başla';
    }
  });

  // Submit Forgot Password
  document.getElementById('form-forgot')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearFeedback();
    const email = (document.getElementById('forgot-email') as HTMLInputElement).value.trim();
    const submitBtn = document.getElementById('btn-submit-forgot') as HTMLButtonElement;

    try {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Gönderiliyor...';
      await sendPasswordResetEmail(auth, email);
      showFeedback('✅ Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Lütfen gelen kutunuzu kontrol ediniz.', false);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error('Forgot error:', error);
      showFeedback('E-posta gönderilemedi. Lütfen adresi doğru girdiğinizden emin olunuz.', true);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Şifre Sıfırlama E-postası Gönder';
    }
  });

  // Google Login
  document.getElementById('btn-google-login')?.addEventListener('click', async () => {
    clearFeedback();
    try {
      await signInWithPopup(auth, googleProvider);
      modalRoot?.classList.add('hidden');
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      console.error('Google sign-in error:', error);
      if (error.code !== 'auth/popup-closed-by-user') {
        showFeedback('Google ile giriş yapılırken bir sorun oluştu.', true);
      }
    }
  });

  // Send Reset from Profile
  document.getElementById('btn-send-reset-from-profile')?.addEventListener('click', async () => {
    if (auth.currentUser && auth.currentUser.email) {
      try {
        await sendPasswordResetEmail(auth, auth.currentUser.email);
        const toast = getToastFunction();
        if (toast) toast('Şifre sıfırlama e-postası gönderildi.');
        modalRoot?.classList.add('hidden');
      } catch (err) {
        console.error(err);
      }
    }
  });

  // Logout
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    try {
      await syncStudyTimeToCloud(false);
      await signOut(auth);
      modalRoot?.classList.add('hidden');
    } catch (err) {
      console.error('Logout error:', err);
    }
  });

  // Admin Nav Trigger Button
  document.getElementById('btn-admin-nav')?.addEventListener('click', () => {
    const app = (window as unknown as { d3k1App?: { showAdminScreen: () => void } }).d3k1App;
    if (app && typeof app.showAdminScreen === 'function') {
      app.showAdminScreen();
    }
  });

  // Profile modal: Go to Admin
  document.getElementById('btn-profile-go-admin')?.addEventListener('click', () => {
    modalRoot?.classList.add('hidden');
    const app = (window as unknown as { d3k1App?: { showAdminScreen: () => void } }).d3k1App;
    if (app && typeof app.showAdminScreen === 'function') {
      app.showAdminScreen();
    }
  });


  // Modal: Open Admin View Directly (Read-Only)
  document.getElementById('btn-admin-modal-view')?.addEventListener('click', () => {
    modalRoot?.classList.add('hidden');
    const app = (window as unknown as { d3k1App?: { showAdminScreen: () => void } }).d3k1App;
    if (app && typeof app.showAdminScreen === 'function') {
      app.showAdminScreen();
    }
  });
}

// Auto-initialize when script loads
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initAuthUI());
  } else {
    initAuthUI();
  }
}
