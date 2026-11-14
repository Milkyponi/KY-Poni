/**
 * KY-Poni - CONFIG_UPDATED Broadcast Test Suite
 *
 * Menguji bahwa overlay yang sedang berjalan benar-benar menerima perubahan preferensi
 * lewat WebSocket. Ini perilaku jaringan sungguhan: server nyata, klien WS nyata,
 * profil config terisolasi.
 *
 * Yang dijaga suite ini:
 *   - POST /api/config memicu CONFIG_UPDATED
 *   - payload berisi konfigurasi SETELAH sanitasi, bukan body mentah
 *   - field `target` (handle YouTube) tidak ikut tersiar
 *   - nilai di luar skema tidak pernah sampai ke overlay
 *   - tema legacy disiarkan dalam bentuk kanonik
 *   - payload rusak tidak memicu broadcast
 *
 * Run: node test/test_config_broadcast.js
 */

const assert = require('assert');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { WebSocket } = require('ws');

// Isolasi profil SEBELUM server di-require, sama seperti suite lain.
const TEST_CONFIG_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'kyp-broadcast-test-'));
process.env.KY_PONI_CONFIG_HOME = TEST_CONFIG_HOME;

const { server, wss } = require('../src/server');
const { broadcastConfigUpdate } = require('../src/routes/config');

const TEST_PORT = 19843;

let pass = 0;
let fail = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    pass++;
    console.log(`[PASS] ${name}`);
  } catch (err) {
    fail++;
    failures.push({ name, error: err.message });
    console.log(`[FAIL] ${name}: ${err.message}`);
  }
}

function postJson(urlPath, body) {
  return fetch(`http://127.0.0.1:${TEST_PORT}${urlPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, body: await res.json() }));
}

/**
 * Buka klien WS, jalankan aksi, dan tunggu frame CONFIG_UPDATED.
 * Mengembalikan null bila tidak ada frame dalam batas waktu (dipakai untuk
 * membuktikan bahwa broadcast memang TIDAK terjadi).
 */
function expectConfigUpdate(action, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/ws`);
    let settled = false;

    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(); } catch (e) { /* ignore */ }
      resolve(value);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    ws.on('message', (raw) => {
      try {
        const payload = JSON.parse(raw.toString());
        if (payload.type === 'CONFIG_UPDATED') finish(payload);
      } catch (e) { /* abaikan frame non-JSON */ }
    });

    ws.on('open', async () => {
      try {
        const result = await action();
        if (result && result.rejected) {
          // Aksi ditolak: tidak boleh ada broadcast sesudahnya.
          setTimeout(() => finish(null), 250);
        }
      } catch (err) {
        clearTimeout(timer);
        try { ws.close(); } catch (e) { /* ignore */ }
        reject(err);
      }
    });

    ws.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function runTests() {
  console.log('🧪 KY-Poni CONFIG_UPDATED Broadcast Suite\n');

  await new Promise((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));

  try {
    // ---------------------------------------------------------------- unit: bentuk payload

    check('broadcastConfigUpdate membuang `target` dari payload', () => {
      let captured = null;
      const payload = broadcastConfigUpdate(
        { target: '@MilkyPoni', theme: 'persona5', scale: 120 },
        (p) => { captured = p; }
      );
      assert.strictEqual(payload.type, 'CONFIG_UPDATED');
      assert.strictEqual(payload.config.target, undefined, 'target tidak boleh tersiar');
      assert.strictEqual(payload.config.theme, 'persona5');
      assert.strictEqual(payload.config.scale, 120);
      assert.strictEqual(captured, payload, 'broadcast harus dipanggil dengan payload yang sama');
    });

    check('broadcastConfigUpdate tidak memodifikasi objek config masukan', () => {
      const input = { target: '@x', theme: 'classic' };
      broadcastConfigUpdate(input, () => {});
      assert.strictEqual(input.target, '@x', 'objek sumber tidak boleh dimutasi');
    });

    check('broadcastConfigUpdate aman tanpa broadcaster / config rusak', () => {
      assert.strictEqual(broadcastConfigUpdate({ theme: 'x' }, null), null);
      assert.strictEqual(broadcastConfigUpdate(null, () => {}), null);
      assert.strictEqual(broadcastConfigUpdate('rusak', () => {}), null);
    });

    // ---------------------------------------------------------------- integrasi: WS nyata

    const first = await expectConfigUpdate(async () => {
      const r = await postJson('/api/config', { theme: 'classic', scale: 130, fontSize: 22 });
      assert.strictEqual(r.status, 200, 'POST config harus 200');
    });

    check('POST /api/config menyiarkan CONFIG_UPDATED ke klien WS', () => {
      assert.ok(first, 'klien WS harus menerima frame CONFIG_UPDATED');
      assert.strictEqual(first.type, 'CONFIG_UPDATED');
    });

    check('payload berisi nilai baru yang tersimpan', () => {
      assert.ok(first && first.config, 'payload harus punya config');
      assert.strictEqual(first.config.theme, 'classic');
      assert.strictEqual(first.config.scale, 130);
      assert.strictEqual(first.config.fontSize, 22);
    });

    check('payload tidak memuat `target`', () => {
      assert.strictEqual(first.config.target, undefined, 'handle YouTube tidak relevan bagi overlay');
    });

    // ---------------------------------------------------------------- sanitasi

    const sanitized = await expectConfigUpdate(async () => {
      await postJson('/api/config', {
        scale: 9999,          // di luar rentang -> harus dibuang
        nonsenseKey: 'x',     // di luar skema -> harus dibuang
        theme: 'persona3reload',
      });
    });

    check('nilai di luar skema tidak pernah sampai ke overlay', () => {
      assert.ok(sanitized, 'harus tetap ada broadcast untuk field yang sah');
      assert.strictEqual(sanitized.config.theme, 'persona3reload');
      assert.strictEqual(sanitized.config.scale, 130, 'nilai lama dipertahankan, bukan 9999');
      assert.strictEqual(sanitized.config.nonsenseKey, undefined);
    });

    const legacy = await expectConfigUpdate(async () => {
      // 'cyberpunk-2077' (pakai tanda hubung) adalah ID lama; bentuk kanoniknya 'cyberpunk2077'.
      // Memakai 'cyberpunk2077' di sini tidak membuktikan apa pun — itu sudah kanonik.
      await postJson('/api/config', { theme: 'cyberpunk-2077' });
    });

    check('tema legacy disiarkan dalam bentuk kanonik', () => {
      assert.ok(legacy, 'harus ada broadcast');
      assert.strictEqual(legacy.config.theme, 'cyberpunk2077', 'cyberpunk-2077 harus dipetakan ke cyberpunk2077');
    });

    // ---------------------------------------------------------------- tanpa broadcast yang salah

    const badJson = await expectConfigUpdate(async () => {
      const r = await postJson('/api/config', '{ ini bukan json }');
      assert.strictEqual(r.status, 400, 'JSON rusak harus 400');
    });

    check('body JSON rusak tidak memicu broadcast', () => {
      assert.strictEqual(badJson, null, 'tidak boleh ada CONFIG_UPDATED saat request gagal');
    });

    const noChange = await expectConfigUpdate(async () => {
      // Request tanpa field berskema: updateConfig tidak mengubah apa pun yang berarti,
      // tetapi tetap menulis. Broadcast tetap terjadi (idempoten) — yang penting overlay
      // tidak menerapkan nilai sampah.
      await postJson('/api/config', {});
    });

    check('request kosong tetap aman (payload hanya berisi config tersimpan)', () => {
      assert.ok(noChange, 'broadcast tetap terjadi');
      assert.strictEqual(noChange.config.nonsenseKey, undefined);
      assert.strictEqual(typeof noChange.config.theme, 'string');
    });

    // ---------------------------------------------------------------- state akhir

    check('config di disk mencerminkan nilai terakhir yang disiarkan', () => {
      const cfgPath = path.join(TEST_CONFIG_HOME, 'config.json');
      assert.ok(fs.existsSync(cfgPath), 'config.json harus tertulis');
      const onDisk = JSON.parse(fs.readFileSync(cfgPath, 'utf-8'));
      assert.strictEqual(onDisk.theme, noChange.config.theme);
      assert.strictEqual(onDisk.fontFamily, noChange.config.fontFamily);
    });
  } finally {
    for (const client of wss.clients) {
      try { client.terminate(); } catch (e) { /* ignore */ }
    }
    await new Promise((resolve) => wss.close(() => resolve()));
    await new Promise((resolve) => server.close(() => resolve()));
    try { fs.rmSync(TEST_CONFIG_HOME, { recursive: true, force: true }); } catch (e) { /* ignore */ }
  }

  console.log(`\n${fail === 0 ? '✅' : '❌'} Hasil: ${pass} PASS, ${fail} FAIL (total ${pass + fail})`);
  if (fail > 0) {
    console.log('\nKegagalan:');
    for (const f of failures) console.log(` - ${f.name}: ${f.error}`);
    process.exit(1);
  }
  process.exit(0);
}

runTests().catch((err) => {
  console.error('❌ Suite gagal dijalankan:', err);
  process.exit(1);
});
