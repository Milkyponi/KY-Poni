/**
 * KY-Poni - Persistent Configuration Routes
 */

const { sendJson, sendError, parseJsonBody, sendBodyError } = require('./helpers');

async function handleConfigRoutes(req, res, pathname, ctx) {
  const { configManager } = ctx;

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
        sendJson(res, 200, { success: true, config: updated });
      } catch (err) {
        sendBodyError(res, err);
      }
      return true;
    }
  }

  return false;
}

module.exports = { handleConfigRoutes };
