/**
 * KY-Poni - Chat Entry Transition Test Suite (v1.3.0)
 *
 * Menguji perilaku nyata modul transisi, bukan pemeriksaan string pada CSS:
 *   1. Arah gerak diturunkan dari anchor (permintaan langsung streamer).
 *   2. Nilai transisi dari config/URL divalidasi terhadap daftar tertutup.
 *   3. Sanitizer server menolak nilai di luar skema.
 *   4. Tema TIDAK lagi memiliki animasi masuk (regresi dua sumber kebenaran).
 *   5. Halaman overlay memuat modul transisi SEBELUM overlay.js.
 *
 * Run: node test/test_transitions.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.join(__dirname, '..');
const Transitions = require(path.join(ROOT, 'src', 'public', 'overlay_transitions.js'));
const Settings = require(path.join(ROOT, 'src', 'public', 'overlay_settings.js'));

const { ConfigManager, DEFAULT_CONFIG, TRANSITION_IDS } = require(path.join(ROOT, 'src', 'config_manager.js'));

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

const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const num = (v) => parseFloat(String(v).replace(/[^0-9.\-]/g, ''));

console.log('\n🧪 KY-Poni CHAT ENTRY TRANSITION Suite (v1.3.0)\n');

// ---------------------------------------------------------------------------
// 1. Daftar transisi & sinkronisasi antar berkas
// ---------------------------------------------------------------------------

check('daftar transisi berisi tepat 5 opsi yang disepakati', () => {
  assert.deepStrictEqual(Transitions.IDS, ['pop', 'slide-x', 'slide-y', 'zoom', 'fade']);
});

check('daftar transisi SINKRON antara resolver, sanitizer, dan settings', () => {
  assert.deepStrictEqual([...Transitions.IDS].sort(), [...TRANSITION_IDS].sort(),
    'overlay_transitions.js dan config_manager.js tidak sepakat');
  assert.deepStrictEqual([...Settings.TRANSITION_IDS].sort(), [...TRANSITION_IDS].sort(),
    'overlay_settings.js dan config_manager.js tidak sepakat');
});

check('bawaan transisi SINKRON di ketiga definisi default', () => {
  assert.strictEqual(Transitions.DEFAULT_ID, 'pop');
  assert.strictEqual(DEFAULT_CONFIG.transition, 'pop');
  assert.strictEqual(Settings.DEFAULTS.transition, 'pop');
});

check('dropdown dashboard menawarkan tepat kelima id transisi', () => {
  const html = read('src/public/index.html');
  const selectStart = html.indexOf('<select id="select-transition">');
  assert.notStrictEqual(selectStart, -1, 'select-transition tidak ada di dashboard');
  const selectBody = html.slice(selectStart, html.indexOf('</select>', selectStart));
  const values = (selectBody.match(/value="([^"]+)"/g) || []).map(s => s.replace(/value="|"/g, ''));
  assert.deepStrictEqual(values.sort(), [...Transitions.IDS].sort());
});

// ---------------------------------------------------------------------------
// 2. Normalisasi input
// ---------------------------------------------------------------------------

check('id transisi tak dikenal ditolak (undefined), bukan diteruskan ke DOM', () => {
  assert.strictEqual(Transitions.normalize('wobble'), undefined);
  assert.strictEqual(Transitions.normalize(''), undefined);
  assert.strictEqual(Transitions.normalize(null), undefined);
  assert.strictEqual(Transitions.normalize(42), undefined);
  assert.strictEqual(Transitions.normalize('"><script>'), undefined);
});

check('id transisi sah diterima, termasuk bentuk berhuruf besar', () => {
  assert.strictEqual(Transitions.normalize('slide-x'), 'slide-x');
  assert.strictEqual(Transitions.normalize('  ZOOM  '), 'zoom');
  assert.strictEqual(Transitions.normalize('Fade'), 'fade');
});

check('id tak dikenal jatuh ke transisi bawaan, bukan tanpa animasi', () => {
  assert.strictEqual(Transitions.resolve('wobble', 'bottom-left').id, 'pop');
  assert.strictEqual(Transitions.resolve(undefined, 'bottom-left').id, 'pop');
});

// ---------------------------------------------------------------------------
// 3. Arah gerak mengikuti anchor — inti permintaan streamer
// ---------------------------------------------------------------------------

console.log('\n  -- arah Slide Menyamping (slide-x) --');

check('anchor KIRI: masuk dari kiri (x negatif), bukan dari kanan', () => {
  ['bottom-left', 'top-left'].forEach(pos => {
    const r = Transitions.resolve('slide-x', pos);
    assert.ok(num(r.x) < 0, `${pos}: x harus negatif, dapat ${r.x}`);
    assert.strictEqual(num(r.y), 0, `${pos}: slide-x tidak boleh bergerak vertikal`);
  });
});

check('anchor KANAN: masuk dari kanan (x positif), bukan dari kiri', () => {
  ['bottom-right', 'top-right'].forEach(pos => {
    const r = Transitions.resolve('slide-x', pos);
    assert.ok(num(r.x) > 0, `${pos}: x harus positif, dapat ${r.x}`);
    assert.strictEqual(num(r.y), 0, `${pos}: slide-x tidak boleh bergerak vertikal`);
  });
});

check('slide-x: jarak awal melewati tepi (>100%) agar bayangan tidak menyembul', () => {
  const r = Transitions.resolve('slide-x', 'bottom-left');
  assert.ok(Math.abs(num(r.x)) > 100, `jarak ${r.x} terlalu kecil, bayangan akan terlihat`);
});

console.log('\n  -- arah Slide Vertikal (slide-y) --');

check('anchor BAWAH: masuk dari bawah (y positif)', () => {
  ['bottom-left', 'bottom-right'].forEach(pos => {
    const r = Transitions.resolve('slide-y', pos);
    assert.ok(num(r.y) > 0, `${pos}: y harus positif, dapat ${r.y}`);
    assert.strictEqual(num(r.x), 0, `${pos}: slide-y tidak boleh bergerak horizontal`);
  });
});

check('anchor ATAS: masuk dari atas (y negatif)', () => {
  ['top-left', 'top-right'].forEach(pos => {
    const r = Transitions.resolve('slide-y', pos);
    assert.ok(num(r.y) < 0, `${pos}: y harus negatif, dapat ${r.y}`);
  });
});

console.log('\n  -- titik tumpu (transform-origin) --');

check('titik tumpu zoom berada di sudut anchor, bukan tengah', () => {
  assert.strictEqual(Transitions.resolve('zoom', 'bottom-left').origin, 'bottom left');
  assert.strictEqual(Transitions.resolve('zoom', 'bottom-right').origin, 'bottom right');
  assert.strictEqual(Transitions.resolve('zoom', 'top-left').origin, 'top left');
  assert.strictEqual(Transitions.resolve('zoom', 'top-right').origin, 'top right');
});

check('zoom mulai dari skala kecil (<1) dan bukan 0', () => {
  const r = Transitions.resolve('zoom', 'bottom-left');
  const from = num(r.scale);
  assert.ok(from > 0 && from < 1, `skala awal ${r.scale} tidak masuk akal untuk zoom-in`);
});

console.log('\n  -- Pop Up mengikuti anchor vertikal --');

check('pop di anchor BAWAH: turun dulu (y positif) lalu naik — gerak slam-in', () => {
  const r = Transitions.resolve('pop', 'bottom-left');
  assert.ok(num(r.y) > 0, `pop bawah harus mulai dari bawah, dapat ${r.y}`);
  assert.ok(num(r.rotate) < 0, 'pop bawah harus miring negatif seperti slam-in P5');
});

check('pop di anchor ATAS: naik dulu (y negatif) lalu turun — gerak slam-down', () => {
  const r = Transitions.resolve('pop', 'top-right');
  assert.ok(num(r.y) < 0, `pop atas harus mulai dari atas, dapat ${r.y}`);
  assert.ok(num(r.rotate) > 0, 'pop atas harus miring positif seperti slam-down P5');
});

check('pop memakai overshoot (skala awal < 1) supaya terasa "menampar"', () => {
  const r = Transitions.resolve('pop', 'bottom-left');
  assert.ok(num(r.scale) < 1);
});

console.log('\n  -- anchor center tidak dikenal tema, tapi tidak boleh crash --');

check('anchor center jatuh ke arah default yang deterministik', () => {
  assert.ok(num(Transitions.resolve('slide-x', 'center').x) < 0, 'center: slide-x masuk dari kiri');
  assert.ok(num(Transitions.resolve('slide-y', 'center').y) > 0, 'center: slide-y masuk dari bawah');
});

check('pos rusak/null tidak membuat resolve melempar error', () => {
  [null, undefined, '', 'sampah', 123].forEach(pos => {
    const r = Transitions.resolve('slide-x', pos);
    assert.ok(r && typeof r.animation === 'string');
  });
});

// ---------------------------------------------------------------------------
// 4. fade tidak bergerak
// ---------------------------------------------------------------------------

check('fade: tanpa pergeseran, tanpa skala, tanpa rotasi', () => {
  const r = Transitions.resolve('fade', 'bottom-right');
  assert.strictEqual(num(r.x), 0);
  assert.strictEqual(num(r.y), 0);
  assert.strictEqual(num(r.scale), 1);
  assert.strictEqual(num(r.rotate), 0);
  assert.strictEqual(r.animation, 'kyp-enter-fade');
});

// ---------------------------------------------------------------------------
// 5. Resolusi config & URL
// ---------------------------------------------------------------------------

check('config menyimpan transisi -> dipakai', () => {
  const s = Settings.resolveSettings({ config: { transition: 'slide-y' } });
  assert.strictEqual(s.transition, 'slide-y');
});

check('tanpa config -> transisi bawaan pop', () => {
  assert.strictEqual(Settings.resolveSettings({}).transition, 'pop');
});

check('config berisi transisi tak dikenal -> jatuh ke bawaan, bukan menyebar', () => {
  const s = Settings.resolveSettings({ config: { transition: 'nyangkut' } });
  assert.strictEqual(s.transition, 'pop');
});

check('URL ?trans= hanya menang di mode preview saat config menyebut nilai lain', () => {
  const preview = Settings.resolveSettings({ search: '?trans=fade', config: { transition: 'zoom' }, preview: true });
  assert.strictEqual(preview.transition, 'fade', 'slider dashboard harus terasa instan');

  const normal = Settings.resolveSettings({ search: '?trans=fade', config: { transition: 'zoom' }, preview: false });
  assert.strictEqual(normal.transition, 'zoom', 'URL tidak boleh mengalahkan config di OBS');
});

check('URL ?trans= tetap berlaku di OBS bila config tidak menyebutnya', () => {
  const s = Settings.resolveSettings({ search: '?trans=zoom', config: { theme: 'classic' } });
  assert.strictEqual(s.transition, 'zoom');
});

check('transisi TIDAK dianggap perubahan struktural (tidak memicu reload overlay)', () => {
  const a = Settings.resolveSettings({ config: { transition: 'pop' } });
  const b = Settings.resolveSettings({ config: { transition: 'slide-x' } });
  assert.strictEqual(Settings.structuralChanged(a, b), false);
  assert.ok(Settings.changedKeys(a, b).includes('transition'), 'perubahan tetap harus terdeteksi');
});

// ---------------------------------------------------------------------------
// 6. Sanitizer server
// ---------------------------------------------------------------------------

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'kyp-transition-test-'));
const cm = new ConfigManager(null, { env: { KY_PONI_CONFIG_HOME: TMP }, platform: 'linux' });

check('server MENYIMPAN transisi yang sah', () => {
  const saved = cm.updateConfig({ transition: 'zoom' });
  assert.strictEqual(saved.transition, 'zoom');
  assert.strictEqual(cm.getConfig().transition, 'zoom');
});

check('server MENOLAK transisi di luar skema (nilai lama dipertahankan)', () => {
  const saved = cm.updateConfig({ transition: 'hack-the-planet' });
  assert.strictEqual(saved.transition, 'zoom', 'nilai tak sah tidak boleh mengganti yang sah');
});

check('server menormalkan huruf besar pada transisi', () => {
  const saved = cm.updateConfig({ transition: ' SLIDE-X ' });
  assert.strictEqual(saved.transition, 'slide-x');
});

check('config.json lama tanpa field transition tetap terbaca dan memakai bawaan', () => {
  const legacyDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kyp-legacy-'));
  fs.writeFileSync(path.join(legacyDir, 'config.json'), JSON.stringify({
    theme: 'persona5', layout: 'vertical', pos: 'bottom-left',
    scale: 100, fontSize: 16, fontFamily: 'OptimaNova', textColor: '#FFFFFF', fade: 8, keep: 1,
  }), 'utf8');
  const legacy = new ConfigManager(null, { env: { KY_PONI_CONFIG_HOME: legacyDir }, platform: 'linux' });
  assert.strictEqual(legacy.getConfig().transition, 'pop');
});

check('reset config mengembalikan transisi ke bawaan', () => {
  cm.updateConfig({ transition: 'fade' });
  assert.strictEqual(cm.resetConfig().transition, 'pop');
});

// ---------------------------------------------------------------------------
// 7. Regresi: tema tidak lagi memiliki animasi MASUK
// ---------------------------------------------------------------------------

console.log('\n  -- regresi dua sumber kebenaran --');

const THEMES = ['persona5', 'persona3reload', 'classic'];

THEMES.forEach(theme => {
  check(`tema "${theme}": .chat-entry tidak mendeklarasikan animation masuk`, () => {
    const css = read(`src/public/themes/${theme}/style.css`);
    const start = css.indexOf('.chat-entry {');
    assert.notStrictEqual(start, -1, '.chat-entry tidak ditemukan');
    const block = css.slice(start, css.indexOf('}', start));
    assert.ok(!/animation\s*:/i.test(block),
      'tema masih mendeklarasikan animation pada .chat-entry — animasi masuk harus milik kustomisasi');
  });
});

check('keyframe masuk lama sudah tidak ada di tema mana pun', () => {
  const legacy = ['p5-slam-in', 'p5-slam-down', 'p3r-slide-in', 'clean-fade'];
  THEMES.forEach(theme => {
    const css = read(`src/public/themes/${theme}/style.css`);
    legacy.forEach(name => {
      // Jangkar `\s*{` WAJIB: pola `\b` juga cocok pada nama turunan seperti
      // "clean-fade-out" (animasi KELUAR yang memang harus tetap ada), sehingga
      // pemeriksaan longgar akan melaporkan kegagalan palsu.
      assert.ok(!new RegExp(`@keyframes\\s+${name}\\s*{`).test(css),
        `keyframe masuk "${name}" masih ada di tema ${theme}`);
    });
  });
});

check('animasi KELUAR tetap milik tema (tidak ikut dihapus)', () => {
  assert.ok(/\.chat-entry\.is-exiting\s*{[^}]*animation:/.test(read('src/public/themes/classic/style.css')),
    'classic kehilangan animasi keluar');
  assert.ok(/\.chat-entry\.is-exiting\s*{[^}]*animation:/.test(read('src/public/themes/persona5/style.css')),
    'persona5 kehilangan animasi keluar');
});

check('lapisan transisi mendefinisikan keyframe yang dirujuk resolver', () => {
  const css = read('src/public/overlay_transitions.css');
  ['kyp-enter-pop', 'kyp-enter-slide', 'kyp-enter-zoom', 'kyp-enter-fade'].forEach(name => {
    assert.ok(new RegExp(`@keyframes\\s+${name}\\b`).test(css), `keyframe ${name} hilang dari CSS`);
  });
});

check('CSS transisi menangani kelima nilai data-transition', () => {
  const css = read('src/public/overlay_transitions.css');
  Transitions.IDS.forEach(id => {
    assert.ok(css.includes(`data-transition="${id}"`), `tidak ada aturan untuk transisi "${id}"`);
  });
});

check('CSS transisi memiliki penjaga kyp-static (anti animasi ulang saat rebuild)', () => {
  const css = read('src/public/overlay_transitions.css');
  assert.ok(/\.chat-entry\.kyp-static/.test(css), 'penjaga kyp-static hilang');
  assert.ok(/animation:\s*none\s*!important/.test(css), 'penjaga harus mematikan animasi secara tegas');
});

// Regresi yang SUDAH TERJADI: penjaga kyp-static memakai `animation: none !important`
// dengan spesifisitas (id + atribut + 2 kelas), sehingga ia juga membunuh animasi
// KELUAR milik tema (yang hanya 2 kelas). Akibatnya balon menghilang mendadak tanpa
// fade — tapi hanya untuk pesan yang kebetulan tampil saat slider digeser. Ditemukan
// lewat uji browser, bukan lewat membaca kode, jadi dikunci di sini.
check('penjaga kyp-static TIDAK membunuh animasi keluar (:not(.is-exiting) wajib)', () => {
  const css = read('src/public/overlay_transitions.css');
  const rule = css.match(/#chat-canvas\[data-transition\]\s+\.chat-entry\.kyp-static[^{]*\{/);
  assert.ok(rule, 'aturan penjaga kyp-static tidak ditemukan');
  assert.ok(/:not\(\.is-exiting\)/.test(rule[0]),
    'selektor penjaga wajib mengecualikan .is-exiting, kalau tidak animasi auto-hide tema mati');
});

// ---------------------------------------------------------------------------
// 8. Boot order halaman overlay
// ---------------------------------------------------------------------------

check('overlay.html memuat CSS transisi setelah stylesheet tema', () => {
  const html = read('src/public/overlay.html');
  const themeIdx = html.indexOf('id="theme-stylesheet"');
  const transIdx = html.indexOf('overlay_transitions.css');
  assert.notStrictEqual(transIdx, -1, 'overlay_transitions.css tidak dimuat');
  assert.ok(transIdx > themeIdx, 'CSS transisi harus dimuat setelah stylesheet tema');
});

check('overlay.html memuat overlay_transitions.js SEBELUM overlay.js', () => {
  const html = read('src/public/overlay.html');
  const scriptIdx = html.indexOf('/overlay_transitions.js');
  const overlayIdx = html.indexOf('/overlay.js');
  assert.notStrictEqual(scriptIdx, -1, 'overlay_transitions.js tidak dimuat');
  assert.ok(scriptIdx < overlayIdx, 'resolver harus tersedia sebelum overlay.js berjalan');
});

check('overlay.js menandai via kyp-entering (pesan baru) & kyp-static (rebuild)', () => {
  const js = read('src/public/overlay.js');
  assert.ok(/classList\.add\('kyp-entering'\)/.test(js), 'kelas kyp-entering tidak dipasang core');
  assert.ok(/classList\.add\('kyp-static'\)/.test(js), 'kelas kyp-static tidak dipasang pada rebuild');
  assert.ok(js.indexOf("function markStatic") < js.indexOf("function rebuildDom"),
    'markStatic harus didefinisikan sebelum dipakai rebuildDom');
});

check('mengganti transisi TIDAK dirender ulang lewat rebuildDom', () => {
  const js = read('src/public/overlay.js');
  const start = js.indexOf('var cosmetic = changed.filter');
  assert.notStrictEqual(start, -1, 'penjaga filter transisi hilang');
  const block = js.slice(start, start + 400);
  assert.ok(block.includes("key !== 'transition'"), 'transisi harus dikecualikan dari rebuild');
});

check('overlay.js tetap jalan walau modul transisi gagal termuat', () => {
  const js = read('src/public/overlay.js');
  assert.ok(/window\.KYPoniTransitions \|\| null/.test(js), 'modul transisi harus dibaca secara defensif');
  assert.ok(/if \(!Transitions\) return;/.test(js), 'markEntering harus aman tanpa modul transisi');
});

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* ignore */ }

const failed = failures.length;
console.log(`\n${'='.repeat(52)}`);
console.log(`  ${pass}/${pass + failed} transition checks passed`);
if (failed) {
  console.log(`  ❌ ${failed} FAILED`);
  failures.forEach(f => console.log(`     - ${f.name}: ${f.error}`));
} else {
  console.log('  ✅ Chat entry transition contract intact');
}
console.log('='.repeat(52));

process.exit(failed ? 1 : 0);
