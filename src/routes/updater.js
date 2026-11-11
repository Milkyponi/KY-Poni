/**
 * KY-Poni - In-App Auto-Updater Routes
 */

const { sendJson, sendError, parseJsonBody, sendBodyError } = require('./helpers');

async function handleUpdaterRoutes(req, res, pathname, ctx) {
  const { appUpdater, broadcast } = ctx;

  if (pathname === '/api/updater/check' && req.method === 'GET') {
    try {
      const info = await appUpdater.checkForUpdates();
      sendJson(res, 200, info);
    } catch (err) {
      sendError(res, 500, err.message);
    }
    return true;
  }

  if (pathname === '/api/updater/download' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const downloadUrl = payload.downloadUrl;
      const assetName = payload.assetName;

      const result = await appUpdater.downloadUpdate(downloadUrl, assetName, (pct, cur, total) => {
        broadcast({ type: 'UPDATE_DOWNLOAD_PROGRESS', pct, cur, total });
      });

      sendJson(res, 200, result);
    } catch (err) {
      sendBodyError(res, err);
    }
    return true;
  }

  if (pathname === '/api/updater/open' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const openedPath = await appUpdater.openDownloadedFile(payload.filePath);
      sendJson(res, 200, { success: true, path: openedPath });
    } catch (err) {
      sendBodyError(res, err);
    }
    return true;
  }

  if (pathname === '/api/updater/restart' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const result = appUpdater.installAndRestart(payload.filePath);
      sendJson(res, 200, result);
    } catch (err) {
      sendBodyError(res, err);
    }
    return true;
  }

  return false;
}

module.exports = { handleUpdaterRoutes };
