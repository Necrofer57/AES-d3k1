// MedNot — Tıp Fakültesi Not Hesaplama Aracı
// Integrated from Necrofer57/mednot with Swiss Editorial (Light) & Midnight Focus (Dark) styling

export interface CalcSettings {
  boardCount: number;
  passingGrade: number;
  exemptionLimit: number;
  boardWeight: number;
  finalWeight: number;
}

export interface BoardGrade {
  id: number;
  name: string;
  score: number;
}

export type StatusType = 'success' | 'warning' | 'danger' | 'info';

export interface CalculationResult {
  boardAverage: number;
  finalRequired: number;
  rawFinalRequired: number;
  isExempt: boolean;
  isImpossible: boolean;
  isBarajApplied: boolean;
  isRisky: boolean;
  statusMessage: string;
  statusType: StatusType;
}

const STORAGE_KEY_SETTINGS = 'mednot_settings';
const STORAGE_KEY_GRADES = 'mednot_grades';

const DEFAULT_SETTINGS: CalcSettings = {
  boardCount: 5,
  passingGrade: 60,
  exemptionLimit: 85,
  boardWeight: 60,
  finalWeight: 40,
};

function getDefaultGrades(count: number): BoardGrade[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: idx + 1,
    name: `${idx + 1}. Kurul`,
    score: 0,
  }));
}

function loadSettings(): CalcSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SETTINGS);
    if (saved) {
      const parsed = JSON.parse(saved);
      const boardWeight = typeof parsed.boardWeight === 'number' ? Math.max(0, Math.min(100, parsed.boardWeight)) : 60;
      const finalWeight = typeof parsed.finalWeight === 'number' ? Math.max(0, Math.min(100, parsed.finalWeight)) : 100 - boardWeight;
      return {
        boardCount: Math.max(1, Math.min(10, Number(parsed.boardCount) || 5)),
        passingGrade: Math.max(0, Math.min(100, Number(parsed.passingGrade) || 60)),
        exemptionLimit: Math.max(0, Math.min(100, Number(parsed.exemptionLimit) || 85)),
        boardWeight,
        finalWeight,
      };
    }
  } catch {
    // Ignore storage errors
  }
  return { ...DEFAULT_SETTINGS };
}

function loadGrades(targetCount: number): BoardGrade[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_GRADES);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return normalizeGradesLength(parsed, targetCount);
      }
    }
  } catch {
    // Ignore storage errors
  }
  return getDefaultGrades(targetCount);
}

function normalizeGradesLength(list: BoardGrade[], targetCount: number): BoardGrade[] {
  const safeCount = Math.max(1, Math.min(10, targetCount || 1));
  if (list.length === safeCount) return list;
  if (list.length < safeCount) {
    const extra: BoardGrade[] = Array.from({ length: safeCount - list.length }, (_, idx) => ({
      id: list.length + idx + 1,
      name: `${list.length + idx + 1}. Kurul`,
      score: 0,
    }));
    return [...list, ...extra];
  }
  return list.slice(0, safeCount);
}

export function calculateResult(settings: CalcSettings, grades: BoardGrade[]): CalculationResult {
  const totalCount = settings.boardCount;
  const sum = grades.reduce((acc, curr) => acc + (Number(curr.score) || 0), 0);
  const boardAverage = totalCount > 0 ? sum / totalCount : 0;

  const boardWeightRate = (settings.boardWeight ?? 60) / 100;
  const finalWeightRate = (settings.finalWeight ?? 40) / 100;

  const rawFinalRequired =
    finalWeightRate > 0 ? (settings.passingGrade - boardAverage * boardWeightRate) / finalWeightRate : 0;

  const isExempt = boardAverage >= settings.exemptionLimit;

  let finalRequired = rawFinalRequired;
  let isBarajApplied = false;

  if (finalRequired < 50.0) {
    finalRequired = 50.0;
    isBarajApplied = true;
  }

  const isImpossible = rawFinalRequired > 100;
  const isRisky = rawFinalRequired > 80 && rawFinalRequired <= 100;

  let statusMessage = '';
  let statusType: StatusType = 'info';

  if (isExempt) {
    statusMessage = 'Tebrikler! Finalsiz geçme sınırını geçtiniz, finale girmeniz gerekmeyebilir.';
    statusType = 'success';
  } else if (isImpossible) {
    statusMessage = `Dikkat! Finalden 100+ (${rawFinalRequired.toFixed(1)}) almanız gerekiyor. Zorlu bir durum.`;
    statusType = 'danger';
  } else if (isRisky) {
    statusMessage = 'Yüksek Hedef! Yıl sonu barajını geçmek için yüksek bir final notu gerekiyor.';
    statusType = 'warning';
  } else if (isBarajApplied) {
    statusMessage = 'Ortalamanız yüksek olsa dahi tıp fakültesi mevzuatı gereği finalden en az 50.0 almalısınız.';
    statusType = 'info';
  } else {
    statusMessage = 'Barajı geçmek için gerekli minimum final notunuz hesaplandı.';
    statusType = 'info';
  }

  return {
    boardAverage,
    finalRequired,
    rawFinalRequired,
    isExempt,
    isImpossible,
    isBarajApplied,
    isRisky,
    statusMessage,
    statusType,
  };
}

let stateSettings: CalcSettings = loadSettings();
let stateGrades: BoardGrade[] = loadGrades(stateSettings.boardCount);

function persistState(): void {
  try {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(stateSettings));
    localStorage.setItem(STORAGE_KEY_GRADES, JSON.stringify(stateGrades));
  } catch {
    // Ignore storage errors
  }
}

function getScoreBadgeClasses(score: number): string {
  if (score >= 85) {
    return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  }
  if (score >= 60) {
    return 'text-indigo-700 bg-indigo-50 border-indigo-200';
  }
  if (score > 0) {
    return 'text-amber-700 bg-amber-50 border-amber-200';
  }
  return 'text-slate-500 bg-slate-50 border-slate-200';
}

function buildShellHTML(): string {
  return `
    <div class="space-y-6 pb-24 lg:pb-8">
      <!-- Üst Başlık & Geri Dön -->
      <div class="rounded-lg bg-white border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="space-y-1">
          <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.85" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><path stroke-linecap="round" d="M8 6h8M8 10h2M12 10h4M8 14h2M12 14h4M8 18h2M12 18h4"/></svg>
            <span>MedNot • Tıp Fakültesi Not Hesaplayıcı</span>
          </div>
          <h2 class="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Kurul Ortalaması &amp; Final Barajı Hesaplama</h2>
          <p class="text-xs sm:text-sm text-slate-600">
            Kurul notlarınızı girin; 50 final barajı ve finalsiz geçme sınırına göre hedef final puanınız anlık hesaplansın.
          </p>
        </div>

        <div class="flex items-center gap-2 shrink-0">
          <button id="mednot-btn-info" type="button" class="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors inline-flex items-center gap-1.5 cursor-pointer">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.85" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path stroke-linecap="round" d="M12 16v-4M12 8h.01"/></svg>
            <span>Kurallar &amp; Formül</span>
          </button>
          <button id="mednot-btn-back-home" type="button" class="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer">
            <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.85" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M19 12H5m6-6-6 6 6 6"/></svg>
            <span>Kurullara Dön</span>
          </button>
        </div>
      </div>

      <!-- 2 Sütunlu Ana Hesaplama Alanı -->
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        <!-- SOL SÜTUN: Sonuç Paneli & Sistem Ayarları -->
        <div class="lg:col-span-5 space-y-5 lg:sticky lg:top-20">

          <!-- Sonuç Kartı -->
          <div class="rounded-lg bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
            <div class="flex flex-col sm:flex-row items-center justify-between gap-5">
              <!-- Dairesel Ortalama Göstergesi -->
              <div class="flex items-center gap-4">
                <div class="relative w-24 h-24 flex items-center justify-center shrink-0">
                  <svg class="w-full h-full -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="34" class="stroke-slate-200" stroke-width="6.5" fill="transparent" />
                    <circle id="mednot-gauge-arc" cx="40" cy="40" r="34" class="stroke-indigo-600 transition-all duration-500 ease-out" stroke-width="6.5" stroke-linecap="round" fill="transparent" />
                  </svg>
                  <div class="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span id="mednot-avg-value" class="text-xl font-extrabold text-slate-900 font-mono tabular-nums">0.0</span>
                    <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ortalama</span>
                  </div>
                </div>
                <div>
                  <div class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Kurul Ortalaması</div>
                  <div id="mednot-avg-sub" class="text-sm font-bold text-slate-900 mt-0.5">%0.0 Başarı Puanı</div>
                  <div id="mednot-exempt-pill" class="hidden mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                    Finalsiz Geçtiniz
                  </div>
                </div>
              </div>

              <div class="hidden sm:block w-px h-16 bg-slate-200"></div>

              <!-- Gereken Final Hedefi -->
              <div class="flex flex-col items-center sm:items-end text-center sm:text-right">
                <div class="flex items-center gap-1.5 mb-1">
                  <span class="text-[11px] font-bold uppercase tracking-wider text-slate-500">Final Gereksinimi</span>
                  <span id="mednot-baraj-badge" class="hidden px-2 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold">Baraj 50</span>
                  <span id="mednot-impossible-badge" class="hidden px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">Zor</span>
                </div>
                <div class="flex items-baseline gap-1">
                  <span id="mednot-final-required" class="text-4xl font-extrabold font-mono tabular-nums tracking-tight text-indigo-600">50.0</span>
                  <span id="mednot-final-denom" class="text-sm font-bold text-slate-500">/ 100</span>
                </div>
                <p id="mednot-final-caption" class="text-[11px] text-slate-500 mt-1">
                  Barajı geçmek için final sınavından gereken not.
                </p>
              </div>
            </div>

            <!-- Durum Uyarı Bandı -->
            <div id="mednot-status-banner" class="p-3.5 rounded-xl border text-xs sm:text-sm font-semibold leading-relaxed bg-indigo-50 border-indigo-200 text-indigo-800">
              Barajı geçmek için gerekli minimum final notunuz hesaplandı.
            </div>
          </div>

          <!-- Sistem Ayarları Kartı -->
          <div class="rounded-lg bg-white border border-slate-200 p-5 sm:p-6 shadow-sm space-y-5">
            <div class="flex items-center justify-between pb-3 border-b border-slate-200">
              <div class="flex items-center gap-2">
                <svg class="w-4 h-4 text-indigo-600 shrink-0" fill="none" stroke="currentColor" stroke-width="1.85" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M4 21v-7m0-4V3m8 18v-9m0-4V3m8 18v-5m0-4V3M1 14h6m2-6h6m2 8h6"/></svg>
                <h3 class="text-sm sm:text-base font-bold text-slate-900">Sistem Ayarları</h3>
              </div>
              <span id="mednot-weight-pill" class="text-xs font-mono font-bold px-2.5 py-0.5 rounded-md bg-indigo-50 border border-indigo-200 text-indigo-700">
                %60 Kurul / %40 Final
              </span>
            </div>

            <!-- 3 Temel Girdi -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div class="space-y-1">
                <label for="mednot-set-count" class="block text-xs font-semibold text-slate-600">Kurul Sayısı</label>
                <div class="relative">
                  <input id="mednot-set-count" type="number" inputmode="numeric" min="1" max="10" class="w-full px-3 py-2 pr-11 text-sm font-bold rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 outline-none" />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">Adet</span>
                </div>
              </div>
              <div class="space-y-1">
                <label for="mednot-set-passing" class="block text-xs font-semibold text-slate-600">Geçme Notu</label>
                <div class="relative">
                  <input id="mednot-set-passing" type="number" inputmode="decimal" min="0" max="100" class="w-full px-3 py-2 pr-11 text-sm font-bold rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 outline-none" />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">Puan</span>
                </div>
              </div>
              <div class="space-y-1">
                <label for="mednot-set-exempt" class="block text-xs font-semibold text-slate-600">Finalsiz Sınırı</label>
                <div class="relative">
                  <input id="mednot-set-exempt" type="number" inputmode="decimal" min="0" max="100" class="w-full px-3 py-2 pr-11 text-sm font-bold rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 outline-none" />
                  <span class="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400 pointer-events-none">Puan</span>
                </div>
              </div>
            </div>

            <!-- Ağırlık Oranları -->
            <div class="pt-3 border-t border-slate-200 space-y-3">
              <div class="text-xs font-semibold text-slate-600">Kurul &amp; Final Ağırlık Oranları</div>
              <div class="grid grid-cols-3 gap-2">
                <button type="button" data-preset-bw="60" class="mednot-preset-btn py-2 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer">%60 / %40</button>
                <button type="button" data-preset-bw="50" class="mednot-preset-btn py-2 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer">%50 / %50</button>
                <button type="button" data-preset-bw="40" class="mednot-preset-btn py-2 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer">%40 / %60</button>
              </div>

              <div class="flex items-center gap-3 pt-1">
                <span class="text-xs font-semibold text-slate-500 w-10">Kurul</span>
                <input id="mednot-weight-slider" type="range" min="10" max="90" step="5" class="flex-1 accent-indigo-600 cursor-pointer" aria-label="Kurul ve Final Oranı Kaydırıcısı" />
                <span class="text-xs font-semibold text-slate-500 w-10 text-right">Final</span>
              </div>

              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1">
                  <label for="mednot-set-bw" class="block text-[11px] font-medium text-slate-500">Kurul Etkisi (%)</label>
                  <input id="mednot-set-bw" type="number" min="0" max="100" class="w-full text-center px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 outline-none" />
                </div>
                <div class="space-y-1">
                  <label for="mednot-set-fw" class="block text-[11px] font-medium text-slate-500">Final Etkisi (%)</label>
                  <input id="mednot-set-fw" type="number" min="0" max="100" class="w-full text-center px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-white text-slate-900 focus:border-indigo-500 outline-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SAĞ SÜTUN: Kurul Not Girdileri -->
        <div class="lg:col-span-7 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h3 class="text-base sm:text-lg font-bold text-slate-900 tracking-tight">Kurul Not Girdileri</h3>
              <span id="mednot-grades-count-badge" class="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-600">5 Kurul</span>
            </div>
            <button id="mednot-btn-reset" type="button" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 transition-colors cursor-pointer" title="Tüm kurul notlarını sıfırla">
              <svg class="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" stroke-width="1.85" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M3 12a9 9 0 1 0 3-6.7L3 8m0-5v5h5"/></svg>
              <span>Notları Sıfırla</span>
            </button>
          </div>

          <div id="mednot-grade-rows" class="space-y-2.5"></div>

          <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
            Notları doğrudan klavyeden yazabilir veya kaydırıcı ile anlık değiştirebilirsiniz. Ayarlarınız cihazınızda otomatik saklanır.
          </div>
        </div>
      </div>

      <!-- Mobil Yapışkan Sonuç Barı -->
      <div id="mednot-mobile-sticky" class="lg:hidden fixed bottom-3 left-3 right-3 z-30 max-w-lg mx-auto">
        <div class="rounded-xl bg-white/95 backdrop-blur border border-slate-300 p-3.5 shadow-lg flex items-center justify-between gap-3">
          <div>
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Kurul Ortalaması</div>
            <div class="flex items-center gap-1.5">
              <span id="mednot-mob-avg" class="text-lg font-extrabold font-mono text-slate-900">%0.0</span>
              <span id="mednot-mob-baraj" class="hidden text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700">Baraj 50</span>
            </div>
          </div>
          <div class="text-right">
            <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Gereken Final</div>
            <div class="flex items-baseline justify-end gap-1">
              <span id="mednot-mob-final" class="text-2xl font-extrabold font-mono text-indigo-600">50.0</span>
              <span id="mednot-mob-denom" class="text-xs font-bold text-slate-500">/100</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Bilgi & Kurallar Modalı -->
      <div id="mednot-info-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm">
        <div class="relative w-full max-w-lg bg-white border border-slate-200 rounded-lg p-6 shadow-xl space-y-4">
          <div class="flex items-center justify-between pb-3 border-b border-slate-200">
            <div>
              <h3 class="text-base font-bold text-slate-900">Bilgi &amp; Hesaplama Kuralları</h3>
              <p class="text-xs text-slate-500">MedNot Tıp Fakültesi Not Hesaplayıcı</p>
            </div>
            <button id="mednot-info-close" type="button" class="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer" aria-label="Kapat">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12"/></svg>
            </button>
          </div>

          <div class="space-y-3 text-xs text-slate-600 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
            <div class="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
              <div class="font-bold text-slate-900">Hesaplama Formülü</div>
              <div class="p-2 rounded-lg bg-white border border-slate-200 font-mono text-[11px] font-bold text-indigo-700 text-center">
                Gerekli Final = [Geçme Notu − (Kurul Ort. × Kurul Oranı)] / Final Oranı
              </div>
            </div>

            <div class="p-3.5 rounded-xl bg-indigo-50 border border-indigo-200 space-y-1">
              <div class="font-bold text-indigo-900">50 Baraj Sınırı Kuralı</div>
              <p class="text-indigo-900/80">
                Tıp fakültesi sınav yönetmelikleri gereği, kurul ortalamanız 100 dahi olsa final sınavından <strong>en az 50.0</strong> almanız zorunludur. Hesaplanan değer 50'den düşük çıksa bile sistem 50.0 barajını otomatik uygular.
              </p>
            </div>

            <div class="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 space-y-1">
              <div class="font-bold text-emerald-900">Finalsiz Geçme Şartı</div>
              <p class="text-emerald-900/80">
                Kurul ortalamanız belirlenen Finalsiz Sınırına (varsayılan 85.0) ulaştığında veya geçtiğinde finale girmeden doğrudan geçmiş sayılırsınız (<strong>FİNALSIZ</strong>).
              </p>
            </div>
          </div>

          <button id="mednot-info-ok" type="button" class="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors cursor-pointer">
            Anlaşıldı
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderGradeRows(): void {
  const container = document.getElementById('mednot-grade-rows');
  if (!container) return;

  container.innerHTML = stateGrades
    .map((g) => {
      const scoreVal = g.score === 0 ? '' : String(g.score);
      const badgeCls = getScoreBadgeClasses(g.score);
      return `
        <div class="rounded-xl bg-white border border-slate-200 p-3.5 sm:p-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4 transition-colors hover:border-indigo-300" data-grade-row="${g.id}">
          <div class="flex items-center gap-3 w-full sm:w-28 shrink-0">
            <div class="w-8 h-8 shrink-0 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 font-mono font-bold text-xs flex items-center justify-center">
              ${g.id}
            </div>
            <span class="font-bold text-sm text-slate-900">${g.name}</span>
          </div>

          <div class="flex-1 w-full flex items-center gap-3">
            <span class="text-[11px] font-mono text-slate-400 w-4 text-right">0</span>
            <input type="range" min="0" max="100" step="1" value="${g.score}" data-grade-slider="${g.id}" class="flex-1 accent-indigo-600 cursor-pointer" aria-label="${g.name} Notu Kaydırıcı" />
            <span class="text-[11px] font-mono text-slate-400 w-6">100</span>
          </div>

          <div class="w-full sm:w-20 shrink-0">
            <input type="number" inputmode="decimal" min="0" max="100" placeholder="0" value="${scoreVal}" data-grade-input="${g.id}" class="w-full text-center font-mono font-extrabold text-sm rounded-xl px-2 py-2 border outline-none focus:ring-2 focus:ring-indigo-200 ${badgeCls}" aria-label="${g.name} Notu" />
          </div>
        </div>
      `;
    })
    .join('');

  container.querySelectorAll<HTMLInputElement>('[data-grade-slider]').forEach((slider) => {
    slider.addEventListener('input', () => {
      const id = Number(slider.getAttribute('data-grade-slider'));
      const val = Math.max(0, Math.min(100, parseFloat(slider.value) || 0));
      updateGradeScore(id, val, 'slider');
    });
  });

  container.querySelectorAll<HTMLInputElement>('[data-grade-input]').forEach((input) => {
    input.addEventListener('input', () => {
      const id = Number(input.getAttribute('data-grade-input'));
      const raw = input.value === '' ? 0 : parseFloat(input.value);
      const val = Math.max(0, Math.min(100, isNaN(raw) ? 0 : raw));
      updateGradeScore(id, val, 'input');
    });
  });
}

function updateGradeScore(id: number, score: number, source: 'slider' | 'input'): void {
  stateGrades = stateGrades.map((g) => (g.id === id ? { ...g, score } : g));
  persistState();

  const row = document.querySelector(`[data-grade-row="${id}"]`);
  if (row) {
    const slider = row.querySelector<HTMLInputElement>(`[data-grade-slider="${id}"]`);
    const input = row.querySelector<HTMLInputElement>(`[data-grade-input="${id}"]`);
    if (source === 'input' && slider) {
      slider.value = String(score);
    }
    if (source === 'slider' && input) {
      input.value = score === 0 ? '' : String(score);
    }
    if (input) {
      input.className = `w-full text-center font-mono font-extrabold text-sm rounded-xl px-2 py-2 border outline-none focus:ring-2 focus:ring-indigo-200 ${getScoreBadgeClasses(score)}`;
    }
  }

  updateDashboardAndSettingsUI();
}

function updateDashboardAndSettingsUI(): void {
  const res = calculateResult(stateSettings, stateGrades);

  // Gauge
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(100, Math.max(0, res.boardAverage)) / 100) * circumference;
  const arc = document.getElementById('mednot-gauge-arc');
  if (arc) {
    arc.setAttribute('stroke-dasharray', String(circumference));
    arc.setAttribute('stroke-dashoffset', String(offset));
  }

  const avgEl = document.getElementById('mednot-avg-value');
  if (avgEl) avgEl.textContent = res.boardAverage.toFixed(1);

  const avgSub = document.getElementById('mednot-avg-sub');
  if (avgSub) avgSub.textContent = `%${res.boardAverage.toFixed(1)} Başarı Puanı`;

  document.getElementById('mednot-exempt-pill')?.classList.toggle('hidden', !res.isExempt);
  document.getElementById('mednot-baraj-badge')?.classList.toggle('hidden', !res.isBarajApplied || res.isExempt);
  document.getElementById('mednot-impossible-badge')?.classList.toggle('hidden', !res.isImpossible);

  const finalEl = document.getElementById('mednot-final-required');
  const denomEl = document.getElementById('mednot-final-denom');
  const capEl = document.getElementById('mednot-final-caption');

  const scoreColorClass = res.isExempt
    ? 'text-emerald-600'
    : res.isImpossible
      ? 'text-rose-600'
      : res.isRisky
        ? 'text-amber-600'
        : 'text-indigo-600';

  if (finalEl) {
    finalEl.textContent = res.isExempt ? 'FİNALSIZ' : res.finalRequired.toFixed(1);
    finalEl.className = `text-4xl font-extrabold font-mono tabular-nums tracking-tight ${scoreColorClass}`;
  }
  if (denomEl) denomEl.classList.toggle('hidden', res.isExempt);
  if (capEl) {
    capEl.textContent = res.isExempt
      ? 'Finalsiz geçme hakkı kazanılmıştır.'
      : 'Barajı geçmek için final sınavından gereken not.';
  }

  // Banner
  const banner = document.getElementById('mednot-status-banner');
  if (banner) {
    banner.textContent = res.statusMessage;
    const bannerPalette =
      res.statusType === 'success'
        ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
        : res.statusType === 'danger'
          ? 'bg-rose-50 border-rose-200 text-rose-800'
          : res.statusType === 'warning'
            ? 'bg-amber-50 border-amber-200 text-amber-800'
            : 'bg-indigo-50 border-indigo-200 text-indigo-800';
    banner.className = `p-3.5 rounded-xl border text-xs sm:text-sm font-semibold leading-relaxed ${bannerPalette}`;
  }

  // Mobile sticky bar
  const mobAvg = document.getElementById('mednot-mob-avg');
  if (mobAvg) mobAvg.textContent = `%${res.boardAverage.toFixed(1)}`;
  document.getElementById('mednot-mob-baraj')?.classList.toggle('hidden', !res.isBarajApplied || res.isExempt);
  const mobFinal = document.getElementById('mednot-mob-final');
  if (mobFinal) {
    mobFinal.textContent = res.isExempt ? 'FİNALSIZ' : res.finalRequired.toFixed(1);
    mobFinal.className = `text-2xl font-extrabold font-mono ${scoreColorClass}`;
  }
  document.getElementById('mednot-mob-denom')?.classList.toggle('hidden', res.isExempt);

  // Settings readouts
  const weightPill = document.getElementById('mednot-weight-pill');
  if (weightPill) weightPill.textContent = `%${stateSettings.boardWeight} Kurul / %${stateSettings.finalWeight} Final`;

  const countBadge = document.getElementById('mednot-grades-count-badge');
  if (countBadge) countBadge.textContent = `${stateGrades.length} Kurul`;

  const bwSlider = document.getElementById('mednot-weight-slider') as HTMLInputElement | null;
  if (bwSlider) bwSlider.value = String(stateSettings.boardWeight);

  const bwInput = document.getElementById('mednot-set-bw') as HTMLInputElement | null;
  if (bwInput && document.activeElement !== bwInput) bwInput.value = String(stateSettings.boardWeight);

  const fwInput = document.getElementById('mednot-set-fw') as HTMLInputElement | null;
  if (fwInput && document.activeElement !== fwInput) fwInput.value = String(stateSettings.finalWeight);

  document.querySelectorAll<HTMLButtonElement>('.mednot-preset-btn').forEach((btn) => {
    const presetBw = Number(btn.getAttribute('data-preset-bw'));
    const active = stateSettings.boardWeight === presetBw && stateSettings.finalWeight === 100 - presetBw;
    btn.className = active
      ? 'mednot-preset-btn py-2 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer bg-indigo-600 text-white border-indigo-600'
      : 'mednot-preset-btn py-2 px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200';
  });
}

function bindEvents(): void {
  const countInput = document.getElementById('mednot-set-count') as HTMLInputElement | null;
  const passInput = document.getElementById('mednot-set-passing') as HTMLInputElement | null;
  const exemptInput = document.getElementById('mednot-set-exempt') as HTMLInputElement | null;
  const bwSlider = document.getElementById('mednot-weight-slider') as HTMLInputElement | null;
  const bwInput = document.getElementById('mednot-set-bw') as HTMLInputElement | null;
  const fwInput = document.getElementById('mednot-set-fw') as HTMLInputElement | null;

  if (countInput) {
    countInput.value = String(stateSettings.boardCount);
    countInput.addEventListener('input', () => {
      const val = parseInt(countInput.value, 10);
      if (isNaN(val) || val < 1) return;
      const clamped = Math.max(1, Math.min(10, val));
      stateSettings.boardCount = clamped;
      stateGrades = normalizeGradesLength(stateGrades, clamped);
      persistState();
      renderGradeRows();
      updateDashboardAndSettingsUI();
    });
  }

  if (passInput) {
    passInput.value = String(stateSettings.passingGrade);
    passInput.addEventListener('input', () => {
      const val = passInput.value === '' ? 0 : parseFloat(passInput.value);
      stateSettings.passingGrade = Math.max(0, Math.min(100, isNaN(val) ? 0 : val));
      persistState();
      updateDashboardAndSettingsUI();
    });
  }

  if (exemptInput) {
    exemptInput.value = String(stateSettings.exemptionLimit);
    exemptInput.addEventListener('input', () => {
      const val = exemptInput.value === '' ? 0 : parseFloat(exemptInput.value);
      stateSettings.exemptionLimit = Math.max(0, Math.min(100, isNaN(val) ? 0 : val));
      persistState();
      updateDashboardAndSettingsUI();
    });
  }

  const applyBoardWeight = (bw: number) => {
    const clamped = Math.max(0, Math.min(100, isNaN(bw) ? 0 : bw));
    stateSettings.boardWeight = clamped;
    stateSettings.finalWeight = 100 - clamped;
    persistState();
    updateDashboardAndSettingsUI();
  };

  document.querySelectorAll<HTMLButtonElement>('.mednot-preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      applyBoardWeight(Number(btn.getAttribute('data-preset-bw')));
    });
  });

  bwSlider?.addEventListener('input', () => applyBoardWeight(parseInt(bwSlider.value, 10)));
  bwInput?.addEventListener('input', () => applyBoardWeight(parseInt(bwInput.value, 10)));
  fwInput?.addEventListener('input', () => {
    const fw = Math.max(0, Math.min(100, parseInt(fwInput.value, 10) || 0));
    stateSettings.finalWeight = fw;
    stateSettings.boardWeight = 100 - fw;
    persistState();
    updateDashboardAndSettingsUI();
  });

  document.getElementById('mednot-btn-reset')?.addEventListener('click', () => {
    stateGrades = stateGrades.map((g) => ({ ...g, score: 0 }));
    persistState();
    renderGradeRows();
    updateDashboardAndSettingsUI();
  });

  document.getElementById('mednot-btn-back-home')?.addEventListener('click', () => {
    const app = (window as unknown as { d3k1App?: { showHomeScreen?: () => void } }).d3k1App;
    app?.showHomeScreen?.();
  });

  // Info modal
  const infoModal = document.getElementById('mednot-info-modal');
  document.getElementById('mednot-btn-info')?.addEventListener('click', () => infoModal?.classList.remove('hidden'));
  document.getElementById('mednot-info-close')?.addEventListener('click', () => infoModal?.classList.add('hidden'));
  document.getElementById('mednot-info-ok')?.addEventListener('click', () => infoModal?.classList.add('hidden'));
  infoModal?.addEventListener('click', (e) => {
    if (e.target === infoModal) infoModal.classList.add('hidden');
  });
}

export function initMedNotCalculator(): void {
  const root = document.getElementById('calculator-screen-root');
  if (!root || root.dataset.initialized === 'true') return;
  root.dataset.initialized = 'true';

  root.innerHTML = buildShellHTML();
  renderGradeRows();
  bindEvents();
  updateDashboardAndSettingsUI();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => initMedNotCalculator());
  } else {
    initMedNotCalculator();
  }
}
