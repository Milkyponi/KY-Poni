/**
 * KY-Poni - Persistent User Configuration Manager
 * Handles reading and writing persistent configuration to OS user data paths:
 * - Linux: ~/.config/ky-poni/config.json ($XDG_CONFIG_HOME/ky-poni/config.json)
 * - Windows: %APPDATA%/KY-Poni/config.json
 * - macOS: ~/Library/Application Support/KY-Poni/config.json
 * 
 * Ensures streamer preferences survive across app updates, AppImage mounts, and exe replacements.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const DEFAULT_CONFIG = {
  target: '@MilkyPoni',
  theme: 'persona5',
  layout: 'vertical-wide',
  pos: 'bottom-left',
  scale: 100,
  fontSize: 16,
  fontFamily: 'Space Grotesk',
  textColor: '#FFFFFF',
  fade: 8,
  keep: 1,
};

class ConfigManager {
  constructor(legacyConfigDir = null) {
    this.legacyConfigDir = legacyConfigDir || path.join(__dirname);
    this.configPath = this.resolveConfigPath();
    this.migrateLegacyIfNeeded();
  }

  resolveConfigPath() {
    let configDir = '';
    if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      configDir = path.join(appData, 'KY-Poni');
    } else if (process.platform === 'darwin') {
      configDir = path.join(os.homedir(), 'Library', 'Application Support', 'KY-Poni');
    } else {
      const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
      configDir = path.join(configHome, 'ky-poni');
    }

    try {
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
    } catch (e) {
      console.warn('[KY-Poni ConfigManager] Failed to create config directory:', e.message);
    }

    return path.join(configDir, 'config.json');
  }

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
        return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
      }
    } catch (e) {
      console.warn('[KY-Poni ConfigManager] Error reading config file, using default:', e.message);
    }
    return { ...DEFAULT_CONFIG };
  }

  updateConfig(updates) {
    const current = this.getConfig();
    const updated = { ...current, ...(updates || {}) };
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(updated, null, 2), 'utf-8');
      return updated;
    } catch (e) {
      throw new Error(`Gagal menyimpan konfigurasi: ${e.message}`);
    }
  }

  resetConfig() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
      return { ...DEFAULT_CONFIG };
    } catch (e) {
      throw new Error(`Gagal mereset konfigurasi: ${e.message}`);
    }
  }
}

module.exports = { ConfigManager, DEFAULT_CONFIG };
