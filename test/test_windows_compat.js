/**
 * KY-Poni - Windows Hard Compatibility Test (simulated win32 runtime)
 *
 * The Linux build is verified end-to-end with a real AppImage. This suite gives the
 * Windows build the same level of scrutiny without needing a Windows CI runner:
 * it forces `platform: 'win32'` with a real %APPDATA% backend and exercises the exact
 * code paths that could regress differently on Windows:
 *
 *   - %APPDATA%\KY-Poni\config.json location and capitalisation
 *   - %APPDATA%\KY-Poni\themes\ folder for downloaded themes
 *   - legacy theme folder rename (cyberpunk-2077 -> cyberpunk2077) on win32
 *   - legacy id normalisation in saved config
 *   - atomic write (rename) behaviour, including the Windows lock fallback
 *
 * Run: node test/test_windows_compat.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const { ConfigManager, resolveConfigDir } = require('../src/config_manager');
const { ThemeManager } = require('../src/theme_manager');
const { legacyIdToCanonical } = require('../src/theme_ids');

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

/** Creates a fake Windows %APPDATA% tree inside a temp dir. */
function windowsHome(tag) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `kyp-win-${tag}-`));
  const appData = path.join(root, 'AppData', 'Roaming');
  fs.mkdirSync(appData, { recursive: true });
  return { root, appData, env: { APPDATA: appData }, opts: { platform: 'win32', env: { APPDATA: appData }, homeDir: root } };
}

function seedTheme(dir, id) {
  const themeDir = path.join(dir, id);
  fs.mkdirSync(themeDir, { recursive: true });
  fs.writeFileSync(path.join(themeDir, 'style.css'), '.t{}', 'utf-8');
  fs.writeFileSync(path.join(themeDir, 'theme.json'), JSON.stringify({ id, name: id, version: '1.0.0' }), 'utf-8');
  return themeDir;
}

(async () => {
  console.log('🪟 KY-Poni Windows Compatibility Suite (simulated win32)\n');

  console.log('— Storage location —');

  await check('config.json lands in %APPDATA%\\KY-Poni with capitalised name', () => {
    const { appData, opts, root } = windowsHome('path');
    const cm = new ConfigManager(null, opts);
    assert.strictEqual(path.dirname(cm.configPath), path.join(appData, 'KY-Poni'));
    fs.rmSync(root, { recursive: true, force: true });
  });

  await check('themes folder is a sibling of config.json inside KY-Poni', () => {
    const { appData, opts, root } = windowsHome('themes');
    const cm = new ConfigManager(null, opts);
    const tm = new ThemeManager(path.join(root, 'builtin'), path.join(root, 'cat.json'), null, opts);
    assert.strictEqual(tm.userThemesDir, path.join(appData, 'KY-Poni', 'themes'));
    // config.json sits directly in KY-Poni; themes/ is one level below it.
    assert.strictEqual(path.dirname(cm.configPath), path.dirname(tm.userThemesDir));
    fs.rmSync(root, { recursive: true, force: true });
  });

  await check('APPDATA unset falls back to <home>\\AppData\\Roaming', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kyp-win-noappdata-'));
    const resolved = resolveConfigDir({ platform: 'win32', env: {}, homeDir: root });
    const segments = resolved.split(/[\\/]+/).filter(Boolean);
    assert.deepStrictEqual(segments.slice(-3), ['AppData', 'Roaming', 'KY-Poni']);
    fs.rmSync(root, { recursive: true, force: true });
  });

  console.log('\n— Persistence round-trip —');

  await check('Preferences survive a full app restart on win32', () => {
    const { opts, root } = windowsHome('roundtrip');
    const first = new ConfigManager(null, opts);
    first.updateConfig({ theme: 'cyberpunk2077', fontFamily: 'Chakra Petch', scale: 130, textColor: '#FFE600' });

    const second = new ConfigManager(null, opts);
    const cfg = second.getConfig();
    assert.strictEqual(cfg.theme, 'cyberpunk2077');
    assert.strictEqual(cfg.fontFamily, 'Chakra Petch');
    assert.strictEqual(cfg.scale, 130);
    fs.rmSync(root, { recursive: true, force: true });
  });

  await check('Atomic write leaves no .tmp files on win32', () => {
    const { opts, root } = windowsHome('atomic');
    const cm = new ConfigManager(null, opts);
    cm.updateConfig({ theme: 'classic' });
    const leftovers = fs.readdirSync(path.dirname(cm.configPath)).filter(f => f.includes('.tmp-'));
    assert.deepStrictEqual(leftovers, []);
    fs.rmSync(root, { recursive: true, force: true });
  });

  await check('Locked target file still gets written (Windows rename fallback)', () => {
    const { opts, root } = windowsHome('lock');
    const cm = new ConfigManager(null, opts);
    cm.updateConfig({ theme: 'persona5' });

    // Simulate a Windows-only condition where rename onto an open handle fails.
    const realRename = fs.renameSync;
    let attempted = false;
    fs.renameSync = () => {
      attempted = true;
      const err = new Error('EPERM: operation not permitted, rename');
      err.code = 'EPERM';
      throw err;
    };
    try {
      cm.updateConfig({ theme: 'undertale' });
    } finally {
      fs.renameSync = realRename;
    }

    assert.ok(attempted, 'rename must be attempted first');
    const cfg = JSON.parse(fs.readFileSync(cm.configPath, 'utf-8'));
    assert.strictEqual(cfg.theme, 'undertale', 'fallback write must still persist the value');
    const leftovers = fs.readdirSync(path.dirname(cm.configPath)).filter(f => f.includes('.tmp-'));
    assert.deepStrictEqual(leftovers, [], 'temp file must be cleaned after fallback');
    fs.rmSync(root, { recursive: true, force: true });
  });

  console.log('\n— Legacy theme migration on win32 —');

  await check('Legacy cyberpunk-2077 folder is renamed to cyberpunk2077', () => {
    const { opts, root } = windowsHome('migrate');
    const cm = new ConfigManager(null, opts);
    const themesDir = path.join(path.dirname(cm.configPath), 'themes');
    fs.mkdirSync(themesDir, { recursive: true });
    seedTheme(themesDir, 'cyberpunk-2077');

    const tm = new ThemeManager(path.join(root, 'builtin'), path.join(root, 'cat.json'), null, opts);
    assert.ok(fs.existsSync(path.join(themesDir, 'cyberpunk2077')));
    assert.ok(!fs.existsSync(path.join(themesDir, 'cyberpunk-2077')));
    assert.ok(tm.getInstalledThemes().some(t => t.id === 'cyberpunk2077'));
    fs.rmSync(root, { recursive: true, force: true });
  });

  await check('Renamed folder still resolves after a simulated EBUSY rename', () => {
    const { opts, root } = windowsHome('busy');
    const cm = new ConfigManager(null, opts);
    const themesDir = path.join(path.dirname(cm.configPath), 'themes');
    fs.mkdirSync(themesDir, { recursive: true });
    seedTheme(themesDir, 'undertale-box');

    const realRename = fs.renameSync;
    fs.renameSync = (from, to) => {
      if (String(from).includes('undertale-box')) {
        const err = new Error('EBUSY: resource busy or locked, rename');
        err.code = 'EBUSY';
        throw err;
      }
      return realRename(from, to);
    };
    let tm;
    try {
      tm = new ThemeManager(path.join(root, 'builtin'), path.join(root, 'cat.json'), null, opts);
    } finally {
      fs.renameSync = realRename;
    }

    assert.ok(fs.existsSync(path.join(themesDir, 'undertale')), 'copy+remove fallback must produce the canonical folder');
    assert.ok(!fs.existsSync(path.join(themesDir, 'undertale-box')), 'legacy folder must be cleaned up');
    assert.ok(tm.getInstalledThemes().some(t => t.id === 'undertale'));
    fs.rmSync(root, { recursive: true, force: true });
  });

  await check('Migrated theme.json with a stale internal id cannot break detection', () => {
    const { opts, root } = windowsHome('staleid');
    const cm = new ConfigManager(null, opts);
    const themesDir = path.join(path.dirname(cm.configPath), 'themes');
    fs.mkdirSync(path.join(themesDir, 'cyberpunk2077'), { recursive: true });
    fs.writeFileSync(path.join(themesDir, 'cyberpunk2077', 'style.css'), '.t{}', 'utf-8');
    // Package built before v0.6.0: folder is modern, internal id is legacy.
    fs.writeFileSync(
      path.join(themesDir, 'cyberpunk2077', 'theme.json'),
      JSON.stringify({ id: 'cyberpunk-2077', name: 'Cyberpunk', version: '1.0.0' }),
      'utf-8'
    );

    const tm = new ThemeManager(path.join(root, 'builtin'), path.join(root, 'cat.json'), null, opts);
    const ids = tm.getInstalledThemes().map(t => t.id);
    assert.ok(ids.includes('cyberpunk2077'), `folder name must win over stale theme.json id, got: ${ids.join(',')}`);
    assert.ok(!ids.includes('cyberpunk-2077'), 'stale id must not leak into the installed list');
    fs.rmSync(root, { recursive: true, force: true });
  });

  console.log('\n— Saved config normalisation —');

  await check('Legacy theme id in config.json is normalised on read', () => {
    const { opts, root } = windowsHome('cfgid');
    const cm = new ConfigManager(null, opts);
    fs.mkdirSync(path.dirname(cm.configPath), { recursive: true });
    fs.writeFileSync(
      cm.configPath,
      JSON.stringify({ target: '@WinUser', theme: 'cyberpunk-2077', scale: 130 }),
      'utf-8'
    );

    const cfg = new ConfigManager(null, opts).getConfig();
    assert.strictEqual(cfg.theme, 'cyberpunk2077', 'saved legacy id must resolve to canonical id');
    fs.rmSync(root, { recursive: true, force: true });
  });

  await check('Normalisation does not rewrite the file on boot (no silent write)', () => {
    const { opts, root } = windowsHome('nowrite');
    const cm = new ConfigManager(null, opts);
    fs.mkdirSync(path.dirname(cm.configPath), { recursive: true });
    const original = JSON.stringify({ theme: 'undertale-box', scale: 100 });
    fs.writeFileSync(cm.configPath, original, 'utf-8');

    // eslint-disable-next-line no-new
    new ConfigManager(null, opts);
    const after = fs.readFileSync(cm.configPath, 'utf-8');
    assert.strictEqual(after, original, 'booting must not rewrite config.json');
    fs.rmSync(root, { recursive: true, force: true });
  });

  await check('legacyIdToCanonical maps both renamed ids and passes modern ids through', () => {
    assert.strictEqual(legacyIdToCanonical('cyberpunk-2077'), 'cyberpunk2077');
    assert.strictEqual(legacyIdToCanonical('undertale-box'), 'undertale');
    assert.strictEqual(legacyIdToCanonical('persona5'), 'persona5');
    assert.strictEqual(legacyIdToCanonical(undefined), undefined);
  });

  await check('Deleted theme leaves no orphaned directory behind', () => {
    const { opts, root } = windowsHome('delete');
    const cm = new ConfigManager(null, opts);
    const themesDir = path.join(path.dirname(cm.configPath), 'themes');
    fs.mkdirSync(themesDir, { recursive: true });
    seedTheme(themesDir, 'undertale');

    const tm = new ThemeManager(path.join(root, 'builtin'), path.join(root, 'cat.json'), null, opts);
    tm.deleteTheme('undertale');
    assert.ok(!fs.existsSync(path.join(themesDir, 'undertale')));
    assert.deepStrictEqual(tm.getInstalledThemes(), []);
    fs.rmSync(root, { recursive: true, force: true });
  });

  await check('Core themes cannot be deleted on win32', () => {
    const { opts, root } = windowsHome('core');
    const tm = new ThemeManager(path.join(root, 'builtin'), path.join(root, 'cat.json'), null, opts);
    assert.throws(() => tm.deleteTheme('persona5'), /tema inti/);
    fs.rmSync(root, { recursive: true, force: true });
  });

  const failed = results.filter(r => !r.ok);
  console.log(`\n${'='.repeat(56)}`);
  console.log(`  ${results.length - failed.length}/${results.length} Windows compatibility checks passed`);
  if (failed.length) {
    console.log(`  ❌ ${failed.length} FAILED`);
    failed.forEach(f => console.log(`     - ${f.name}: ${f.error}`));
  } else {
    console.log('  ✅ Windows path, persistence and migration behaviour verified');
  }
  console.log('='.repeat(56));

  process.exit(failed.length ? 1 : 0);
})();
