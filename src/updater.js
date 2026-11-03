/**
 * KY-Poni - In-App GitHub Releases Auto-Updater
 * Checks for updates against GitHub Releases API and handles in-app downloading.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec, spawn } = require('child_process');

const REPO_OWNER = 'Milkyponi';
const REPO_NAME = 'KY-Poni';

class AppUpdater {
  constructor(currentVersion) {
    this.currentVersion = currentVersion.replace(/^v/, '');
    this.latestRelease = null;
    this.activeDownload = null;
  }

  /**
   * Compare semver strings (e.g. "0.4.0" vs "0.3.0")
   * Returns: 1 if vA > vB, -1 if vA < vB, 0 if equal
   */
  compareSemver(vA, vB) {
    if (!vA || !vB) return 0;
    const cleanA = vA.replace(/^v/, '').split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
    const cleanB = vB.replace(/^v/, '').split('-')[0].split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < 3; i++) {
      const a = cleanA[i] || 0;
      const b = cleanB[i] || 0;
      if (a > b) return 1;
      if (a < b) return -1;
    }
    return 0;
  }

  /**
   * Fetch latest release from GitHub API
   */
  async checkForUpdates() {
    return new Promise((resolve, reject) => {
      const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`;
      const options = {
        headers: {
          'User-Agent': 'KY-Poni-AppUpdater/1.0',
          'Accept': 'application/vnd.github.v3+json',
        },
      };

      https.get(url, options, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode === 404) {
            // No releases published yet
            return resolve({
              updateAvailable: false,
              currentVersion: this.currentVersion,
              latestVersion: this.currentVersion,
              message: 'Belum ada rilis baru di GitHub.',
            });
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`GitHub API error (${res.statusCode}): ${body}`));
          }

          try {
            const data = JSON.parse(body);
            this.latestRelease = data;
            const latestTag = (data.tag_name || '').replace(/^v/, '').split('-')[0];
            const currentClean = this.currentVersion.replace(/^v/, '').split('-')[0];

            // STRICT CHECK: update is ONLY available if latest release is strictly NEWER
            const isNewer = this.compareSemver(latestTag, currentClean) > 0;

            // Pick asset matching user platform
            let asset = null;
            if (Array.isArray(data.assets)) {
              if (process.platform === 'win32') {
                asset = data.assets.find(a => a.name.endsWith('.exe')) || data.assets[0];
              } else {
                asset = data.assets.find(a => a.name.endsWith('.AppImage')) || data.assets[0];
              }
            }

            resolve({
              updateAvailable: isNewer,
              currentVersion: this.currentVersion,
              latestVersion: latestTag,
              releaseName: data.name || `KY-Poni v${latestTag}`,
              releaseNotes: data.body || 'Pembaruan stabilitas dan fitur baru.',
              publishedAt: data.published_at,
              htmlUrl: data.html_url,
              assetUrl: asset ? asset.browser_download_url : null,
              assetName: asset ? asset.name : null,
              assetSize: asset ? asset.size : 0,
            });
          } catch (e) {
            reject(new Error(`Gagal mem-parse respon GitHub release: ${e.message}`));
          }
        });
      }).on('error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Download the new update file with live progress reporting
   */
  async downloadUpdate(downloadUrl, assetName, progressCallback) {
    if (!downloadUrl) throw new Error('Download URL tidak ditemukan.');

    const downloadsDir = path.join(os.homedir(), 'Downloads');
    const targetFile = path.join(downloadsDir, assetName || `KY-Poni-update-${Date.now()}`);

    return new Promise((resolve, reject) => {
      const getFile = (url) => {
        const client = url.startsWith('https://') ? https : http;
        client.get(url, { headers: { 'User-Agent': 'KY-Poni-AppUpdater/1.0' } }, (res) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return getFile(res.headers.location);
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`Gagal mengunduh berkas update (Status ${res.statusCode})`));
          }

          const totalBytes = parseInt(res.headers['content-length'] || '0', 10);
          let receivedBytes = 0;
          const fileStream = fs.createWriteStream(targetFile);

          res.on('data', (chunk) => {
            receivedBytes += chunk.length;
            if (progressCallback && totalBytes > 0) {
              const pct = Math.round((receivedBytes / totalBytes) * 100);
              progressCallback(pct, receivedBytes, totalBytes);
            }
          });

          res.pipe(fileStream);

          fileStream.on('finish', () => {
            fileStream.close(() => {
              // Make executable on Linux
              if (process.platform !== 'win32' && targetFile.endsWith('.AppImage')) {
                try { fs.chmodSync(targetFile, 0o755); } catch (e) {}
              }
              resolve({ success: true, filePath: targetFile, fileName: path.basename(targetFile) });
            });
          });
        }).on('error', (err) => {
          try { fs.unlinkSync(targetFile); } catch (e) {}
          reject(err);
        });
      };

      getFile(downloadUrl);
    });
  }

  /**
   * Open downloaded file in OS
   */
  openDownloadedFile(filePath) {
    let cmd = '';
    if (process.platform === 'win32') {
      cmd = `start "" "${filePath}"`;
    } else if (process.platform === 'darwin') {
      cmd = `open "${filePath}"`;
    } else {
      cmd = `xdg-open "${filePath}" 2>/dev/null || open "${filePath}"`;
    }

    return new Promise((resolve) => {
      exec(cmd, () => resolve(filePath));
    });
  }

  /**
   * One-Click Seamless Auto-Update & Restart
   * Supports Linux (.AppImage) and Windows (.exe portable)
   */
  installAndRestart(downloadedFilePath) {
    if (!downloadedFilePath || !fs.existsSync(downloadedFilePath)) {
      throw new Error(`Berkas pembaruan tidak ditemukan di: ${downloadedFilePath}`);
    }

    if (process.platform === 'win32') {
      // ----------------------------------------------------
      // Windows Portable: Self-Replacement via Background Batch
      // ----------------------------------------------------
      let targetExe = process.env.PORTABLE_EXECUTABLE_FILE;
      if (!targetExe || !fs.existsSync(targetExe)) {
        targetExe = process.execPath;
      }

      const currentPid = process.pid;
      const scriptPath = path.join(os.tmpdir(), `ky_poni_updater_${Date.now()}.cmd`);

      const batchScript = `@echo off
chcp 65001 >nul
timeout /t 1 /nobreak >nul
:wait_loop
tasklist /fi "PID eq ${currentPid}" 2>nul | find "${currentPid}" >nul
if not errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto wait_loop
)
timeout /t 1 /nobreak >nul
copy /y "${downloadedFilePath}" "${targetExe}" >nul
if errorlevel 1 (
    move /y "${downloadedFilePath}" "${targetExe}" >nul
)
start "" "${targetExe}"
del "%~f0"
`;

      fs.writeFileSync(scriptPath, batchScript, 'utf-8');

      const child = spawn('cmd.exe', ['/c', scriptPath], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.unref();

      setTimeout(() => {
        process.exit(0);
      }, 500);

      return { success: true, platform: 'win32', targetPath: targetExe };

    } else {
      // ----------------------------------------------------
      // Linux AppImage: Atomic Replacement & Relaunch
      // ----------------------------------------------------
      try {
        fs.chmodSync(downloadedFilePath, 0o755);
      } catch (e) {}

      let targetAppImage = process.env.APPIMAGE;
      if (!targetAppImage || !fs.existsSync(targetAppImage)) {
        const defaultAppImage = path.join(os.homedir(), 'AppImages', 'kyponi.appimage');
        if (fs.existsSync(defaultAppImage)) {
          targetAppImage = defaultAppImage;
        }
      }

      if (targetAppImage && fs.existsSync(targetAppImage)) {
        try {
          fs.copyFileSync(downloadedFilePath, targetAppImage);
          fs.chmodSync(targetAppImage, 0o755);
        } catch (err) {
          console.warn('[Updater] Direct copy failed, launching downloaded file:', err.message);
          targetAppImage = downloadedFilePath;
        }
      } else {
        targetAppImage = downloadedFilePath;
      }

      console.log(`[Updater] Launching updated version from: ${targetAppImage}`);

      const child = spawn(targetAppImage, [], {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, DESKTOPINTEGRATION: '1' },
      });
      child.unref();

      setTimeout(() => {
        process.exit(0);
      }, 500);

      return { success: true, platform: 'linux', targetPath: targetAppImage };
    }
  }
}

module.exports = { AppUpdater };
