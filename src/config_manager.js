/**
 * KY-Poni - Persistent User Configuration Manager
 * Handles reading and writing persistent configuration to OS user data paths:
 * - Linux: ~/.config/ky-poni/config.json ($XDG_CONFIG_HOME/ky-poni/config.json)
 * - Windows: %APPDATA%/KY-Poni/config.json
 * - macOS: ~/Library/Application Support/KY-Poni/config.json
 *
 * Ensures streamer preferences survive across app updates, AppImage mounts, and exe replacements.
 *
 * Cross-platform note: the Windows folder name is `KY-Poni` (capitalised) and the Linux one is
 * `ky-poni` (lowercase) on purpose — they match Electron's own userData folder on each OS so a
 * single directory holds both the app profile and the user's saved preferences.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { legacyIdToCanonical, isLegacyThemeId } = require('./theme_ids');

const DEFAULT_CONFIG = {
  target: '@MilkyPoni',
  theme: 'persona5',
  layout: 'vertical',
  pos: 'bottom-left',
  scale: 100,
  fontSize: 16,
  fontFamily: 'OptimaNova',
  textColor: '#FFFFFF',
  fade: 8,
  keep: 1,
};

/**
 * Resolves the per-platform configuration directory.
 * Exported so ThemeManager and the cross-platform tests share exactly one implementation.
 *
 * @param {object} [options]
 * @param {string} [options.platform] Override process.platform (tests / cross-platform audit)
 * @param {object} [options.env]      Override process.env
 * @param {string} [options.homeDir]  Override os.homedir()
 * @returns {string} absolute config directory
 */
function resolveConfigDir(options = {}) {
  const platform = options.platform || process.platform;
  const env = options.env || process.env;
  const homeDir = options.homeDir || os.homedir();

  if (platform === 'win32') {
    const appData = env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    return path.join(appData, 'KY-Poni');
  }
  if (platform === 'darwin') {
    return path.join(homeDir, 'Library', 'Application Support', 'KY-Poni');
  }
  const configHome = env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
  return path.join(configHome, 'ky-poni');
}

class ConfigManager {
  constructor(legacyConfigDir = null, options = {}) {
    this.legacyConfigDir = legacyConfigDir || path.join(__dirname);
    this.platform = options.platform || process.platform;
    this.env = options.env || process.env;
    this.homeDir = options.homeDir || os.homedir();
    this.configPath = this.resolveConfigPath();
    this.migrateLegacyIfNeeded();
  }

  resolveConfigPath() {
    const configDir = resolveConfigDir({
      platform: this.platform,
      env: this.env,
      homeDir: this.homeDir,
    });

    try {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
    } catch (e) {
      console.warn('[KY-Poni ConfigManager] Failed to create config directory:', e.message);
    }

    return path.join(configDir, 'config.json');
  }

  /**
   * Copies a pre-0.5 config.json that lived next to the source tree into the OS user dir.
   * Runs only when the destination does not exist yet, so it can never clobber live prefs.
   */
  migrateLegacyIfNeeded() {
    const legacyPath = path.join(this.legacyConfigDir, 'config.json');
    if (!fs.existsSync(this.configPath) && fs.existsSync(legacyPath)) {
      try {
        fs.copyFileSync(legacyPath, this.configPath);
        console.log(`[KY-Poni ConfigManager] Migrated legacy local config to: ${this.configPath}`);
      } catch (e) {
        console.warn('[KY-Poni ConfigManager] Legacy migration failed:', e.message);
      }
    }
  }

  getConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed.layout) {
          parsed.layout = parsed.layout.startsWith('horizontal') ? 'horizontal' : 'vertical';
        }
        // Normalize legacy theme ids so callers (and the dashboard select) never see
        // an orphaned identifier that fails to match the catalog list.
        if (parsed.theme && isLegacyThemeId(parsed.theme)) {
          parsed.theme = legacyIdToCanonical(parsed.theme);
        }
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    } catch (e) {
      console.warn('[KY-Poni ConfigManager] Error reading config file, using default:', e.message);
    }
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Merge-write the config. Never mutates the caller's object.
   * Uses temp file + rename so a crash mid-write cannot leave a truncated
   * (unparseable) config.json behind on either POSIX or Windows.
   */
  updateConfig(updates) {
    const current = this.getConfig();
    const safeUpdates = { ...(updates || {}) };
    if (safeUpdates.layout) {
      safeUpdates.layout = safeUpdates.layout.startsWith('horizontal') ? 'horizontal' : 'vertical';
    }
    const updated = { ...current, ...safeUpdates };
    try {
      this.writeAtomic(updated);
      return updated;
    } catch (e) {
      throw new Error(`Gagal menyimpan konfigurasi: ${e.message}`);
    }
  }

  resetConfig() {
    try {
      this.writeAtomic(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    } catch (e) {
      throw new Error(`Gagal mereset konfigurasi: ${e.message}`);
    }
  }

  writeAtomic(payload) {
    const dir = path.dirname(this.configPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tmpPath = `${this.configPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2), 'utf-8');
    try {
      fs.renameSync(tmpPath, this.configPath);
    } catch (e) {
      // Windows can hold a transient lock (antivirus / Explorer preview) on the target.
      // Fall back to a direct overwrite before giving up entirely.
      try { fs.unlinkSync(tmpPath); } catch (cleanupErr) { /* ignore */ }
      fs.writeFileSync(this.configPath, JSON.stringify(payload, null, 2), 'utf-8');
    }
  }
}

module.exports = { ConfigManager, DEFAULT_CONFIG, resolveConfigDir };
