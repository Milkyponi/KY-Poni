/**
 * KY-Poni - Core Local Broadcaster Server
 * Slim Orchestrator: HTTP Server, WebSocket Broadcaster, and Route Dispatcher.
 */

const http = require('http');
const path = require('path');
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

// Start Server if executed directly
if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`====================================================`);
    console.log(`  KY-Poni Chat Overlay Studio running on port ${PORT}`);
    console.log(`  Dashboard: http://localhost:${PORT}/`);
    console.log(`  OBS URL:   http://localhost:${PORT}/overlay?theme=persona5`);
    console.log(`====================================================`);
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
  PORT,
};
