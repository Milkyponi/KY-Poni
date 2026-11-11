/**
 * KY-Poni - Security Hardening Regression Tests
 *
 * Covers the two hardening changes (GLM agent, 2026-11-11, see
 * docs/SECURITY-HARDENING-2026-11-11.md):
 *   1. Origin guard: requests bearing an external Origin header are rejected (403)
 *      at both the HTTP dispatcher and the WebSocket upgrade path, while requests
 *      from the app itself (no Origin / localhost Origin) keep working.
 *   2. Theme id validation: malicious themeIds ("../escape", shell metacharacters)
 *      are rejected with 400 before ever touching the filesystem or a shell command.
 *
 * Run: node test/test_security_hardening.js
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { WebSocket } = require('ws');

// Isolate the suite from the real streamer profile BEFORE src/server is required.
const TEST_CONFIG_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'kyp-sec-test-'));
process.env.KY_PONI_CONFIG_HOME = TEST_CONFIG_HOME;

const { server, wss } = require('../src/server');
const { isValidThemeId } = require('../src/theme_manager');

const TEST_PORT = 19842;

async function runTests() {
  console.log('🧪 Starting KY-Poni Security Hardening Test Suite...\n');

  await new Promise((resolve) => {
    server.listen(TEST_PORT, '127.0.0.1', resolve);
  });

  try {
    // ---- 1. Requests without an Origin header (curl, OBS, Electron) still work
    const status = await fetchJson(`http://127.0.0.1:${TEST_PORT}/api/status`);
    assert.strictEqual(status.status, 'idle', 'Request without Origin must reach the API');
    console.log('[PASS] Request without Origin header accepted (curl/OBS/Electron path)');

    // ---- 2. Trusted local origin is accepted
    const simRaw = await fetchPost(
      `http://127.0.0.1:${TEST_PORT}/api/simulate`,
      { type: 'chat', message: 'origin test' },
      `http://localhost:${TEST_PORT}`
    );
    const sim = JSON.parse(simRaw.body);
    assert.strictEqual(simRaw.statusCode, 200, 'Trusted localhost origin must reach the API');
    assert.strictEqual(sim.success, true, 'Trusted localhost origin must be accepted');
    console.log('[PASS] Request with trusted localhost Origin accepted');

    // ---- 3. External origin is rejected with 403
    const evil = await fetchPost(
      `http://127.0.0.1:${TEST_PORT}/api/simulate`,
      { type: 'chat', message: 'should not happen' },
      'https://attacker.example'
    );
    assert.strictEqual(evil.statusCode, 403, 'External Origin must be rejected with 403');
    console.log('[PASS] Request with external Origin rejected (403)');

    // ---- 4. CORS header no longer wildcard
    const preflight = await fetchOptions(`http://127.0.0.1:${TEST_PORT}/api/status`, `http://localhost:${TEST_PORT}`);
    assert.strictEqual(preflight.statusCode, 204, 'Preflight from trusted origin should succeed');
    assert.notStrictEqual(preflight.headers['access-control-allow-origin'], '*',
      'Access-Control-Allow-Origin must never be the wildcard "*"');
    console.log('[PASS] CORS header is no longer wildcard "*"');

    // ---- 5. WebSocket upgrade from external origin is rejected
    const wsRejected = await tryWebSocket('https://attacker.example');
    assert.strictEqual(wsRejected, false, 'WS upgrade with external Origin must be refused');
    console.log('[PASS] WebSocket upgrade from external Origin refused');

    // ---- 6. WebSocket without Origin (OBS/Electron) still accepted
    const wsAccepted = await tryWebSocket(null);
    assert.strictEqual(wsAccepted, true, 'WS upgrade without Origin must still succeed');
    console.log('[PASS] WebSocket upgrade without Origin accepted');

    // ---- 7. Malicious themeIds rejected with 400
    for (const bad of ['../escape', "foo'; calc.exe", 'a/b', 'a\\b', 'a..b', 'UPPER-CASE', '']) {
      const res = await fetchPost(`http://127.0.0.1:${TEST_PORT}/api/themes/install`, { themeId: bad });
      assert.strictEqual(res.statusCode, 400, `themeId "${bad}" must be rejected with 400`);
    }
    console.log('[PASS] Malicious themeIds rejected with 400 on /api/themes/install');

    const delBad = await fetchPost(`http://127.0.0.1:${TEST_PORT}/api/themes/delete`, { themeId: '../../something' });
    assert.strictEqual(delBad.statusCode, 400, 'Malicious delete themeId must be rejected with 400');
    console.log('[PASS] Malicious themeIds rejected with 400 on /api/themes/delete');

    // ---- 8. Valid theme ids still install & delete cleanly (regression)
    assert.strictEqual(isValidThemeId('undertale'), true, 'Valid id must pass isValidThemeId');
    const installRaw = await fetchPost(`http://127.0.0.1:${TEST_PORT}/api/themes/install`, { themeId: 'undertale' });
    const install = JSON.parse(installRaw.body);
    assert.strictEqual(installRaw.statusCode, 200, 'Valid theme install must return 200');
    assert.strictEqual(install.success, true, 'Valid theme install must still succeed');
    const delRaw = await fetchPost(`http://127.0.0.1:${TEST_PORT}/api/themes/delete`, { themeId: 'undertale' });
    const del = JSON.parse(delRaw.body);
    assert.strictEqual(delRaw.statusCode, 200, 'Valid theme delete must return 200');
    assert.strictEqual(del.success, true, 'Valid theme delete must still succeed');
    console.log('[PASS] Valid themeId undertale still installs & deletes cleanly');

    console.log('\n🎉 ALL SECURITY HARDENING TESTS PASSED!');
  } finally {
    for (const client of wss.clients) client.terminate();
    wss.close();
    server.close();
  }
}

// ---- Helpers

async function tryWebSocket(originHeader) {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/ws`, originHeader ? { headers: { Origin: originHeader } } : {});
    const timer = setTimeout(() => { try { ws.terminate(); } catch (e) {} resolve(false); }, 2000);
    ws.on('open', () => { clearTimeout(timer); ws.terminate(); resolve(true); });
    ws.on('error', () => { clearTimeout(timer); resolve(false); });
    ws.on('unexpected-response', () => { clearTimeout(timer); resolve(false); });
  });
}

function fetchJson(url) {
  return rawRequest('GET', url).then((r) => JSON.parse(r.body));
}

function fetchPost(url, payload, originHeader = null) {
  return rawRequest('POST', url, JSON.stringify(payload), originHeader);
}

function fetchOptions(url, originHeader) {
  return rawRequest('OPTIONS', url, null, originHeader);
}

function rawRequest(method, url, body = null, originHeader = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { Connection: 'close' };
    if (originHeader) headers['Origin'] = originHeader;
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method,
      headers,
    }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

runTests().then(() => process.exit(0)).catch((err) => {
  console.error('\n❌ SECURITY TEST SUITE FAILED:', err);
  process.exit(1);
});
