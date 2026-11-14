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

  // Explicit override. The automated test suite sets this so a test run can never
  // read or write the real streamer profile (it used to clobber a live config.json).
  if (env.KY_PONI_CONFIG_HOME) {
    return env.KY_PONI_CONFIG_HOME;
  }

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
   *
   * Deliberately skipped when running from a packaged archive: inside app.asar the legacy
   * path resolves to the developer's own leftover profile, so a fresh install would silently
   * inherit the developer's scale/font/theme instead of starting from DEFAULT_CONFIG.
   */
  migrateLegacyIfNeeded() {
    const legacyPath = path.join(this.legacyConfigDir, 'config.json');
    if (legacyPath.includes('.asar')) return;
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
        // Tolak berkas yang jelas rusak/terlalu besar (mis. tersisa payload uji)
        // alih-alih memuatnya dan menyebarkan isinya ke seluruh aplikasi.
        const stat = fs.statSync(this.configPath);
        if (stat.size > 256 * 1024) {
          console.warn(`[KY-Poni ConfigManager] config.json terlalu besar (${stat.size} byte), memakai default.`);
          return { ...DEFAULT_CONFIG };
        }

        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw);

        // Hanya key berskema yang diteruskan. Berkas lama yang sempat menyimpan
        // key sampah tidak akan mengontaminasi state aplikasi.
        const clean = {};
        for (const key of Object.keys(DEFAULT_CONFIG)) {
          if (parsed[key] !== undefined) clean[key] = parsed[key];
        }

        if (clean.layout) {
          clean.layout = clean.layout.startsWith('horizontal') ? 'horizontal' : 'vertical';
        }
        // Normalize legacy theme ids so callers (and the dashboard select) never see
        // an orphaned identifier that fails to match the catalog list.
        if (clean.theme && isLegacyThemeId(clean.theme)) {
          clean.theme = legacyIdToCanonical(clean.theme);
        }
        return { ...DEFAULT_CONFIG, ...clean };
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
   *
   * Hanya key yang ada di dalam skema yang disimpan. Sebelumnya key arbitrer
   * dari body HTTP ikut masuk apa adanya — payload 20 MB berisi satu field
   * bernama `x` berhasil tersimpan dan membuat config.json membengkak 20 MB
   * (terjadi sungguhan saat uji batas body). Nilai juga dipangkas sesuai tipe.
   */
  updateConfig(updates) {
    const current = this.getConfig();
    const sanitized = this.sanitizeUpdates(updates);
    const updated = { ...current, ...sanitized };
    try {
      this.writeAtomic(updated);
      return updated;
    } catch (e) {
      throw new Error(`Gagal menyimpan konfigurasi: ${e.message}`);
    }
  }

  /**
   * Saring input dari klien: hanya key yang dikenal, dengan tipe & panjang wajar.
   * Key tak dikenal DIBUANG (bukan dikembalikan sebagai error) supaya klien lama
   * yang mengirim field tambahan tidak tiba-tiba gagal menyimpan preferensi.
   */
  sanitizeUpdates(updates) {
    const out = {};
    if (!updates || typeof updates !== 'object') return out;

    const str = (v, max) => (typeof v === 'string' && v.length <= max ? v : undefined);
    const num = (v, min, max) => (typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : undefined);
    const hex = (v) => (typeof v === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : undefined);
    const oneOf = (v, allowed) => (typeof v === 'string' && allowed.includes(v) ? v : undefined);

    // target: handle/live URL YouTube — dibatasi panjangnya, bukan kontrol karakter.
    if ('target' in updates) {
      const v = str(updates.target, 256);
      if (v !== undefined) out.target = v.replace(/[\x00-\x1f\x7f]/g, '');
    }
    if ('theme' in updates) {
      const v = str(updates.theme, 64);
      // Simpan dalam bentuk KANONIK, bukan bentuk legacy.
      //
      // Sebelumnya normalisasi hanya terjadi di jalur BACA (getConfig), sehingga
      // `cyberpunk-2077` tertulis apa adanya ke config.json dan baru dipetakan ketika
      // dibaca kembali. Akibatnya ada dua representasi untuk satu tema yang sama:
      // nilai di disk/payload tulis berbeda dari nilai yang dibaca/dibagikan. Sekarang
      // satu bentuk saja, jadi disk, GET, dan broadcast selalu sepakat.
      if (v !== undefined) out.theme = legacyIdToCanonical(v);
    }
    if ('layout' in updates) {
      if (typeof updates.layout === 'string') {
        out.layout = updates.layout.startsWith('horizontal') ? 'horizontal' : 'vertical';
      }
    }
    if ('pos' in updates) {
      const v = oneOf(updates.pos, ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'center']);
      if (v !== undefined) out.pos = v;
    }
    if ('scale' in updates) {
      const v = num(updates.scale, 10, 400);
      if (v !== undefined) out.scale = v;
    }
    if ('fontSize' in updates) {
      const v = num(updates.fontSize, 6, 96);
      if (v !== undefined) out.fontSize = v;
    }
    if ('fontFamily' in updates) {
      const v = str(updates.fontFamily, 64);
      if (v !== undefined) out.fontFamily = v;
    }
    if ('textColor' in updates) {
      const v = hex(updates.textColor);
      if (v !== undefined) out.textColor = v;
    }
    if ('fade' in updates) {
      const v = num(updates.fade, 0, 600);
      if (v !== undefined) out.fade = v;
    }
    if ('keep' in updates) {
      const v = num(updates.keep, 0, 200);
      if (v !== undefined) out.keep = v;
    }

    return out;
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
