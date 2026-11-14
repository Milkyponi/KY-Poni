/**
 * KY-Poni - Overlay Settings Resolver Test Suite
 *
 * Menguji modul yang memutuskan prioritas sumber tampilan overlay:
 *   config server  vs  parameter URL  vs  default.
 *
 * Ini fungsi nyata (bukan pemeriksaan string pada kode), karena kesalahan prioritas
 * adalah kesalahan logika yang tidak akan terlihat dari membaca file.
 *
 * Run: node test/test_overlay_settings.js
 */

const assert = require('assert');
const path = require('path');

const {
  DEFAULTS,
  DEFAULT_MAX,
  resolveSettings,
  normalizeConfig,
  normalizeUrlParams,
  normalizeColor,
  structuralChanged,
  changedKeys,
} = require(path.join(__dirname, '..', 'src', 'public', 'overlay_settings.js'));

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

console.log('🧪 KY-Poni Overlay Settings Resolver\n');

// ---------------------------------------------------------------- default

check('tanpa config & tanpa URL -> seluruh nilai default', () => {
  const s = resolveSettings({ search: '', config: null });
  assert.strictEqual(s.theme, DEFAULTS.theme);
  assert.strictEqual(s.layout, DEFAULTS.layout);
  assert.strictEqual(s.pos, DEFAULTS.pos);
  assert.strictEqual(s.scale, DEFAULTS.scale);
  assert.strictEqual(s.fontSize, DEFAULTS.fontSize);
  assert.strictEqual(s.fontFamily, DEFAULTS.fontFamily);
  assert.strictEqual(s.textColor, DEFAULTS.textColor);
  assert.strictEqual(s.fade, DEFAULTS.fade);
  assert.strictEqual(s.keep, DEFAULTS.keep);
  assert.strictEqual(s.max, DEFAULT_MAX);
});

check('default fontFamily adalah OptimaNova (tema default Persona 5)', () => {
  assert.strictEqual(DEFAULTS.fontFamily, 'OptimaNova');
  const s = resolveSettings({ search: '', config: {} });
  assert.strictEqual(s.fontFamily, 'OptimaNova');
});

check('default textColor sudah dalam bentuk #RRGGBB huruf besar', () => {
  assert.strictEqual(DEFAULTS.textColor, '#FFFFFF');
});

// ---------------------------------------------------------------- prioritas

check('mode normal: config menang atas parameter URL', () => {
  const s = resolveSettings({
    search: '?theme=persona5&layout=vertical&scale=100&font=Space Grotesk',
    config: { theme: 'classic', layout: 'horizontal', scale: 140, fontFamily: 'Bebas Neue' },
    preview: false,
  });
  assert.strictEqual(s.theme, 'classic', 'config harus menang di OBS');
  assert.strictEqual(s.layout, 'horizontal');
  assert.strictEqual(s.scale, 140);
  assert.strictEqual(s.fontFamily, 'Bebas Neue');
});

check('mode preview: parameter URL menang atas config', () => {
  const s = resolveSettings({
    search: '?theme=classic&scale=125&fsize=22',
    config: { theme: 'persona5', scale: 100, fontSize: 16 },
    preview: true,
  });
  assert.strictEqual(s.theme, 'classic', 'slider dashboard harus instan');
  assert.strictEqual(s.scale, 125);
  assert.strictEqual(s.fontSize, 22);
});

check('mode preview hanya menimpa field yang memang ada di URL', () => {
  const s = resolveSettings({
    search: '?scale=130',
    config: { theme: 'persona3reload', fontFamily: 'Agane', textColor: '#FFE600' },
    preview: true,
  });
  assert.strictEqual(s.scale, 130, 'dari URL');
  assert.strictEqual(s.theme, 'persona3reload', 'dari config');
  assert.strictEqual(s.fontFamily, 'Agane', 'dari config');
  assert.strictEqual(s.textColor, '#FFE600', 'dari config');
});

check('config parsial: field yang tidak ada jatuh ke default, bukan undefined', () => {
  const s = resolveSettings({ search: '', config: { theme: 'classic' } });
  assert.strictEqual(s.theme, 'classic');
  assert.strictEqual(s.layout, DEFAULTS.layout);
  assert.strictEqual(s.scale, DEFAULTS.scale);
  assert.notStrictEqual(s.fontFamily, undefined);
});

check('URL lama tanpa config tetap terbaca penuh (kompatibilitas)', () => {
  const s = resolveSettings({
    search: '?theme=persona3reload&layout=horizontal&pos=top-right&scale=75&fsize=20&font=Inter&color=FFE600&fade=5&keep=3&max=6',
    config: null,
  });
  assert.strictEqual(s.theme, 'persona3reload');
  assert.strictEqual(s.layout, 'horizontal');
  assert.strictEqual(s.pos, 'top-right');
  assert.strictEqual(s.scale, 75);
  assert.strictEqual(s.fontSize, 20);
  assert.strictEqual(s.fontFamily, 'Inter');
  assert.strictEqual(s.textColor, '#FFE600');
  assert.strictEqual(s.fade, 5);
  assert.strictEqual(s.keep, 3);
  assert.strictEqual(s.max, 6);
});

check('max tidak pernah datang dari config (hanya parameter URL)', () => {
  const s = resolveSettings({ search: '', config: { max: 20 } });
  assert.strictEqual(s.max, DEFAULT_MAX, 'config tidak boleh mensponsori max');
});

// ---------------------------------------------------------------- pemetaan nama

check('pemetaan nama URL -> config: fsize/font/color', () => {
  const u = normalizeUrlParams('?fsize=24&font=Bangers&color=00F0FF');
  assert.strictEqual(u.fontSize, 24);
  assert.strictEqual(u.fontFamily, 'Bangers');
  assert.strictEqual(u.textColor, '#00F0FF');
});

check('pemetaan terbalik tidak bocor: key config mentah diabaikan dari URL', () => {
  const u = normalizeUrlParams('?fontSize=24&fontFamily=Bangers');
  assert.strictEqual(u.fontSize, undefined, 'URL memakai fsize, bukan fontSize');
  assert.strictEqual(u.fontFamily, undefined);
});

// ---------------------------------------------------------------- normalisasi warna

check('warna dinormalkan: tanpa #, huruf kecil, dan bentuk 3 digit', () => {
  assert.strictEqual(normalizeColor('FFFFFF'), '#FFFFFF');
  assert.strictEqual(normalizeColor('#ffffff'), '#FFFFFF');
  assert.strictEqual(normalizeColor('#fff'), '#FFFFFF');
  assert.strictEqual(normalizeColor('abc'), '#AABBCC');
  assert.strictEqual(normalizeColor('#FFE600CC'), '#FFE600CC');
});

check('warna tidak valid ditolak, bukan diteruskan mentah', () => {
  assert.strictEqual(normalizeColor('merah'), undefined);
  assert.strictEqual(normalizeColor('#GGGGGG'), undefined);
  assert.strictEqual(normalizeColor(''), undefined);
  assert.strictEqual(normalizeColor(null), undefined);
  const s = resolveSettings({ search: '?color=zzz', config: { textColor: '#00F0FF' } });
  assert.strictEqual(s.textColor, '#00F0FF', 'nilai rusak tidak boleh menimpa config');
});

// ---------------------------------------------------------------- validasi

check('layout dinormalkan ke vertical/horizontal', () => {
  assert.strictEqual(resolveSettings({ search: '?layout=horizontal-ticker' }).layout, 'horizontal');
  assert.strictEqual(resolveSettings({ search: '?layout=diagonal' }).layout, 'vertical');
});

check('pos tak dikenal ditolak', () => {
  const s = resolveSettings({ search: '', config: { pos: 'tengah-atas' } });
  assert.strictEqual(s.pos, DEFAULTS.pos);
});

check('pos valid dikenali semua', () => {
  for (const pos of ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']) {
    assert.strictEqual(resolveSettings({ config: { pos } }).pos, pos);
  }
});

check('angka di luar rentang ditolak', () => {
  assert.strictEqual(resolveSettings({ config: { scale: 5000 } }).scale, DEFAULTS.scale);
  assert.strictEqual(resolveSettings({ config: { fontSize: 0 } }).fontSize, DEFAULTS.fontSize);
  assert.strictEqual(resolveSettings({ config: { fade: -1 } }).fade, DEFAULTS.fade);
  assert.strictEqual(resolveSettings({ config: { keep: 999 } }).keep, DEFAULTS.keep);
});

check('skala & font size sebagai string angka tetap diterima', () => {
  const s = resolveSettings({ config: { scale: '120', fontSize: '20' } });
  assert.strictEqual(s.scale, 120);
  assert.strictEqual(s.fontSize, 20);
});

check('theme dengan karakter berbahaya ditolak', () => {
  assert.strictEqual(resolveSettings({ config: { theme: '../etc/passwd' } }).theme, DEFAULTS.theme);
  assert.strictEqual(resolveSettings({ config: { theme: 'a b' } }).theme, DEFAULTS.theme);
});

check('config bukan objek tidak membuat crash', () => {
  assert.deepStrictEqual(normalizeConfig(null), {});
  assert.deepStrictEqual(normalizeConfig('string'), {});
  const s = resolveSettings({ search: '', config: 'rusak' });
  assert.strictEqual(s.theme, DEFAULTS.theme);
});

// ---------------------------------------------------------------- diff struktural

check('structuralChanged: tema/layout/pos dianggap struktural', () => {
  const a = resolveSettings({ config: { theme: 'persona5' } });
  assert.strictEqual(structuralChanged(a, { ...a, theme: 'classic' }), true);
  assert.strictEqual(structuralChanged(a, { ...a, layout: 'horizontal' }), true);
  assert.strictEqual(structuralChanged(a, { ...a, pos: 'top-right' }), true);
});

check('structuralChanged: kosmetik TIDAK dianggap struktural', () => {
  const a = resolveSettings({ config: { theme: 'persona5' } });
  assert.strictEqual(structuralChanged(a, { ...a, scale: 150 }), false);
  assert.strictEqual(structuralChanged(a, { ...a, fontSize: 24 }), false);
  assert.strictEqual(structuralChanged(a, { ...a, fontFamily: 'Inter' }), false);
  assert.strictEqual(structuralChanged(a, { ...a, textColor: '#FFE600' }), false);
  assert.strictEqual(structuralChanged(a, { ...a, fade: 3 }), false);
  assert.strictEqual(structuralChanged(a, { ...a, keep: 5 }), false);
});

check('structuralChanged: setelan identik -> false (guard anti reload-loop)', () => {
  const a = resolveSettings({ search: '?theme=persona5', config: { theme: 'persona5', scale: 100 } });
  const b = resolveSettings({ search: '?theme=persona5', config: { theme: 'persona5', scale: 100 } });
  assert.strictEqual(structuralChanged(a, b), false);
});

check('changedKeys melaporkan field yang berubah', () => {
  const a = { theme: 'persona5', scale: 100, textColor: '#FFFFFF' };
  const b = { theme: 'persona5', scale: 120, textColor: '#FFFFFF' };
  const changed = changedKeys(a, b);
  assert.deepStrictEqual(changed, ['scale']);
});

// ---------------------------------------------------------------- ringkasan

console.log(`\n${fail === 0 ? '✅' : '❌'} Hasil: ${pass} PASS, ${fail} FAIL (total ${pass + fail})`);
if (fail > 0) {
  console.log('\nKegagalan:');
  for (const f of failures) console.log(` - ${f.name}: ${f.error}`);
  process.exit(1);
}
process.exit(0);
