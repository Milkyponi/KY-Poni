/**
 * KY-Poni - Themes & Catalog Management Routes
 */

const fs = require('fs');
const path = require('path');
const { sendJson, sendError, parseJsonBody, sendBodyError } = require('./helpers');
const { isValidThemeId } = require('../theme_manager');

// Allowlist sumber unduhan tema.
//
// Sebelumnya `downloadUrl` dari body HTTP diterima apa adanya, sehingga penyerang
// bisa menyuruh KY-Poni mengunduh dari host mana pun (SSRF ke 169.254.169.254 dsb.)
// atau menyalin path lokal seperti /etc/passwd ke dalam folder tema.
// Sekarang hanya URL https ke repositori katalog resmi yang diizinkan.
const TRUSTED_THEME_HOSTS = [
  'raw.githubusercontent.com',
  'github.com',
  'objects.githubusercontent.com',
  'codeload.github.com',
];
const TRUSTED_THEME_PATH_PREFIXES = [
  '/Milkyponi/ky-poni-themes/',
];

function isTrustedThemeDownloadUrl(rawUrl) {
  if (typeof rawUrl !== 'string') return false;
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (e) {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (!TRUSTED_THEME_HOSTS.includes(parsed.hostname)) return false;
  const fullPath = parsed.pathname;
  return TRUSTED_THEME_PATH_PREFIXES.some(prefix => fullPath.startsWith(prefix));
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
