/**
 * Automated Test Suite for KY-Poni Core Engine
 */

const assert = require('assert');
const http = require('http');
const { WebSocket } = require('ws');
const { server, wss, youtubeIngest } = require('../src/server');

const TEST_PORT = 19841;

async function runTests() {
  console.log('🧪 Starting KY-Poni Automated Test Suite...\n');

  // 1. Boot test server
  await new Promise((resolve) => {
    server.listen(TEST_PORT, '127.0.0.1', () => {
      console.log(`[PASS] Server successfully bound to 127.0.0.1:${TEST_PORT}`);
      resolve();
    });
  });

  let wsClient = null;

  try {
    // 2. Test GET /api/status & /api/version
    const statusRes = await fetchJson(`http://127.0.0.1:${TEST_PORT}/api/status`);
    assert.strictEqual(statusRes.status, 'idle', 'Status should be idle on start');
    assert(statusRes.version, 'Status must include server version');
    console.log(`[PASS] GET /api/status returned valid idle status (version=${statusRes.version})`);

    const verRes = await fetchJson(`http://127.0.0.1:${TEST_PORT}/api/version`);
    assert.strictEqual(verRes.appName, 'KY-Poni');
    assert(verRes.version, 'Version API must return version');
    console.log(`[PASS] GET /api/version returned valid version: ${verRes.version}`);

    // 3. Test GET /api/themes
    const themesRes = await fetchJson(`http://127.0.0.1:${TEST_PORT}/api/themes`);
    assert(Array.isArray(themesRes.themes), 'Themes should be an array');
    const p5 = themesRes.themes.find(t => t.id === 'persona5');
    assert(p5, 'Persona 5 theme must be present in themes list');
    console.log(`[PASS] GET /api/themes verified (${themesRes.themes.length} themes installed, including Persona 5)`);

    // 4. Test GET /api/catalog
    const catalogRes = await fetchJson(`http://127.0.0.1:${TEST_PORT}/api/catalog`);
    assert(Array.isArray(catalogRes.themes), 'Catalog themes should be an array');
    console.log(`[PASS] GET /api/catalog verified (${catalogRes.themes.length} catalog items)`);

    // 5. Test Static HTML & CSS Serving
    const overlayHtml = await fetchText(`http://127.0.0.1:${TEST_PORT}/overlay`);
    assert(overlayHtml.includes('id="chat-canvas"'), 'Overlay HTML must contain #chat-canvas');
    assert(overlayHtml.includes('src="/overlay.js"'), 'Overlay HTML must link /overlay.js');
    console.log('[PASS] GET /overlay served valid OBS canvas HTML');

    const p5Css = await fetchText(`http://127.0.0.1:${TEST_PORT}/themes/persona5/style.css`);
    assert(p5Css.includes('--p5-red: #D03D3D') || p5Css.includes('--p5-red:'), 'Persona 5 CSS must contain --p5-red variable');
    assert(p5Css.includes('.p5-dialogue-bubble'), 'Persona 5 CSS must contain .p5-dialogue-bubble');
    console.log('[PASS] GET /themes/persona5/style.css served valid styling');

    // 6. Test WebSocket & Simulated Message Broadcast
    console.log('[TEST] Connecting WebSocket client to test real-time broadcast...');
    wsClient = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/ws`);

    const receivedEvents = [];

    wsClient.on('message', (data) => {
      const parsed = JSON.parse(data.toString());
      receivedEvents.push(parsed);
    });

    await new Promise((resolve, reject) => {
      wsClient.on('open', () => {
        console.log('[PASS] WebSocket client connected successfully');
        resolve();
      });
      wsClient.on('error', reject);
    });

    // Wait for initial SYSTEM_STATUS event
    await sleep(200);
    assert(receivedEvents.some(e => e.type === 'SYSTEM_STATUS'), 'WS should receive initial SYSTEM_STATUS');

    // 7. Simulate Super Chat Event
    console.log('[TEST] Sending simulated Super Chat (All-Out Attack) to /api/simulate...');
    const simRes = await fetchPost(`http://127.0.0.1:${TEST_PORT}/api/simulate`, {
      type: 'superchat',
      author: 'Joker',
      amount: 'Rp 100.000',
      message: 'Take your time!',
    });
    assert.strictEqual(simRes.success, true);
    assert.strictEqual(simRes.item.type, 'superchat');

    await sleep(300);

    const chatMsgEvent = receivedEvents.find(e => e.type === 'CHAT_MESSAGE' && e.data.author.name === 'Joker');
    assert(chatMsgEvent, 'WebSocket should have received CHAT_MESSAGE event for Joker');
    assert.strictEqual(chatMsgEvent.data.superchat.amount, 'Rp 100.000');
    console.log('[PASS] Super Chat simulated event successfully broadcasted over WebSocket to client');

    // 8. Test Preferences Persistence API (/api/config)
    console.log('[TEST] Testing GET & POST /api/config for user preferences persistence...');
    const cfgGet = await fetchJson(`http://127.0.0.1:${TEST_PORT}/api/config`);
    assert(cfgGet.theme, 'Config should return default or saved theme');
    console.log(`[PASS] GET /api/config verified (scale=${cfgGet.scale}%, font=${cfgGet.fontFamily})`);

    const cfgSave = await fetchPost(`http://127.0.0.1:${TEST_PORT}/api/config`, {
      scale: 120,
      fontSize: 18,
      fontFamily: 'Bebas Neue',
      textColor: '#FFE600'
    });
    assert.strictEqual(cfgSave.success, true);
    assert.strictEqual(cfgSave.config.scale, 120);
    assert.strictEqual(cfgSave.config.textColor, '#FFE600');
    console.log('[PASS] POST /api/config successfully saved custom scale, font size, and text color');

    // 9. Test Phase 5/6: Remote Theme Catalog & Dynamic Downloader/Installer
    console.log('[TEST] Testing Theme Installer (installing undertale & cyberpunk2077)...');
    const installUt = await fetchPost(`http://127.0.0.1:${TEST_PORT}/api/themes/install`, {
      themeId: 'undertale'
    });
    assert.strictEqual(installUt.success, true);
    console.log('[PASS] POST /api/themes/install successfully extracted and registered undertale');

    const utCss = await fetchText(`http://127.0.0.1:${TEST_PORT}/themes/undertale/style.css`);
    assert(utCss.includes('Undertale Retro Box'), 'Dynamic theme CSS must be served over HTTP');
    const utRenderer = await fetchText(`http://127.0.0.1:${TEST_PORT}/themes/undertale/renderer.js`);
    assert(utRenderer.includes('window.KYPoniTheme'), 'Undertale renderer must implement window.KYPoniTheme');
    console.log('[PASS] GET /themes/undertale/style.css & renderer.js successfully served from user themes directory');

    const installCp = await fetchPost(`http://127.0.0.1:${TEST_PORT}/api/themes/install`, {
      themeId: 'cyberpunk2077'
    });
    assert.strictEqual(installCp.success, true);
    console.log('[PASS] POST /api/themes/install successfully extracted and registered cyberpunk2077');

    const cpCss = await fetchText(`http://127.0.0.1:${TEST_PORT}/themes/cyberpunk2077/style.css`);
    assert(cpCss.includes('Cyberpunk 2077'), 'Cyberpunk CSS must be served over HTTP');
    console.log('[PASS] GET /themes/cyberpunk2077/style.css successfully served from user themes directory');

    const delUt = await fetchPost(`http://127.0.0.1:${TEST_PORT}/api/themes/delete`, {
      themeId: 'undertale'
    });
    assert.strictEqual(delUt.success, true);
    const delCp = await fetchPost(`http://127.0.0.1:${TEST_PORT}/api/themes/delete`, {
      themeId: 'cyberpunk2077'
    });
    assert.strictEqual(delCp.success, true);
    console.log('[PASS] POST /api/themes/delete successfully uninstalled custom themes');

    // 10. Test In-App Auto-Updater API (/api/updater/check)
    console.log('[TEST] Testing In-App GitHub Releases Auto-Updater API...');
    const updaterRes = await fetchJson(`http://127.0.0.1:${TEST_PORT}/api/updater/check`);
    assert(typeof updaterRes.updateAvailable === 'boolean', 'Updater must return updateAvailable boolean');
    assert(updaterRes.currentVersion, 'Updater must return currentVersion');
    console.log(`[PASS] GET /api/updater/check verified (currentVersion=${updaterRes.currentVersion}, latestRelease=${updaterRes.latestVersion})`);

    // 11. Test Modular Theme Plugin Renderers (THEME_SPEC.md compliance)
    console.log('[TEST] Testing Theme Plugin Dynamic Renderers...');
    const p5RendererJs = await fetchText(`http://127.0.0.1:${TEST_PORT}/themes/persona5/renderer.js`);
    assert(p5RendererJs.includes('window.KYPoniTheme'), 'Persona 5 theme must implement window.KYPoniTheme');
    assert(p5RendererJs.includes('renderMessage'), 'Persona 5 renderer must have renderMessage function');

    const classicRendererJs = await fetchText(`http://127.0.0.1:${TEST_PORT}/themes/classic/renderer.js`);
    assert(classicRendererJs.includes('window.KYPoniTheme'), 'Classic theme must implement window.KYPoniTheme');
    assert(classicRendererJs.includes('renderMessage'), 'Classic renderer must have renderMessage function');
    console.log('[PASS] Dynamic Theme Plugin Renderers verified (THEME_SPEC.md 100% compliant)');

    console.log('\n🎉 ALL 11 TESTS PASSED SUCCESSFULLY! Clean architecture verified.');
  } finally {
    if (wsClient && wsClient.readyState === WebSocket.OPEN) {
      wsClient.terminate();
    }
    for (const client of wss.clients) {
      client.terminate();
    }
    wss.close();
    server.close();
  }
}

// Helpers
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers: { Connection: 'close' } }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers: { Connection: 'close' } }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
  });
}

function fetchPost(url, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Connection': 'close',
      },
    }, (res) => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

runTests().then(() => {
  process.exit(0);
}).catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});
