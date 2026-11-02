/**
 * KY-Poni - In-App GitHub Releases Auto-Updater
 * Checks for updates against GitHub Releases API and handles in-app downloading.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

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
    const cleanA = vA.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const cleanB = vB.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
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
              message: 'Belum ada rilis publik di GitHub repository.',
            });
          }

          if (res.statusCode !== 200) {
            return reject(new Error(`GitHub API error (${res.statusCode}): ${body}`));
          }

          try {
            const data = JSON.parse(body);
            this.latestRelease = data;
            const latestTag = (data.tag_name || '').replace(/^v/, '');

            const isNewer = this.compareSemver(latestTag, this.currentVersion) > 0;

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
      }).on('error', reject);
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
}

module.exports = { AppUpdater };
