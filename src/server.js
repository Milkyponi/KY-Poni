/**
 * KY-Poni - Core Local Broadcaster Server
 * HTTP & WebSocket Server running on port 19840
 * Features Theme Management (Phase 3), Live Customization, and Preferences Persistence
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { YouTubeChatIngest } = require('./youtube_ingest');
const { ThemeManager } = require('./theme_manager');

const PORT = parseInt(process.env.PORT || '19840', 10);
const PUBLIC_DIR = path.join(__dirname, 'public');
const CATALOG_PATH = path.join(__dirname, 'catalog', 'catalog.json');
const PACKAGES_DIR = path.join(__dirname, 'catalog', 'packages');
const CONFIG_PATH = path.join(__dirname, 'config.json');

const DEFAULT_CONFIG = {
  target: '@MilkyPoni',
  theme: 'persona5',
  layout: 'vertical',
  pos: 'bottom-left',
  scale: 100,
  fontSize: 16,
  fontFamily: 'Space Grotesk',
  textColor: '#FFFFFF',
  fade: 8,
  keep: 1,
};

const youtubeIngest = new YouTubeChatIngest();
const themeManager = new ThemeManager(path.join(PUBLIC_DIR, 'themes'), CATALOG_PATH);
const pkg = require('../package.json');
const { AppUpdater } = require('./updater');
const appUpdater = new AppUpdater(pkg.version);

// MIME Types
const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// HTTP Request Handler
function requestHandler(req, res) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Status API
  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: youtubeIngest.status,
      target: youtubeIngest.currentTarget,
      liveId: youtubeIngest.activeLiveId,
      messageCount: youtubeIngest.messageCount,
      version: pkg.version,
    }));
    return;
  }

  // 1.1 Version API
  if (pathname === '/api/version' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      version: pkg.version,
      appName: 'KY-Poni',
    }));
    return;
  }

  // 1.2 Graceful Shutdown API (for clean version upgrades)
  if (pathname === '/api/shutdown' && req.method === 'POST') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Server shutting down' }));
    setTimeout(() => {
      process.exit(0);
    }, 200);
    return;
  }

  // 2. Catalog & Theme Management APIs (Phase 3)
  if (pathname === '/api/catalog' && req.method === 'GET') {
    try {
      const catalog = themeManager.getCatalog();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(catalog));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/themes' && req.method === 'GET') {
    try {
      const themes = themeManager.getInstalledThemes();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ themes }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/themes/install' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const themeId = payload.themeId;
        if (!themeId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Field "themeId" wajib diisi' }));
          return;
        }

        // Check if there is a pre-packaged zip in src/catalog/packages/
        const localPackageZip = path.join(PACKAGES_DIR, `${themeId}.zip`);
        const source = fs.existsSync(localPackageZip) ? localPackageZip : payload.downloadUrl;

        const installResult = await themeManager.installTheme(themeId, source);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(installResult));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/themes/delete' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = themeManager.deleteTheme(payload.themeId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/themes/open-folder' && req.method === 'GET') {
    themeManager.openThemesFolder().then(dir => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, path: dir }));
    }).catch(e => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    });
    return;
  }

  // 2.5 In-App Updater APIs
  if (pathname === '/api/updater/check' && req.method === 'GET') {
    appUpdater.checkForUpdates().then(info => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(info));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
    return;
  }

  if (pathname === '/api/updater/download' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        const downloadUrl = payload.downloadUrl;
        const assetName = payload.assetName;

        const result = await appUpdater.downloadUpdate(downloadUrl, assetName, (pct, cur, total) => {
          broadcast({ type: 'UPDATE_DOWNLOAD_PROGRESS', pct, cur, total });
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/updater/open' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        appUpdater.openDownloadedFile(payload.filePath).then(path => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, path }));
        }).catch(err => {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/updater/restart' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const result = appUpdater.installAndRestart(payload.filePath);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // 3. Preferences API
  if (pathname === '/api/config' && req.method === 'GET') {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(raw);
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(DEFAULT_CONFIG));
      }
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (pathname === '/api/config' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const current = fs.existsSync(CONFIG_PATH)
          ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'))
          : { ...DEFAULT_CONFIG };
        const updated = { ...current, ...JSON.parse(body || '{}') };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, config: updated }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 4. Ingest & Simulator APIs
  if (pathname === '/api/connect' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const payload = JSON.parse(body || '{}');
        if (!payload.target) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Field "target" wajib diisi' }));
          return;
        }

        youtubeIngest.connect(payload.target).then(() => {
          console.log(`[KY-Poni] Connected to stream target: ${payload.target}`);
        }).catch(err => {
          console.error(`[KY-Poni] Failed to connect:`, err.message);
        });

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: true,
          status: 'connecting',
          target: payload.target,
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  if (pathname === '/api/disconnect' && req.method === 'POST') {
    youtubeIngest.disconnect();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, status: 'idle' }));
    return;
  }

  if (pathname === '/api/simulate' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body || '{}');
        const simulated = youtubeIngest.simulateMessage(payload.type || 'chat', payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, item: simulated }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // 5. Dynamic Theme File Serving (/themes/:themeId/...)
  if (pathname.startsWith('/themes/')) {
    const parts = pathname.slice('/themes/'.length).split('/');
    const themeId = parts[0];
    const subPath = parts.slice(1).join('/');

    const themeDir = themeManager.getThemePath(themeId);
    if (themeDir) {
      const fullPath = path.normalize(path.join(themeDir, subPath));
      if (fullPath.startsWith(themeDir) && fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const ext = path.extname(fullPath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(fullPath).pipe(res);
        return;
      }
    }
  }

  // 6. Static Web Dashboard & Overlay File Serving
  let relativeFilePath = pathname;
  if (pathname === '/' || pathname === '/index.html') {
    relativeFilePath = '/index.html';
  } else if (pathname === '/overlay') {
    relativeFilePath = '/overlay.html';
  }

  const safePath = path.normalize(path.join(PUBLIC_DIR, relativeFilePath));
  if (!safePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(safePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  });
}

// Create HTTP Server
const server = http.createServer(requestHandler);

// Create WebSocket Server
const wss = new WebSocketServer({ server, path: '/ws' });
const connectedClients = new Set();

wss.on('connection', (ws) => {
  connectedClients.add(ws);
  console.log(`[KY-Poni WS] New client connected. Total clients: ${connectedClients.size}`);

  // Send current status immediately
  ws.send(JSON.stringify({
    type: 'SYSTEM_STATUS',
    data: {
      status: youtubeIngest.status,
      target: youtubeIngest.currentTarget,
      liveId: youtubeIngest.activeLiveId,
      messageCount: youtubeIngest.messageCount,
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

// Hook YouTube Ingest Events
youtubeIngest.on('message', (item) => {
  broadcast({ type: 'CHAT_MESSAGE', data: item });
});

youtubeIngest.on('status_change', (statusData) => {
  broadcast({ type: 'SYSTEM_STATUS', data: statusData });
});

// Start Server
if (require.main === module) {
  server.listen(PORT, '127.0.0.1', () => {
    console.log(`====================================================`);
    console.log(`  KY-Poni Chat Overlay Studio running on port ${PORT}`);
    console.log(`  Dashboard: http://localhost:${PORT}/`);
    console.log(`  OBS URL:   http://localhost:${PORT}/overlay?theme=persona5`);
    console.log(`====================================================`);
  });

  process.on('SIGTERM', () => {
    console.log('Shutting down KY-Poni server...');
    youtubeIngest.disconnect();
    server.close(() => process.exit(0));
  });

  process.on('SIGINT', () => {
    console.log('Interrupted, shutting down...');
    youtubeIngest.disconnect();
    server.close(() => process.exit(0));
  });
}

module.exports = { server, wss, youtubeIngest, themeManager, PORT };
