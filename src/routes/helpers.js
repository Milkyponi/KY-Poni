/**
 * KY-Poni - Route Handler Helpers
 * Zero-dependency JSON body parser and response utilities.
 */

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
};
