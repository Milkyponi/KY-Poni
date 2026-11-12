/**
 * KY-Poni - Live Ingest & Simulator Routes
 */

const { sendJson, sendError, parseJsonBody, sendBodyError } = require('./helpers');

async function handleIngestRoutes(req, res, pathname, ctx) {
  const { youtubeIngest } = ctx;

  if (pathname === '/api/connect' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      if (!payload.target) {
        sendError(res, 400, 'Field "target" wajib diisi');
        return true;
      }

      youtubeIngest.connect(payload.target).then(() => {
        console.log(`[KY-Poni] Connected to stream target: ${payload.target}`);
      }).catch(err => {
        console.error(`[KY-Poni] Failed to connect:`, err.message);
      });

      sendJson(res, 200, {
        success: true,
        target: payload.target,
        status: 'connecting',
      });
    } catch (err) {
      sendBodyError(res, err);
    }
    return true;
  }

  if (pathname === '/api/disconnect' && req.method === 'POST') {
    youtubeIngest.disconnect();
    sendJson(res, 200, { success: true, status: 'idle' });
    return true;
  }

  if (pathname === '/api/simulate' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      const simulated = youtubeIngest.simulateMessage(payload.type || 'chat', payload);
      sendJson(res, 200, { success: true, item: simulated });
    } catch (err) {
      sendBodyError(res, err);
    }
    return true;
  }

  return false;
}

module.exports = { handleIngestRoutes };
