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

  // Adjust preview wrapper size based on layout preset
  if (layout === 'horizontal') {
    previewWrapper.style.width = '780px';
    previewWrapper.style.height = '300px';
    previewResolution.textContent = `800 x 300 px (${currentPos.toUpperCase()})`;
  } else {
    previewWrapper.style.width = '450px';
    previewWrapper.style.height = '740px';
    previewResolution.textContent = `450 x 800 px (${currentPos.toUpperCase()})`;
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
  statusDot.className = `status-dot ${state}`;
  statusText.textContent = label;
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
  try {
    const res = await fetch('/api/themes/open-folder');
    const data = await res.json();
    if (data.path) {
      console.log('Folder tema dibuka:', data.path);
    }
  } catch (e) {
    console.warn('Gagal membuka folder tema:', e);
  }
}

// Fetch Catalog with Action Buttons
async function loadCatalog() {
  const container = document.getElementById('catalog-list');
  try {
    const res = await fetch('/api/catalog');
    const data = await res.json();
    if (!data.themes) return;

    container.innerHTML = data.themes.map(t => {
      const isInstalled = t.installed;
      const isBuiltIn = t.id === 'persona5' || t.id === 'classic';

      return `
        <div style="background: var(--bg-card); border: 1px solid var(--border-subtle); padding: 10px 12px; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; gap: 8px;">
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${t.previewColor || 'var(--text-main)'};"></span>
              <span style="font-size: 0.85rem; font-weight: 700; color: #FFF;">
                ${t.name}
              </span>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${t.description}
            </div>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            ${isInstalled 
              ? `<span style="font-size: 0.68rem; color: var(--accent-green); font-weight: 700; border: 1px solid var(--accent-green); padding: 3px 6px; border-radius: 4px;">TERPASANG</span>
                 ${!isBuiltIn ? `<button class="btn btn-secondary" style="font-size: 0.68rem; padding: 3px 6px; color: #EF4444;" onclick="deleteTheme('${t.id}', this)" title="Hapus Tema">🗑️</button>` : ''}`
              : `<button class="btn btn-primary" style="font-size: 0.72rem; padding: 4px 10px;" onclick="installTheme('${t.id}', '${t.downloadUrl}', this)">
                   📥 Pasang
                 </button>`
            }
          </div>
        </div>
      `;
    }).join('');
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
    if (data.updateAvailable) {
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

    if (data.updateAvailable) {
      currentUpdateInfo = data;
      showUpdateModal(data);
    } else {
      alert(`✅ Anda sudah menggunakan versi terbaru (v${data.currentVersion})!\n${data.message || 'Tidak ada pembaruan baru.'}`);
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
        <button type="button" class="btn btn-primary" onclick="openDownloadedFile('${data.filePath.replace(/\\/g, '\\\\')}')">📂 Buka Berkas</button>
      `;
      btnContainer.style.display = 'flex';
    }
  } catch (err) {
    alert(`Error unduhan: ${err.message}`);
    if (btnContainer) btnContainer.style.display = 'flex';
    if (progressContainer) progressContainer.style.display = 'none';
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

// WebSocket Listen for Update Progress
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
