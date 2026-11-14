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

      const target = String(payload.target).trim();

      // Validasi format SEBELUM menyentuh jaringan. Format yang tidak dikenali harus
      // ditolak dengan pesan jelas, bukan diteruskan lalu gagal dengan "pastikan live".
      if (!youtubeIngest.parseTarget(target)) {
        sendError(
          res,
          400,
          `Format target tidak dikenali: "${target}". ` +
          'Gunakan @handle, Channel ID (UC...), URL kanal, atau URL live/video YouTube.'
        );
        return true;
      }

      // Tunggu hasil nyata (live / waiting / error) supaya dashboard tidak perlu menebak.
      // Handler connect menangani mode 'waiting' sendiri dan tidak melempar error untuk itu.
      try {
        await youtubeIngest.connect(target);
      } catch (err) {
        sendError(res, 400, err.message);
        return true;
      }

      sendJson(res, 200, {
        success: true,
        target,
        status: youtubeIngest.status,
        liveId: youtubeIngest.activeLiveId,
        channelId: youtubeIngest.activeChannelId,
        profile: youtubeIngest.channelProfile,
      });
    } catch (err) {
      sendBodyError(res, err);
    }
    return true;
  }

  if (pathname === '/api/channel/profile' && req.method === 'POST') {
    try {
      const payload = await parseJsonBody(req);
      if (!payload.target) {
        sendError(res, 400, 'Field "target" wajib diisi');
        return true;
      }

      const target = String(payload.target).trim();
      if (!youtubeIngest.parseTarget(target)) {
        sendError(
          res,
          400,
          `Format target tidak dikenali: "${target}". ` +
          'Gunakan @handle, Channel ID (UC...), URL kanal, atau URL live/video YouTube.'
        );
        return true;
      }

      const resProf = await youtubeIngest.resolver.resolveChannelProfile(target);
      if (resProf && resProf.ok) {
        sendJson(res, 200, { success: true, profile: resProf.profile });
      } else {
        sendError(res, 404, (resProf && resProf.reason) || 'Kanal tidak ditemukan di YouTube.');
      }
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
