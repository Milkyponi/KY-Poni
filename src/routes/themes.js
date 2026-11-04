/**
 * KY-Poni - Themes & Catalog Management Routes
 */

const fs = require('fs');
const path = require('path');
const { sendJson, sendError, parseJsonBody } = require('./helpers');

async function handleThemesRoutes(req, res, pathname, ctx) {
  const { themeManager, PACKAGES_DIR } = ctx;

  if (pathname === '/api/themes' && req.method === 'GET') {
    try {
      const themes = themeManager.getInstalledThemes();
      sendJson(res, 200, { themes });
    } catch (err) {
      sendError(res, 500, err.message);
    }
    return true;
  }

  if (pathname === '/api/catalog' && req.method === 'GET') {
    try {
      const catalog = await themeManager.getCatalog();
      sendJson(res, 200, catalog);
    } catch (err) {
      sendError(res, 500, err.message);
    }
    return true;
  }

  if (pathname === '/api/themes/install' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const themeId = payload.themeId;
      if (!themeId) {
        sendError(res, 400, 'Field "themeId" wajib diisi');
        return true;
      }

      // Check if there is a pre-packaged zip in src/catalog/packages/
      const localPackageZip = path.join(PACKAGES_DIR, `${themeId}.zip`);
      const source = fs.existsSync(localPackageZip) ? localPackageZip : payload.downloadUrl;

      const installResult = await themeManager.installTheme(themeId, source);
      sendJson(res, 200, installResult);
    } catch (err) {
      sendError(res, 500, err.message);
    }
    return true;
  }

  if (pathname === '/api/themes/delete' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const deleteResult = themeManager.deleteTheme(payload.themeId);
      sendJson(res, 200, deleteResult);
    } catch (err) {
      sendError(res, 500, err.message);
    }
    return true;
  }

  if (pathname === '/api/themes/open-folder' && req.method === 'GET') {
    try {
      const dir = await themeManager.openThemesFolder();
      sendJson(res, 200, { success: true, path: dir });
    } catch (err) {
      sendError(res, 500, err.message);
    }
    return true;
  }

  return false;
}

module.exports = { handleThemesRoutes };
