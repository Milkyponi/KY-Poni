/**
 * KY-Poni - Dashboard Client Logic
 * Live Customization (Scale, Font Size, Font Family, Text Color)
 * & User Preferences Persistence (/api/config)
 */

const selectTheme = document.getElementById('select-theme');
const selectLayout = document.getElementById('select-layout');
const inputFade = document.getElementById('input-fade');
const selectKeep = document.getElementById('select-keep');
const obsUrlInput = document.getElementById('obs-url');
const btnCopyUrl = document.getElementById('btn-copy-url');
const previewFrame = document.getElementById('preview-frame');
const previewWrapper = document.getElementById('preview-wrapper');
const previewResolution = document.getElementById('preview-resolution');

// Customization Controls
const inputScale = document.getElementById('input-scale');
const labelScaleVal = document.getElementById('label-scale-val');
const inputFsize = document.getElementById('input-fsize');
const labelFsizeVal = document.getElementById('label-fsize-val');
const selectFont = document.getElementById('select-font');
const inputColor = document.getElementById('input-color');
const inputColorHex = document.getElementById('input-color-hex');

const ytTargetInput = document.getElementById('yt-target');
const btnConnect = document.getElementById('btn-connect');
const btnDisconnect = document.getElementById('btn-disconnect');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const streamInfo = document.getElementById('stream-info');
const infoLiveId = document.getElementById('info-liveid');
const infoMsgCount = document.getElementById('info-msgcount');

let currentPos = 'bottom-left';
let saveConfigTimeout = null;

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

// Sync Range Sliders & Value Labels
if (inputScale) {
  inputScale.addEventListener('input', () => {
    if (labelScaleVal) labelScaleVal.textContent = `${inputScale.value}%`;
    updateOverlayParams();
  });
}

if (inputFsize) {
  inputFsize.addEventListener('input', () => {
    if (labelFsizeVal) labelFsizeVal.textContent = `${inputFsize.value}px`;
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
  const scale = inputScale ? inputScale.value : '100';
  const fsize = inputFsize ? inputFsize.value : '16';
  const font = selectFont ? selectFont.value : 'Space Grotesk';
  const color = inputColorHex ? inputColorHex.value.replace('#', '') : 'FFFFFF';

  const params = new URLSearchParams({
    theme,
    layout,
    pos: currentPos,
    scale,
    fsize,
    font,
    color,
    fade,
    keep,
  });

  const url = `${window.location.origin}/overlay?${params.toString()}`;
  obsUrlInput.value = url;
  previewFrame.src = url;

  const obsDimTip = document.getElementById('obs-dim-tip');
  if (previewResolution) {
    const layoutLabel = layout === 'horizontal' ? 'Horizontal Ticker' : 'Vertical Stack';
    previewResolution.textContent = `1000 x 1000 px (${layoutLabel}) [${currentPos.toUpperCase()}]`;
  }
  if (obsDimTip) {
    obsDimTip.textContent = `💡 Browser Source OBS: Width 1000 x Height 1000 px`;
  }

  updatePreviewZoom();

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
async function saveUserConfig() {
  let layoutVal = selectLayout ? selectLayout.value : 'vertical';
  if (layoutVal.startsWith('horizontal')) {
    layoutVal = 'horizontal';
  } else {
    layoutVal = 'vertical';
  }

  const config = {
    target: ytTargetInput ? ytTargetInput.value.trim() : '@MilkyPoni',
    theme: selectTheme ? selectTheme.value : 'persona5',
    layout: layoutVal,
    pos: currentPos,
    scale: inputScale ? parseInt(inputScale.value, 10) : 100,
    fontSize: inputFsize ? parseInt(inputFsize.value, 10) : 16,
    fontFamily: selectFont ? selectFont.value : 'Space Grotesk',
    textColor: inputColorHex ? inputColorHex.value : '#FFFFFF',
    fade: inputFade ? parseInt(inputFade.value, 10) : 8,
    keep: selectKeep ? parseInt(selectKeep.value, 10) : 1,
  };

  try {
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
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
  if (cfg.fontSize && inputFsize) {
    inputFsize.value = cfg.fontSize;
    if (labelFsizeVal) labelFsizeVal.textContent = `${cfg.fontSize}px`;
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

  updateOverlayParams();
}

// Copy URL
btnCopyUrl.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(obsUrlInput.value);
    const orig = btnCopyUrl.innerHTML;
    btnCopyUrl.innerHTML = '✅ Tersalin!';
    setTimeout(() => { btnCopyUrl.innerHTML = orig; }, 1800);
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
    alert('Masukkan handle YouTube atau URL live stream terlebih dahulu.');
    return;
  }

  btnConnect.disabled = true;
  btnConnect.innerHTML = '<span>⏳</span> Menghubungkan...';
  setUIStatus('connecting', `Menghubungkan ke ${target}...`);

  try {
    const res = await fetch('/api/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal terhubung');
    
    setUIStatus('connected', `Terhubung ke ${target}`);
    btnConnect.style.display = 'none';
    btnDisconnect.style.display = 'inline-flex';
    streamInfo.style.display = 'block';
    if (data.liveId) infoLiveId.textContent = data.liveId;
    saveUserConfig();
  } catch (err) {
    alert(`Error koneksi: ${err.message}`);
    setUIStatus('error', err.message);
  } finally {
    btnConnect.disabled = false;
    btnConnect.innerHTML = '<span>⚡</span> Hubungkan Stream';
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
  if (inputFsize) inputFsize.value = 16;
  if (labelFsizeVal) labelFsizeVal.textContent = '16px';
  if (selectFont) selectFont.value = 'Space Grotesk';
  if (inputColor) inputColor.value = '#ffffff';
  if (inputColorHex) inputColorHex.value = '#FFFFFF';
  if (inputFade) inputFade.value = 8;
  if (selectKeep) selectKeep.value = '1';

  currentPos = 'bottom-left';
  document.querySelectorAll('#position-selector .btn-pos').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-pos') === 'bottom-left');
  });

  updateOverlayParams();
  await saveUserConfig();
  alert('✅ Preferensi tampilan berhasil dikembalikan ke default pabrik!');
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
  if (p.fontSize && inputFsize && labelFsizeVal) {
    inputFsize.value = p.fontSize;
    labelFsizeVal.textContent = `${p.fontSize}px`;
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
      <option value="${t.id}" ${t.id === resolved ? 'selected' : ''}>
        ${t.name} ${t.isBuiltIn ? '' : '(Kustom)'}
      </option>
    `).join('');

    selectTheme.value = resolved;
    return resolved;
  } catch (e) {
    console.error('Failed to load themes:', e);
  }
}

async function installTheme(themeId, downloadUrl, btn) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Mengunduh & Memasang...';
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
    alert(`🎉 Tema "${themeId}" berhasil dipasang dan langsung diaktifkan dengan preset resminya!`);
  } catch (err) {
    alert(`Error pemasangan tema: ${err.message}`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '⚡ Instal & Pasang';
    }
  }
}

async function deleteTheme(themeId, btn) {
  if (!confirm(`Hapus tema "${themeId}" beserta seluruh preset dan font bawaannya?`)) return;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Menghapus...';
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
      btn.innerHTML = '🗑️ Hapus';
    }
  }
}

async function openThemesFolder() {
  console.log('Themes are managed dynamically via In-App Catalog.');
}

// Fetch Catalog and render showcase grid in Tab 2
async function loadCatalog() {
  const container = document.getElementById('catalog-showcase-grid');
  if (!container) return;

  try {
    const res = await fetch('/api/catalog');
    const data = await res.json();
    if (!data.themes) return;

    const currentActiveTheme = selectTheme ? selectTheme.value : 'persona5';

    const themeCardsHtml = data.themes.map(t => {
      const isCurrentlyActive = t.id === currentActiveTheme;
      const isInstalled = !!t.installed;
      const isBuiltIn = !!t.isBuiltIn;

      let bannerVisual = '';
      if (t.id === 'persona5') {
        bannerVisual = `
          <div class="theme-banner-preview theme-banner-p5" style="background: radial-gradient(circle at center, #2A1015 0%, #100608 100%); position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 10px;">
            <div style="position: relative; width: 330px; height: 105px; filter: drop-shadow(3px 3px 0px rgba(0,0,0,0.95)); flex-shrink: 0;">
              <!-- 3-Piece Sliced Skin -->
              <div style="position: absolute; inset: 0; display: flex; flex-direction: row; pointer-events: none;">
                <div style="width: 34.3%; height: 100%; background: url('/themes/persona5/assets/bubble_left.png') no-repeat left top; background-size: 100% 100%; flex-shrink: 0;"></div>
                <div style="flex: 1; height: 100%; background: url('/themes/persona5/assets/bubble_mid.png') no-repeat center top; background-size: 100% 100%; margin-left: -1px; margin-right: -1px;"></div>
                <div style="width: 34.6%; height: 100%; background: url('/themes/persona5/assets/bubble_right.png') no-repeat right top; background-size: 100% 100%; flex-shrink: 0;"></div>
              </div>
              <!-- Ransom Nameplate -->
              <div style="position: absolute; top: 15px; left: 17%; width: 22%; height: 18px; display: flex; align-items: center; justify-content: center; z-index: 5; font-family: 'P5Hatty', sans-serif; font-size: 11px; font-weight: 900; transform: skewX(-14deg); pointer-events: none; letter-spacing: 0.8px;">
                <span style="color:#000;">R</span>
                <span style="background:#D03D3D; color:#FFF; padding:0 2.5px; margin:0 1px; border:1px solid #000; box-shadow:1px 1px 0 #000; transform:rotate(-2deg);">Y</span>
                <span style="color:#000;">U</span>
                <span style="color:#000;">J</span>
                <span style="color:#000;">I</span>
              </div>
              <!-- Message Content -->
              <div style="position: absolute; top: 38px; bottom: 12px; left: 18%; right: 17%; z-index: 5; display: flex; align-items: center; justify-content: flex-start;">
                <div style="color: #FFFFFF; font-family: 'OptimaNova', 'Space Grotesk', sans-serif; font-size: 0.86rem; font-weight: 900; line-height: 1.22; word-break: break-word;">
                  For real?! Lookin' cool, Joker!
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (t.id === 'persona3reload') {
        bannerVisual = `
          <div class="theme-banner-preview" style="background: radial-gradient(circle at center, #0F2042 0%, #060E21 100%); position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 10px;">
            <div style="position: relative; width: 330px; height: 105px; filter: drop-shadow(0px 6px 12px rgba(0, 10, 30, 0.7)); flex-shrink: 0;">
              <!-- 3-Piece Sliced Skin -->
              <div style="position: absolute; inset: 0; display: flex; flex-direction: row; pointer-events: none;">
                <div style="width: 32.6%; height: 100%; background: url('/themes/persona3reload/assets/slices/bubble_left.png') no-repeat left top; background-size: 100% 100%; flex-shrink: 0;"></div>
                <div style="flex: 1; height: 100%; background: url('/themes/persona3reload/assets/slices/bubble_mid.png') no-repeat center top; background-size: 100% 100%; margin-left: -1px; margin-right: -1px;"></div>
                <div style="width: 31.9%; height: 100%; background: url('/themes/persona3reload/assets/slices/bubble_right.png') no-repeat right top; background-size: 100% 100%; flex-shrink: 0;"></div>
              </div>
              <!-- Meta (Username & Badge TALK) -->
              <div style="position: absolute; top: 22px; left: 52px; display: flex; align-items: baseline; gap: 6px; z-index: 5;">
                <span style="color: #FFFFFF; font-family: 'Agane', sans-serif; font-size: 12px; font-weight: 700;">Makoto Yuki</span>
                <span style="color: #00D2FF; font-family: 'Agane', sans-serif; font-size: 8px; font-weight: 800; letter-spacing: 1.2px;">TALK</span>
              </div>
              <!-- Message Content -->
              <div style="position: absolute; top: 40px; bottom: 12px; left: 52px; right: 35px; z-index: 5; display: flex; align-items: center; justify-content: flex-start;">
                <div style="color: #FFFFFF; font-family: 'Agane', sans-serif; font-size: 0.88rem; font-weight: 400; line-height: 1.25; word-break: break-word;">
                  I will burn my dread and face tomorrow.
                </div>
              </div>
            </div>
          </div>
        `;
      } else if (t.id === 'undertale') {
        bannerVisual = `
          <div class="theme-banner-preview" style="background: #000000; position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 10px;">
            <div style="background: #000; border: 3px solid #FFF; box-shadow: inset 0 0 0 1px #000; padding: 8px 14px; width: 300px; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; gap: 6px; border-bottom: 1px dashed rgba(255,255,255,0.3); padding-bottom: 2px;">
                <span style="width: 10px; height: 10px; background: #FF0000; clip-path: polygon(50% 0%, 100% 35%, 82% 100%, 50% 75%, 18% 100%, 0% 35%);"></span>
                <span style="color: #FFFF00; font-family: 'VT323', monospace; font-size: 1.1rem; font-weight: 700; text-transform: uppercase;">FRISK</span>
              </div>
              <div style="color: #FFFFFF; font-family: 'VT323', monospace; font-size: 1.25rem; letter-spacing: 0.5px;">
                * You feel your DETERMINATION.
              </div>
            </div>
          </div>
        `;
      } else if (t.id === 'cyberpunk2077') {
        bannerVisual = `
          <div class="theme-banner-preview" style="background: radial-gradient(circle at center, #1B212D 0%, #0B0E14 100%); position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; padding: 10px;">
            <div style="background: rgba(18, 24, 36, 0.95); border: 1.5px solid #FFE600; box-shadow: 0 0 14px rgba(255, 230, 0, 0.3); clip-path: polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px)); padding: 8px 14px; width: 310px; display: flex; flex-direction: column; gap: 4px;">
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,230,0,0.3); padding-bottom: 2px;">
                <span style="color: #00F0FF; font-family: monospace; font-size: 0.65rem;">// COMMS //</span>
                <span style="color: #FFF; font-family: 'Chakra Petch', sans-serif; font-size: 0.82rem; font-weight: 800;">NETRUNNER</span>
              </div>
              <div style="color: #FFE600; font-family: 'Chakra Petch', sans-serif; font-size: 0.92rem; font-weight: 700;">
                Wake up Samurai, we have a city to burn.
              </div>
            </div>
          </div>
        `;
      } else {
        bannerVisual = `
          <div class="theme-banner-preview theme-banner-classic">
            <div style="background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(255, 255, 255, 0.2); backdrop-filter: blur(8px); padding: 12px 20px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5); display: flex; align-items: center; gap: 12px;">
              <div style="width: 28px; height: 28px; border-radius: 50%; background: #2563EB; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; color: #FFF;">
                ✨
              </div>
              <div>
                <div style="color: #60A5FA; font-weight: 700; font-size: 0.75rem;">MilkyViewer</div>
                <div style="color: #F3F4F6; font-size: 0.85rem;">Clean minimalist translucent style...</div>
              </div>
            </div>
          </div>
        `;
      }

      let statusBadge = '';
      if (isCurrentlyActive) {
        statusBadge = `<span style="font-size: 0.68rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; background: var(--primary); color: #FFF; border: 1px solid var(--primary);">★ AKTIF DIGUNAKAN</span>`;
      } else if (isInstalled) {
        statusBadge = `<span style="font-size: 0.68rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; background: var(--bg-input); color: #FFF; border: 1px solid var(--border-subtle);">TERPASANG</span>`;
      } else {
        statusBadge = `<span style="font-size: 0.68rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; background: rgba(0, 240, 255, 0.1); color: var(--accent-cyan); border: 1px solid rgba(0, 240, 255, 0.3);">TERSEDIA DI CLOUD</span>`;
      }

      let actionButtons = '';
      if (isInstalled) {
        if (isCurrentlyActive) {
          actionButtons = `<button class="btn btn-secondary" style="font-size: 0.76rem; padding: 6px 14px; opacity: 0.7; cursor: default;" disabled>✓ Sedang Digunakan</button>`;
          actionButtons += `<button class="btn btn-secondary" style="font-size: 0.76rem; padding: 6px 12px; margin-left: 8px;" onclick="resetThemePresets('${t.id}')" title="Kembalikan font, ukuran & warna teks ke preset resmi tema ini">↺ Preset Tema</button>`;
        } else {
          actionButtons = `<button class="btn btn-primary" style="font-size: 0.76rem; padding: 6px 16px;" onclick="selectThemeFromCatalog('${t.id}')">⚡ Gunakan Tema Ini</button>`;
          if (!isBuiltIn) {
            actionButtons += `<button class="btn btn-danger" style="font-size: 0.76rem; padding: 6px 12px; margin-left: 8px; background: rgba(220, 38, 38, 0.2); border: 1px solid #DC2626; color: #FCA5A5; border-radius: 4px; cursor: pointer;" onclick="deleteTheme('${t.id}', this)" title="Hapus tema beserta font bawaannya">🗑️ Hapus</button>`;
          }
        }
      } else {
        actionButtons = `<button class="btn btn-primary" style="font-size: 0.76rem; padding: 6px 16px; background: var(--accent-cyan); color: #000; font-weight: 800; border: none; border-radius: 4px; cursor: pointer;" onclick="installTheme('${t.id}', '${t.downloadUrl}', this)">⚡ Instal & Pasang</button>`;
      }

      return `
        <div class="theme-card-large ${isCurrentlyActive ? 'active-theme' : ''}">
          ${bannerVisual}
          <div class="theme-body">
            <div class="theme-name-row">
              <div class="theme-name">${t.name}</div>
              ${statusBadge}
            </div>

            <div class="theme-tag-row">
              ${(t.tags || []).map(tag => `<span class="theme-tag">${tag}</span>`).join('')}
            </div>
          </div>

          <div class="theme-card-footer" style="justify-content: flex-end;">
            ${actionButtons}
          </div>
        </div>
      `;
    }).join('');

    // Upcoming Themes Card
    const upcomingCardHtml = `
      <div class="theme-card-large" style="border: 1px dashed var(--border-highlight); background: rgba(21, 25, 34, 0.4);">
        <div class="theme-banner-preview" style="background: radial-gradient(circle at center, #1B1A2E 0%, #0C0B17 100%); flex-direction: column; gap: 8px;">
          <div style="font-size: 2rem;">🚀</div>
          <div style="font-size: 0.85rem; font-weight: 700; color: var(--accent-cyan); letter-spacing: 0.5px;">KOLEKSI GAME BERIKUTNYA</div>
        </div>
        <div class="theme-body">
          <div class="theme-name" style="color: var(--text-muted);">Persona 4 Golden</div>
          <div class="theme-tag-row">
            <span class="theme-tag">Segera Hadir</span>
            <span class="theme-tag">Midnight Channel</span>
            <span class="theme-tag">Yellow</span>
          </div>
        </div>
        <div class="theme-card-footer" style="justify-content: flex-end;">
          <span style="font-size: 0.76rem; color: var(--accent-cyan); font-weight: 700; border: 1px solid rgba(0, 240, 255, 0.3); padding: 4px 10px; border-radius: 4px;">
            🚀 Segera Hadir
          </span>
        </div>
      </div>
    `;

    container.innerHTML = themeCardsHtml + upcomingCardHtml;
  } catch (e) {
    console.error('Failed to load catalog:', e);
  }
}

// Poll server status periodically
async function pollStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    if (data.version) {
      const headerVerEl = document.getElementById('header-version-badge');
      if (headerVerEl) headerVerEl.textContent = `v${data.version}`;
      const currentVerEl = document.getElementById('settings-current-ver');
      if (currentVerEl) currentVerEl.textContent = `v${data.version}`;
    }
    if (data.status === 'connected') {
      setUIStatus('connected', `Live: ${data.target}`);
      btnConnect.style.display = 'none';
      btnDisconnect.style.display = 'inline-flex';
      streamInfo.style.display = 'block';
      if (data.liveId) infoLiveId.textContent = data.liveId;
      infoMsgCount.textContent = data.messageCount;
    } else if (data.status === 'reconnecting') {
      setUIStatus('connecting', '⚠️ Sinyal drop, memulihkan koneksi stream...');
      btnConnect.style.display = 'none';
      btnDisconnect.style.display = 'inline-flex';
      streamInfo.style.display = 'block';
    } else if (data.status === 'idle') {
      btnConnect.style.display = 'inline-flex';
      btnDisconnect.style.display = 'none';
      streamInfo.style.display = 'none';
    }
  } catch (e) {
    // offline
  }
}

// In-App Auto-Updater Logic
let currentUpdateInfo = null;

async function checkUpdateAuto() {
  try {
    const res = await fetch('/api/updater/check');
    if (!res.ok) return;
    const data = await res.json();

    // Dynamically sync version in Settings tab
    const currentVerEl = document.getElementById('settings-current-ver');
    if (currentVerEl && data.currentVersion) {
      currentVerEl.textContent = `v${data.currentVersion}`;
    }
    const headerVerEl = document.getElementById('header-version-badge');
    if (headerVerEl && data.currentVersion) {
      headerVerEl.textContent = `v${data.currentVersion}`;
    }

    // Only show modal if an update is genuinely newer AND not previously dismissed by user
    if (data.updateAvailable) {
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
    btn.innerHTML = '⏳ Mengecek...';
  }

  try {
    const res = await fetch('/api/updater/check');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal mengecek update');

    const currentVerEl = document.getElementById('settings-current-ver');
    if (currentVerEl && data.currentVersion) {
      currentVerEl.textContent = `v${data.currentVersion}`;
    }
    const headerVerEl = document.getElementById('header-version-badge');
    if (headerVerEl && data.currentVersion) {
      headerVerEl.textContent = `v${data.currentVersion}`;
    }

    if (data.updateAvailable) {
      currentUpdateInfo = data;
      showUpdateModal(data);
    } else {
      alert(`✅ Anda sudah menggunakan versi terbaru (v${data.currentVersion})!\nTidak ada pembaruan baru di GitHub.`);
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
    if (progressStatus) progressStatus.innerHTML = `✅ Berhasil diunduh: <b>${data.fileName}</b>`;

    if (btnContainer) {
      btnContainer.innerHTML = `
        <button type="button" class="btn btn-secondary" onclick="dismissUpdateModal()">Tutup</button>
        <button type="button" class="btn btn-primary" style="background: linear-gradient(135deg, #10B981, #059669); border-color: #059669;" onclick="installAndRestart('${data.filePath.replace(/\\/g, '\\\\')}')">⚡ Pasang & Mulai Ulang</button>
      `;
      btnContainer.style.display = 'flex';
    }
  } catch (err) {
    alert(`Error unduhan: ${err.message}`);
    if (btnContainer) btnContainer.style.display = 'flex';
    if (progressContainer) progressContainer.style.display = 'none';
  }
}

async function installAndRestart(filePath) {
  const btnContainer = document.getElementById('update-modal-buttons');
  const progressStatus = document.getElementById('update-progress-status');
  
  if (btnContainer) btnContainer.style.display = 'none';
  if (progressStatus) progressStatus.innerHTML = `⏳ <b>Memasang pembaruan & memuat ulang aplikasi...</b>`;

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
          const s = payload.data;
          if (s.status === 'connected') {
            setUIStatus('connected', `Live: ${s.target}`);
            btnConnect.style.display = 'none';
            btnDisconnect.style.display = 'inline-flex';
            streamInfo.style.display = 'block';
            if (s.liveId) infoLiveId.textContent = s.liveId;
          } else if (s.status === 'reconnecting') {
            setUIStatus('connecting', '⚠️ Sinyal drop, memulihkan koneksi...');
            btnConnect.style.display = 'none';
            btnDisconnect.style.display = 'inline-flex';
          } else if (s.status === 'idle') {
            setUIStatus('idle', 'Disconnected');
            btnConnect.style.display = 'inline-flex';
            btnDisconnect.style.display = 'none';
            streamInfo.style.display = 'none';
          }
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
  checkUpdateAuto();
  setInterval(pollStatus, 5000);
})();
