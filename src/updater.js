/**
 * KY-Poni - In-App GitHub Releases Auto-Updater
 * Checks for updates against GitHub Releases API and handles in-app downloading.
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, spawn } = require('child_process');

const REPO_OWNER = 'Milkyponi';
const REPO_NAME = 'KY-Poni';

/**
 * Resolusi path berkas pembaruan yang aman.
 *
 * Latar belakang: endpoint /api/updater/open dan /api/updater/restart dulu menerima
 * `filePath` mentah dari body HTTP dan memasukkannya ke perintah shell lewat exec().
 * Nilai seperti `/tmp/a" ; id > /tmp/pwn ; echo "` mengeksekusi perintah arbitrary
 * sebagai user yang menjalankan KY-Poni (RCE terbukti, bukan teoretis).
 *
 * Aturan sekarang:
 *  - hanya NAMA BERKAS yang diterima; komponen direktori dibuang dengan basename()
 *  - hasilnya wajib berada tepat di dalam direktori unduhan resmi
 *  - tidak ada shell: semua eksekusi memakai execFile/spawn dengan argumen array
 */
function resolveUpdateFile(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) {
    throw new Error('Path berkas pembaruan tidak sah.');
  }
  const downloadsDir = path.resolve(path.join(os.homedir(), 'Downloads'));
  const baseName = path.basename(filePath.trim());
  const resolved = path.resolve(downloadsDir, baseName);

  // Pertahanan berlapis: basename() sudah membuang traversal, tapi pastikan lagi
  // bahwa hasil akhir benar-benar anak langsung dari downloadsDir.
  if (path.dirname(resolved) !== downloadsDir) {
    throw new Error('Path berkas pembaruan berada di luar direktori unduhan.');
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`Berkas pembaruan tidak ditemukan di: ${resolved}`);
  }
  return resolved;
}

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
    if (typeof downloadUrl !== 'string' || !/^https?:\/\//i.test(downloadUrl)) {
      throw new Error('Download URL harus berupa http(s) absolut.');
    }

    const downloadsDir = path.resolve(path.join(os.homedir(), 'Downloads'));

    // `assetName` datang dari body HTTP: jangan pernah dipakai mentah di path.join().
    // Hanya nama berkas yang dipakai; kalau kosong, pakai nama default.
    const safeName = assetName ? path.basename(String(assetName)) : `KY-Poni-update-${Date.now()}`;
    if (safeName === '.' || safeName === '..' || !safeName) {
      throw new Error('Nama berkas pembaruan tidak sah.');
    }
    const targetFile = path.resolve(downloadsDir, safeName);
    if (path.dirname(targetFile) !== downloadsDir) {
      throw new Error('Nama berkas pembaruan berada di luar direktori unduhan.');
    }

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
   * Open downloaded file in OS.
   *
   * Menerima path dari klien hanya sebagai PETUNJUK NAMA BERKAS; path final
   * selalu diresolusi ulang di dalam direktori unduhan (lihat resolveUpdateFile).
   * Semua eksekusi memakai execFile dengan argumen array — tidak ada shell,
   * sehingga metacharakter tidak bisa menjadi perintah.
   */
  openDownloadedFile(filePath) {
    const target = resolveUpdateFile(filePath);

    let bin;
    let args;
    if (process.platform === 'win32') {
      // `start` adalah builtin cmd.exe; panggil langsung tanpa string shell.
      bin = 'cmd.exe';
      args = ['/c', 'start', '', target];
    } else if (process.platform === 'darwin') {
      bin = 'open';
      args = [target];
    } else {
      bin = 'xdg-open';
      args = [target];
    }

    return new Promise((resolve) => {
      execFile(bin, args, () => resolve(target));
    });
  }

  /**
   * One-Click Seamless Auto-Update & Restart
   * Supports Linux (.AppImage) and Windows (.exe portable)
   */
  installAndRestart(downloadedFilePath) {
    // Path dari klien tidak pernah dipercaya: resolusi ulang di direktori unduhan.
    const downloadedFile = resolveUpdateFile(downloadedFilePath);

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

      // Path tetap diinterpolasi ke berkas .cmd, dan nama berkas Windows boleh
      // mengandung metacharakter batch (&, |, <, >, ^). Escape dulu supaya nama
      // berkas tidak pernah dibaca sebagai perintah di dalam batch.
      const escapeBatch = (p) => String(p).replace(/([\^&|<>()%"])/g, '^$1');
      const safeDownloaded = escapeBatch(downloadedFile);
      const safeTarget = escapeBatch(targetExe);

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
copy /y "${safeDownloaded}" "${safeTarget}" >nul
if errorlevel 1 (
    move /y "${safeDownloaded}" "${safeTarget}" >nul
)
start "" "${safeTarget}"
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
        fs.chmodSync(downloadedFile, 0o755);
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
          fs.copyFileSync(downloadedFile, targetAppImage);
          fs.chmodSync(targetAppImage, 0o755);
        } catch (err) {
          console.warn('[Updater] Direct copy failed, launching downloaded file:', err.message);
          targetAppImage = downloadedFile;
        }
      } else {
        targetAppImage = downloadedFile;
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
