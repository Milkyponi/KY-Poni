/**
 * KY-Poni - Native Modular Route Dispatcher
 * Dispatches incoming HTTP requests to isolated route controllers.
 */

const { handleStatusRoutes } = require('./status');
const { handleConfigRoutes } = require('./config');
const { handleIngestRoutes } = require('./ingest');
const { handleThemesRoutes } = require('./themes');
const { handleUpdaterRoutes } = require('./updater');
const { handleStaticRoutes } = require('./static');

const { sendError, isTrustedLocalOrigin } = require('./helpers');

async function dispatchRequest(req, res, ctx) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Origin guard: tolak permintaan yang datang dari website eksternal.
  // Dashboard/overlay/Electron satu-origin dengan server ini, jadi tidak terpengaruh.
  //
  // Kalau guard menolak, TIDAK ada header CORS yang dipasang — biarkan browser
  // memblokir pembacaan response. Response tidak pernah menyebut origin penyerang
  // sebagai diizinkan, baik pada jalur sukses maupun gagal.
  // Port acuan diambil dari socket lokal yang benar-benar menerima koneksi
  // (bukan env PORT, dan bukan header yang bisa dipalsukan penyerang).
  const actualPort = req.socket && req.socket.localPort;
  if (!isTrustedLocalOrigin(req.headers.origin, req.headers.host, actualPort)) {
    sendError(res, 403, 'Permintaan lintas-origin ditolak.');
    return;
  }

  // CORS: satu-satunya tempat header ini dipasang di seluruh aplikasi.
  // `helpers.sendJson()` sengaja TIDAK menyentuh header CORS sama sekali.
  // Bug sebelumnya: sendJson memanggil writeHead() dengan wildcard '*', dan
  // writeHead menimpa header yang dipasang di sini — sehingga seluruh origin
  // guard di atas bisa di-bypass dari website mana pun.
  if (req.headers.origin) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Route 1: Status, Version & Shutdown
  if (handleStatusRoutes(req, res, pathname, ctx)) return;

  // Route 2: Persistent User Configuration
  if (await handleConfigRoutes(req, res, pathname, ctx)) return;

  // Route 3: YouTube Live Ingest & Simulator
  if (await handleIngestRoutes(req, res, pathname, ctx)) return;

  // Route 4: Theme Catalog & Management
  if (await handleThemesRoutes(req, res, pathname, ctx)) return;

  // Route 5: In-App Auto-Updater
  if (await handleUpdaterRoutes(req, res, pathname, ctx)) return;

  // Route 6: Static Assets & Overlay Canvas Serving
  if (handleStaticRoutes(req, res, pathname, ctx)) return;
}

module.exports = { dispatchRequest };
