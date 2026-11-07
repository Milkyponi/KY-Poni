/**
 * KY-Poni - Static File & Theme Asset Serving
 */

const fs = require('fs');
const path = require('path');

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
  '.ico': 'image/x-icon',
};

function handleStaticRoutes(req, res, pathname, ctx) {
  const { themeManager, PUBLIC_DIR } = ctx;

  // 1. Dynamic Theme Asset Serving (/themes/:themeId/...)
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
        res.writeHead(200, {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        fs.createReadStream(fullPath).pipe(res);
        return true;
      }
    }
  }

  // 2. Static Web Dashboard & Overlay File Serving
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
    return true;
  }

  if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
    const ext = path.extname(safePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    fs.createReadStream(safePath).pipe(res);
    return true;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
  return true;
}

module.exports = { handleStaticRoutes, MIME_TYPES };
