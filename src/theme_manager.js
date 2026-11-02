/**
 * KY-Poni - Theme Manager & Dynamic Downloader (Phase 3)
 * Manages Built-In and User Custom Themes, Dynamic Downloads from Catalog,
 * and Cross-Platform Storage Paths.
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const os = require('os');
const { exec } = require('child_process');

class ThemeManager {
  constructor(publicThemesDir, catalogPath) {
    this.publicThemesDir = publicThemesDir;
    this.catalogPath = catalogPath;
    this.userThemesDir = this.resolveUserThemesDir();
    this.ensureDirs();
  }

  resolveUserThemesDir() {
    // Cross-platform theme storage
    if (process.platform === 'win32') {
      const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
      return path.join(appData, 'KY-Poni', 'themes');
    } else {
      const configHome = process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config');
      return path.join(configHome, 'ky-poni', 'themes');
    }
  }

  ensureDirs() {
    try {
      if (!fs.existsSync(this.publicThemesDir)) {
        fs.mkdirSync(this.publicThemesDir, { recursive: true });
      }
      if (!fs.existsSync(this.userThemesDir)) {
        fs.mkdirSync(this.userThemesDir, { recursive: true });
      }
    } catch (e) {
      console.warn('[KY-Poni Themes] Failed to create directories:', e.message);
    }
  }

  /**
   * Returns list of all installed themes (both built-in and user-installed)
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
                author: isBuiltIn ? 'Milky Brain' : 'Custom',
                isBuiltIn,
                installed: true,
                path: themeDir,
              };

              if (fs.existsSync(metaPath)) {
                try {
                  const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                  meta = { ...meta, ...parsed, isBuiltIn, installed: true, path: themeDir };
                } catch (e) {
                  // ignore json parse error
                }
              }
              themeMap.set(themeId, meta);
            }
          }
        }
      } catch (e) {
        console.warn(`[KY-Poni Themes] Error scanning ${dir}:`, e.message);
      }
    };

    // Scan user themes first, then built-in
    scanDirectory(this.userThemesDir, false);
    scanDirectory(this.publicThemesDir, true);

    return Array.from(themeMap.values());
  }

  /**
   * Resolves the absolute directory path of an installed theme
   */
  getThemePath(themeId) {
    // Check user custom themes first
    const userTheme = path.join(this.userThemesDir, themeId);
    if (fs.existsSync(path.join(userTheme, 'style.css'))) {
      return userTheme;
    }
    // Check built-in public themes
    const builtInTheme = path.join(this.publicThemesDir, themeId);
    if (fs.existsSync(path.join(builtInTheme, 'style.css'))) {
      return builtInTheme;
    }
    return null;
  }

  /**
   * Returns remote theme catalog with live 'installed' status
   */
  getCatalog() {
    const installed = new Set(this.getInstalledThemes().map((t) => t.id));
    let catalog = { version: '1.0.0', themes: [] };

    if (fs.existsSync(this.catalogPath)) {
      try {
        catalog = JSON.parse(fs.readFileSync(this.catalogPath, 'utf-8'));
      } catch (e) {
        // ignore
      }
    }

    if (Array.isArray(catalog.themes)) {
      catalog.themes = catalog.themes.map((t) => ({
        ...t,
        installed: installed.has(t.id),
      }));
    }

    return catalog;
  }

  /**
   * Installs a theme from a local package path, zip file, or remote URL
   */
  async installTheme(themeId, sourceUrlOrPath) {
    if (!themeId || typeof themeId !== 'string') {
      throw new Error('themeId wajib diisi');
    }

    const targetDir = path.join(this.userThemesDir, themeId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. If it's a local zip file or directory
    if (sourceUrlOrPath && fs.existsSync(sourceUrlOrPath)) {
      const stats = fs.statSync(sourceUrlOrPath);
      if (stats.isDirectory()) {
        copyRecursiveSync(sourceUrlOrPath, targetDir);
      } else if (sourceUrlOrPath.endsWith('.zip')) {
        await this.extractZip(sourceUrlOrPath, targetDir);
      }
    } else if (sourceUrlOrPath && (sourceUrlOrPath.startsWith('http://') || sourceUrlOrPath.startsWith('https://'))) {
      // 2. Download remote archive
      const tempZip = path.join(os.tmpdir(), `ky_poni_theme_${themeId}_${Date.now()}.zip`);
      await this.downloadFile(sourceUrlOrPath, tempZip);
      await this.extractZip(tempZip, targetDir);
      try { fs.unlinkSync(tempZip); } catch (e) {}
    } else {
      throw new Error(`Sumber paket tema tidak valid atau tidak ditemukan: ${sourceUrlOrPath}`);
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
   * Deletes a user-installed theme (cannot delete built-in themes)
   */
  deleteTheme(themeId) {
    const builtInPath = path.join(this.publicThemesDir, themeId);
    if (fs.existsSync(builtInPath)) {
      throw new Error(`Tema "${themeId}" adalah tema bawaan dan tidak dapat dihapus.`);
    }

    const userThemePath = path.join(this.userThemesDir, themeId);
    if (fs.existsSync(userThemePath)) {
      fs.rmSync(userThemePath, { recursive: true, force: true });
      return { success: true, themeId, deleted: true };
    }

    throw new Error(`Tema "${themeId}" tidak ditemukan.`);
  }

  /**
   * Opens the user custom themes folder in the OS file manager
   */
  openThemesFolder() {
    const dir = this.userThemesDir;
    let cmd = '';
    if (process.platform === 'win32') {
      cmd = `explorer "${dir}"`;
    } else if (process.platform === 'darwin') {
      cmd = `open "${dir}"`;
    } else {
      cmd = `xdg-open "${dir}" 2>/dev/null || open "${dir}"`;
    }

    return new Promise((resolve) => {
      exec(cmd, () => resolve(dir));
    });
  }

  downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
      const client = url.startsWith('https://') ? https : http;
      const file = fs.createWriteStream(dest);

      client.get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          // Handle redirect
          return this.downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        }
        if (response.statusCode !== 200) {
          file.close();
          return reject(new Error(`Gagal mengunduh tema: Status HTTP ${response.statusCode}`));
        }
        response.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve(dest));
        });
      }).on('error', (err) => {
        file.close();
        try { fs.unlinkSync(dest); } catch (e) {}
        reject(err);
      });
    });
  }

  extractZip(zipPath, destDir) {
    return new Promise((resolve, reject) => {
      exec(`unzip -o -q "${zipPath}" -d "${destDir}"`, (err) => {
        if (err) {
          return reject(new Error(`Gagal mengekstrak berkas zip: ${err.message}`));
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

module.exports = { ThemeManager };
