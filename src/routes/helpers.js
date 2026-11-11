/**
 * KY-Poni - Route Handler Helpers
 * Zero-dependency JSON body parser, response utilities, and origin guard.
 */

/**
 * Origin guard: memastikan permintaan dengan header `Origin` hanya berasal dari
 * server lokal KY-Poni sendiri (localhost/127.0.0.1). Permintaan tanpa `Origin`
 * (curl, OBS, proses internal Electron) selalu diizinkan.
 *
 * Latar belakang: sebelumnya semua route memakai `Access-Control-Allow-Origin: *`,
 * sehingga website apa pun yang dibuka di browser bisa POST ke server lokal
 * (shutdown, connect, install theme) tanpa sepengetahuan user.
 */
function isTrustedLocalOrigin(origin, hostHeader) {
  if (!origin) return true;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch (e) {
    return false;
  }
  // Cukup cek hostname: localhost dan 127.0.0.1 dipakai bergantian oleh
  // dashboard/OBS, dan keduanya tidak mungkin berasal dari website eksternal.
  const trustedHostnames = ['localhost', '127.0.0.1'];
  return trustedHostnames.includes(parsed.hostname);
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error(`JSON body tidak valid: ${err.message}`));
      }
    });
    req.on('error', reject);
  });
}

module.exports = {
  sendJson,
  sendError,
  parseJsonBody,
  isTrustedLocalOrigin,
};
