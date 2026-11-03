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

// Update OBS URL & Live Preview Frame
function updateOverlayParams() {
  const theme = selectTheme.value;
  const layout = selectLayout.value;
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

  const PRESET_DIMS = {
    'vertical': { w: 450, h: 800, previewW: 440, previewH: 680, label: '450 x 800 px (Vertical Standar)' },
    'vertical-wide': { w: 600, h: 900, previewW: 520, previewH: 680, label: '600 x 900 px (Vertical Lebar ★)' },
    'vertical-compact': { w: 380, h: 650, previewW: 380, previewH: 640, label: '380 x 650 px (Vertical Ringkas)' },
    'horizontal': { w: 800, h: 300, previewW: 780, previewH: 300, label: '800 x 300 px (Horizontal Ticker)' },
    'horizontal-wide': { w: 1200, h: 320, previewW: 860, previewH: 260, label: '1200 x 320 px (Horizontal Ultrawide)' },
    'fullscreen': { w: 1920, h: 1080, previewW: 860, previewH: 484, label: '1920 x 1080 px (Full-HD 1080p Freeform)' },
  };

  const preset = PRESET_DIMS[layout] || PRESET_DIMS['vertical'];
  if (previewWrapper) {
    previewWrapper.style.width = `${preset.previewW}px`;
    previewWrapper.style.height = `${preset.previewH}px`;
  }
  if (previewResolution) {
    previewResolution.textContent = `${preset.label} [${currentPos.toUpperCase()}]`;
  }
  if (obsDimTip) {
    obsDimTip.textContent = `💡 Rekomendasi OBS: Width ${preset.w} x Height ${preset.h} px`;
  }

  // Auto-Save User Preferences (debounced 500ms)
  if (saveConfigTimeout) clearTimeout(saveConfigTimeout);
  saveConfigTimeout = setTimeout(saveUserConfig, 500);
}

selectTheme.addEventListener('change', updateOverlayParams);
selectLayout.addEventListener('change', updateOverlayParams);
if (inputFade) inputFade.addEventListener('input', updateOverlayParams);
if (selectKeep) selectKeep.addEventListener('change', updateOverlayParams);

// Save User Configuration
async function saveUserConfig() {
  const config = {
    target: ytTargetInput ? ytTargetInput.value.trim() : '@MilkyPoni',
    theme: selectTheme ? selectTheme.value : 'persona5',
    layout: selectLayout ? selectLayout.value : 'vertical',
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
async function loadSavedConfig() {
  try {
    const res = await fetch('/api/config');
    if (!res.ok) return;
    const cfg = await res.json();

    if (cfg.target && ytTargetInput) ytTargetInput.value = cfg.target;
    if (cfg.theme && selectTheme) selectTheme.value = cfg.theme;
    if (cfg.layout && selectLayout) selectLayout.value = cfg.layout;

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
    if (cfg.fontFamily && selectFont) selectFont.value = cfg.fontFamily;
    if (cfg.textColor && inputColor && inputColorHex) {
      inputColor.value = cfg.textColor;
      inputColorHex.value = cfg.textColor.toUpperCase();
    }
    if (cfg.fade !== undefined && inputFade) inputFade.value = cfg.fade;
    if (cfg.keep !== undefined && selectKeep) selectKeep.value = cfg.keep;

    updateOverlayParams();
  } catch (e) {
    console.warn('Gagal memuat config tersimpan:', e);
  }
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
    selectTheme.value = themeId;
    updateOverlayParams();
    loadCatalog();
    switchTab('tab-studio');
  }
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
  alert('✅ Preferensi tampilan berhasil dikembalikan ke default pabrik!');
}

// Simulator Trigger
async function simulateEvent(preset) {
  let payload = {};

  if (preset === 'chat_ryuji') {
    payload = {
      type: 'chat',
      author: 'Ryuji Sakamoto',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Ryuji',
      message: 'For real?! Ini overlay chat beneran gokil abis, Bos!',
    };
  } else if (preset === 'chat_morgana') {
    payload = {
      type: 'chat',
      author: 'Morgana',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Morgana',
      badges: [{ type: 'owner', label: 'OWNER' }],
      message: "Lookin' cool, Joker! Ayo gas terus live streamnya!",
    };
  } else if (preset === 'chat_makoto') {
    payload = {
      type: 'chat',
      author: 'Makoto Niijima',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Makoto',
      badges: [{ type: 'mod', label: 'MOD' }],
      message: 'Mohon jaga sopan santun dan patuhi aturan stream ya.',
    };
  } else if (preset === 'member_ann') {
    payload = {
      type: 'membership',
      author: 'Ann Takamaki',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Ann',
      message: 'Baru saja bergabung menjadi anggota Phantom Thief Tier 1!',
    };
  } else if (preset === 'superchat_50k') {
    payload = {
      type: 'superchat',
      author: 'Joker (Ren)',
      avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Joker',
      amount: 'Rp 500.000.000',
      message: 'Take your time! Donasi spesial untuk support Milky Brain HQ!',
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

// Theme Management (Phase 3)
async function loadThemes() {
  if (!selectTheme) return;
  try {
    const res = await fetch('/api/themes');
    const data = await res.json();
    if (!data.themes) return;

    const currentVal = selectTheme.value;
    selectTheme.innerHTML = data.themes.map(t => `
      <option value="${t.id}" ${t.id === currentVal ? 'selected' : ''}>
        ${t.name} ${t.isBuiltIn ? '' : '(Kustom)'}
      </option>
    `).join('');

    if (!Array.from(selectTheme.options).some(o => o.value === currentVal) && data.themes.length > 0) {
      selectTheme.value = data.themes[0].id;
    }
  } catch (e) {
    console.error('Failed to load themes:', e);
  }
}

async function installTheme(themeId, downloadUrl, btn) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '⏳ Memasang...';
  }

  try {
    const res = await fetch('/api/themes/install', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId, downloadUrl }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memasang tema');

    await loadThemes();
    await loadCatalog();
    selectTheme.value = themeId;
    updateOverlayParams();
    alert(`Tema "${themeId}" berhasil dipasang dan langsung diaktifkan!`);
  } catch (err) {
    alert(`Error pemasangan tema: ${err.message}`);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '📥 Pasang';
    }
  }
}

async function deleteTheme(themeId, btn) {
  if (!confirm(`Hapus tema kustom "${themeId}"?`)) return;
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

    await loadThemes();
    await loadCatalog();
    if (selectTheme.value === themeId) {
      selectTheme.value = 'persona5';
      updateOverlayParams();
    }
  } catch (e) {
    alert(`Error: ${e.message}`);
  }
}

async function openThemesFolder() {
  // Custom user themes disabled by design: themes are strictly official from Milky Brain.
  console.log('Custom theme directory is disabled. Themes are strictly official.');
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
      const isP5 = t.id === 'persona5';

      let bannerVisual = '';
      if (isP5) {
        bannerVisual = `
          <div class="theme-banner-preview theme-banner-p5">
            <div style="background: #000; border: 3px solid #FFF; padding: 12px 20px; transform: skewX(-12deg); box-shadow: 4px 4px 0 #D03D3D; display: flex; align-items: center; gap: 12px;">
              <div style="width: 32px; height: 32px; background: #FFF; border: 2px solid #000; transform: rotate(-8deg); display: flex; align-items: center; justify-content: center; font-weight: 900; color: #D03D3D; font-size: 0.9rem;">
                🎭
              </div>
              <div style="transform: skewX(12deg);">
                <div style="background: #D03D3D; color: #FFF; font-weight: 800; font-size: 0.72rem; padding: 2px 6px; display: inline-block;">RYUJI</div>
                <div style="color: #FFF; font-weight: 700; font-size: 0.85rem; margin-top: 2px;">For real?! Lookin' cool!</div>
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

      return `
        <div class="theme-card-large ${isCurrentlyActive ? 'active-theme' : ''}">
          ${bannerVisual}
          <div class="theme-body">
            <div class="theme-name-row">
              <div class="theme-name">${t.name}</div>
              <span style="font-size: 0.68rem; font-weight: 700; padding: 3px 8px; border-radius: 4px; background: ${isCurrentlyActive ? 'var(--primary)' : 'var(--bg-input)'}; color: #FFF; border: 1px solid ${isCurrentlyActive ? 'var(--primary)' : 'var(--border-subtle)'};">
                ${isCurrentlyActive ? '★ AKTIF DIGUNAKAN' : 'TERPASANG'}
              </span>
            </div>

            <div class="theme-tag-row">
              ${(t.tags || []).map(tag => `<span class="theme-tag">${tag}</span>`).join('')}
            </div>

            <div class="theme-desc">
              ${t.description}
            </div>
          </div>

          <div class="theme-card-footer">
            <span style="font-size: 0.75rem; color: var(--text-dim);">By ${t.author || 'Milky Brain'}</span>
            ${isCurrentlyActive 
              ? `<button class="btn btn-secondary" style="font-size: 0.76rem; padding: 6px 14px; opacity: 0.7; cursor: default;" disabled>
                   ✓ Sedang Digunakan
                 </button>`
              : `<button class="btn btn-primary" style="font-size: 0.76rem; padding: 6px 16px;" onclick="selectThemeFromCatalog('${t.id}')">
                   ⚡ Gunakan Tema Ini
                 </button>`
            }
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
          <div class="theme-name" style="color: var(--text-muted);">Undertale, Cyberpunk, & Retro JRPG</div>
          <div class="theme-tag-row">
            <span class="theme-tag">Coming Soon</span>
            <span class="theme-tag">Community</span>
            <span class="theme-tag">Pixel Art</span>
          </div>
          <div class="theme-desc">
            Tema-tema game legendaris lainnya sedang dalam kurasi untuk pembaruan berikutnya. Anda juga dapat memasang tema CSS kustom sendiri melalui folder tema lokal.
          </div>
        </div>
        <div class="theme-card-footer">
          <span style="font-size: 0.75rem; color: var(--text-dim);">Dukungan CSS Modular</span>
          <button class="btn btn-secondary" style="font-size: 0.76rem; padding: 6px 14px;" onclick="openThemesFolder()">
            📂 Folder Tema Kustom
          </button>
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
loadSavedConfig().then(async () => {
  await loadThemes();
  await loadCatalog();
  setupUpdaterWS();
  checkUpdateAuto();
  setInterval(pollStatus, 5000);
});
