/**
 * KY-Poni - Dashboard Boot Behaviour Audit (headless, no browser dependency)
 *
 * Statically verifies the load-order contract in src/public/dashboard.js, because the
 * original field bug was a *sequence* problem that unit tests of ConfigManager cannot see:
 * saved values were applied before the dynamic <option> list existed, then a debounced
 * save overwrote the user's real preference with a default.
 *
 * These assertions fail loudly if someone reintroduces:
 *   - loadSavedConfig() before loadThemes()
 *   - saving on load (no isBootstrapping guard)
 *   - applyThemePresets() on plain theme <select> change
 *
 * Run: node test/test_dashboard_boot.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'src', 'public', 'dashboard.js');
const source = fs.readFileSync(SRC, 'utf-8');

const results = [];
function check(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    console.log(`[FAIL] ${name}: ${err.message}`);
  }
}

/** Extracts the startup IIFE block from the bottom of the file. */
function startupBlock() {
  const marker = 'Startup Initialization';
  const idx = source.indexOf(marker);
  assert.notStrictEqual(idx, -1, 'startup initialisation block not found');
  return source.slice(idx);
}

console.log('🧪 KY-Poni Dashboard Boot-Order Audit\n');

check('Boot guard flag exists', () => {
  assert.ok(/let\s+isBootstrapping\s*=\s*true/.test(source), 'isBootstrapping must be declared and start true');
});

check('scheduleSave() refuses to persist while bootstrapping', () => {
  const fnIdx = source.indexOf('function scheduleSave()');
  assert.notStrictEqual(fnIdx, -1, 'scheduleSave function missing');
  const body = source.slice(fnIdx, fnIdx + 320);
  assert.ok(/if\s*\(\s*isBootstrapping\s*\)\s*return/.test(body), 'scheduleSave must early-return during boot');
});

check('updateOverlayParams() delegates persistence to scheduleSave()', () => {
  const fnIdx = source.indexOf('function updateOverlayParams()');
  assert.notStrictEqual(fnIdx, -1, 'updateOverlayParams missing');
  // function body ends at the next top-level function declaration
  const body = source.slice(fnIdx, source.indexOf('function scheduleSave()'));
  assert.ok(/scheduleSave\(\)/.test(body), 'updateOverlayParams must call scheduleSave(), not set a timer directly');
  assert.ok(!/setTimeout\(\s*saveUserConfig/.test(body), 'updateOverlayParams must not schedule saveUserConfig directly');
});

check('Theme <select> change does NOT apply presets', () => {
  const idx = source.indexOf("selectTheme.addEventListener('change'");
  assert.notStrictEqual(idx, -1, 'selectTheme change handler missing');
  const body = source.slice(idx, idx + 220);
  assert.ok(!/applyThemePresets/.test(body), 'switching theme must not overwrite the user typography preset');
  assert.ok(/updateOverlayParams\(\)/.test(body), 'theme change should still re-render the overlay');
});

check('loadSavedConfig() performs no writes', () => {
  const start = source.indexOf('async function loadSavedConfig()');
  const end = source.indexOf('async function applyConfigToUI');
  assert.notStrictEqual(start, -1, 'loadSavedConfig missing');
  assert.notStrictEqual(end, -1, 'applyConfigToUI missing');
  const body = source.slice(start, end);
  assert.ok(!/saveUserConfig\s*\(/.test(body), 'loadSavedConfig must not call saveUserConfig');
  assert.ok(!/method:\s*'POST'/.test(body), 'loadSavedConfig must not POST anything');
});

check('applyConfigToUI() performs no writes', () => {
  const start = source.indexOf('async function applyConfigToUI');
  const end = source.indexOf('// Copy URL');
  assert.notStrictEqual(start, -1, 'applyConfigToUI missing');
  const body = source.slice(start, end);
  assert.ok(!/saveUserConfig\s*\(/.test(body), 'applyConfigToUI must not call saveUserConfig');
  assert.ok(!/method:\s*'POST'/.test(body), 'applyConfigToUI must not POST anything');
});

check('Startup populates themes BEFORE applying saved config', () => {
  const block = startupBlock();
  const loadThemesIdx = block.indexOf('await loadThemes(');
  const applyIdx = block.indexOf('await applyConfigToUI(');
  assert.notStrictEqual(loadThemesIdx, -1, 'startup must await loadThemes()');
  assert.notStrictEqual(applyIdx, -1, 'startup must await applyConfigToUI()');
  assert.ok(loadThemesIdx < applyIdx, 'loadThemes() must run before applyConfigToUI()');
});

check('Startup releases the boot guard after the UI is hydrated', () => {
  const block = startupBlock();
  assert.ok(/isBootstrapping\s*=\s*false/.test(block), 'startup must set isBootstrapping = false');
  const applyIdx = block.indexOf('await applyConfigToUI(');
  const releaseIdx = block.indexOf('isBootstrapping = false');
  assert.ok(applyIdx !== -1 && releaseIdx > applyIdx, 'guard must be released only after config is applied');
});

check('loadThemes() keeps a still-installed theme instead of forcing the first option', () => {
  const start = source.indexOf('async function loadThemes(');
  const end = source.indexOf('async function installTheme(');
  const body = source.slice(start, end);
  assert.ok(/preferredTheme/.test(body), 'loadThemes must accept a preferred theme id');
  assert.ok(/const resolved = exists \? wanted : data\.themes\[0\]\.id/.test(body),
    'loadThemes must only fall back when the wanted theme is genuinely absent');
});

check('Channel handle has its own debounced save listener', () => {
  assert.ok(/ytTargetInput\.addEventListener\('input'/.test(source),
    'typing the YouTube handle must trigger a save, not rely on another control');
});

check('Fresh install applies presets, plain switch does not', () => {
  const start = source.indexOf('async function installTheme(');
  const end = source.indexOf('async function deleteTheme(');
  const body = source.slice(start, end);
  assert.ok(/applyThemePresets\(themeId\)/.test(body), 'install should apply the theme preset');
  assert.ok(/await saveUserConfig\(\)/.test(body), 'install should flush the preference immediately');
});

check('Explicit preset-reset action exists for the active theme', () => {
  assert.ok(/function resetThemePresets\(/.test(source), 'resetThemePresets() must exist');
  const start = source.indexOf('function resetThemePresets(');
  const body = source.slice(start, start + 400);
  assert.ok(/applyThemePresets\(themeId\)/.test(body), 'reset action must apply presets');
});

check('Saved-but-unlisted font is preserved as an option', () => {
  assert.ok(/Tersimpan/.test(source), 'missing saved font should be appended instead of dropped');
});

// ---------------------------------------------------------------------------
// Kontrak URL statis (v1.2.0)
//
// Ini regresi yang paling mungkin terjadi tanpa disadari: seseorang "merapikan"
// updateOverlayParams() dan mengembalikan URL berparameter ke kotak salin. Akibatnya
// fitur inti hilang tanpa satu pun tes lama gagal.
// ---------------------------------------------------------------------------

check('URL OBS yang disalin bersifat statis (tanpa query string)', () => {
  assert.ok(/STATIC_OVERLAY_URL\s*=/.test(source), 'STATIC_OVERLAY_URL harus dideklarasikan');
  assert.ok(
    /const\s+STATIC_OVERLAY_URL\s*=\s*`\$\{window\.location\.origin\}\/overlay`/.test(source),
    'URL statis harus origin + /overlay, tanpa parameter'
  );
});

check('updateOverlayParams() mengisi kotak URL dengan URL statis, bukan URL berparameter', () => {
  const start = source.indexOf('function updateOverlayParams()');
  const end = source.indexOf('function scheduleSave()');
  const body = source.slice(start, end);
  assert.ok(/obsUrlInput\.value\s*=\s*STATIC_OVERLAY_URL/.test(body), 'kotak URL harus menerima URL statis');
  assert.ok(!/obsUrlInput\.value\s*=\s*previewUrl/.test(body), 'kotak URL tidak boleh menerima URL preview berparameter');
});

check('Iframe preview memakai penanda preview=1', () => {
  const start = source.indexOf('function updateOverlayParams()');
  const end = source.indexOf('function scheduleSave()');
  const body = source.slice(start, end);
  assert.ok(/preview:\s*'1'/.test(body), 'preview harus menandai dirinya ke overlay');
  assert.ok(/previewFrame\.src\s*=\s*previewUrl/.test(body), 'iframe harus memakai URL berparameter');
});

check('URL statis tidak mengandung parameter tema', () => {
  const match = source.match(/const\s+STATIC_OVERLAY_URL\s*=\s*([^;]+);/);
  assert.ok(match, 'deklarasi STATIC_OVERLAY_URL tidak ditemukan');
  assert.ok(!/\?/.test(match[1]), 'URL statis tidak boleh punya query string');
});

check('Reset preferensi memakai font default OptimaNova', () => {
  const start = source.indexOf('async function resetAllPreferences()');
  const body = source.slice(start, start + 1200);
  assert.ok(/selectFont\.value\s*=\s*'OptimaNova'/.test(body), 'reset harus kembali ke font tema default');
});

const failed = results.filter(r => !r.ok);
console.log(`\n${'='.repeat(52)}`);
console.log(`  ${results.length - failed.length}/${results.length} boot-order checks passed`);
if (failed.length) {
  console.log(`  ❌ ${failed.length} FAILED`);
  failed.forEach(f => console.log(`     - ${f.name}: ${f.error}`));
} else {
  console.log('  ✅ Boot order contract intact');
}
console.log('='.repeat(52));

process.exit(failed.length ? 1 : 0);
