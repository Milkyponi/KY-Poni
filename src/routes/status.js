/**
 * KY-Poni - Status, Version & Lifecycle Routes
 */

const { sendJson } = require('./helpers');

function handleStatusRoutes(req, res, pathname, ctx) {
  const { youtubeIngest, pkg } = ctx;

  if (pathname === '/api/status' && req.method === 'GET') {
    sendJson(res, 200, {
      status: youtubeIngest.status,
      target: youtubeIngest.currentTarget,
      liveId: youtubeIngest.activeLiveId,
      channelId: youtubeIngest.activeChannelId,
      messageCount: youtubeIngest.messageCount,
      version: pkg.version,
    });
    return true;
  }

  if (pathname === '/api/version' && req.method === 'GET') {
    sendJson(res, 200, {
      version: pkg.version,
      appName: 'KY-Poni',
    });
    return true;
  }

  if (pathname === '/api/shutdown' && req.method === 'POST') {
    sendJson(res, 200, { success: true, message: 'Server shutting down' });
    setTimeout(() => {
      process.exit(0);
    }, 200);
    return true;
  }

  return false;
}

module.exports = { handleStatusRoutes };
