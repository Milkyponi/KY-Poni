/**
 * KY-Poni - Dashboard Client Logic
 * Live Customization (Scale, Font Size, Font Family, Text Color)
 * & User Preferences Persistence (/api/config)
 */

/**
 * Escape teks sebelum dimasukkan ke template HTML.
 *
 * Dashboard banyak memakai innerHTML untuk membangun kartu tema. Data seperti
 * `name`, `tags`, dan `downloadUrl` berasal dari katalog (remote atau berkas
 * lokal yang bisa ditambahkan user), jadi tidak boleh dipercaya. Tanpa escape,
 * nama tema berisi `<img onerror=...>` akan dieksekusi di dashboard.
 */
function escapeHtml(value) {
  return String(value === undefined || value === null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape untuk nilai yang masuk ke atribut JS inline, mis.
 *   onclick="installTheme('${escapeJsAttr(t.id)}', this)"
 *
 * Nilai berada di dalam string berkutip TUNGGAL di dalam atribut HTML berkutip
 * ganda. Jadi yang harus di-escape adalah:
 *   1. backslash (agar tidak jadi escape sequence)
 *   2. kutip tunggal (agar tidak menutup string JS)
 *   3. karakter HTML & < > " (agar tidak menutup atribut)
 *
 * JANGAN memakai JSON.stringify di sini: hasilnya menambahkan kutip ganda sendiri
 * sehingga `installTheme('"undertale"', ...)` — id menjadi `"undertale"` dan
 * gagal validasi isValidThemeId. Pemasangan tema jadi selalu gagal.
 */
function escapeJsAttr(value) {
  const s = String(value === undefined || value === null ? '' : value);
  return s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const selectTheme = document.getElementById('select-theme');
const selectLayout = document.getElementById('select-layout');
const inputFade = document.getElementById('input-fade');
const selectKeep = document.getElementById('select-keep');
const selectTransition = document.getElementById('select-transition');
const obsUrlInput = document.getElementById('obs-url');
const btnCopyUrl = document.getElementById('btn-copy-url');
const previewFrame = document.getElementById('preview-frame');
const previewWrapper = document.getElementById('preview-wrapper');
const previewResolution = document.getElementById('preview-resolution');

/**
 * URL OBS statis — satu-satunya string yang perlu ditempel pengguna ke Browser Source,
 * dan tidak pernah berubah saat tema atau preferensi diganti.
 *
 * Diturunkan dari origin halaman ini (bukan hardcode) supaya tetap benar bila port
 * diubah lewat env PORT. Nilainya stabil untuk satu instalasi, karena port aplikasi
 * tidak berubah selama masa pakai.
 */
const STATIC_OVERLAY_URL = `${window.location.origin}/overlay`;

// Customization Controls
const inputScale = document.getElementById('input-scale');
const labelScaleVal = document.getElementById('label-scale-val');
const labelFsizeVal = document.getElementById('label-fsize-val');
const selectFont = document.getElementById('select-font');
const inputColor = document.getElementById('input-color');
const inputColorHex = document.getElementById('input-color-hex');

const FONT_SIZE_PRESETS = [
  { value: 14, label: 'Small' },
  { value: 16, label: 'Medium' },
  { value: 20, label: 'Large' },
];

function snapFontSizePreset(rawSize) {
  const n = Number(rawSize);
  if (!Number.isFinite(n) || n <= 0) return 16;
  if (n <= 14) return 14;
  if (n <= 17) return 16;
  return 20;
}

function fontSizePresetLabel(px) {
  const found = FONT_SIZE_PRESETS.find(p => p.value === px);
  return found ? `${found.label} (${found.value}px)` : `${px}px`;
}

const ytTargetInput = document.getElementById('yt-target');
const btnConnect = document.getElementById('btn-connect');
// Markup asli tombol Connect (SVG + label) disimpan sekali supaya status sementara
// ("Menghubungkan...") bisa dipulihkan tanpa menduplikasi markup di dua tempat.
const CONNECT_DEFAULT_HTML = btnConnect ? btnConnect.innerHTML : '';
const btnDisconnect = document.getElementById('btn-disconnect');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const streamInfo = document.getElementById('stream-info');
const infoLiveId = document.getElementById('info-liveid');
const infoMsgCount = document.getElementById('info-msgcount');

// Channel Profile UI Elements
const ytProfileView = document.getElementById('yt-profile-view');
const ytInputView = document.getElementById('yt-input-view');
const profileAvatar = document.getElementById('profile-avatar');
const profileAvatarStatus = document.getElementById('profile-avatar-status');
const profileTitle = document.getElementById('profile-title');
const profileHandle = document.getElementById('profile-handle');
const profileChannelBadge = document.getElementById('profile-channel-badge');
const btnEditTarget = document.getElementById('btn-edit-target');
const btnCancelEdit = document.getElementById('btn-cancel-edit');

let currentChannelProfile = null;

// UI edit lock.
//
// Background heartbeats (`pollStatus()` every 5s and the SYSTEM_STATUS WebSocket message)
// both call applyStreamStatus(), which re-renders the channel profile card. Without a lock
// that re-render fires 1-5s after the user clicks "Ganti" and force-closes the input form,
// throwing away whatever they were typing. While this flag is true the background status
// feed may still update badges/dots/liveId, but it must not touch the profile/input layout.
let isEditingTarget = false;

// Channel Profile UI Helpers
function renderChannelProfile(profile, targetFallback = '') {
  // Rendering the card is the deliberate end of edit mode (boot, connect, cancel).
  isEditingTarget = false;
  const target = targetFallback || (ytTargetInput ? ytTargetInput.value.trim() : '');
  const title = (profile && profile.title) || target || 'YouTube Channel';
  const handle = (profile && profile.handle) || target || '';
  const avatar = (profile && profile.avatar) || '';

  if (profileTitle) profileTitle.textContent = title;
  if (profileHandle) profileHandle.textContent = handle;
  if (profileAvatar) {
    if (avatar) {
      profileAvatar.src = avatar;
    } else {
      profileAvatar.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='44' height='44' viewBox='0 0 24 24' fill='%23888'><circle cx='12' cy='8' r='4'/><path d='M12 14c-6.1 0-8 4-8 4v2h16v-2s-1.9-4-8-4z'/></svg>";
    }
  }

  if (ytProfileView) ytProfileView.style.display = 'block';
  if (ytInputView) ytInputView.style.display = 'none';
  if (profileChannelBadge) profileChannelBadge.style.display = 'inline-block';
}

/**
 * Shows the handle input form.
 *
 * @param {boolean} allowCancel  whether the "Batal" button is offered
 * @param {boolean} markEditing  raise the edit lock so the background status feed cannot
 *                               steal the form back. Boot passes false: an empty form is
 *                               just the resting state there, and a later autoconnect
 *                               SYSTEM_STATUS must still be allowed to paint the card.
 */
function showTargetInputForm(allowCancel = true, markEditing = true) {
  // Kunci dulu sebelum menyentuh DOM: heartbeat bisa mendarat di antara dua baris ini.
  if (markEditing) isEditingTarget = true;
  if (ytProfileView) ytProfileView.style.display = 'none';
  if (ytInputView) ytInputView.style.display = 'block';
  if (btnCancelEdit) btnCancelEdit.style.display = (allowCancel && currentChannelProfile) ? 'inline-flex' : 'none';
  if (ytTargetInput) ytTargetInput.focus();
}

if (btnEditTarget) {
  btnEditTarget.addEventListener('click', () => {
    showTargetInputForm(true);
  });
}

if (btnCancelEdit) {
  btnCancelEdit.addEventListener('click', () => {
    isEditingTarget = false;
    if (currentChannelProfile) {
      renderChannelProfile(currentChannelProfile, ytTargetInput ? ytTargetInput.value.trim() : '');
    } else {
      // Tidak ada profil tersimpan: keluar dari mode edit tanpa mengklaim ada kartu profil.
      renderChannelProfile(null, ytTargetInput ? ytTargetInput.value.trim() : '');
    }
  });
}

let currentPos = 'bottom-left';
let currentFontSize = 16;
let saveConfigTimeout = null;

function setFontSizeUI(rawSize) {
  currentFontSize = snapFontSizePreset(rawSize);
  if (labelFsizeVal) labelFsizeVal.textContent = fontSizePresetLabel(currentFontSize);
  document.querySelectorAll('#fsize-selector .btn-fsize').forEach(b => {
    b.classList.toggle('active', Number(b.getAttribute('data-fsize')) === currentFontSize);
  });
}

// Boot guard: never persist during initial load. Only real user interaction may write.
let isBootstrapping = true;

// Handle Position Selector Buttons
document.querySelectorAll('#position-selector .btn-pos').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#position-selector .btn-pos').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPos = btn.getAttribute('data-pos') || 'bottom-left';
    updateOverlayParams();
  });
});

// Handle Font Size Preset Buttons (Small / Medium / Large)
document.querySelectorAll('#fsize-selector .btn-fsize').forEach(btn => {
  btn.addEventListener('click', () => {
    setFontSizeUI(btn.getAttribute('data-fsize'));
    updateOverlayParams();
  });
});

// Sync Range Sliders & Value Labels
if (inputScale) {
  inputScale.addEventListener('input', () => {
    if (labelScaleVal) labelScaleVal.textContent = `${inputScale.value}%`;
    updateOverlayParams();
  });
}

if (selectFont) {
  selectFont.addEventListener('change', updateOverlayParams);
}

// Color Picker & Hex Input Sync
if (inputColor && inputColorHex) {
  inputColor.addEventListener('input', () => {
    inputColorHex.value = inputColor.value.toUpperCase();
    updateOverlayParams();
  });

  inputColorHex.addEventListener('input', () => {
    let val = inputColorHex.value.trim();
    if (!val.startsWith('#')) val = `#${val}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      inputColor.value = val;
      updateOverlayParams();
    }
  });
}

// Quick Swatch Clickers
document.querySelectorAll('.btn-swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    const col = swatch.getAttribute('data-color');
    if (col && inputColor && inputColorHex) {
      inputColor.value = col;
      inputColorHex.value = col.toUpperCase();
      updateOverlayParams();
    }
  });
});

// Dynamic 1:1 Scaled Canvas Preview (1000 x 1000 px Virtual Viewport)
function updatePreviewZoom() {
  const viewport = document.querySelector('.canvas-viewport');
  if (!viewport) return;
  const rect = viewport.getBoundingClientRect();
  const pad = 32;
  const availW = Math.max(100, rect.width - pad);
  const availH = Math.max(100, rect.height - pad);
  const size = Math.min(availW, availH);
  const zoom = Math.max(0.15, Math.min(1.0, size / 1000));

  viewport.style.setProperty('--preview-zoom', zoom.toFixed(4));
  if (previewWrapper) {
    const pxSize = Math.round(1000 * zoom);
    previewWrapper.style.width = `${pxSize}px`;
    previewWrapper.style.height = `${pxSize}px`;
  }
}

// Observe canvas viewport resize for auto-fit zoom
const viewportEl = document.querySelector('.canvas-viewport');
if (viewportEl && window.ResizeObserver) {
  const ro = new ResizeObserver(() => updatePreviewZoom());
  ro.observe(viewportEl);
}
window.addEventListener('resize', updatePreviewZoom);

// ===========================================================================
// Opsi A — Studio Interaction Layer (presentational only)
// ===========================================================================
//
// Seluruh helper di blok ini SENGAJA tidak melakukan fetch/POST dan tidak pernah
// memanggil saveUserConfig(): mereka hanya membaca nilai kontrol yang sudah ada
// lalu menuliskannya ke elemen tampilan (kartu tema, toggle arah, badge anchor,
// kotak ringkasan). Persistensi tetap satu pintu lewat scheduleSave().

const POSITION_LABELS = {
  'top-left': 'Kiri Atas',
  'top-right': 'Kanan Atas',
  'bottom-left': 'Kiri Bawah',
  'bottom-right': 'Kanan Bawah',
};

const THEME_SHORT_CODES = {
  persona5: 'P5',
  persona3reload: 'P3R',
  classic: 'CL',
  undertale: 'UT',
  cyberpunk2077: 'CP',
};

const THEME_BANNER_CLASSES = {
  persona5: 'theme-banner-p5',
  persona3reload: 'theme-banner-p3r',
  classic: 'theme-banner-classic',
  undertale: 'theme-banner-undertale',
  cyberpunk2077: 'theme-banner-cyberpunk',
};

function positionLabel(pos) {
  return POSITION_LABELS[pos] || POSITION_LABELS['bottom-left'];
}

function themeShortCode(themeId) {
  const id = String(themeId || '');
  if (THEME_SHORT_CODES[id]) return THEME_SHORT_CODES[id];
  const fallback = id.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase();
  return fallback || 'TH';
}

/** Nama tema terpilih, tanpa penanda "(Kustom)" milik loadThemes(). */
function selectedThemeName() {
  if (!selectTheme) return '';
  const options = Array.from(selectTheme.options || []);
  const found = options.find(o => o && o.value === selectTheme.value);
  const raw = found ? (found.textContent || found.value || '') : '';
  const cleaned = String(raw).replace(/\(Kustom\)/i, '').replace(/\s+/g, ' ').trim();
  if (cleaned) return cleaned;
  return String(selectTheme.value || '').replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
}

/** Label pendek font aktif: "Optima Nova (Official Persona 5)" -> "Optima Nova". */
function selectedFontShortName() {
  if (!selectFont) return '';
  const options = Array.from(selectFont.options || []);
  const found = options.find(o => o && o.value === selectFont.value);
  const raw = found ? String(found.textContent || '') : '';
  const stripped = raw.split('(')[0].replace(/\s+/g, ' ').trim();
  if (stripped) return stripped;
  return String(selectFont.value || '').replace(/([a-z])([A-Z])/g, '$1 $2').trim();
}

function fadeSummaryLabel() {
  const raw = inputFade ? String(inputFade.value).trim() : '8';
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 'Auto-Hide Off';
  return `Auto-Hide ${n} dtk`;
}

function currentLayoutValue() {
  const raw = selectLayout ? String(selectLayout.value || '') : '';
  return raw.startsWith('horizontal') ? 'horizontal' : 'vertical';
}

/**
 * Menyegarkan seluruh cermin visual dari kontrol tersembunyi.
 * Dipanggil dari updateOverlayParams(), applyConfigToUI(), dan loadThemes().
 */
function syncStudioVisualControls() {
  try {
    // 1) Kartu pemilih tema (kode + nama).
    const pickerName = document.getElementById('theme-picker-name');
    if (pickerName) pickerName.textContent = selectedThemeName();
    const pickerCode = document.getElementById('theme-picker-code');
    if (pickerCode) pickerCode.textContent = themeShortCode(selectTheme ? selectTheme.value : '');

    // 2) Toggle arah aliran.
    const layout = currentLayoutValue();
    document.querySelectorAll('.btn-flow').forEach(btn => {
      if (!btn || !btn.classList) return;
      btn.classList.toggle('active', btn.getAttribute('data-layout') === layout);
    });

    // 3) Sudut overlay: label + badge di kanvas preview.
    const posLabel = positionLabel(currentPos);
    const labelPosVal = document.getElementById('label-pos-val');
    if (labelPosVal) labelPosVal.textContent = posLabel;
    const anchorBadge = document.getElementById('preview-anchor-badge');
    if (anchorBadge) anchorBadge.textContent = `Anchor: ${posLabel}`;

    // 4) Swatch warna aktif mengikuti hex yang sedang dipakai.
    const hex = String(inputColorHex && inputColorHex.value ? inputColorHex.value : '').trim().toUpperCase();
    document.querySelectorAll('.btn-swatch').forEach(swatch => {
      if (!swatch || !swatch.classList) return;
      const swatchColor = String(swatch.getAttribute('data-color') || '').trim().toUpperCase();
      swatch.classList.toggle('active', !!swatchColor && swatchColor === hex);
    });

    // 5) Kotak ringkasan di kedua sub-tab.
    const scaleVal = inputScale ? inputScale.value : '100';
    const summaryCustom = document.getElementById('summary-custom-text');
    if (summaryCustom) {
      summaryCustom.textContent = `${fontSizePresetLabel(currentFontSize)} · ${selectedFontShortName()} · ${fadeSummaryLabel()}`;
    }
    const summaryLayout = document.getElementById('summary-layout-text');
    if (summaryLayout) {
      const layoutText = layout === 'horizontal' ? 'Horizontal' : 'Vertikal';
      summaryLayout.textContent = `${selectedThemeName()} · ${layoutText} · ${posLabel} · ${scaleVal}%`;
    }

    // 6) Isi track slider skala (CSS memakai variabel --range-pct).
    if (inputScale && inputScale.style && typeof inputScale.style.setProperty === 'function') {
      const min = Number(inputScale.min || 25);
      const max = Number(inputScale.max || 150);
      const value = Number(scaleVal);
      if (Number.isFinite(value) && max > min) {
        const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
        inputScale.style.setProperty('--range-pct', `${pct.toFixed(1)}%`);
      }
    }
  } catch (e) {
    console.warn('[KY-Poni] Gagal menyinkronkan panel Studio:', e);
  }
}

// --- Sub-tab Studio (Theme & Layout / Customization) -----------------------
function switchStudioSubtab(subtabId) {
  if (!subtabId) return;

  document.querySelectorAll('#studio-subtabs .subtab-btn').forEach(btn => {
    if (!btn || !btn.classList) return;
    const isTarget = btn.getAttribute('data-subtab') === subtabId;
    btn.classList.toggle('active', isTarget);
    if (btn.setAttribute) btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  document.querySelectorAll('.subtab-pane').forEach(pane => {
    if (!pane || !pane.classList) return;
    pane.classList.toggle('active', pane.id === subtabId);
  });
}

document.querySelectorAll('#studio-subtabs .subtab-btn').forEach(btn => {
  if (!btn || !btn.addEventListener) return;
  btn.addEventListener('click', () => {
    const target = (btn.dataset && btn.dataset.subtab) || btn.getAttribute('data-subtab');
    if (target) switchStudioSubtab(target);
  });
});

// --- Toggle arah aliran (Vertikal / Horizontal) ---------------------------
document.querySelectorAll('.btn-flow').forEach(btn => {
  if (!btn || !btn.addEventListener) return;
  btn.addEventListener('click', () => {
    const target = String(btn.getAttribute('data-layout') || 'vertical');
    if (selectLayout) {
      selectLayout.value = target.startsWith('horizontal') ? 'horizontal' : 'vertical';
    }
    syncStudioVisualControls();
    updateOverlayParams();
  });
});

// --- Reset preset resmi tema aktif ---------------------------------------
const btnResetThemePreset = document.getElementById('btn-reset-theme-preset');
if (btnResetThemePreset && btnResetThemePreset.addEventListener) {
  btnResetThemePreset.addEventListener('click', () => {
    const themeId = selectTheme ? selectTheme.value : '';
    if (themeId) resetThemePresets(themeId);
  });
}

// --- Toggle latar preview (murni state UI lokal, tidak disimpan) ---------
const PREVIEW_BG_MODES = ['game', 'transparent'];

function applyPreviewBackground(mode) {
  const target = PREVIEW_BG_MODES.indexOf(mode) !== -1 ? mode : 'game';

  if (previewWrapper && previewWrapper.classList) {
    previewWrapper.classList.toggle('bg-game', target === 'game');
    previewWrapper.classList.toggle('bg-transparent', target === 'transparent');
  }

  document.querySelectorAll('#preview-bg-toggle .btn-bg-mode').forEach(btn => {
    if (!btn || !btn.classList) return;
    btn.classList.toggle('active', btn.getAttribute('data-bg') === target);
  });
}

document.querySelectorAll('#preview-bg-toggle .btn-bg-mode').forEach(btn => {
  if (!btn || !btn.addEventListener) return;
  btn.addEventListener('click', () => {
    applyPreviewBackground(String(btn.getAttribute('data-bg') || 'game'));
  });
});

// Update OBS URL & Live Preview Frame
// NOTE: this function renders state. Persisting is a separate concern — see scheduleSave().
function updateOverlayParams() {
  const theme = selectTheme.value;
  let layout = selectLayout.value;
  if (layout.startsWith('horizontal')) {
    layout = 'horizontal';
  } else {
    layout = 'vertical';
  }
  const fade = inputFade ? inputFade.value : '8';
  const keep = selectKeep ? selectKeep.value : '1';
  const trans = selectTransition ? selectTransition.value : 'pop';
  const scale = inputScale ? inputScale.value : '100';
  const fsize = String(currentFontSize || 16);
  const font = selectFont ? selectFont.value : 'OptimaNova';
  const color = inputColorHex ? inputColorHex.value.replace('#', '') : 'FFFFFF';

  // Penanda preview: iframe memakai parameter URL sebagai sumber kebenaran supaya
  // slider terasa instan tanpa menunggu simpan ke disk. Instance di OBS tidak memakai
  // penanda ini, sehingga ia mengikuti config tersimpan.
  const params = new URLSearchParams({
    preview: '1',
    theme,
    layout,
    pos: currentPos,
    scale,
    fsize,
    font,
    color,
    fade,
    keep,
    trans,
  });

  const previewUrl = `${window.location.origin}/overlay?${params.toString()}`;

  // URL yang disalin ke OBS SELALU statis. Preferensi sudah tinggal di config server,
  // jadi pengguna tidak perlu lagi memperbarui URL setiap kali mengganti tema.
  obsUrlInput.value = STATIC_OVERLAY_URL;
  previewFrame.src = previewUrl;

  const obsDimTip = document.getElementById('obs-dim-tip');
  if (previewResolution) {
    const layoutLabel = layout === 'horizontal' ? 'Horizontal Ticker' : 'Vertical Stack';
    previewResolution.textContent = `1000 x 1000 px (${layoutLabel}) [${currentPos.toUpperCase()}]`;
  }
  if (obsDimTip) {
    obsDimTip.textContent = `Browser Source OBS: Width 1000 x Height 1000 px`;
  }

  updatePreviewZoom();

  // Cermin visual panel Studio (kartu tema, toggle arah, badge anchor, ringkasan).
  // Murni render — persistensi tetap di scheduleSave() di bawah.
  syncStudioVisualControls();

  // Auto-Save User Preferences (debounced 500ms) — skipped while bootstrapping
  scheduleSave();
}

/**
 * Debounced persistence. Called from every real user interaction handler.
 * During boot we deliberately do nothing: loading saved preferences must never
 * write back to disk, otherwise a not-yet-populated dropdown silently overwrites
 * the user's stored theme/font with a default value.
 */
function scheduleSave() {
  if (isBootstrapping) return;
  if (saveConfigTimeout) clearTimeout(saveConfigTimeout);
  saveConfigTimeout = setTimeout(saveUserConfig, 500);
}


// Changing theme from the dropdown is a USER choice: keep their font/size/colour.
// Presets are only applied on explicit actions (first install, or the reset button),
// because silently resetting typography on every theme switch destroys customisation.
selectTheme.addEventListener('change', () => {
  updateOverlayParams();
  loadCatalog();
});
selectLayout.addEventListener('change', updateOverlayParams);
if (inputFade) inputFade.addEventListener('input', updateOverlayParams);
if (selectKeep) selectKeep.addEventListener('change', updateOverlayParams);
if (selectTransition) selectTransition.addEventListener('change', updateOverlayParams);
// The channel handle used to be persisted only as a side effect of touching another control.
// Give it its own (debounced) save so typing a handle alone survives a restart.
if (ytTargetInput) {
  ytTargetInput.addEventListener('input', () => {
    if (isBootstrapping) return;
    if (saveConfigTimeout) clearTimeout(saveConfigTimeout);
    saveConfigTimeout = setTimeout(saveUserConfig, 500);
  });
}

// Save User Configuration
//
// PENTING: hanya field yang BENAR-BENAR diubah pengguna yang dikirim.
//
// Versi lama mengirim seluruh field dari DOM setiap kali menyimpan. Kalau satu field saja
// belum sempat dipulihkan dari config tersimpan (boot belum selesai, tema belum termuat,
// atau dashboard dibuka sebelum /api/config menjawab), satu interaksi kecil — menggeser
// slider skala, misalnya — akan menuliskan nilai default ke SEMUA field dan menghapus
// preferensi streamer secara permanen. Kejadian nyata: config profil tertimpa default
// hanya karena aplikasi sempat dibuka lalu ditutup.
//
// `lastKnownConfig` adalah snapshot terakhir yang diketahui benar (dari server). Field yang
// nilainya masih sama dengan snapshot tidak ikut dikirim, sehingga tidak mungkin menimpa.
let lastKnownConfig = null;

async function saveUserConfig(forceFields = null) {
  let layoutVal = selectLayout ? selectLayout.value : 'vertical';
  if (layoutVal.startsWith('horizontal')) {
    layoutVal = 'horizontal';
  } else {
    layoutVal = 'vertical';
  }

  const current = {
    target: ytTargetInput ? ytTargetInput.value.trim() : '@MilkyPoni',
    channelProfile: currentChannelProfile,
    theme: selectTheme ? selectTheme.value : 'persona5',
    layout: layoutVal,
    pos: currentPos,
    scale: inputScale ? parseInt(inputScale.value, 10) : 100,
    fontSize: currentFontSize || 16,
    fontFamily: selectFont ? selectFont.value : 'OptimaNova',
    textColor: inputColorHex ? inputColorHex.value : '#FFFFFF',
    fade: inputFade ? parseInt(inputFade.value, 10) : 8,
    keep: selectKeep ? parseInt(selectKeep.value, 10) : 1,
    transition: selectTransition ? selectTransition.value : 'pop',
  };

  // Kirim hanya yang berubah dibanding snapshot server. Tanpa snapshot (boot gagal),
  // tolak menyimpan sama sekali — lebih baik tidak menyimpan daripada menimpa.
  let payload = current;
  if (Array.isArray(forceFields)) {
    payload = {};
    for (const key of forceFields) {
      if (key in current) payload[key] = current[key];
    }
  } else if (lastKnownConfig) {
    payload = {};
    for (const key of Object.keys(current)) {
      if (key === 'channelProfile') {
        const currStr = JSON.stringify(current[key] || null);
        const lastStr = JSON.stringify(lastKnownConfig[key] || null);
        if (currStr !== lastStr) payload[key] = current[key];
      } else if (current[key] !== lastKnownConfig[key]) {
        payload[key] = current[key];
      }
    }
  } else {
    console.warn('[KY-Poni] Simpan dilewati: konfigurasi acuan belum termuat.');
    return;
  }

  if (Object.keys(payload).length === 0) return; // tidak ada perubahan nyata

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const saved = await res.json();
      if (saved && saved.config) lastKnownConfig = { ...saved.config };
    }
  } catch (e) {
    console.warn('Gagal menyimpan config lokal:', e);
  }
}

// Load Saved Configuration on Startup
// Pure read path: populates the DOM only. Callers must run loadThemes() FIRST so every
// dynamic <option> (downloaded themes, theme-provided fonts) already exists before we
// assign .value — otherwise the browser silently blanks the field.
// This function must never trigger a write; see scheduleSave() for the guard.
async function loadSavedConfig() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return;
    const cfg = await res.json();
    await applyConfigToUI(cfg);
  } catch (e) {
    console.warn('Gagal memuat config tersimpan:', e);
  }
}

/**
 * Applies a config object to the dashboard DOM.
 * Contains zero network writes and zero persistence side effects.
 * @param {object} cfg configuration as returned by GET /api/config
 */
async function applyConfigToUI(cfg) {
  if (!cfg) return;

  if (cfg.target && ytTargetInput) ytTargetInput.value = cfg.target;
  if (cfg.theme && selectTheme) {
    // Only assign when the option genuinely exists; keeps the current selection otherwise.
    if (Array.from(selectTheme.options).some(o => o.value === cfg.theme)) {
      selectTheme.value = cfg.theme;
    }
  }
  if (cfg.layout && selectLayout) {
    const norm = cfg.layout.startsWith('horizontal') ? 'horizontal' : 'vertical';
    selectLayout.value = norm;
  }

  if (cfg.pos) {
    currentPos = cfg.pos;
    document.querySelectorAll('#position-selector .btn-pos').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-pos') === currentPos);
    });
  }

  if (cfg.scale && inputScale) {
    inputScale.value = cfg.scale;
    if (labelScaleVal) labelScaleVal.textContent = `${cfg.scale}%`;
  }
  if (cfg.fontSize) {
    setFontSizeUI(cfg.fontSize);
  }
  if (cfg.fontFamily && selectFont) {
    // If the saved font is not offered by any installed theme (e.g. a theme was removed
    // or an older package did not declare its font list), keep it as an explicit option
    // rather than silently dropping the user's choice.
    if (!Array.from(selectFont.options).some(o => o.value === cfg.fontFamily)) {
      const opt = document.createElement('option');
      opt.value = cfg.fontFamily;
      opt.textContent = `${cfg.fontFamily} (Tersimpan)`;
      selectFont.appendChild(opt);
    }
    selectFont.value = cfg.fontFamily;
  }
  if (cfg.textColor && inputColor && inputColorHex) {
    inputColor.value = cfg.textColor;
    inputColorHex.value = cfg.textColor.toUpperCase();
  }
  if (cfg.fade !== undefined && inputFade) inputFade.value = cfg.fade;
  if (cfg.keep !== undefined && selectKeep) selectKeep.value = cfg.keep;
  if (cfg.transition && selectTransition) {
    // Hanya dipasang bila opsinya benar-benar ada, supaya config dari versi lebih
    // baru (transisi yang belum dikenal build ini) tidak mengosongkan dropdown.
    if (Array.from(selectTransition.options).some(o => o.value === cfg.transition)) {
      selectTransition.value = cfg.transition;
    }
  }

  if (cfg.channelProfile) {
    currentChannelProfile = cfg.channelProfile;
    renderChannelProfile(cfg.channelProfile, cfg.target);
  } else if (cfg.target && cfg.target !== '@MilkyPoni') {
    renderChannelProfile(null, cfg.target);
  } else {
    // Belum ada target tersimpan: form kosong adalah keadaan diam, bukan sesi edit.
    // Jangan pasang kunci supaya autoconnect tetap boleh menggambar kartu profil.
    showTargetInputForm(false, false);
  }

  syncStudioVisualControls();
  updateOverlayParams();
}

const COPY_URL_DEFAULT_HTML = btnCopyUrl ? btnCopyUrl.innerHTML : '';

// Copy URL
btnCopyUrl.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(obsUrlInput.value);
    if (btnCopyUrl) {
      btnCopyUrl.classList.add('is-copied');
      btnCopyUrl.innerHTML = 'Tersalin!';
    }
    setTimeout(() => {
      if (btnCopyUrl) {
        btnCopyUrl.classList.remove('is-copied');
        if (COPY_URL_DEFAULT_HTML) btnCopyUrl.innerHTML = COPY_URL_DEFAULT_HTML;
      }
    }, 1800);
  } catch (e) {
    obsUrlInput.select();
    document.execCommand('copy');
    alert('URL OBS telah disalin!');
  }
});

// YouTube Connection API
btnConnect.addEventListener('click', async () => {
  const target = ytTargetInput.value.trim();
  if (!target) {
    alert('Masukkan handle YouTube, Channel ID, atau URL live stream terlebih dahulu.');
    return;
  }

  btnConnect.disabled = true;
  btnConnect.innerHTML = 'Menghubungkan...';
  setUIStatus('connecting', `Menghubungkan ke ${target}...`);

  try {
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal terhubung');

    // Koneksi berhasil = niat mengedit sudah selesai. Lepas kunci sebelum render supaya
    // kartu profil tidak bisa tertahan di form input bila render melempar error.
    isEditingTarget = false;
    if (data.profile) {
      currentChannelProfile = data.profile;
      renderChannelProfile(data.profile, target);
    } else {
      renderChannelProfile(null, target);
    }

    // Jangan mengklaim "Terhubung" sebelum server melaporkan status sebenarnya.
    // Server bisa langsung 'connected', atau 'waiting' bila kanal belum menyiarkan.
    saveUserConfig();
    await pollStatus();
  } catch (err) {
    // Gagal terhubung berarti pengguna MASIH mengedit: biarkan kunci terpasang agar
    // heartbeat tidak menutup form sebelum ia memperbaiki target atau menekan Cancel.
    alert(`Error koneksi: ${err.message}`);
    setUIStatus('error', err.message);
  } finally {
    btnConnect.disabled = false;
    btnConnect.innerHTML = CONNECT_DEFAULT_HTML || 'Connect';
  }
});

btnDisconnect.addEventListener('click', async () => {
  try {
    await fetch('/api/disconnect', { method: 'POST' });
    setUIStatus('idle', 'Disconnected');
    btnConnect.style.display = 'inline-flex';
    btnDisconnect.style.display = 'none';
    streamInfo.style.display = 'none';
  } catch (e) {
    console.error(e);
  }
});

function setUIStatus(state, label) {
  if (statusDot) statusDot.className = `status-dot ${state}`;
  if (statusText) statusText.textContent = label;
  const settingsStatus = document.getElementById('settings-status-text');
  if (settingsStatus) {
    settingsStatus.textContent = label;
    if (state === 'connected') settingsStatus.style.color = 'var(--accent-green)';
    else if (state === 'connecting') settingsStatus.style.color = 'var(--accent-yellow)';
    else settingsStatus.style.color = 'var(--text-muted)';
  }
}

// Topbar Tab Navigation
function switchTab(tabId) {
  document.querySelectorAll('.top-nav .nav-tab').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
  });

  document.querySelectorAll('.tab-content').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });

  if (tabId === 'tab-catalog') {
    loadCatalog();
  }
}

function selectThemeFromCatalog(themeId) {
  if (selectTheme) {
    // Picking an already-installed theme from the catalog is a theme switch, not a reinstall:
    // respect the streamer's existing font/colour customisation.
    selectTheme.value = themeId;
    updateOverlayParams();
    loadCatalog();
    switchTab('tab-studio');
  }
}

/**
 * Explicit "reset to this theme's official look" action.
 * This is the ONLY place (besides a fresh install) where presets overwrite user typography.
 */
function resetThemePresets(themeId) {
  if (!confirm(`Kembalikan font, ukuran, dan warna teks ke preset resmi tema "${themeId}"?`)) return;
  applyThemePresets(themeId);
  updateOverlayParams();
  loadCatalog();
}

async function resetAllPreferences() {
  if (!confirm('Apakah Anda yakin ingin mereset seluruh preferensi tampilan ke setelan awal pabrik?')) return;

  if (inputScale) inputScale.value = 100;
  if (labelScaleVal) labelScaleVal.textContent = '100%';
  setFontSizeUI(16);
  if (selectFont) selectFont.value = 'OptimaNova';
  if (inputColor) inputColor.value = '#ffffff';
  if (inputColorHex) inputColorHex.value = '#FFFFFF';
  if (inputFade) inputFade.value = 8;
  if (selectKeep) selectKeep.value = '1';
  if (selectTransition) selectTransition.value = 'pop';

  currentPos = 'bottom-left';
  document.querySelectorAll('#position-selector .btn-pos').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-pos') === 'bottom-left');
  });

  updateOverlayParams();
  await saveUserConfig();
  alert('Preferensi tampilan berhasil dikembalikan ke default pabrik.');
}

// Simulator Trigger
async function simulateEvent(preset) {
  let payload = {};

  if (preset === 'chat_ryuji') {
    payload = {
      type: 'chat',
      author: 'ViewerOne',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ViewerOne',
      message: 'Halo streamer! Keren banget overlay live chat-nya!',
    };
  } else if (preset === 'chat_morgana') {
    payload = {
      type: 'chat',
      author: 'MilkyPoni',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=MilkyPoni',
      badges: [{ type: 'owner', label: 'OWNER' }],
      message: 'Halo semuanya, selamat datang di live stream!',
    };
  } else if (preset === 'chat_makoto') {
    payload = {
      type: 'chat',
      author: 'ModTeam',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=ModTeam',
      badges: [{ type: 'mod', label: 'MOD' }],
      message: 'Mohon jaga ketertiban dan patuhi aturan stream ya.',
    };
  } else if (preset === 'member_ann') {
    payload = {
      type: 'membership',
      author: 'MemberStar',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=MemberStar',
      badges: [{ type: 'member', label: 'MEMBER' }],
      message: 'Baru saja bergabung menjadi Member Tier 1!',
    };
  } else if (preset === 'superchat_50k') {
    payload = {
      type: 'superchat',
      author: 'Supporter',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Supporter',
      amount: 'Rp 50.000',
      message: 'Semangat terus live streaming-nya, Bos!',
    };
  }

  try {
    await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('Failed to trigger simulation:', e);
  }
}

async function simulateCustom() {
  const input = document.getElementById('custom-message');
  const val = input.value.trim();
  if (!val) return;

  try {
    await fetch('/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'chat',
        author: 'MilkyViewer',
        message: val,
      }),
    });
    input.value = '';
  } catch (e) {
    console.error(e);
  }
}

// Theme Management & Presets (Phase 5/6)
let installedThemesMap = new Map();

function applyThemePresets(themeId) {
  const themeMeta = installedThemesMap.get(themeId);
  if (!themeMeta || !themeMeta.presets) return;
  const p = themeMeta.presets;

  if (p.fontFamily && selectFont) {
    selectFont.value = p.fontFamily;
  }
  if (p.fontSize) {
    setFontSizeUI(p.fontSize);
  }
  if (p.textColor && inputColor && inputColorHex) {
    inputColor.value = p.textColor;
    inputColorHex.value = p.textColor.toUpperCase();
  }
  if (p.recommendedLayout && selectLayout) {
    const norm = p.recommendedLayout.startsWith('horizontal') ? 'horizontal' : 'vertical';
    selectLayout.value = norm;
  }
}

function updateFontDropdown(themes) {
  if (!selectFont) return;
  const currentFont = selectFont.value;

  const baseFonts = [
    { name: 'OptimaNova', label: 'Optima Nova (Official Persona 5)' },
    { name: 'Space Grotesk', label: 'Space Grotesk (Default Anime)' },
    { name: 'Inter', label: 'Inter (Clean Ultra Legible)' },
    { name: 'Bebas Neue', label: 'Bebas Neue (Punchy Comic All-Caps)' },
    { name: 'Bangers', label: 'Bangers (Western Comic)' },
    { name: 'Montserrat', label: 'Montserrat (Modern Bold)' },
    { name: 'VT323', label: 'VT323 (Retro 8-Bit Pixel)' },
  ];

  const themeFonts = [];
  const seen = new Set(baseFonts.map(f => f.name));

  (themes || []).forEach(t => {
    if (Array.isArray(t.fonts)) {
      t.fonts.forEach(f => {
        if (!seen.has(f.name)) {
          seen.add(f.name);
          themeFonts.push(f);
        }
      });
    }
  });

  selectFont.innerHTML = [
    ...themeFonts.map(f => `<option value="${f.name}">${f.label || f.name}</option>`),
    ...baseFonts.map(f => `<option value="${f.name}">${f.label || f.name}</option>`),
  ].join('');

  if (Array.from(selectFont.options).some(o => o.value === currentFont)) {
    selectFont.value = currentFont;
  }
}

/**
 * Populates the theme dropdown from installed themes.
 * @param {string|null} preferredTheme  theme id to keep selected (falls back to current DOM value)
 * The dropdown is rebuilt from scratch each call, so we must re-select deliberately:
 * an empty <select> would otherwise resolve to the first option and silently change the theme.
 */
async function loadThemes(preferredTheme = null) {
  if (!selectTheme) return;
  try {
    const res = await fetch('/api/themes');
    const data = await res.json();
    if (!data.themes || data.themes.length === 0) return;

    installedThemesMap = new Map(data.themes.map(t => [t.id, t]));
    updateFontDropdown(data.themes);

    const wanted = preferredTheme || selectTheme.value;
    const exists = data.themes.some(t => t.id === wanted);
    // Keep the stored theme when it is still installed; only then fall back.
    const resolved = exists ? wanted : data.themes[0].id;

    selectTheme.innerHTML = data.themes.map(t => `
      <option value="${escapeHtml(t.id)}" ${t.id === resolved ? 'selected' : ''}>
        ${escapeHtml(t.name)} ${t.isBuiltIn ? '' : '(Kustom)'}
      </option>
    `).join('');

    selectTheme.value = resolved;
    // Dropdown dibangun ulang → cermin visual (kartu tema + ringkasan) harus ikut segar.
    syncStudioVisualControls();
    return resolved;
  } catch (e) {
    console.error('Failed to load themes:', e);
  }
}

async function installTheme(themeId, downloadUrl, btn) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Mengunduh &amp; Memasang...';
  }

  try {
    const res = await fetch('/api/themes/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId, downloadUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memasang tema');

    // Fresh install is an explicit user action, so applying the theme's official
    // preset here is correct and expected. Switching themes later will NOT reset typography.
    await loadThemes(themeId);
    selectTheme.value = themeId;
    applyThemePresets(themeId);
    updateOverlayParams();
    // Flush the new preference immediately instead of waiting for the debounce,
    // so a fast window close right after install cannot lose the selection.
    await saveUserConfig();
    await loadCatalog();
    switchTab('tab-studio');
    alert(`Tema "${themeId}" berhasil dipasang dan langsung diaktifkan dengan preset resminya.`);
  } catch (err) {
    alert(`Error pemasangan tema: ${err.message}`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Unduh &amp; Pasang';
    }
  }
}

async function deleteTheme(themeId, btn) {
  if (!confirm(`Hapus tema "${themeId}" beserta seluruh preset dan font bawaannya?`)) return;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Menghapus...';
  }

  try {
    const res = await fetch('/api/themes/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal menghapus tema');

    // If the deleted theme was active, fall back to the first remaining theme.
    // Presets are applied here because the previous theme no longer exists at all.
    const remaining = await loadThemes();
    if (selectTheme.value === themeId || !remaining) {
      const fallback = remaining || 'persona5';
      selectTheme.value = fallback;
      applyThemePresets(fallback);
      updateOverlayParams();
      await saveUserConfig();
    }
    await loadCatalog();
    alert(`Tema "${themeId}" berhasil dihapus.`);
  } catch (e) {
    alert(`Error: ${e.message}`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Hapus';
    }
  }
}

async function openThemesFolder() {
  console.log('Themes are managed dynamically via In-App Catalog.');
}

// ===========================================================================
// Tab Katalog (Opsi A): filter instan dari cache + kartu tanpa emoji
// ===========================================================================
//
// `currentCatalogFilter` dan `cachedCatalogThemes` sengaja disimpan di level modul
// supaya klik filter tidak memicu request baru: server hanya dipanggil sekali per
// loadCatalog()/refresh, sisanya render ulang dari memori.

let currentCatalogFilter = 'all';
let cachedCatalogThemes = [];

const CATALOG_FILTERS = ['all', 'installed', 'online'];

/** Satu-satunya definisi "terpasang" — katalog mengirim `installed`, API lain `isInstalled`. */
function isCatalogThemeInstalled(theme) {
  return !!(theme && (theme.isInstalled === true || theme.installed === true));
}

function catalogStatusBadge(theme, installed) {
  const activeId = selectTheme ? selectTheme.value : '';
  if (theme && theme.id === activeId) return '<span class="theme-status-badge is-active">Aktif</span>';
  if (installed) return '<span class="theme-status-badge is-installed">Terpasang</span>';
  return '<span class="theme-status-badge is-online">Online</span>';
}

function catalogSourceMeta(theme, installed) {
  if (!installed) return 'Gratis · Unduh otomatis';
  if (theme && theme.isBuiltIn === true) return 'Bawaan aplikasi';
  return 'Terpasang lokal';
}

// Ikon stroke kecil (seragam dengan index.html) menggantikan emoji.
const ICON_TRASH = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"></path><path d="M10 11v6"></path><path d="M14 11v6"></path></svg>';
const ICON_RESET = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5"></path></svg>';
const ICON_DOWNLOAD = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>';
const ICON_CLOCK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><polyline points="12 7 12 12 15.5 14"></polyline></svg>';

/**
 * Mockup mini di dalam banner kartu. Hanya memakai kelas banner dari dashboard.css
 * (theme-banner-p5/p3r/classic/undertale/cyberpunk) — tidak ada teks dinamis di sini,
 * jadi tidak ada permukaan XSS tambahan.
 */
function themeBannerVisual(themeId) {
  if (themeId === 'persona5') {
    return `
      <div style="position: relative; width: 92%; height: 104px; filter: drop-shadow(3px 3px 0 rgba(0, 0, 0, 0.92));">
        <div style="position: absolute; inset: 0; display: flex; flex-direction: row; pointer-events: none;">
          <div style="width: 34.3%; height: 100%; background: url('/themes/persona5/assets/bubble_left.png') no-repeat left top; background-size: 100% 100%; flex-shrink: 0;"></div>
          <div style="flex: 1; height: 100%; background: url('/themes/persona5/assets/bubble_mid.png') no-repeat center top; background-size: 100% 100%; margin: 0 -1px;"></div>
          <div style="width: 34.6%; height: 100%; background: url('/themes/persona5/assets/bubble_right.png') no-repeat right top; background-size: 100% 100%; flex-shrink: 0;"></div>
        </div>
        <div style="position: absolute; top: 15px; left: 17%; display: flex; align-items: center; z-index: 5; font-family: 'P5Hatty', sans-serif; font-size: 11px; font-weight: 900; letter-spacing: 0.8px; transform: skewX(-14deg);">
          <span style="color: #000;">R</span>
          <span style="background: #D03D3D; color: #FFF; padding: 0 3px; margin: 0 1px; border: 1px solid #000; box-shadow: 1px 1px 0 #000; transform: rotate(-2deg);">Y</span>
          <span style="color: #000;">U</span>
          <span style="color: #000;">J</span>
          <span style="color: #000;">I</span>
        </div>
        <div style="position: absolute; top: 38px; bottom: 12px; left: 18%; right: 17%; z-index: 5; display: flex; align-items: center;">
          <div style="color: #FFFFFF; font-family: 'OptimaNova', 'Space Grotesk', sans-serif; font-size: 0.8rem; font-weight: 900; line-height: 1.22; word-break: break-word;">For real?! Lookin' cool, Joker!</div>
        </div>
      </div>
    `;
  }

  if (themeId === 'persona3reload') {
    return `
      <div style="position: relative; width: 92%; height: 104px; filter: drop-shadow(0 6px 12px rgba(0, 10, 30, 0.7));">
        <div style="position: absolute; inset: 0; display: flex; flex-direction: row; pointer-events: none;">
          <div style="width: 32.6%; height: 100%; background: url('/themes/persona3reload/assets/slices/bubble_left.png') no-repeat left top; background-size: 100% 100%; flex-shrink: 0;"></div>
          <div style="flex: 1; height: 100%; background: url('/themes/persona3reload/assets/slices/bubble_mid.png') no-repeat center top; background-size: 100% 100%; margin: 0 -1px;"></div>
          <div style="width: 31.9%; height: 100%; background: url('/themes/persona3reload/assets/slices/bubble_right.png') no-repeat right top; background-size: 100% 100%; flex-shrink: 0;"></div>
        </div>
        <div style="position: absolute; top: 20px; left: 15%; display: flex; align-items: baseline; gap: 6px; z-index: 5;">
          <span style="color: #FFFFFF; font-family: 'Agane', sans-serif; font-size: 11.5px; font-weight: 700;">Makoto Yuki</span>
          <span style="color: #00D2FF; font-family: 'Agane', sans-serif; font-size: 8px; font-weight: 800; letter-spacing: 1.2px;">TALK</span>
        </div>
        <div style="position: absolute; top: 38px; bottom: 12px; left: 15%; right: 14%; z-index: 5; display: flex; align-items: center;">
          <div style="color: #FFFFFF; font-family: 'Agane', sans-serif; font-size: 0.8rem; font-weight: 400; line-height: 1.25; word-break: break-word;">I will burn my dread and face tomorrow.</div>
        </div>
      </div>
    `;
  }

  if (themeId === 'undertale') {
    return `
      <div style="background: #000; border: 3px solid #FFF; padding: 7px 12px; width: 82%; margin-top: 18px; display: flex; flex-direction: column; gap: 4px; box-sizing: border-box;">
        <div style="display: flex; align-items: center; gap: 6px; border-bottom: 1px dashed rgba(255,255,255,0.3); padding-bottom: 3px;">
          <span style="width: 10px; height: 10px; background: #FF0000; clip-path: polygon(50% 0%, 100% 35%, 82% 100%, 50% 75%, 18% 100%, 0% 35%);"></span>
          <span style="color: #FFFF00; font-family: 'VT323', monospace; font-size: 1rem; font-weight: 700; text-transform: uppercase;">FRISK</span>
        </div>
        <div style="color: #FFFFFF; font-family: 'VT323', monospace; font-size: 1.05rem; letter-spacing: 0.5px; line-height: 1.25;">* You feel your DETERMINATION.</div>
      </div>
    `;
  }

  if (themeId === 'cyberpunk2077') {
    return `
      <div style="background: rgba(18, 24, 36, 0.95); border: 1.5px solid #FFE600; box-shadow: 0 0 14px rgba(255, 230, 0, 0.3); clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px)); padding: 7px 12px; width: 82%; margin-top: 16px; display: flex; flex-direction: column; gap: 4px; box-sizing: border-box;">
        <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,230,0,0.3); padding-bottom: 3px;">
          <span style="color: #00F0FF; font-family: monospace; font-size: 0.62rem;">// COMMS //</span>
          <span style="color: #FFF; font-family: 'Chakra Petch', sans-serif; font-size: 0.78rem; font-weight: 800;">NETRUNNER</span>
        </div>
        <div style="color: #FFE600; font-family: 'Chakra Petch', sans-serif; font-size: 0.85rem; font-weight: 700; line-height: 1.3;">Wake up Samurai, we have a city to burn.</div>
      </div>
    `;
  }

  // classic + tema kustom apa pun
  return `
    <div style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.16); backdrop-filter: blur(8px); padding: 10px 16px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5); display: flex; align-items: center; gap: 11px; width: 86%; box-sizing: border-box;">
      <div style="width: 26px; height: 26px; border-radius: 50%; background: #2563EB; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
      </div>
      <div style="min-width: 0;">
        <div style="color: #60A5FA; font-weight: 700; font-size: 0.72rem;">MilkyViewer</div>
        <div style="color: #F3F4F6; font-size: 0.8rem; line-height: 1.3;">Clean minimalist translucent style...</div>
      </div>
    </div>
  `;
}

/** Kartu satu tema. Semua data katalog di-escape sebelum masuk template. */
function catalogCardHtml(t) {
  const activeId = selectTheme ? selectTheme.value : '';
  const installed = isCatalogThemeInstalled(t);
  const isActive = !!t && t.id === activeId;
  const bannerClass = THEME_BANNER_CLASSES[t.id] || 'theme-banner-classic';
  const tags = (t.tags || []).map(tag => `<span class="theme-tag">${escapeHtml(tag)}</span>`).join('');

  let actions = '';
  if (isActive) {
    // Tema aktif: tidak ada aksi "pakai" lagi, hanya reset preset resmi.
    actions = `<button type="button" class="btn btn-secondary" onclick="resetThemePresets('${escapeJsAttr(t.id)}')" title="Kembalikan font, ukuran &amp; warna teks ke preset resmi tema ini">${ICON_RESET}<span>Reset Preset</span></button>`
      + '<button type="button" class="btn btn-theme-used" disabled>Dipakai</button>';
  } else if (installed) {
    if (t.isBuiltIn !== true) {
      actions += `<button type="button" class="btn btn-danger-soft" onclick="deleteTheme('${escapeJsAttr(t.id)}', this)" title="Hapus tema beserta font bawaannya">${ICON_TRASH}<span>Hapus</span></button>`;
    }
    actions += `<button type="button" class="btn btn-primary" onclick="selectThemeFromCatalog('${escapeJsAttr(t.id)}')"><span>Gunakan Tema</span></button>`;
  } else {
    actions = `<button type="button" class="btn btn-primary" onclick="installTheme('${escapeJsAttr(t.id)}', '${escapeJsAttr(t.downloadUrl)}', this)">${ICON_DOWNLOAD}<span>Unduh &amp; Pasang</span></button>`;
  }

  return `
    <div class="theme-card-large ${isActive ? 'active-theme' : ''}">
      <div class="theme-banner-preview ${bannerClass}">
        ${themeBannerVisual(t.id)}
        ${catalogStatusBadge(t, installed)}
      </div>
      <div class="theme-body">
        <div class="theme-name-row">
          <div class="theme-name">${escapeHtml(t.name)}</div>
        </div>
        <div class="theme-tag-row">
          ${tags}
        </div>
      </div>
      <div class="theme-card-footer">
        <span class="theme-source-meta">${catalogSourceMeta(t, installed)}</span>
        <div class="theme-card-actions">
          ${actions}
        </div>
      </div>
    </div>
  `;
}

/** Kartu teaser; hanya tampil pada filter "Semua" dan tidak dihitung sebagai tema. */
function upcomingCatalogCardHtml() {
  return `
    <div class="theme-card-large is-upcoming">
      <div class="theme-banner-preview theme-banner-upcoming">
        <div class="upcoming-icon-circle">${ICON_CLOCK}</div>
        <div class="upcoming-banner-label">Koleksi game berikutnya</div>
        <span class="theme-status-badge is-upcoming">Segera Hadir</span>
      </div>
      <div class="theme-body">
        <div class="theme-name-row">
          <div class="theme-name">Persona 4 Golden</div>
        </div>
        <div class="theme-tag-row">
          <span class="theme-tag">Midnight Channel</span>
          <span class="theme-tag">Yellow</span>
        </div>
      </div>
      <div class="theme-card-footer">
        <span class="theme-source-meta">Belum tersedia</span>
        <div class="theme-card-actions">
          <button type="button" class="btn-theme-upcoming" disabled>Segera Hadir</button>
        </div>
      </div>
    </div>
  `;
}

/** Counter di bar filter. Tema upcoming sengaja TIDAK ikut dihitung. */
function updateCatalogCounters() {
  const total = cachedCatalogThemes.length;
  const installed = cachedCatalogThemes.filter(isCatalogThemeInstalled).length;
  const counts = {
    'count-all': total,
    'count-installed': installed,
    'count-online': total - installed,
  };
  Object.keys(counts).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(counts[id]);
  });
}

/** Render ulang grid dari cache (instan, tanpa request). */
function renderCatalogGrid() {
  const container = document.getElementById('catalog-showcase-grid');
  if (!container) return;

  let list = cachedCatalogThemes;
  if (currentCatalogFilter === 'installed') {
    list = cachedCatalogThemes.filter(isCatalogThemeInstalled);
  } else if (currentCatalogFilter === 'online') {
    list = cachedCatalogThemes.filter(theme => !isCatalogThemeInstalled(theme));
  }

  const cards = list.map(theme => catalogCardHtml(theme)).join('');
  const upcoming = currentCatalogFilter === 'all' ? upcomingCatalogCardHtml() : '';

  if (!cards && !upcoming) {
    // Kelas CSS-nya belum ada di stylesheet, jadi gaya dasar diberikan inline
    // supaya kondisi kosong tetap rapi tanpa mengubah dashboard.css.
    container.innerHTML = '<div class="catalog-empty-note" style="grid-column: 1 / -1; padding: 40px 0; text-align: center; font-size: 13px; color: var(--text-muted);">Belum ada tema pada filter ini.</div>';
    return;
  }
  container.innerHTML = cards + upcoming;
}

document.querySelectorAll('.btn-catalog-filter').forEach(btn => {
  if (!btn || !btn.addEventListener) return;
  btn.addEventListener('click', () => {
    const wanted = String(btn.getAttribute('data-filter') || 'all');
    currentCatalogFilter = CATALOG_FILTERS.indexOf(wanted) !== -1 ? wanted : 'all';
    document.querySelectorAll('.btn-catalog-filter').forEach(other => {
      if (!other || !other.classList) return;
      other.classList.toggle('active', other === btn);
    });
    renderCatalogGrid();
  });
});

const btnRefreshCatalog = document.getElementById('btn-refresh-catalog');
if (btnRefreshCatalog && btnRefreshCatalog.addEventListener) {
  btnRefreshCatalog.addEventListener('click', () => {
    loadCatalog();
  });
}

// Fetch Catalog and render showcase grid in Tab 2
async function loadCatalog() {
  try {
    const res = await fetch('/api/catalog');
    const data = await res.json();
    if (!data || !Array.isArray(data.themes)) return;

    // Cache dipakai ulang oleh klik filter; hanya request ini yang boleh menulisnya.
    cachedCatalogThemes = data.themes;
    updateCatalogCounters();
    renderCatalogGrid();
  } catch (e) {
    console.error('Failed to load catalog:', e);
  }
}

/**
 * Satu-satunya tempat yang menerjemahkan status ingest ke tampilan dashboard.
 *
 * Sebelumnya logika ini terduplikasi di pollStatus() dan setupUpdaterWS(), dan keduanya
 * tidak menangani status 'error' maupun 'waiting' — akibatnya kegagalan koneksi tampil
 * sebagai "Disconnected" biasa tanpa penjelasan.
 */
function applyStreamStatus(data) {
  if (!data || !data.status) return;

  // Layout kartu profil HANYA boleh ditimpa saat pengguna tidak sedang mengedit target.
  // Tanpa penjaga ini, heartbeat (poll 5s / WS) menutup form input beberapa detik setelah
  // "Ganti" ditekan dan mengembalikan profil lama dari server.
  // Badge, dot avatar, dan liveId di bawah tetap diperbarui walau sedang mengedit.
  if (data.profile && !isEditingTarget) {
    currentChannelProfile = data.profile;
    renderChannelProfile(data.profile, data.target || (ytTargetInput ? ytTargetInput.value.trim() : ''));
  }

  const showConnected = () => {
    btnConnect.style.display = 'none';
    btnDisconnect.style.display = 'inline-flex';
    streamInfo.style.display = 'block';
  };

  switch (data.status) {
    case 'connected':
      setUIStatus('connected', `Live: ${data.target || ''}`.trim());
      showConnected();
      if (data.liveId) infoLiveId.textContent = data.liveId;
      if (typeof data.messageCount === 'number') infoMsgCount.textContent = data.messageCount;
      if (profileAvatarStatus) profileAvatarStatus.style.background = '#00ff88';
      if (profileChannelBadge) {
        profileChannelBadge.textContent = 'Live';
        profileChannelBadge.style.color = '#ff4444';
        profileChannelBadge.style.background = 'rgba(255, 68, 68, 0.15)';
        profileChannelBadge.style.borderColor = 'rgba(255, 68, 68, 0.3)';
      }
      break;

    case 'waiting':
      // Kanal dikenali, siaran belum dimulai. Bukan error: aplikasi akan menyambung sendiri.
      setUIStatus('connecting', 'Menunggu siaran dimulai...');
      showConnected();
      infoLiveId.textContent = data.channelId ? `menunggu (${data.channelId})` : 'menunggu siaran';
      if (profileAvatarStatus) profileAvatarStatus.style.background = '#00f0ff';
      if (profileChannelBadge) {
        profileChannelBadge.textContent = 'Standby';
        profileChannelBadge.style.color = 'var(--accent-cyan)';
        profileChannelBadge.style.background = 'rgba(0, 240, 255, 0.15)';
        profileChannelBadge.style.borderColor = 'rgba(0, 240, 255, 0.3)';
      }
      break;

    case 'connecting':
      setUIStatus('connecting', data.liveId ? 'Siaran ditemukan, menyambungkan chat...' : 'Menghubungkan...');
      showConnected();
      if (profileAvatarStatus) profileAvatarStatus.style.background = '#ffaa00';
      break;

    case 'reconnecting':
      setUIStatus('connecting', 'Sinyal drop, memulihkan koneksi stream...');
      showConnected();
      if (profileAvatarStatus) profileAvatarStatus.style.background = '#ffaa00';
      break;

    case 'error':
      // Tampilkan alasan sebenarnya, bukan sekadar "Disconnected".
      setUIStatus('error', data.error || 'Gagal terhubung ke YouTube.');
      btnConnect.style.display = 'inline-flex';
      btnDisconnect.style.display = 'none';
      streamInfo.style.display = 'none';
      if (profileAvatarStatus) profileAvatarStatus.style.background = '#888888';
      if (profileChannelBadge) {
        profileChannelBadge.textContent = 'Error';
        profileChannelBadge.style.color = 'var(--text-dim)';
        profileChannelBadge.style.background = 'rgba(255, 255, 255, 0.05)';
        profileChannelBadge.style.borderColor = 'var(--border-color)';
      }
      break;

    case 'idle':
    default:
      setUIStatus('idle', 'Disconnected');
      btnConnect.style.display = 'inline-flex';
      btnDisconnect.style.display = 'none';
      streamInfo.style.display = 'none';
      if (profileAvatarStatus) profileAvatarStatus.style.background = '#888888';
      if (profileChannelBadge) {
        profileChannelBadge.textContent = 'Offline';
        profileChannelBadge.style.color = 'var(--text-dim)';
        profileChannelBadge.style.background = 'rgba(255, 255, 255, 0.05)';
        profileChannelBadge.style.borderColor = 'var(--border-color)';
      }
      break;
  }
}

// Badge versi tersebar di tiga tempat (header, kartu Pengaturan, modal update).
// Satu helper supaya ketiganya tidak pernah menampilkan versi berbeda.
function applyVersionLabels(version) {
  if (!version) return;
  const label = `v${version}`;
  ['header-version-badge', 'settings-current-ver', 'modal-current-version'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = label;
  });
}

/** Sumber versi otoritatif saat boot: /api/version (bukan versi yang di-hardcode di HTML). */
async function loadVersionInfo() {
  try {
    const res = await fetch('/api/version');
    if (!res.ok) return;
    const data = await res.json();
    if (data && data.version) applyVersionLabels(data.version);
  } catch (e) {
    // Versi bukan hal kritis: biarkan badge memakai nilai dari HTML.
  }
}

// Poll server status periodically
async function pollStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.version) applyVersionLabels(data.version);
    applyStreamStatus(data);
  } catch (e) {
    // offline
  }
}

// In-App Auto-Updater Logic
let currentUpdateInfo = null;
// Info update terakhir yang diketahui (walau modalnya sudah di-dismiss user), supaya
// tombol "Lihat Update" di tab Pengaturan selalu bisa membuka ulang modalnya.
let latestUpdateInfo = null;

/**
 * Menyalakan penanda pembaruan di seluruh UI: titik di tab Pengaturan, badge
 * "Tersedia vX", dan tombol buka modal. Dipanggil baik oleh cek otomatis maupun manual.
 */
function syncUpdateAvailabilityUI(info) {
  if (!info || !info.updateAvailable) return;
  latestUpdateInfo = info;
  const ver = info.latestVersion || '';

  const navDot = document.getElementById('nav-update-dot');
  if (navDot) navDot.hidden = false;

  const settingsBadge = document.getElementById('settings-update-badge');
  if (settingsBadge) {
    settingsBadge.style.display = 'inline-flex';
    settingsBadge.textContent = ver ? `Tersedia v${ver}` : 'Tersedia';
  }

  const openBtn = document.getElementById('btn-open-update-modal');
  if (openBtn) openBtn.style.display = 'inline-flex';
}

const btnOpenUpdateModal = document.getElementById('btn-open-update-modal');
if (btnOpenUpdateModal && btnOpenUpdateModal.addEventListener) {
  btnOpenUpdateModal.addEventListener('click', () => {
    const info = currentUpdateInfo || latestUpdateInfo;
    if (info) showUpdateModal(info);
  });
}

async function checkUpdateAuto() {
  try {
    const res = await fetch('/api/updater/check');
    if (!res.ok) return;
    const data = await res.json();

    applyVersionLabels(data.currentVersion);

    if (data.updateAvailable) {
      // Penanda UI dinyalakan SEBELUM cek dismiss: user yang pernah menutup modal
      // tetap harus punya jalan membuka update-nya lagi.
      syncUpdateAvailabilityUI(data);

      // Modal otomatis hanya muncul bila versi ini belum pernah di-dismiss.
      const dismissedVer = localStorage.getItem('ky_dismissed_update_version');
      if (dismissedVer === data.latestVersion) {
        console.log(`[KY-Poni Updater] Update v${data.latestVersion} was previously dismissed by user.`);
        return;
      }
      currentUpdateInfo = data;
      showUpdateModal(data);
    }
  } catch (e) {
    // silently ignore background check error
  }
}

async function checkUpdateManual() {
  const btn = document.getElementById('btn-check-update');
  const origText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Mengecek...';
  }

  try {
    const res = await fetch('/api/updater/check');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengecek update');

    applyVersionLabels(data.currentVersion);

    if (data.updateAvailable) {
      syncUpdateAvailabilityUI(data);
      currentUpdateInfo = data;
      showUpdateModal(data);
    } else {
      alert(`Anda sudah menggunakan versi terbaru (v${data.currentVersion}).\nTidak ada pembaruan baru di GitHub.`);
    }
  } catch (err) {
    alert(`Gagal mengecek pembaruan: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = origText;
    }
  }
}

function showUpdateModal(info) {
  const modal = document.getElementById('update-modal');
  const versionEl = document.getElementById('modal-update-version');
  const notesEl = document.getElementById('modal-update-notes');
  const progressContainer = document.getElementById('update-progress-container');
  const btnContainer = document.getElementById('update-modal-buttons');

  if (versionEl) versionEl.textContent = `KY-Poni v${info.latestVersion}`;
  if (notesEl) notesEl.textContent = info.releaseNotes || 'Pembaruan stabilitas dan fitur baru.';
  if (progressContainer) progressContainer.style.display = 'none';
  if (btnContainer) btnContainer.style.display = 'flex';

  if (modal) modal.style.display = 'flex';
}

function dismissUpdateModal() {
  if (currentUpdateInfo && currentUpdateInfo.latestVersion) {
    localStorage.setItem('ky_dismissed_update_version', currentUpdateInfo.latestVersion);
  }
  const modal = document.getElementById('update-modal');
  if (modal) modal.style.display = 'none';
}

async function startInAppUpdate() {
  if (!currentUpdateInfo || !currentUpdateInfo.assetUrl) {
    alert('URL unduhan pembaruan tidak ditemukan.');
    return;
  }

  const btnContainer = document.getElementById('update-modal-buttons');
  const progressContainer = document.getElementById('update-progress-container');
  const progressBar = document.getElementById('update-progress-bar');
  const progressPct = document.getElementById('update-progress-pct');
  const progressStatus = document.getElementById('update-progress-status');

  if (btnContainer) btnContainer.style.display = 'none';
  if (progressContainer) progressContainer.style.display = 'flex';

  // Tombol "Update Sekarang" hidup di dalam modal; beri umpan balik langsung dan
  // pulihkan bila unduhan gagal supaya user bisa mencoba lagi tanpa menutup modal.
  const btnDoUpdate = document.getElementById('btn-do-update');
  const btnDoUpdateHtml = btnDoUpdate ? btnDoUpdate.innerHTML : '';
  if (btnDoUpdate) {
    btnDoUpdate.disabled = true;
    btnDoUpdate.textContent = 'Mengunduh...';
  }

  try {
    const res = await fetch('/api/updater/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        downloadUrl: currentUpdateInfo.assetUrl,
        assetName: currentUpdateInfo.assetName,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengunduh');

    if (progressBar) progressBar.style.width = '100%';
    if (progressPct) progressPct.textContent = '100%';
    if (progressStatus) progressStatus.textContent = `Berhasil diunduh: ${data.fileName || ''}`;

    if (btnContainer) {
      btnContainer.innerHTML = `
        <button type="button" class="btn btn-secondary" onclick="dismissUpdateModal()">Tutup</button>
        <button type="button" class="btn btn-primary" style="background: linear-gradient(135deg, #10B981, #059669); border-color: #059669;" onclick="installAndRestart('${escapeJsAttr(data.filePath)}')"><span>Pasang &amp; Mulai Ulang</span></button>
      `;
      btnContainer.style.display = 'flex';
    }
  } catch (err) {
    alert(`Error unduhan: ${err.message}`);
    if (btnContainer) btnContainer.style.display = 'flex';
    if (progressContainer) progressContainer.style.display = 'none';
    if (btnDoUpdate) {
      btnDoUpdate.disabled = false;
      if (btnDoUpdateHtml) btnDoUpdate.innerHTML = btnDoUpdateHtml;
      else btnDoUpdate.textContent = 'Update Sekarang';
    }
  }
}

async function installAndRestart(filePath) {
  const btnContainer = document.getElementById('update-modal-buttons');
  const progressStatus = document.getElementById('update-progress-status');
  
  if (btnContainer) btnContainer.style.display = 'none';
  if (progressStatus) progressStatus.textContent = 'Memasang pembaruan & memuat ulang aplikasi...';

  try {
    const res = await fetch('/api/updater/restart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memulai ulang');
    console.log('[Updater] Restart triggered:', data);
  } catch (err) {
    alert(`Gagal memasang pembaruan: ${err.message}`);
    if (btnContainer) btnContainer.style.display = 'flex';
  }
}

async function openDownloadedFile(filePath) {
  try {
    await fetch('/api/updater/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath }),
    });
  } catch (e) {
    console.error(e);
  }
}

// WebSocket Listen for Update Progress & Realtime Stream Status
function setupUpdaterWS() {
  try {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'UPDATE_DOWNLOAD_PROGRESS') {
          const progressBar = document.getElementById('update-progress-bar');
          const progressPct = document.getElementById('update-progress-pct');
          if (progressBar) progressBar.style.width = `${payload.pct}%`;
          if (progressPct) progressPct.textContent = `${payload.pct}%`;
        } else if (payload.type === 'SYSTEM_STATUS') {
          applyStreamStatus(payload.data);
        }
      } catch (e) {}
    };
  } catch (e) {}
}

// Startup Initialization
// ORDER MATTERS. Theme/font dropdowns must be fully populated BEFORE saved values are
// assigned, otherwise assigning .value for a downloaded theme silently resolves to ""
// and the next debounced save would overwrite the user's real preference with a default.
(async () => {
  try {
    const savedRes = await fetch('/api/config');
    if (savedRes.ok) {
      const savedCfg = await savedRes.json();
      // Snapshot acuan HARUS dipasang sebelum nilai apa pun masuk ke DOM, supaya
      // saveUserConfig() hanya mengirim field yang benar-benar diubah pengguna.
      lastKnownConfig = { ...savedCfg };
      // 1) Populate every dynamic option first, keeping the saved theme if it is installed.
      await loadThemes(savedCfg.theme || null);
      // 2) Now assign the saved values onto the fully-built DOM.
      await applyConfigToUI(savedCfg);
    } else {
      await loadThemes();
    }
    await loadCatalog();
  } catch (e) {
    console.warn('[KY-Poni] Startup initialisation failed:', e);
  } finally {
    // 3) Enable persistence only after the UI reflects the stored state.
    isBootstrapping = false;
  }

  setupUpdaterWS();
  loadVersionInfo();
  checkUpdateAuto();
  setInterval(pollStatus, 5000);
})();
