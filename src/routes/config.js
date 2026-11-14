/**
 * KY-Poni - Persistent Configuration Routes
 */

const { sendJson, sendError, parseJsonBody, sendBodyError } = require('./helpers');

async function handleConfigRoutes(req, res, pathname, ctx) {
  const { configManager, broadcast } = ctx;

  if (pathname === '/api/config') {
    if (req.method === 'GET') {
      try {
        const config = configManager.getConfig();
        sendJson(res, 200, config);
      } catch (err) {
        sendError(res, 500, err.message);
      }
      return true;
    }

    if (req.method === 'POST') {
      try {
        const body = await parseJsonBody(req);
        const updated = configManager.updateConfig(body);

        // Beri tahu overlay yang sedang berjalan bahwa preferensi berubah.
        //
        // Yang disiarkan adalah hasil SETELAH sanitasi dan setelah ditulis ke disk
        // (`updated`), bukan `body` mentah. Kalau payload mentah yang disiarkan, overlay
        // bisa menerapkan nilai yang sebenarnya ditolak/dibuang oleh ConfigManager —
        // mis. key di luar skema atau angka di luar rentang.
        //
        // `target` (handle YouTube) sengaja dibuang: overlay tidak membutuhkannya, dan
        // membatasi data yang berpindah ke halaman overlay adalah kebiasaan yang benar.
        broadcastConfigUpdate(updated, broadcast);

        sendJson(res, 200, { success: true, config: updated });
      } catch (err) {
        sendBodyError(res, err);
      }
      return true;
    }
  }

  return false;
}

/**
 * Siarkan perubahan konfigurasi ke seluruh klien WebSocket.
 *
 * Dipisah menjadi fungsi supaya bentuk payload punya satu definisi dan bisa diuji
 * tanpa memanggil HTTP handler.
 *
 * @param {object} config konfigurasi hasil sanitasi
 * @param {function} broadcast fungsi broadcaster dari server
 * @returns {object|null} payload yang disiarkan, atau null bila tidak ada yang disiarkan
 */
function broadcastConfigUpdate(config, broadcast) {
  if (typeof broadcast !== 'function' || !config || typeof config !== 'object') return null;

  const safeConfig = { ...config };
  delete safeConfig.target; // tidak relevan bagi overlay
  delete safeConfig.channelProfile; // tidak relevan bagi overlay

  const payload = { type: 'CONFIG_UPDATED', config: safeConfig };
  broadcast(payload);
  return payload;
}

module.exports = { handleConfigRoutes, broadcastConfigUpdate };
