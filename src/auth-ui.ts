import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  onAuthStateChanged,
  User,
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
} from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase.ts';

// User profile interface matching firebase-blueprint.json
interface UserProfileData {
  userId: string;
  email: string;
  displayName?: string;
  createdAt?: string;
  updatedAt?: string;
}

let hadPreviousUser = false;

export function initAuthUI(): void {
  // Inject Auth Modal HTML into DOM if not present
  if (!document.getElementById('auth-modal-root')) {
    injectAuthModalDOM();
  }

  // Setup Event Listeners
  setupAuthEventListeners();

  // Listen to Auth state changes
  onAuthStateChanged(auth, async (user) => {
    updateHeaderUserUI(user);
    updateHomeBannerUI(user);

    if (user) {
      hadPreviousUser = true;
      await onUserSignedIn(user);
    } else {
      if (hadPreviousUser) {
        onUserSignedOut();
      }
      hadPreviousUser = false;
    }
  });

  // Listen to local progress saves to sync to cloud
  window.addEventListener('d3k1-save-progress', ((e: CustomEvent) => {
    if (auth.currentUser) {
      syncProgressToCloud(auth.currentUser, e.detail?.favorites);
    }
  }) as EventListener);
}

function updateHeaderUserUI(user: User | null): void {
  const triggerBtn = document.getElementById('btn-auth-trigger');
  const btnIcon = document.getElementById('auth-btn-icon');
  const btnText = document.getElementById('auth-btn-text');

  if (!triggerBtn || !btnText || !btnIcon) return;

  if (user) {
    const name = user.displayName || user.email?.split('@')[0] || 'Kullanıcı';
    btnIcon.textContent = '✅';
    btnText.textContent = name.length > 10 ? name.substring(0, 9) + '..' : name;
    triggerBtn.className =
      'px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-600 hover:bg-emerald-700 text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition-all shrink-0';
    triggerBtn.title = `Giriş yapıldı: ${user.email} (Hesap Detayları İçin Tıklayın)`;
  } else {
    btnIcon.textContent = '👤';
    btnText.textContent = 'Giriş Yap / Kayıt';
    triggerBtn.className =
      'px-3 py-1.5 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-sm flex items-center gap-1.5 transition-all shrink-0';
    triggerBtn.title = 'Kullanıcı Girişi / E-posta ile Kayıt Ol';
  }
}

function updateHomeBannerUI(user: User | null): void {
  const loggedOutBanner = document.getElementById('home-auth-logged-out');
  const loggedInBanner = document.getElementById('home-auth-logged-in');
  const userNameEl = document.getElementById('home-user-name');
  const userEmailEl = document.getElementById('home-user-email');

  if (!loggedOutBanner || !loggedInBanner) return;

  if (user) {
    loggedOutBanner.classList.add('hidden');
    loggedInBanner.classList.remove('hidden');
    if (userNameEl) userNameEl.textContent = user.displayName || user.email?.split('@')[0] || 'Öğrenci';
    if (userEmailEl) userEmailEl.textContent = user.email || '';
  } else {
    loggedOutBanner.classList.remove('hidden');
    loggedInBanner.classList.add('hidden');
  }
}

async function onUserSignedIn(user: User): Promise<void> {
  const toast = getToastFunction();
  if (toast) {
    toast(`👋 Hoş geldiniz, ${user.displayName || user.email}!`);
  }

  // 1. Sync / Save user profile to Firestore
  try {
    const userDocRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userDocRef);
    if (!snap.exists()) {
      const newProfile: UserProfileData = {
        userId: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.email?.split('@')[0] || 'Öğrenci',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, newProfile);
    }
  } catch (error) {
    console.warn('User profile sync notice:', error);
  }

  // 2. Load cloud bookmarks into local state
  await loadCloudBookmarks(user);
}

function onUserSignedOut(): void {
  const toast = getToastFunction();
  if (toast) {
    toast('Oturum kapatıldı.');
  }
}

async function loadCloudBookmarks(user: User): Promise<void> {
  try {
    const bookmarksRef = collection(db, 'users', user.uid, 'bookmarks');
    const snap = await getDocs(bookmarksRef);
    const cloudFavs: string[] = [];
    snap.forEach((d) => {
      const data = d.data();
      if (data.questionId) cloudFavs.push(data.questionId);
    });

    const app = (window as unknown as { d3k1App?: { state: { favorites: Set<string> }; saveUserProgress: () => void; updateHeaderScores: () => void } }).d3k1App;
    if (app && app.state) {
      let mergedCount = 0;
      cloudFavs.forEach((qid) => {
        if (!app.state.favorites.has(qid)) {
          app.state.favorites.add(qid);
          mergedCount++;
        }
      });
      if (mergedCount > 0) {
        app.saveUserProgress();
        app.updateHeaderScores();
        const toast = getToastFunction();
        if (toast) toast(`☁️ Buluttan ${mergedCount} favori soru senkronize edildi!`);
      }
    }
  } catch (error) {
    console.warn('Failed to load cloud bookmarks:', error);
  }
}

let syncTimeout: number | null = null;
function syncProgressToCloud(user: User, favs?: string[]): void {
  if (syncTimeout) window.clearTimeout(syncTimeout);

  syncTimeout = window.setTimeout(async () => {
    try {
      if (favs && Array.isArray(favs)) {
        // Sync up to 200 bookmarks to avoid batch limit
        for (const qid of favs.slice(0, 200)) {
          const sanitizedId = String(qid).replace(/[^a-zA-Z0-9_-]/g, '_');
          if (!sanitizedId) continue;
          const bmRef = doc(db, 'users', user.uid, 'bookmarks', sanitizedId);
          await setDoc(bmRef, {
            userId: user.uid,
            questionId: String(qid),
            createdAt: new Date().toISOString(),
          }, { merge: true });
        }
      }

      // Update user doc with counts
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      const syncBadge = document.getElementById('cloud-sync-status');
      if (syncBadge) {
        syncBadge.textContent = '🟢 Senkronize Edildi';
      }
    } catch (err) {
      console.warn('Sync to cloud notice:', err);
    }
  }, 1200);
}

function getToastFunction(): ((msg: string) => void) | null {
  const app = (window as unknown as { d3k1App?: { showToast: (msg: string) => void } }).d3k1App;
  if (app && typeof app.showToast === 'function') {
    return app.showToast;
  }
  return null;
}

function openAuthModal(defaultTab: 'login' | 'register' = 'login'): void {
  clearFeedback();
  const modalRoot = document.getElementById('auth-modal-root');
  const user = auth.currentUser;
  const formsContainer = document.getElementById('auth-forms-container');
  const profileContainer = document.getElementById('auth-profile-container');

  if (user) {
    formsContainer?.classList.add('hidden');
    profileContainer?.classList.remove('hidden');

    const nameEl = document.getElementById('profile-display-name');
    const emailEl = document.getElementById('profile-display-email');
    const favsEl = document.getElementById('profile-stat-favs');
    const ansEl = document.getElementById('profile-stat-answers');

    if (nameEl) nameEl.textContent = user.displayName || user.email?.split('@')[0] || 'Kullanıcı';
    if (emailEl) emailEl.textContent = user.email || '';

    const app = (window as unknown as { d3k1App?: { state: { favorites: Set<string>; userAnswers: Record<string, string> } } }).d3k1App;
    if (app && app.state) {
      if (favsEl) favsEl.textContent = String(app.state.favorites.size);
      if (ansEl) ansEl.textContent = String(Object.keys(app.state.userAnswers).length);
    }
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
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Ad Soyad</label>
              <input id="reg-name" type="text" required placeholder="Ahmet Yılmaz" class="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all" />
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
        </div>

        <!-- 2. PROFİL DETAYLARI GÖRÜNÜMÜ (Oturum Açıkken) -->
        <div id="auth-profile-container" class="hidden space-y-4">
          <div class="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-500 dark:text-slate-400">Giriş Yapılan Hesap</span>
              <span id="cloud-sync-status" class="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">🟢 Bulut Senkronizasyonu Aktif</span>
            </div>
            <div class="font-bold text-slate-900 dark:text-slate-100" id="profile-display-name">Ahmet Yılmaz</div>
            <div class="text-xs text-slate-600 dark:text-slate-300 font-mono" id="profile-display-email">ornek@ogrenci.edu.tr</div>
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

  // Header trigger button
  triggerBtn?.addEventListener('click', () => openAuthModal('login'));

  // Home banner buttons
  document.getElementById('btn-home-open-register')?.addEventListener('click', () => openAuthModal('register'));
  document.getElementById('btn-home-open-login')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('btn-home-open-profile')?.addEventListener('click', () => openAuthModal('login'));
  document.getElementById('btn-home-logout')?.addEventListener('click', async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn(e);
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
      console.error('Login error:', error);
      let msg = 'Giriş yapılamadı. Lütfen e-posta ve şifrenizi kontrol ediniz.';
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        msg = 'Hatalı e-posta veya şifre girdiniz.';
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
        await updateProfile(userCred.user, { displayName: name });
      }
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
      await signOut(auth);
      modalRoot?.classList.add('hidden');
    } catch (err) {
      console.error('Logout error:', err);
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
