/**
 * KY-Poni - Route Handler Helpers
 * Zero-dependency JSON body parser, response utilities, and origin guard.
 */

/**
 * Origin guard: memastikan permintaan dengan header `Origin` hanya berasal dari
 * server lokal KY-Poni sendiri (localhost/127.0.0.1 PADA PORT YANG SAMA).
 * Permintaan tanpa `Origin` (curl, OBS, proses internal Electron) selalu diizinkan.
 *
 * Kenapa port ikut diperiksa: mencocokkan hostname saja TIDAK cukup. Proses lain
 * di mesin yang sama — dev server, tool lokal, halaman yang di-serve port lain —
 * berjalan di origin 127.0.0.1 yang berbeda port dan akan lolos kalau port
 * diabaikan. Ditemukan saat audit lanjutan: halaman di 127.0.0.1:19998 masih bisa
 * membaca dan mem-POST API KY-Poni karena guard hanya melihat hostname.
 *
 * @param {string|undefined} origin  Header Origin dari request.
 * @param {string|undefined} hostHeader Header Host dari request.
 * @param {number|string} expectedPort Port tempat server ini benar-benar listen.
 */
function isTrustedLocalOrigin(origin, hostHeader, expectedPort) {
  if (!origin) return true;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch (e) {
    return false;
  }

  const trustedHostnames = ['localhost', '127.0.0.1'];
  if (!trustedHostnames.includes(parsed.hostname)) return false;

  // Port wajib cocok dengan port server ini. `URL.port` kosong berarti port
  // default skema (80/443), yang bukan port KY-Poni — tolak.
  const originPort = parsed.port;
  const expected = expectedPort === undefined || expectedPort === null
    ? null
    : String(expectedPort);

  if (expected === null) return false;
  return originPort === expected;
}

/**
 * Otoritas header CORS HANYA di dispatcher (routes/index.js), tepat satu tempat.
 *
 * PENTING: fungsi ini sengaja TIDAK pernah menyetel `Access-Control-Allow-Origin`.
 * Versi sebelumnya menyetel `*` di sini, dan karena `writeHead()` menimpa header
 * yang sudah dipasang lewat `setHeader()` di dispatcher, wildcard ini membatalkan
 * seluruh origin guard (website mana pun tetap bisa membaca/mengirim request).
 * Header CORS kini dipasang sekali di dispatcher dan diwarisi oleh response ini.
 */
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
  });
  res.end(JSON.stringify(data));
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { error: message });
}

// Batas ukuran body (anti-DoS memori). 1 MB jauh di atas kebutuhan payload
// konfigurasi/tema terbesar, tapi mencegah penyerang menahan memori dengan
// body puluhan megabyte.
const MAX_BODY_BYTES = 1024 * 1024;

function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    let settled = false;

    const fail = (err) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    req.on('data', chunk => {
      if (settled) return;
      bytes += chunk.length;
      if (bytes > MAX_BODY_BYTES) {
        // Hentikan pembacaan; dispatcher akan mengubahnya menjadi 413.
        const err = new Error(`Body request terlalu besar (maksimal ${MAX_BODY_BYTES} byte)`);
        err.code = 'BODY_TOO_LARGE';
        req.pause();
        fail(err);
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      if (settled) return;
      settled = true;
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error(`JSON body tidak valid: ${err.message}`));
      }
    });

    req.on('error', fail);
  });
}

/**
 * Petakan error pembacaan body ke status HTTP yang tepat.
 * Body kebesaran → 413; JSON rusak / field salah → 400.
 */
function sendBodyError(res, err) {
  if (err && err.code === 'BODY_TOO_LARGE') {
    // Sisa body raksasa tidak akan pernah dibaca. Tutup koneksi setelah response
    // supaya socket tidak menggantung dan merusak request berikutnya di keep-alive.
    res.setHeader('Connection', 'close');
    sendError(res, 413, err.message);
    if (typeof res.on === 'function') {
      res.on('finish', () => {
        if (res.socket && !res.socket.destroyed) {
          try { res.socket.destroy(); } catch (e) {}
        }
      });
    }
    return;
  }
  sendError(res, 400, err.message);
}

module.exports = {
  sendJson,
  sendError,
  parseJsonBody,
  isTrustedLocalOrigin,
  sendBodyError,
  MAX_BODY_BYTES,
};
