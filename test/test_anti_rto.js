/**
 * Automated Test: YouTube Ingest Anti-RTO Resilience & Auto-Recovery
 */
const assert = require('assert');
const { YouTubeChatIngest } = require('../src/youtube_ingest');

async function testAntiRTO() {
  console.log('🧪 Testing YouTube Ingest Anti-RTO & Self-Healing Watchdog...');

  const yt = new YouTubeChatIngest();
  let statusEvents = [];
  yt.on('status_change', (s) => statusEvents.push(s));

  // 1. Initial State
  assert.strictEqual(yt.status, 'idle');
  console.log('[PASS] Initial idle status verified');

  // 2. Simulate Target Parsing
  // Kontrak klasifikasi pindah ke youtube_target.js; bentuknya kini punya `kind`.
  // Yang diuji tetap hal yang sama: handle dan URL video dikenali dengan benar.
  assert.deepStrictEqual(yt.parseTarget('@MilkyPoni'), { kind: 'handle', handle: '@MilkyPoni', raw: '@MilkyPoni' });
  assert.deepStrictEqual(yt.parseTarget('https://www.youtube.com/watch?v=dQw4w9WgXcQ'), { kind: 'video', videoId: 'dQw4w9WgXcQ', raw: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  console.log('[PASS] Target parsing verified');

  // 3. Simulate Transient Network RTO / Polling Errors
  yt.status = 'connected';
  yt.currentTarget = '@MilkyPoni';
  yt.activeLiveId = 'live_mock_123';

  // Mock liveChat with event emitter
  const { EventEmitter } = require('events');
  yt.liveChat = new EventEmitter();
  yt.liveChat.stop = () => {};
  yt.setupListeners(yt.liveChat);

  // Simulate 1st transient RTO error
  yt.liveChat.emit('error', new Error('ETIMEDOUT: connect timed out'));
  assert.strictEqual(yt.status, 'reconnecting');
  assert.strictEqual(yt.consecutiveErrors, 1);
  console.log('[PASS] Transient RTO error cleanly transitioned status to "reconnecting"');

  // Simulate network restored: chat arrives
  yt.liveChat.emit('chat', {
    id: 'msg_1',
    author: { name: 'Viewer1' },
    message: [{ text: 'Halo Bos!' }]
  });
  assert.strictEqual(yt.status, 'connected');
  assert.strictEqual(yt.consecutiveErrors, 0);
  assert.strictEqual(yt.messageCount, 1);
  console.log('[PASS] Automatic self-recovery verified: incoming chat restored "connected" state');

  // 4. Simulate Prolonged Outage triggering Self-Healing Reconnect
  for (let i = 0; i < 4; i++) {
    yt.liveChat.emit('error', new Error('ENOTFOUND: www.youtube.com'));
  }
  assert.strictEqual(yt.status, 'reconnecting');
  assert(yt.reconnectAttempts >= 1, 'Self-healing reconnect attempt should be recorded');
  assert(yt.reconnectTimer !== null, 'Reconnect timer should be active');
  console.log('[PASS] Prolonged network drop successfully engaged Self-Healing Watchdog');

  // 5. Clean Disconnect
  await yt.disconnect();
  assert.strictEqual(yt.status, 'idle');
  assert.strictEqual(yt.reconnectTimer, null);
  console.log('[PASS] Disconnect cleanly aborted retry loops and released resources');

  console.log('🎉 Anti-RTO Resilience Test Suite Passed 100%!\n');
}

testAntiRTO().catch(err => {
  console.error('❌ Anti-RTO Test Failed:', err);
  process.exit(1);
});
