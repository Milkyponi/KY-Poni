/**
 * KY-Poni - Core Local Broadcaster Server
 * Slim Orchestrator: HTTP Server, WebSocket Broadcaster, and Route Dispatcher.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');
const { WebSocketServer } = require('ws');
const { YouTubeChatIngest } = require('./youtube_ingest');
const { ThemeManager } = require('./theme_manager');
const { ConfigManager } = require('./config_manager');
const { AppUpdater } = require('./updater');
const { dispatchRequest } = require('./routes');
const { isTrustedLocalOrigin } = require('./routes/helpers');
const pkg = require('../package.json');

const PORT = parseInt(process.env.PORT || '19840', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');
const CATALOG_PATH = path.join(__dirname, 'catalog', 'catalog.json');
const PACKAGES_DIR = path.join(__dirname, 'catalog', 'packages');

// Core Subsystems Initialization
const youtubeIngest = new YouTubeChatIngest();
const themeManager = new ThemeManager(path.join(PUBLIC_DIR, 'themes'), CATALOG_PATH);
const configManager = new ConfigManager(__dirname);
const appUpdater = new AppUpdater(pkg.version);

// Create HTTP Server
const server = http.createServer((req, res) => {
  dispatchRequest(req, res, {
    youtubeIngest,
    themeManager,
    configManager,
    appUpdater,
    broadcast,
    PUBLIC_DIR,
    PACKAGES_DIR,
    PORT,
    pkg,
  });
});

// Create WebSocket Server
// verifyClient: koneksi WS dari origin eksternal (website lain di browser) ditolak,
// melengkapi origin guard di dispatcher HTTP. OBS/dashboard/Electron tidak terpengaruh.
const wss = new WebSocketServer({
  server,
  path: '/ws',
  verifyClient: (info) => isTrustedLocalOrigin(
    info.req.headers.origin,
    info.req.headers.host,
    info.req.socket && info.req.socket.localPort
  ),
});
const connectedClients = new Set();

wss.on('connection', (ws) => {
  connectedClients.add(ws);
  console.log(`[KY-Poni WS] New client connected. Total clients: ${connectedClients.size}`);

  // Send current status immediately upon connection
  ws.send(JSON.stringify({
    type: 'SYSTEM_STATUS',
    data: {
      status: youtubeIngest.status,
      target: youtubeIngest.currentTarget,
      liveId: youtubeIngest.activeLiveId,
      channelId: youtubeIngest.activeChannelId,
      profile: youtubeIngest.channelProfile || null,
      messageCount: youtubeIngest.messageCount,
      version: pkg.version,
    },
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      if (data.type === 'REGISTER_OVERLAY') {
        ws.isOverlay = true;
      }
    } catch (e) {
      // ignore
    }
  });

  ws.on('close', () => {
    connectedClients.delete(ws);
    console.log(`[KY-Poni WS] Client disconnected. Remaining: ${connectedClients.size}`);
  });
});

// Broadcast Helper
function broadcast(payload) {
  const json = JSON.stringify(payload);
  for (const client of connectedClients) {
    if (client.readyState === 1 /* OPEN */) {
      client.send(json);
    }
  }
}

// Hook YouTube Ingest Events to WebSocket Broadcaster
youtubeIngest.on('message', (item) => {
  broadcast({ type: 'CHAT_MESSAGE', data: item });
});

youtubeIngest.on('status_change', (statusData) => {
  broadcast({ type: 'SYSTEM_STATUS', data: statusData });
});

/**
 * Auto-connect saat aplikasi dibuka.
 *
 * Keluhan yang diselesaikan: "setiap live harus copy-paste link live URL". Target kanal
 * sudah lama tersimpan di config.json, tetapi tidak pernah dipakai untuk menyambung —
 * streamer harus menekan tombol Hubungkan setiap kali membuka aplikasi.
 *
 * Perilaku:
 *   - Diam saja bila target kosong/placeholder default yang belum pernah dikonfirmasi.
 *   - Tidak melempar error ke UI bila kanal sedang offline: ingest masuk mode 'waiting'
 *     dan menunggu siaran dimulai.
 *   - Kegagalan jaringan tidak boleh menggagalkan boot server. Aplikasi tetap harus terbuka.
 */
function scheduleAutoConnect(options = {}) {
  const delay = options.delay !== undefined ? options.delay : 1200;

  const timer = setTimeout(async () => {
    let target = '';
    try {
      // Instalasi baru TIDAK boleh auto-connect.
      //
      // DEFAULT_CONFIG.target berisi '@MilkyPoni' sebagai contoh di kolom input. Tanpa
      // pemeriksaan ini, setiap pengguna yang baru memasang aplikasi akan otomatis
      // mencoba menyambung ke kanal pengembang — status di dashboardnya jadi "menunggu
      // siaran" untuk kanal orang lain. Auto-connect hanya sah bila pengguna benar-benar
      // pernah menyimpan target sendiri, yang dibuktikan oleh keberadaan config.json.
      if (!fs.existsSync(configManager.configPath)) {
        console.log('[KY-Poni AutoConnect] Belum ada config tersimpan (instalasi baru). Tidak menyambung otomatis.');
        return;
      }

      const cfg = configManager.getConfig();
      target = (cfg && cfg.target) ? String(cfg.target).trim() : '';
    } catch (e) {
      console.warn('[KY-Poni AutoConnect] Gagal membaca konfigurasi:', e.message);
      return;
    }

    if (!target) {
      console.log('[KY-Poni AutoConnect] Tidak ada target tersimpan. Menunggu pengguna memilih kanal.');
      return;
    }

    if (!youtubeIngest.parseTarget(target)) {
      console.warn(`[KY-Poni AutoConnect] Target tersimpan tidak dikenali: "${target}". Dilewati.`);
      return;
    }

    console.log(`[KY-Poni AutoConnect] Menyambung otomatis ke target tersimpan: ${target}`);
    try {
      await youtubeIngest.connect(target);
    } catch (err) {
      // Bukan kondisi fatal: dashboard tetap menampilkan status dan tombol Hubungkan.
      console.warn(`[KY-Poni AutoConnect] Gagal menyambung otomatis: ${err.message}`);
    }
  }, delay);

  // Jangan menahan proses hidup hanya karena jadwal auto-connect.
  if (timer && typeof timer.unref === 'function') timer.unref();
  return timer;
}

// Start Server if executed directly
if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`====================================================`);
    console.log(`  KY-Poni Chat Overlay Studio running on port ${PORT}`);
    console.log(`  Dashboard: http://localhost:${PORT}/`);
    console.log(`  OBS URL:   http://localhost:${PORT}/overlay  (statis — tidak berubah saat ganti tema)`);
    console.log(`====================================================`);
    scheduleAutoConnect();
  });

  const gracefulShutdown = () => {
    console.log('Shutting down KY-Poni server...');
    youtubeIngest.disconnect();

    // Tutup WebSocket dulu, lalu HTTP. Tanpa ini, server.close() menunggu koneksi
    // WS yang masih terbuka dan proses bisa menggantung sampai dipaksa kill.
    for (const client of connectedClients) {
      try { client.terminate(); } catch (e) {}
    }
    connectedClients.clear();

    const forceExit = setTimeout(() => process.exit(0), 3000);
    forceExit.unref();

    wss.close(() => {
      server.close(() => process.exit(0));
    });
  };

  process.on('SIGTERM', gracefulShutdown);
  process.on('SIGINT', gracefulShutdown);
}

module.exports = {
  server,
  wss,
  youtubeIngest,
  themeManager,
  configManager,
  appUpdater,
  broadcast,
  scheduleAutoConnect,
  PORT,
};
