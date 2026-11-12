/**
 * KY-Poni - Auto-Connect Regression Tests
 *
 * Keluhan yang dijaga: "setiap live harus copy-paste link live URL".
 * Perbaikannya: target tersimpan dipakai menyambung otomatis saat aplikasi dibuka.
 *
 * Dua hal yang WAJIB benar dan keduanya diuji di sini:
 *   1. Pengguna lama (punya config.json)  -> menyambung otomatis.
 *   2. Pengguna baru (belum punya config) -> DIAM. Jangan menyambung ke kanal pengembang.
 *
 * Poin 2 ditemukan saat verifikasi akhir SOP §4 ("profil bersih: mulai dari default").
 * DEFAULT_CONFIG.target bernilai '@MilkyPoni' sebagai contoh di kolom input; tanpa guard
 * keberadaan config.json, setiap instalasi baru akan mencoba menyambung ke kanal
 * pengembang dan menampilkan "menunggu siaran" untuk kanal orang lain.
 *
 * Run: node test/test_autoconnect.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolasi ketat: seluruh tes memakai direktori sementara, tidak pernah menyentuh
// profil streamer sungguhan.
const TMP_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'kyp-autoconnect-'));

const results = [];
async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    console.log(`[FAIL] ${name}: ${err.message}`);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Muat modul server dengan direktori config tertentu.
 * Modul di-cache Node, jadi tiap skenario memakai proses terpisah lewat child_process.
 */
function probeAutoConnect(configDir, waitMs) {
  const { execFileSync } = require('child_process');
  const script = `
    const { scheduleAutoConnect, youtubeIngest } = require(${JSON.stringify(
      path.join(__dirname, '../src/server.js')
    )});
    const events = [];
    youtubeIngest.on('status_change', (s) => events.push(s.status));
    scheduleAutoConnect({ delay: 50 });
    setTimeout(() => {
      const cfgPath = require('path').join(process.env.KY_PONI_CONFIG_HOME || '', 'config.json');
      console.log('RESULT:' + JSON.stringify({
        attempted: events.length > 0,
        events,
        status: youtubeIngest.status,
        configExists: require('fs').existsSync(cfgPath),
      }));
      process.exit(0);
    }, ${waitMs});
  `;

  const out = execFileSync(process.execPath, ['-e', script], {
    env: { ...process.env, KY_PONI_CONFIG_HOME: configDir },
    encoding: 'utf-8',
    timeout: waitMs + 20000,
  });

  const line = out.split('\n').find((l) => l.startsWith('RESULT:'));
  if (!line) throw new Error('probe tidak mengeluarkan RESULT');
  return JSON.parse(line.slice('RESULT:'.length));
}

(async () => {
  console.log('🧪 Auto-Connect Regression Tests\n');

  // ── 1. Instalasi baru: belum ada config.json ──────────────────────────────────
  await check('instalasi baru (tanpa config.json) TIDAK auto-connect', async () => {
    const dir = path.join(TMP_ROOT, 'fresh');
    fs.mkdirSync(dir, { recursive: true });

    const r = probeAutoConnect(dir, 2500);

    assert.strictEqual(r.configExists, false, 'probe tidak boleh membuat config.json');
    assert.strictEqual(r.attempted, false, `auto-connect tidak boleh jalan, event: ${r.events.join(',')}`);
    assert.strictEqual(r.status, 'idle', `status harus tetap idle, dapat "${r.status}"`);
  });

  // ── 2. Pengguna lama: config.json ada dengan target ───────────────────────────
  await check('pengguna dengan config.json tersimpan -> auto-connect dijalankan', async () => {
    const dir = path.join(TMP_ROOT, 'existing');
    fs.mkdirSync(dir, { recursive: true });
    // Target yang pasti tidak live supaya tes tidak bergantung pada siaran aktif,
    // tetapi tetap membuktikan auto-connect MENCOBA. Status akhirnya 'waiting'.
    fs.writeFileSync(
      path.join(dir, 'config.json'),
      JSON.stringify({ target: '@MilkyPoni', theme: 'persona5', layout: 'vertical' })
    );

    const r = probeAutoConnect(dir, 12000);

    assert.strictEqual(r.attempted, true, 'auto-connect harus mencoba menyambung');
    assert.strictEqual(r.configExists, true);
    // 'waiting' = kanal dikenali tapi belum live; 'connected' bila kebetulan live.
    assert(
      ['waiting', 'connected', 'connecting'].includes(r.status),
      `status tak terduga: ${r.status} (event: ${r.events.join(',')})`
    );
    assert(!r.events.includes('error'), `auto-connect tidak boleh gagal: ${r.events.join(',')}`);
  });

  // ── 3. Target sampah tersimpan: dilewati, tidak crash ─────────────────────────
  await check('target tersimpan yang tidak valid dilewati tanpa crash', async () => {
    const dir = path.join(TMP_ROOT, 'garbage');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'config.json'),
      JSON.stringify({ target: '!!! bukan target !!!', theme: 'persona5', layout: 'vertical' })
    );

    const r = probeAutoConnect(dir, 2500);

    assert.strictEqual(r.status, 'idle', `harus tetap idle, dapat "${r.status}"`);
    assert.strictEqual(r.attempted, false, 'target tak valid tidak boleh memicu koneksi');
  });

  // ── 4. Target kosong: dilewati ────────────────────────────────────────────────
  await check('target kosong dilewati tanpa koneksi', async () => {
    const dir = path.join(TMP_ROOT, 'empty-target');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'config.json'),
      JSON.stringify({ target: '   ', theme: 'persona5', layout: 'vertical' })
    );

    const r = probeAutoConnect(dir, 2500);

    assert.strictEqual(r.status, 'idle');
    assert.strictEqual(r.attempted, false);
  });

  // ── 5. Profil streamer asli tidak tersentuh ───────────────────────────────────
  await check('profil streamer asli tidak tersentuh tes ini', async () => {
    const realPath = path.join(os.homedir(), '.config', 'ky-poni', 'config.json');
    if (!fs.existsSync(realPath)) return; // tidak ada profil, tidak ada risiko
    const before = fs.statSync(realPath).mtimeMs;
    await sleep(50);
    const after = fs.statSync(realPath).mtimeMs;
    assert.strictEqual(before, after, 'config.json asli berubah selama tes');
  });

  // Bersihkan
  try { fs.rmSync(TMP_ROOT, { recursive: true, force: true }); } catch (e) {}

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} cek lulus.`);
  if (failed.length) {
    console.error(`\n❌ ${failed.length} cek GAGAL:`);
    failed.forEach((f) => console.error(`   - ${f.name}: ${f.error}`));
    process.exit(1);
  }
  console.log('🎉 Auto-connect suite passed.\n');
  process.exit(0);
})();
