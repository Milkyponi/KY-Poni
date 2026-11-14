/**
 * KY-Poni - Preference Persistence & Cross-Platform Path Regression Tests
 *
 * Covers the two field-reported defects:
 *   1. Preferences silently reverting to defaults after opening/updating the app.
 *   2. Downloaded themes appearing "not installed" (asking to download again) after update.
 *
 * Also asserts the Windows/macOS/Linux config + theme directory resolution stays consistent,
 * because a path mismatch between ConfigManager and ThemeManager is what made the Linux fix
 * risky to ship without a cross-platform gate.
 *
 * Run: node test/test_persistence.js
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { ConfigManager, DEFAULT_CONFIG, resolveConfigDir } = require('../src/config_manager');
const { ThemeManager } = require('../src/theme_manager');

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

async function checkAsync(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`[PASS] ${name}`);
  } catch (err) {
    results.push({ name, ok: false, error: err.message });
    console.log(`[FAIL] ${name}: ${err.message}`);
  }
}

function makeTempHome(tag) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `kyp-${tag}-`));
  return dir;
}

function themeFixture(dir, id = 'sample') {
  const themeDir = path.join(dir, id);
  fs.mkdirSync(themeDir, { recursive: true });
  fs.writeFileSync(path.join(themeDir, 'style.css'), '.x{}', 'utf-8');
  fs.writeFileSync(
    path.join(themeDir, 'theme.json'),
    JSON.stringify({ id, name: id, version: '1.0.0', presets: { fontFamily: 'Inter', fontSize: 16 } }),
    'utf-8'
  );
  return themeDir;
}

(async () => {
  console.log('🧪 KY-Poni Persistence & Cross-Platform Regression Suite\n');

  // ---------------------------------------------------------------- path resolution
  console.log('— Config directory resolution (cross-platform) —');

  check('Windows uses %APPDATA%\\KY-Poni under the app data root', () => {
    const resolved = resolveConfigDir({
      platform: 'win32',
      env: { APPDATA: 'C:\\Users\\Milky\\AppData\\Roaming' },
      homeDir: 'C:\\Users\\Milky',
    });
    // The app calls path.join(), which yields backslashes when actually running on Windows
    // and forward slashes when simulating win32 on a Linux runner. Assert the semantics
    // (segments), not the separator, so the test is meaningful on any host.
    const segments = resolved.split(/[\\/]+/).filter(Boolean);
    assert.deepStrictEqual(
      segments.slice(-2),
      ['Roaming', 'KY-Poni'],
      `expected .../Roaming/KY-Poni, got ${resolved}`
    );
    assert.ok(segments.includes('AppData'), `expected AppData in path, got ${resolved}`);
    if (process.platform === 'win32') {
      assert.ok(resolved.includes('\\'), 'native Windows must use backslash separators');
    }
  });

  check('Windows folder name is capitalised KY-Poni (matches Electron userData)', () => {
    const resolved = resolveConfigDir({
      platform: 'win32',
      env: { APPDATA: 'C:\\Users\\Milky\\AppData\\Roaming' },
      homeDir: 'C:\\Users\\Milky',
    });
    assert.ok(resolved.endsWith('KY-Poni'), `expected capitalised KY-Poni, got ${resolved}`);
    assert.ok(!resolved.endsWith('ky-poni'), 'must not use the lowercase Linux folder name');
  });

  check('Windows falls back to AppData/Roaming when APPDATA is unset', () => {
    const resolved = resolveConfigDir({
      platform: 'win32',
      env: {},
      homeDir: 'C:\\Users\\Milky',
    });
    assert.ok(resolved.includes('AppData'));
    assert.ok(resolved.endsWith('KY-Poni'));
  });

  check('Windows theme dir nests under the same base as config.json', () => {
    const base = resolveConfigDir({
      platform: 'win32',
      env: { APPDATA: 'C:\\Users\\Milky\\AppData\\Roaming' },
      homeDir: 'C:\\Users\\Milky',
    });
    const expectedThemes = path.join(base, 'themes');
    assert.ok(expectedThemes.endsWith(path.join('KY-Poni', 'themes')));
  });

  check('Linux honours XDG_CONFIG_HOME', () => {
    const resolved = resolveConfigDir({
      platform: 'linux',
      env: { XDG_CONFIG_HOME: '/custom/xdg' },
      homeDir: '/home/milky',
    });
    assert.strictEqual(resolved, '/custom/xdg/ky-poni');
  });

  check('Linux defaults to ~/.config/ky-poni', () => {
    const resolved = resolveConfigDir({ platform: 'linux', env: {}, homeDir: '/home/milky' });
    assert.strictEqual(resolved, '/home/milky/.config/ky-poni');
  });

  check('macOS uses Application Support/KY-Poni', () => {
    const resolved = resolveConfigDir({ platform: 'darwin', env: {}, homeDir: '/Users/milky' });
    assert.strictEqual(resolved, path.join('/Users/milky', 'Library', 'Application Support', 'KY-Poni'));
  });

  check('ConfigManager and ThemeManager resolve the SAME base directory', () => {
    const homeDir = makeTempHome('samepath');
    const cfgPath = resolveConfigDir({ platform: 'linux', env: {}, homeDir });
    const cm = new ConfigManager(null, { platform: 'linux', env: {}, homeDir });
    assert.strictEqual(path.dirname(cm.configPath), cfgPath);

    const tm = new ThemeManager(
      path.join(homeDir, 'builtin-empty'),
      path.join(homeDir, 'catalog.json'),
      null,
      { platform: 'linux', env: {}, homeDir }
    );
    assert.strictEqual(path.dirname(tm.userThemesDir), cfgPath);
    assert.strictEqual(path.basename(tm.userThemesDir), 'themes');
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------- config persistence
  console.log('\n— Preference persistence —');

  check('Preferences round-trip survives a fresh ConfigManager (app restart)', () => {
    const homeDir = makeTempHome('roundtrip');
    const opts = { platform: 'linux', env: {}, homeDir };

    const first = new ConfigManager(null, opts);
    first.updateConfig({
      theme: 'cyberpunk2077',
      fontFamily: 'Chakra Petch',
      scale: 130,
      textColor: '#FFE600',
    });

    // Simulate a full app restart: brand new instance reading the same user dir.
    const second = new ConfigManager(null, opts);
    const cfg = second.getConfig();
    assert.strictEqual(cfg.theme, 'cyberpunk2077', 'downloaded theme must survive restart');
    assert.strictEqual(cfg.fontFamily, 'Chakra Petch');
    assert.strictEqual(cfg.scale, 130);
    assert.strictEqual(cfg.textColor, '#FFE600');
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  check('updateConfig does not mutate the caller object', () => {
    const homeDir = makeTempHome('nomutate');
    const cm = new ConfigManager(null, { platform: 'linux', env: {}, homeDir });
    const payload = { theme: 'classic', layout: 'horizontal-ticker' };
    cm.updateConfig(payload);
    assert.strictEqual(payload.layout, 'horizontal-ticker', 'caller object must be untouched');
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  check('Atomic write leaves no temp files behind', () => {
    const homeDir = makeTempHome('atomic');
    const cm = new ConfigManager(null, { platform: 'linux', env: {}, homeDir });
    cm.updateConfig({ theme: 'persona3reload' });
    const dir = path.dirname(cm.configPath);
    const leftovers = fs.readdirSync(dir).filter(f => f.includes('.tmp-'));
    assert.deepStrictEqual(leftovers, [], `unexpected temp files: ${leftovers.join(', ')}`);
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  check('channelProfile survives restart and sanitises malicious avatar scheme', () => {
    const homeDir = makeTempHome('profile');
    const cm = new ConfigManager(null, { platform: 'linux', env: {}, homeDir });
    cm.updateConfig({
      target: '@MilkyPoni',
      channelProfile: {
        title: 'Milky Poni',
        avatar: 'javascript:alert(1)',
        channelId: 'UCbtU1G3peng0-uLPHnJdNNQ',
        handle: '@MilkyPoni',
      },
    });

    const second = new ConfigManager(null, { platform: 'linux', env: {}, homeDir });
    const cfg = second.getConfig();
    assert.ok(cfg.channelProfile, 'channelProfile must persist');
    assert.strictEqual(cfg.channelProfile.title, 'Milky Poni');
    assert.strictEqual(cfg.channelProfile.handle, '@MilkyPoni');
    assert.strictEqual(cfg.channelProfile.avatar, '', 'javascript: scheme must be sanitized to empty string');
    assert.strictEqual(cfg.channelProfile.channelId, 'UCbtU1G3peng0-uLPHnJdNNQ');
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  check('Corrupt config.json falls back to defaults instead of crashing', () => {
    const homeDir = makeTempHome('corrupt');
    const cm = new ConfigManager(null, { platform: 'linux', env: {}, homeDir });
    fs.writeFileSync(cm.configPath, '{ this is not json', 'utf-8');
    const cfg = cm.getConfig();
    assert.strictEqual(cfg.theme, DEFAULT_CONFIG.theme);
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------- theme dir migration
  console.log('\n— Legacy theme folder migration (renamed catalog IDs) —');

  check('cyberpunk-2077 folder is renamed to cyberpunk2077', () => {
    const homeDir = makeTempHome('migrate');
    const builtin = path.join(homeDir, 'builtin');
    const opts = { platform: 'linux', env: {}, homeDir };

    const cm = new ConfigManager(null, opts);
    const userThemesDir = path.join(path.dirname(cm.configPath), 'themes');
    fs.mkdirSync(userThemesDir, { recursive: true });
    themeFixture(userThemesDir, 'cyberpunk-2077');

    const tm = new ThemeManager(builtin, path.join(homeDir, 'catalog.json'), null, opts);
    assert.ok(!fs.existsSync(path.join(userThemesDir, 'cyberpunk-2077')), 'legacy folder should be gone');
    assert.ok(fs.existsSync(path.join(userThemesDir, 'cyberpunk2077')), 'canonical folder should exist');

    const ids = tm.getInstalledThemes().map(t => t.id).sort();
    assert.ok(ids.includes('cyberpunk2077'), `theme must be recognised as installed, got: ${ids.join(',')}`);
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  check('undertale-box folder is renamed to undertale', () => {
    const homeDir = makeTempHome('migrate2');
    const opts = { platform: 'linux', env: {}, homeDir };
    const cm = new ConfigManager(null, opts);
    const userThemesDir = path.join(path.dirname(cm.configPath), 'themes');
    fs.mkdirSync(userThemesDir, { recursive: true });
    themeFixture(userThemesDir, 'undertale-box');

    const tm = new ThemeManager(path.join(homeDir, 'builtin'), path.join(homeDir, 'cat.json'), null, opts);
    const ids = tm.getInstalledThemes().map(t => t.id);
    assert.ok(ids.includes('undertale'), `theme must be recognised, got: ${ids.join(',')}`);
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  check('Migration never overwrites an existing canonical folder', () => {
    const homeDir = makeTempHome('migrate3');
    const opts = { platform: 'linux', env: {}, homeDir };
    const cm = new ConfigManager(null, opts);
    const userThemesDir = path.join(path.dirname(cm.configPath), 'themes');
    fs.mkdirSync(userThemesDir, { recursive: true });

    const canonical = themeFixture(userThemesDir, 'cyberpunk2077');
    fs.writeFileSync(path.join(canonical, 'MARKER_MODERN'), 'keep-me', 'utf-8');
    themeFixture(userThemesDir, 'cyberpunk-2077');

    // eslint-disable-next-line no-new
    new ThemeManager(path.join(homeDir, 'builtin'), path.join(homeDir, 'cat.json'), null, opts);

    assert.ok(fs.existsSync(path.join(canonical, 'MARKER_MODERN')), 'modern folder must be preserved');
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  check('Migration is idempotent across repeated boots', () => {
    const homeDir = makeTempHome('migrate4');
    const opts = { platform: 'linux', env: {}, homeDir };
    const cm = new ConfigManager(null, opts);
    const userThemesDir = path.join(path.dirname(cm.configPath), 'themes');
    fs.mkdirSync(userThemesDir, { recursive: true });
    themeFixture(userThemesDir, 'cyberpunk-2077');

    for (let i = 0; i < 3; i++) {
      // eslint-disable-next-line no-new
      new ThemeManager(path.join(homeDir, 'builtin'), path.join(homeDir, 'cat.json'), null, opts);
    }
    const entries = fs.readdirSync(userThemesDir).filter(e => !e.startsWith('.'));
    assert.deepStrictEqual(entries, ['cyberpunk2077'], `expected single canonical folder, got ${entries.join(',')}`);
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------- integration
  await checkAsync('Saved downloaded theme is readable via API-equivalent getConfig after restart', async () => {
    const homeDir = makeTempHome('integration');
    const opts = { platform: 'linux', env: {}, homeDir };
    const cm = new ConfigManager(null, opts);
    const userThemesDir = path.join(path.dirname(cm.configPath), 'themes');
    fs.mkdirSync(userThemesDir, { recursive: true });
    themeFixture(userThemesDir, 'undertale');
    cm.updateConfig({ theme: 'undertale', fontFamily: 'VT323', fontSize: 20 });

    const tm = new ThemeManager(path.join(homeDir, 'builtin'), path.join(homeDir, 'cat.json'), null, opts);
    const installed = tm.getInstalledThemes().map(t => t.id);
    const cfg = new ConfigManager(null, opts).getConfig();

    assert.ok(installed.includes(cfg.theme), 'saved theme must exist in installed list');
    assert.strictEqual(tm.getThemePath(cfg.theme) !== null, true, 'theme path must resolve');
    fs.rmSync(homeDir, { recursive: true, force: true });
  });

  // ---------------------------------------------------------------- summary
  const failed = results.filter(r => !r.ok);
  console.log(`\n${'='.repeat(52)}`);
  console.log(`  ${results.length - failed.length}/${results.length} tests passed`);
  if (failed.length) {
    console.log(`  ❌ ${failed.length} FAILED`);
    failed.forEach(f => console.log(`     - ${f.name}: ${f.error}`));
  } else {
    console.log('  ✅ All persistence & cross-platform tests passed');
  }
  console.log('='.repeat(52));

  process.exit(failed.length ? 1 : 0);
})();
