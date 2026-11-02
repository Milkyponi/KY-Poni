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
    // 2. Test GET /api/status
    const statusRes = await fetchJson(`http://127.0.0.1:${TEST_PORT}/api/status`);
    assert.strictEqual(statusRes.status, 'idle', 'Status should be idle on start');
    console.log('[PASS] GET /api/status returned valid idle status');

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
    assert(overlayHtml.includes('id="cutin-overlay"'), 'Overlay HTML must contain #cutin-overlay');
    console.log('[PASS] GET /overlay served valid OBS canvas HTML');

    const p5Css = await fetchText(`http://127.0.0.1:${TEST_PORT}/themes/persona5/style.css`);
    assert(p5Css.includes('--p5-red: #D03D3D') || p5Css.includes('--p5-red:'), 'Persona 5 CSS must contain --p5-red variable');
    assert(p5Css.includes('clip-path: polygon'), 'Persona 5 CSS must contain polygon clip-path');
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

    // 9. Test Phase 3: Theme Catalog & Dynamic Downloader/Installer
    console.log('[TEST] Testing Theme Installer (Phase 3: installing undertale-box)...');
    const installRes = await fetchPost(`http://127.0.0.1:${TEST_PORT}/api/themes/install`, {
      themeId: 'undertale-box'
    });
    assert.strictEqual(installRes.success, true);
    console.log('[PASS] POST /api/themes/install successfully extracted and registered theme');

    const utCss = await fetchText(`http://127.0.0.1:${TEST_PORT}/themes/undertale-box/style.css`);
    assert(utCss.includes('Undertale Retro Box'), 'Dynamic theme CSS must be served over HTTP');
    console.log('[PASS] GET /themes/undertale-box/style.css successfully served from dynamic user themes directory');

    const delRes = await fetchPost(`http://127.0.0.1:${TEST_PORT}/api/themes/delete`, {
      themeId: 'undertale-box'
    });
    assert.strictEqual(delRes.success, true);
    console.log('[PASS] POST /api/themes/delete successfully uninstalled custom theme');

    console.log('\n🎉 ALL 9 TESTS PASSED SUCCESSFULLY! Clean architecture verified.');
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
