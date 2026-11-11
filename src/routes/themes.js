/**
 * KY-Poni - Themes & Catalog Management Routes
 */

const fs = require('fs');
const path = require('path');
const { sendJson, sendError, parseJsonBody, sendBodyError } = require('./helpers');
const { isValidThemeId, TRUSTED_THEME_HOSTS, TRUSTED_THEME_PATH_PREFIXES } = require('../theme_manager');
const { validateDownloadUrl } = require('../url_guard');

// Allowlist sumber unduhan tema berasal dari theme_manager (satu sumber
// kebenaran), sehingga route dan downloader tidak bisa berbeda pendapat.
function isTrustedThemeDownloadUrl(rawUrl) {
  const verdict = validateDownloadUrl(rawUrl, {
    allowedHosts: TRUSTED_THEME_HOSTS,
    allowedPathPrefixes: TRUSTED_THEME_PATH_PREFIXES,
    requireHttps: true,
  });
  return verdict.ok;
}

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
      if (!isValidThemeId(themeId)) {
        sendError(res, 400, 'Field "themeId" tidak valid. Hanya huruf kecil, angka, dan tanda minus yang diizinkan.');
        return true;
      }

      // Check if there is a pre-packaged zip in src/catalog/packages/
      let source;
      const localPackageZip = path.join(PACKAGES_DIR, `${themeId}.zip`);
      if (fs.existsSync(localPackageZip)) {
        source = localPackageZip;
      } else if (payload.downloadUrl !== undefined) {
        // Hanya URL katalog resmi yang diterima (cegah SSRF & salin path lokal).
        if (!isTrustedThemeDownloadUrl(payload.downloadUrl)) {
          sendError(res, 400, 'Field "downloadUrl" harus berupa URL https ke katalog tema resmi (Milkyponi/ky-poni-themes).');
          return true;
        }
        source = payload.downloadUrl;
      }

      const installResult = await themeManager.installTheme(themeId, source);
      sendJson(res, 200, installResult);
    } catch (err) {
      sendBodyError(res, err);
    }
    return true;
  }

  if (pathname === '/api/themes/delete' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      if (!isValidThemeId(payload.themeId)) {
        sendError(res, 400, 'Field "themeId" tidak valid. Hanya huruf kecil, angka, dan tanda minus yang diizinkan.');
        return true;
      }
      const deleteResult = themeManager.deleteTheme(payload.themeId);
      sendJson(res, 200, deleteResult);
    } catch (err) {
      sendBodyError(res, err);
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
