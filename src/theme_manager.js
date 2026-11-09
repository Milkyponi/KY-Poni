/**
 * KY-Poni - Theme Manager & Dynamic Downloader (Phase 5/6)
 * Manages Built-In Themes and Persistent User Themes, Remote GitHub Catalog,
 * Dynamic Installation/Uninstallation, and Cross-Platform Storage Paths.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');
const { exec } = require('child_process');
const { resolveConfigDir } = require('./config_manager');
const { legacyIdToCanonical, LEGACY_THEME_ID_ALIASES } = require('./theme_ids');

const REMOTE_CATALOG_URL = 'https://raw.githubusercontent.com/Milkyponi/ky-poni-themes/main/catalog.json';

class ThemeManager {
  constructor(publicThemesDir, catalogPath, userThemesDir = null, options = {}) {
    this.publicThemesDir = publicThemesDir;
    this.catalogPath = catalogPath;
    this.platform = options.platform || process.platform;
    this.env = options.env || process.env;
    this.homeDir = options.homeDir || os.homedir();
    this.userThemesDir = userThemesDir || this.resolveUserThemesDir();
    this.cachedRemoteCatalog = null;
    this.lastCatalogFetchTime = 0;
    this.ensureDirs();
  }

  /**
   * User themes live inside the same per-OS config directory that holds config.json,
   * under a `themes/` subfolder. Resolved through the shared ConfigManager helper so the
   * Linux/Windows/macOS paths can never drift apart between modules.
   */
  resolveUserThemesDir() {
    const baseDir = resolveConfigDir({
      platform: this.platform,
      env: this.env,
      homeDir: this.homeDir,
    });
    return path.join(baseDir, 'themes');
  }

  /**
   * Renames theme folders that still carry a pre-v0.6.0 id (cyberpunk-2077 -> cyberpunk2077).
   * Without this, an updated install sees the old folder on disk but the new catalog asks for
   * a different name, so the theme looks "not installed" and users are told to download again.
   * Only renames when the modern folder does not already exist, so it never destroys data.
   *
   * @returns {Array<{from: string, to: string}>} performed migrations
   */
  migrateLegacyThemeDirs() {
    const migrations = [];
    const aliases = LEGACY_THEME_ID_ALIASES;

    for (const [legacyId, canonicalId] of Object.entries(aliases)) {
      const legacyDir = path.join(this.userThemesDir, legacyId);
      const canonicalDir = path.join(this.userThemesDir, canonicalId);

      if (!fs.existsSync(legacyDir)) continue;
      if (fs.existsSync(canonicalDir)) continue; // both present -> keep modern one untouched

      try {
        fs.renameSync(legacyDir, canonicalDir);
        migrations.push({ from: legacyId, to: canonicalId });
        console.log(`[KY-Poni Themes] Migrated legacy theme folder "${legacyId}" -> "${canonicalId}"`);
      } catch (e) {
        // Windows can fail with EPERM/EBUSY while a file is open; fall back to copy + remove.
        try {
          copyRecursiveSync(legacyDir, canonicalDir);
          fs.rmSync(legacyDir, { recursive: true, force: true });
          migrations.push({ from: legacyId, to: canonicalId, method: 'copy' });
          console.log(`[KY-Poni Themes] Copied legacy theme folder "${legacyId}" -> "${canonicalId}"`);
        } catch (copyErr) {
          console.warn(`[KY-Poni Themes] Legacy theme migration failed for "${legacyId}":`, copyErr.message);
        }
      }
    }

    return migrations;
  }

  ensureDirs() {
    try {
      if (!fs.existsSync(this.publicThemesDir)) {
        fs.mkdirSync(this.publicThemesDir, { recursive: true });
      }
    } catch (e) {
      console.warn('[KY-Poni Themes] Note on publicThemesDir:', e.message);
    }

    try {
      if (!fs.existsSync(this.userThemesDir)) {
        fs.mkdirSync(this.userThemesDir, { recursive: true });
      }
    } catch (e) {
      console.warn('[KY-Poni Themes] Failed to create userThemesDir:', e.message);
    }

    // Heal renamed theme folders before any scan happens, so an updated install
    // immediately recognises previously downloaded themes instead of offering re-download.
    try {
      this.migrateLegacyThemeDirs();
    } catch (e) {
      console.warn('[KY-Poni Themes] Legacy theme migration step skipped:', e.message);
    }
  }

  /**
   * Returns list of all installed themes (scans user themes dir and built-in themes dir)
   */
  getInstalledThemes() {
    const themeMap = new Map();

    const scanDirectory = (dir, isBuiltIn) => {
      if (!fs.existsSync(dir)) return;
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const themeId = entry.name;
            const themeDir = path.join(dir, themeId);
            const metaPath = path.join(themeDir, 'theme.json');
            const stylePath = path.join(themeDir, 'style.css');

            if (fs.existsSync(stylePath)) {
              let meta = {
                id: themeId,
                name: themeId,
                version: '1.0.0',
                author: 'Milkyponi',
                isBuiltIn,
                installed: true,
                path: themeDir,
                presets: {},
                fonts: [],
              };

              if (fs.existsSync(metaPath)) {
                try {
                  const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                  meta = { ...meta, ...parsed, isBuiltIn, installed: true, path: themeDir };
                } catch (e) {
                  // ignore json parse error
                }
              }

              // The folder name is authoritative for identity: packages shipped before v0.6.0
              // still carry an old id inside their theme.json (cyberpunk-2077), which would
              // otherwise shadow the canonical id and make the theme look uninstalled.
              const canonicalId = legacyIdToCanonical(themeId);
              meta.id = canonicalId;
              themeMap.set(canonicalId, meta);
            }
          }
        }
      } catch (e) {
        console.warn(`[KY-Poni Themes] Error scanning ${dir}:`, e.message);
      }
    };

    // 1. Scan built-in themes first
    scanDirectory(this.publicThemesDir, true);

    // 2. Scan user persistent themes (can override or extend)
    scanDirectory(this.userThemesDir, false);

    return Array.from(themeMap.values());
  }

  /**
   * Resolves the absolute directory path of an installed theme.
   * Accepts both canonical and legacy ids so old bookmarks/URLs keep working.
   */
  getThemePath(themeId) {
    if (!themeId) return null;
    const canonicalId = legacyIdToCanonical(themeId);

    // 1. Check user persistent directory first (canonical, then legacy folder name)
    for (const candidate of [canonicalId, themeId]) {
      const userTheme = path.join(this.userThemesDir, candidate);
      if (fs.existsSync(path.join(userTheme, 'style.css'))) {
        return userTheme;
      }
    }

    // 2. Fall back to built-in themes directory
    for (const candidate of [canonicalId, themeId]) {
      const builtInTheme = path.join(this.publicThemesDir, candidate);
      if (fs.existsSync(path.join(builtInTheme, 'style.css'))) {
        return builtInTheme;
      }
    }

    return null;
  }

  /**
   * Fetches the theme catalog (preferring remote GitHub, cached for 60s, with local fallback)
   */
  async getCatalog() {
    const installedList = this.getInstalledThemes();
    const installedMap = new Map(installedList.map((t) => [t.id, t]));

    let catalog = null;
    const now = Date.now();

    // Check memory cache (60 seconds)
    if (this.cachedRemoteCatalog && now - this.lastCatalogFetchTime < 60000) {
      catalog = JSON.parse(JSON.stringify(this.cachedRemoteCatalog));
    } else {
      try {
        catalog = await this.fetchRemoteCatalog(REMOTE_CATALOG_URL, 3500);
        this.cachedRemoteCatalog = JSON.parse(JSON.stringify(catalog));
        this.lastCatalogFetchTime = now;
      } catch (err) {
        // Fallback to local catalog file
        if (fs.existsSync(this.catalogPath)) {
          try {
            catalog = JSON.parse(fs.readFileSync(this.catalogPath, 'utf-8'));
          } catch (e) {
            // ignore
          }
        }
      }
    }

    if (!catalog || !Array.isArray(catalog.themes)) {
      catalog = { version: '1.0.0', themes: [] };
    }

    // Merge any installed built-in themes not yet in remote catalog
    installedList.forEach((it) => {
      if (!catalog.themes.some((t) => t.id === it.id)) {
        const p5Idx = catalog.themes.findIndex((t) => t.id === 'persona5');
        const insertIdx = p5Idx !== -1 ? p5Idx + 1 : 0;
        catalog.themes.splice(insertIdx, 0, {
          id: it.id,
          name: it.name,
          version: it.version,
          author: it.author,
          previewColor: it.previewColor || '#00D2FF',
          installed: true,
          isBuiltIn: it.isBuiltIn,
          tags: it.tags || ['JRPG', 'Persona', 'Tartarus', 'Agane'],
          presets: it.presets || {},
          fonts: it.fonts || [],
        });
      }
    });

    // Annotate catalog items with live installation state, presets, and fonts
    catalog.themes = catalog.themes.map((t) => {
      const installedEntry = installedMap.get(t.id);
      return {
        ...t,
        installed: !!installedEntry,
        isBuiltIn: installedEntry ? installedEntry.isBuiltIn : (t.id === 'persona5' || t.id === 'classic' || t.id === 'persona3reload'),
        presets: t.presets || (installedEntry ? installedEntry.presets : {}),
        fonts: t.fonts || (installedEntry ? installedEntry.fonts : []),
      };
    });

    return catalog;
  }

  fetchRemoteCatalog(url, timeoutMs = 3500) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https://') ? https : http;
      const req = client.get(url, { headers: { 'User-Agent': 'KY-Poni-Client' } }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          return this.fetchRemoteCatalog(res.headers.location, timeoutMs).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Remote catalog returned HTTP ${res.statusCode}`));
        }
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try {
            resolve(JSON.parse(raw));
          } catch (e) {
            reject(new Error(`Invalid remote catalog JSON: ${e.message}`));
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(timeoutMs, () => {
        req.destroy();
        reject(new Error('Remote catalog request timed out'));
      });
    });
  }

  /**
   * Installs an official theme package into the user themes directory (~/.config/ky-poni/themes/)
   */
  async installTheme(themeId, sourceUrlOrPath) {
    if (!themeId || typeof themeId !== 'string') {
      throw new Error('themeId wajib diisi');
    }

    this.ensureDirs();
    const targetDir = path.join(this.userThemesDir, themeId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. If local zip file or directory
    if (sourceUrlOrPath && fs.existsSync(sourceUrlOrPath)) {
      const stats = fs.statSync(sourceUrlOrPath);
      if (stats.isDirectory()) {
        copyRecursiveSync(sourceUrlOrPath, targetDir);
      } else if (sourceUrlOrPath.endsWith('.zip')) {
        let realZipPath = sourceUrlOrPath;
        let isTemp = false;
        if (sourceUrlOrPath.includes('.asar')) {
          const tempAsarZip = path.join(os.tmpdir(), `ky_theme_${themeId}_${Date.now()}.zip`);
          fs.writeFileSync(tempAsarZip, fs.readFileSync(sourceUrlOrPath));
          realZipPath = tempAsarZip;
          isTemp = true;
        }
        try {
          await this.extractZip(realZipPath, targetDir);
        } finally {
          if (isTemp) {
            try { fs.unlinkSync(realZipPath); } catch (e) {}
          }
        }
      }
    } else if (sourceUrlOrPath && (sourceUrlOrPath.startsWith('http://') || sourceUrlOrPath.startsWith('https://'))) {
      // 2. Download remote zip archive
      const tempZip = path.join(os.tmpdir(), `ky_theme_${themeId}_${Date.now()}.zip`);
      await this.downloadFile(sourceUrlOrPath, tempZip);
      await this.extractZip(tempZip, targetDir);
      try { fs.unlinkSync(tempZip); } catch (e) {}
    } else {
      throw new Error(`Tema "${themeId}" belum tersedia di server katalog.`);
    }

    // Verify installation
    const stylePath = path.join(targetDir, 'style.css');
    if (!fs.existsSync(stylePath)) {
      throw new Error(`Tema "${themeId}" berhasil diunduh tetapi tidak memiliki berkas "style.css".`);
    }

    return {
      success: true,
      themeId,
      path: targetDir,
      installed: true,
    };
  }

  /**
   * Deletes an installed theme package from the user themes directory.
   * Core themes (persona5, classic) cannot be deleted.
   */
  deleteTheme(themeId) {
    if (themeId === 'persona5' || themeId === 'classic' || themeId === 'persona3reload') {
      throw new Error(`Tema "${themeId}" adalah tema inti bawaan dan tidak dapat dihapus.`);
    }

    const themePath = path.join(this.userThemesDir, themeId);
    if (fs.existsSync(themePath)) {
      fs.rmSync(themePath, { recursive: true, force: true });
      return { success: true, themeId, deleted: true };
    }

    throw new Error(`Tema "${themeId}" tidak ditemukan.`);
  }

  downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https://') ? https : http;
      const file = fs.createWriteStream(dest);

      const req = client.get(url, { headers: { 'User-Agent': 'KY-Poni-Client' } }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          try { fs.unlinkSync(dest); } catch (e) {}
          return this.downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        }
        if (response.statusCode !== 200) {
          file.close();
          try { fs.unlinkSync(dest); } catch (e) {}
          return reject(new Error(`Gagal mengunduh tema: Status HTTP ${response.statusCode}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(dest));
        });
      });

      req.on('error', (err) => {
        file.close();
        try { fs.unlinkSync(dest); } catch (e) {}
        reject(err);
      });
    });
  }

  extractZip(zipPath, destDir) {
    return new Promise((resolve, reject) => {
      let cmd = '';
      if (process.platform === 'win32') {
        cmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${destDir}'"`;
      } else {
        cmd = `unzip -o -q "${zipPath}" -d "${destDir}" || tar -xf "${zipPath}" -C "${destDir}"`;
      }

      exec(cmd, (err) => {
        if (err) {
          return reject(new Error(`Gagal mengekstrak berkas zip tema: ${err.message}`));
        }
        resolve(destDir);
      });
    });
  }
}

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  const stats = exists && fs.statSync(src);
  const isDirectory = exists && stats.isDirectory();
  if (isDirectory) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach((childItemName) => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

module.exports = { ThemeManager, REMOTE_CATALOG_URL };
