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
    this.ensureDirs();
  }

  ensureDirs() {
    try {
      if (!fs.existsSync(this.publicThemesDir)) {
        fs.mkdirSync(this.publicThemesDir, { recursive: true });
      }
    } catch (e) {
      console.warn('[KY-Poni Themes] Failed to create directories:', e.message);
    }
  }

  /**
   * Returns list of all installed themes (curated official themes only)
   */
  getInstalledThemes() {
    const themeMap = new Map();

    const scanDirectory = (dir) => {
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
                author: 'Milky Brain',
                isBuiltIn: true,
                installed: true,
                path: themeDir,
              };

              if (fs.existsSync(metaPath)) {
                try {
                  const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
                  meta = { ...meta, ...parsed, isBuiltIn: true, installed: true, path: themeDir };
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

    // Only scan official built-in themes directory
    scanDirectory(this.publicThemesDir);

    return Array.from(themeMap.values());
  }

  /**
   * Resolves the absolute directory path of an official theme
   */
  getThemePath(themeId) {
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
   * Installs an official theme package into the themes directory
   */
  async installTheme(themeId, sourceUrlOrPath) {
    if (!themeId || typeof themeId !== 'string') {
      throw new Error('themeId wajib diisi');
    }

    const targetDir = path.join(this.publicThemesDir, themeId);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // 1. If it's a local zip file or directory
    if (sourceUrlOrPath && fs.existsSync(sourceUrlOrPath)) {
      const stats = fs.statSync(sourceUrlOrPath);
      if (stats.isDirectory()) {
        copyRecursiveSync(sourceUrlOrPath, targetDir);
      } else if (sourceUrlOrPath.endsWith('.zip')) {
        // If zip is packaged inside asar, copy to temporary real filesystem first
        let realZipPath = sourceUrlOrPath;
        let isTemp = false;
        if (sourceUrlOrPath.includes('.asar')) {
          const tempAsarZip = path.join(os.tmpdir(), `ky_theme_extract_${Date.now()}.zip`);
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
      // 2. Download remote archive
      const tempZip = path.join(os.tmpdir(), `ky_poni_theme_${themeId}_${Date.now()}.zip`);
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
   * Deletes an installed theme package (cannot delete core themes: persona5, classic)
   */
  deleteTheme(themeId) {
    if (themeId === 'persona5' || themeId === 'classic') {
      throw new Error(`Tema "${themeId}" adalah tema inti bawaan dan tidak dapat dihapus.`);
    }

    const themePath = path.join(this.publicThemesDir, themeId);
    if (fs.existsSync(themePath)) {
      fs.rmSync(themePath, { recursive: true, force: true });
      return { success: true, themeId, deleted: true };
    }

    throw new Error(`Tema "${themeId}" tidak ditemukan.`);
  }

  /**
   * Opens the official themes folder in the OS file manager
   */
  openThemesFolder() {
    const dir = this.publicThemesDir;
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
