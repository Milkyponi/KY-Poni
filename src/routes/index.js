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

const { sendJson, sendError, parseJsonBody, isTrustedLocalOrigin } = require('./helpers');

async function dispatchRequest(req, res, ctx) {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Origin guard: tolak permintaan yang datang dari website eksternal.
  // Dashboard/overlay/Electron satu-origin dengan server ini, jadi tidak terpengaruh.
  if (!isTrustedLocalOrigin(req.headers.origin, req.headers.host)) {
    sendJson(res, 403, { error: 'Permintaan lintas-origin ditolak.' });
    return;
  }

  // CORS headers: hanya di-echo untuk origin lokal terpercaya
  // (tidak lagi wildcard '*' yang membuka API ke website mana pun).
  if (req.headers.origin && isTrustedLocalOrigin(req.headers.origin, req.headers.host)) {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
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
