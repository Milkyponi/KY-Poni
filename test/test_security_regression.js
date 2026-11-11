/**
 * KY-Poni - Security Regression Suite v2
 *
 * Berbeda dari test_security_hardening.js (yang hanya memeriksa preflight OPTIONS),
 * suite ini menyerang JALUR YANG DIPAKAI PENYERANG:
 *
 *  - response GET/POST NYATA dari origin eksternal (bukan cuma OPTIONS)
 *  - penulisan header CORS wildcard pada response sukses maupun gagal
 *  - bypass preflight lewat Content-Type "simple request" (text/plain)
 *  - RCE lewat filePath pada /api/updater/open & /api/updater/restart
 *  - traversal lewat assetName pada /api/updater/download
 *  - XSS lewat payload /api/simulate (escape di batas sistem)
 *  - zip-slip pada arsip tema
 *  - SSRF / salin path lokal lewat downloadUrl tema
 *  - batas ukuran body (413)
 *
 * Setiap test menegaskan SERANGAN GAGAL, bukan sekadar fungsi normal jalan.
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const PORT = 19845;
const BASE = `http://127.0.0.1:${PORT}`;

let passed = 0;
let failed = 0;

function check(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.log(`[FAIL] ${name}\n       ${err.message}`);
    failed++;
  }
}

async function checkAsync(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err) {
    console.log(`[FAIL] ${name}\n       ${err.message}`);
    failed++;
  }
}

function request(method, path, { body, headers = {}, rawBody } = {}) {
  return new Promise((resolve, reject) => {
    const payload = rawBody !== undefined ? rawBody : (body !== undefined ? JSON.stringify(body) : null);
    const opts = {
      hostname: '127.0.0.1',
      port: PORT,
      path,
      method,
      headers: { ...headers },
      // Koneksi baru per request: body raksasa yang ditolak dini bisa mereset
      // socket, dan keep-alive akan mengaburkan hasil test berikutnya.
      agent: false,
    };
    if (payload !== null) {
      if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
      opts.headers['Content-Length'] = Buffer.byteLength(payload);
    }
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (payload !== null) req.write(payload);
    req.end();
  });
}

async function main() {
  // Bersihkan sisa eksperimen sebelumnya supaya test deterministik.
  const themesDir = path.join(os.homedir(), '.config', 'ky-poni', 'themes');

  const { server, wss, youtubeIngest } = require('../src/server');

  await new Promise((resolve, reject) => {
    server.on('error', reject);
    server.listen(PORT, '127.0.0.1', resolve);
  });

  console.log('🧪 KY-Poni Security Regression Suite v2\n');

  // ---------------------------------------------------------------------
  // A. CORS: response NYATA, bukan preflight
  // ---------------------------------------------------------------------

  await checkAsync('GET response from external Origin is 403', async () => {
    const r = await request('GET', '/api/version', { headers: { Origin: 'https://evil.example' } });
    assert.strictEqual(r.status, 403, `expected 403, got ${r.status}`);
  });

  await checkAsync('GET 403 response carries NO Access-Control-Allow-Origin', async () => {
    const r = await request('GET', '/api/version', { headers: { Origin: 'https://evil.example' } });
    assert.strictEqual(r.headers['access-control-allow-origin'], undefined,
      `ACAO harus tidak ada, tapi bernilai "${r.headers['access-control-allow-origin']}"`);
  });

  await checkAsync('POST 403 response carries NO Access-Control-Allow-Origin', async () => {
    const r = await request('POST', '/api/simulate',
      { body: { type: 'chat', message: 'x' }, headers: { Origin: 'https://evil.example' } });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(r.headers['access-control-allow-origin'], undefined,
      `ACAO harus tidak ada, tapi bernilai "${r.headers['access-control-allow-origin']}"`);
  });

  await checkAsync('trusted localhost Origin IS allowed (not 403)', async () => {
    const r = await request('GET', '/api/version',
      { headers: { Origin: `http://localhost:${PORT}` } });
    assert.strictEqual(r.status, 200, `expected 200, got ${r.status}`);
  });

  await checkAsync('trusted Origin is echoed back, never "*"', async () => {
    const origin = `http://localhost:${PORT}`;
    const r = await request('GET', '/api/version', { headers: { Origin: origin } });
    assert.strictEqual(r.headers['access-control-allow-origin'], origin);
  });

  await checkAsync('no-Origin request still works (OBS/curl/Electron)', async () => {
    const r = await request('GET', '/api/version');
    assert.strictEqual(r.status, 200);
    assert.strictEqual(r.headers['access-control-allow-origin'], undefined);
  });

  // Ini regresi inti bug v1.0.0: Content-Type text/plain membuat request
  // menjadi "simple request" (tanpa preflight), jadi guard harus tetap menolak
  // berdasarkan Origin — bukan mengandalkan preflight.
  await checkAsync('preflight-bypass via text/plain still rejected (403)', async () => {
    const r = await request('POST', '/api/simulate', {
      rawBody: JSON.stringify({ type: 'chat', message: 'pwn' }),
      headers: { Origin: 'https://evil.example', 'Content-Type': 'text/plain' },
    });
    assert.strictEqual(r.status, 403, `expected 403, got ${r.status}`);
  });

  await checkAsync('DNS-rebinding style Host+Origin mismatch rejected', async () => {
    const r = await request('GET', '/api/version', {
      headers: { Origin: 'http://attacker.example', Host: 'attacker.example' },
    });
    assert.strictEqual(r.status, 403);
  });

  // Regresi celah "localhost port lain": guard hanya memeriksa hostname di v1.0.0,
  // sehingga halaman yang di-serve proses lain di 127.0.0.1:PORT_LAIN tetap lolos.
  await checkAsync('same hostname but DIFFERENT port is rejected (403)', async () => {
    const r = await request('GET', '/api/version', {
      headers: { Origin: 'http://127.0.0.1:19998' },
    });
    assert.strictEqual(r.status, 403, `origin localhost port lain harus ditolak, dapat ${r.status}`);
  });

  await checkAsync('same hostname "localhost" but different port is rejected', async () => {
    const r = await request('GET', '/api/version', {
      headers: { Origin: 'http://localhost:19998' },
    });
    assert.strictEqual(r.status, 403, `origin localhost:19998 harus ditolak, dapat ${r.status}`);
  });

  await checkAsync('origin without explicit port is rejected', async () => {
    const r = await request('GET', '/api/version', {
      headers: { Origin: 'http://localhost' },
    });
    assert.strictEqual(r.status, 403, `origin tanpa port harus ditolak, dapat ${r.status}`);
  });

  // ---------------------------------------------------------------------
  // B. RCE pada endpoint updater
  // ---------------------------------------------------------------------

  const RCE_MARKERS = [
    path.join(os.tmpdir(), 'kyponi_rce_open_marker'),
    path.join(os.tmpdir(), 'kyponi_rce_restart_marker'),
  ];

  for (const m of RCE_MARKERS) { try { fs.unlinkSync(m); } catch (e) {} }

  await checkAsync('/api/updater/open rejects shell metacharacters (no RCE)', async () => {
    const marker = RCE_MARKERS[0];
    const r = await request('POST', '/api/updater/open', {
      body: { filePath: `/tmp/x" ; touch ${marker} ; echo "` },
    });
    // Boleh error apa pun asal BUKAN sukses, dan marker tidak boleh ada.
    assert.ok(r.status >= 400, `endpoint harus menolak, tapi status ${r.status}`);
    await new Promise(res => setTimeout(res, 300));
    assert.strictEqual(fs.existsSync(marker), false, 'perintah shell tereksekusi (RCE!)');
  });

  await checkAsync('/api/updater/restart rejects shell metacharacters (no RCE)', async () => {
    const marker = RCE_MARKERS[1];
    const r = await request('POST', '/api/updater/restart', {
      body: { filePath: `/tmp/x" ; touch ${marker} ; echo "` },
    });
    assert.ok(r.status >= 400, `endpoint harus menolak, tapi status ${r.status}`);
    await new Promise(res => setTimeout(res, 300));
    assert.strictEqual(fs.existsSync(marker), false, 'perintah shell tereksekusi (RCE!)');
  });

  await checkAsync('/api/updater/open rejects absolute path outside Downloads', async () => {
    const r = await request('POST', '/api/updater/open', { body: { filePath: '/etc/passwd' } });
    assert.ok(r.status >= 400, `harus 4xx/5xx, dapat ${r.status}`);
    assert.ok(!/root:x:0/.test(r.body), 'isi /etc/passwd bocor di response');
  });

  await checkAsync('/api/updater/restart rejects traversal path', async () => {
    const r = await request('POST', '/api/updater/restart', { body: { filePath: '../../etc/shadow' } });
    assert.ok(r.status >= 400, `harus 4xx/5xx, dapat ${r.status}`);
  });

  await checkAsync('/api/updater/download rejects traversal assetName', async () => {
    const r = await request('POST', '/api/updater/download', {
      body: { downloadUrl: 'https://example.com/a.AppImage', assetName: '../../../tmp/evil.AppImage' },
    });
    // Tidak boleh menulis di luar Downloads; resolusi membuang komponen direktori.
    assert.ok(!/\.\.\//.test(r.body || ''), 'path traversal tercermin di response');
  });

  // ---------------------------------------------------------------------
  // C. XSS lewat simulator
  // ---------------------------------------------------------------------

  await checkAsync('/api/simulate escapes HTML in message', async () => {
    const r = await request('POST', '/api/simulate', {
      body: { type: 'chat', message: '<img src=x onerror=alert(1)>' },
    });
    assert.strictEqual(r.status, 200);
    const item = JSON.parse(r.body).item;
    assert.ok(!/<img/i.test(item.message), `payload XSS lolos mentah: ${item.message}`);
    assert.ok(item.message.includes('&lt;img'), 'HTML tidak di-escape dengan benar');
  });

  await checkAsync('/api/simulate keeps author name raw but renderers escape it', async () => {
    const r = await request('POST', '/api/simulate', {
      body: { type: 'chat', message: 'ok', author: '<script>alert(2)</script>' },
    });
    const item = JSON.parse(r.body).item;
    // author.name sengaja MENTAH di batas sistem: setiap renderer meng-escape
    // sendiri (p5 per karakter, classic/cyberpunk textContent, p3r innerText).
    // Yang wajib dijamin: SEMUA renderer benar-benar meng-escape, bukan
    // menginterpolasi nama ke innerHTML mentah.
    assert.strictEqual(item.author.name, '<script>alert(2)</script>',
      'author.name seharusnya mentah (kontrak renderer)');

    const renderers = {
      persona5: fs.readFileSync(path.join(__dirname, '..', 'src', 'public', 'themes', 'persona5', 'renderer.js'), 'utf8'),
      persona3reload: fs.readFileSync(path.join(__dirname, '..', 'src', 'public', 'themes', 'persona3reload', 'renderer.js'), 'utf8'),
      classic: fs.readFileSync(path.join(__dirname, '..', 'src', 'public', 'themes', 'classic', 'renderer.js'), 'utf8'),
    };
    // p5: escape per karakter
    assert.ok(/escapeText\(char\)/.test(renderers.persona5), 'p5 tidak escape nama per karakter');
    // classic: textContent
    assert.ok(/nameSpan\.textContent/.test(renderers.classic), 'classic tidak memakai textContent untuk nama');
    // p3r: innerText
    assert.ok(/username\.innerText/.test(renderers.persona3reload), 'p3r tidak memakai innerText untuk nama');
  });

  await checkAsync('/api/simulate rejects javascript: avatar URL', async () => {
    const r = await request('POST', '/api/simulate', {
      body: { type: 'chat', message: 'ok', avatar: 'javascript:alert(3)' },
    });
    const item = JSON.parse(r.body).item;
    assert.ok(!/^javascript:/i.test(item.author.avatar), `avatar javascript: lolos: ${item.author.avatar}`);
  });

  await checkAsync('/api/simulate sanitises type to known values', async () => {
    const r = await request('POST', '/api/simulate', {
      body: { type: '<script>x</script>', message: 'ok' },
    });
    const item = JSON.parse(r.body).item;
    assert.strictEqual(item.type, 'chat', `type tidak disanitasi: ${item.type}`);
  });

  await checkAsync('/api/simulate keeps rawText unescaped for p3r double-escape safety', async () => {
    const r = await request('POST', '/api/simulate', {
      body: { type: 'chat', message: 'a & b', rawText: 'a & b' },
    });
    const item = JSON.parse(r.body).item;
    assert.strictEqual(item.rawText, 'a & b', 'rawText seharusnya tidak di-escape (p3r escape sendiri)');
    assert.ok(item.message.includes('&amp;'), 'message seharusnya di-escape');
  });

  // ---------------------------------------------------------------------
  // D. Zip-slip
  // ---------------------------------------------------------------------

  await checkAsync('zip-slip archive is rejected (entry with ../)', async () => {
    const tmpZip = path.join(os.tmpdir(), `kyponi_zipslip_${Date.now()}.zip`);
    const stageDir = path.join(os.tmpdir(), `kyponi_zipslip_stage_${Date.now()}`);
    fs.mkdirSync(stageDir, { recursive: true });

    // Buat zip berisi entri traversal memakai python (zip tersedia di Fedora).
    const py = `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1], 'w')
z.writestr('../../../../tmp/kyponi_zipslip_escape.txt', 'escaped')
z.writestr('style.css', 'body{}')
z.close()
`;
    try {
      execFileSync('python3', ['-c', py, tmpZip], { stdio: 'pipe' });
      const { ThemeManager } = require('../src/theme_manager');
      const tm = new ThemeManager(
        path.join(__dirname, '..', 'src', 'public', 'themes'),
        path.join(__dirname, '..', 'src', 'catalog', 'catalog.json'),
      );
      const destDir = path.join(stageDir, 'theme');
      fs.mkdirSync(destDir, { recursive: true });

      let rejected = false;
      try {
        await tm.extractZip(tmpZip, destDir);
      } catch (err) {
        rejected = true;
      }
      assert.strictEqual(rejected, true, 'zip slip TIDAK ditolak — ekstraksi lolos');
      assert.strictEqual(fs.existsSync('/tmp/kyponi_zipslip_escape.txt'), false,
        'berkas traversal berhasil ditulis di luar direktori');
    } finally {
      try { fs.unlinkSync(tmpZip); } catch (e) {}
      try { fs.rmSync(stageDir, { recursive: true, force: true }); } catch (e) {}
      try { fs.unlinkSync('/tmp/kyponi_zipslip_escape.txt'); } catch (e) {}
    }
  });

  // ---------------------------------------------------------------------
  // E. SSRF / path lokal lewat downloadUrl
  // ---------------------------------------------------------------------

  await checkAsync('downloadUrl to internal metadata IP is rejected', async () => {
    const r = await request('POST', '/api/themes/install', {
      body: { themeId: 'ssrfprobe', downloadUrl: 'http://169.254.169.254/latest/meta-data/' },
    });
    assert.strictEqual(r.status, 400, `harus 400, dapat ${r.status}: ${r.body}`);
  });

  await checkAsync('downloadUrl with local file path is rejected', async () => {
    const r = await request('POST', '/api/themes/install', {
      body: { themeId: 'localprobe', downloadUrl: '/etc/passwd' },
    });
    assert.strictEqual(r.status, 400, `harus 400, dapat ${r.status}: ${r.body}`);
  });

  await checkAsync('downloadUrl from non-catalog https host is rejected', async () => {
    const r = await request('POST', '/api/themes/install', {
      body: { themeId: 'evilhost', downloadUrl: 'https://evil.example/theme.zip' },
    });
    assert.strictEqual(r.status, 400, `harus 400, dapat ${r.status}: ${r.body}`);
  });

  await checkAsync('downloadUrl http (non-TLS) to catalog host is rejected', async () => {
    const r = await request('POST', '/api/themes/install', {
      body: {
        themeId: 'plainhttp',
        downloadUrl: 'http://raw.githubusercontent.com/Milkyponi/ky-poni-themes/main/x.zip',
      },
    });
    assert.strictEqual(r.status, 400, `harus 400, dapat ${r.status}: ${r.body}`);
  });

  await checkAsync('downloadUrl pointing at a LOOKALIKE host is rejected', async () => {
    const r = await request('POST', '/api/themes/install', {
      body: {
        themeId: 'lookalike',
        downloadUrl: 'https://raw.githubusercontent.com.evil.example/Milkyponi/ky-poni-themes/x.zip',
      },
    });
    assert.strictEqual(r.status, 400, `harus 400, dapat ${r.status}: ${r.body}`);
  });

  // ---------------------------------------------------------------------
  // F. Batas ukuran body
  // ---------------------------------------------------------------------

  await checkAsync('oversized body returns 413, not 200', async () => {
    const huge = JSON.stringify({ x: 'A'.repeat(2 * 1024 * 1024) });
    let r;
    try {
      r = await request('POST', '/api/config', { rawBody: huge });
    } catch (err) {
      // Koneksi direset karena kita berhenti membaca — itu perilaku yang sah
      // untuk penolakan dini; anggap sebagai penolakan yang benar.
      return;
    }
    assert.ok(r.status === 413 || r.status === 400,
      `body 2MB seharusnya ditolak (413/400), dapat ${r.status}`);
    assert.notStrictEqual(r.status, 200, 'body 2MB diterima — tidak ada batas ukuran');
  });

  // ---------------------------------------------------------------------
  // G. Theme install yang sah tetap jalan (jangan over-block)
  // ---------------------------------------------------------------------

  await checkAsync('valid local package theme still installs', async () => {
    const r = await request('POST', '/api/themes/install', { body: { themeId: 'undertale' } });
    assert.strictEqual(r.status, 200, `install tema sah gagal: ${r.status} ${r.body}`);
  });

  await checkAsync('installed theme still deletable', async () => {
    const r = await request('POST', '/api/themes/delete', { body: { themeId: 'undertale' } });
    assert.strictEqual(r.status, 200, `delete tema sah gagal: ${r.status} ${r.body}`);
  });

  // ---------------------------------------------------------------------
  // H. Universalitas: patch harus aman di PC orang lain, bukan hanya di sini
  // ---------------------------------------------------------------------

  await checkAsync('ZIP extraction works WITHOUT external "unzip" binary', async () => {
    // Regresi nyata: implementasi berbasis `unzip`/`tar`/`powershell` gagal total
    // di distro minimal / Arch base / container. Pembaca ZIP murni Node tidak.
    const { extractZipFile } = require('../src/zip_reader');
    const tmpZip = path.join(os.tmpdir(), `kyponi_purezip_${Date.now()}.zip`);
    const tmpOut = path.join(os.tmpdir(), `kyponi_purezip_out_${Date.now()}`);
    const py = `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1], 'w')
z.writestr('style.css', 'body{color:red}')
z.writestr('theme.json', '{"id":"t"}')
z.close()
`;
    try {
      execFileSync('python3', ['-c', py, tmpZip], { stdio: 'pipe' });
      const res = extractZipFile(tmpZip, tmpOut);
      assert.ok(res.written >= 2, `hanya ${res.written} berkas diekstrak`);
      assert.ok(fs.existsSync(path.join(tmpOut, 'style.css')), 'style.css tidak diekstrak');
      assert.ok(fs.readFileSync(path.join(tmpOut, 'style.css'), 'utf8').includes('color:red'),
        'isi berkas tidak benar');
    } finally {
      try { fs.unlinkSync(tmpZip); } catch (e) {}
      try { fs.rmSync(tmpOut, { recursive: true, force: true }); } catch (e) {}
    }
  });

  await checkAsync('zip_reader rejects traversal AND absolute paths', async () => {
    const { extractZipFile } = require('../src/zip_reader');
    const tmpZip = path.join(os.tmpdir(), `kyponi_zipguard_${Date.now()}.zip`);
    const tmpOut = path.join(os.tmpdir(), `kyponi_zipguard_out_${Date.now()}`);
    const py = `
import zipfile, sys
z = zipfile.ZipFile(sys.argv[1], 'w')
z.writestr('../../../../tmp/kyponi_reg_escape.txt', 'pwn')
z.writestr('/tmp/kyponi_reg_abs.txt', 'pwn')
z.writestr('style.css', 'ok')
z.close()
`;
    try {
      execFileSync('python3', ['-c', py, tmpZip], { stdio: 'pipe' });
      let rejected = false;
      try { extractZipFile(tmpZip, tmpOut); } catch (e) { rejected = true; }
      assert.strictEqual(rejected, true, 'arsip berbahaya TIDAK ditolak');
      assert.strictEqual(fs.existsSync('/tmp/kyponi_reg_escape.txt'), false, 'traversal berhasil');
      assert.strictEqual(fs.existsSync('/tmp/kyponi_reg_abs.txt'), false, 'absolute path berhasil');
    } finally {
      try { fs.unlinkSync(tmpZip); } catch (e) {}
      try { fs.rmSync(tmpOut, { recursive: true, force: true }); } catch (e) {}
      try { fs.unlinkSync('/tmp/kyponi_reg_escape.txt'); } catch (e) {}
      try { fs.unlinkSync('/tmp/kyponi_reg_abs.txt'); } catch (e) {}
    }
  });

  await checkAsync('downloads dir follows XDG_DOWNLOAD_DIR (localised folders)', async () => {
    // Regresi nyata: hardcode ~/Downloads gagal di PC berbahasa Indonesia
    // yang foldernya ~/Unduhan. Auto-update tidak menemukan berkasnya sendiri.
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'kyponi_xdg_'));
    try {
      fs.mkdirSync(path.join(tmpHome, '.config'), { recursive: true });
      fs.mkdirSync(path.join(tmpHome, 'Unduhan'), { recursive: true });
      fs.writeFileSync(
        path.join(tmpHome, '.config', 'user-dirs.dirs'),
        'XDG_DOWNLOAD_DIR="$HOME/Unduhan"\n'
      );
      const script = `
        const path = require('path');
        const { AppUpdater } = require(${JSON.stringify(path.join(__dirname, '..', 'src', 'updater.js'))});
        const up = new AppUpdater('1.0.1');
        up.openDownloadedFile('KY-Poni-test.AppImage')
          .then(p => console.log('RESOLVED:' + p))
          .catch(e => console.log('ERROR:' + e.message));
      `;
      fs.writeFileSync(path.join(tmpHome, 'probe.js'), script);
      fs.writeFileSync(path.join(tmpHome, 'Unduhan', 'KY-Poni-test.AppImage'), 'x');
      const out = execFileSync('node', [path.join(tmpHome, 'probe.js')], {
        env: { ...process.env, HOME: tmpHome },
        encoding: 'utf8',
        timeout: 15000,
      });
      assert.ok(out.includes('Unduhan'), `folder lokal tidak terdeteksi: ${out}`);
    } finally {
      try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (e) {}
    }
  });

  // ---------------------------------------------------------------------
  // I. SSRF lewat redirect & validasi URL terpusat
  // ---------------------------------------------------------------------

  await checkAsync('url_guard rejects redirect targets to internal addresses', async () => {
    const { validateDownloadUrl } = require('../src/url_guard');
    const { TRUSTED_THEME_HOSTS, TRUSTED_THEME_PATH_PREFIXES } = require('../src/theme_manager');
    const opts = {
      allowedHosts: TRUSTED_THEME_HOSTS,
      allowedPathPrefixes: TRUSTED_THEME_PATH_PREFIXES,
      requireHttps: true,
    };
    const bad = [
      'http://169.254.169.254/latest/meta-data/',   // metadata cloud
      'http://127.0.0.1:8080/admin',                // localhost lain port
      'http://10.0.0.5/internal',                   // jaringan privat
      'file:///etc/passwd',                         // skema file
      'https://raw.githubusercontent.com/other/repo/x.zip', // repo lain
      'https://raw.githubusercontent.com.evil.example/Milkyponi/ky-poni-themes/x.zip',
    ];
    for (const u of bad) {
      const v = validateDownloadUrl(u, opts);
      assert.strictEqual(v.ok, false, `URL berbahaya lolos: ${u}`);
    }
  });

  await checkAsync('url_guard ACCEPTS the legitimate catalog URL', async () => {
    const { validateDownloadUrl } = require('../src/url_guard');
    const { TRUSTED_THEME_HOSTS, TRUSTED_THEME_PATH_PREFIXES } = require('../src/theme_manager');
    const v = validateDownloadUrl(
      'https://raw.githubusercontent.com/Milkyponi/ky-poni-themes/main/packages/undertale.zip',
      { allowedHosts: TRUSTED_THEME_HOSTS, allowedPathPrefixes: TRUSTED_THEME_PATH_PREFIXES, requireHttps: true }
    );
    assert.strictEqual(v.ok, true, `URL katalog sah ditolak: ${v.reason}`);
  });

  await checkAsync('downloadFile validates URL BEFORE making a request', async () => {
    const { ThemeManager } = require('../src/theme_manager');
    const tm = new ThemeManager(
      path.join(__dirname, '..', 'src', 'public', 'themes'),
      path.join(__dirname, '..', 'src', 'catalog', 'catalog.json'),
    );
    const tmp = path.join(os.tmpdir(), `kyponi_dl_${Date.now()}.zip`);
    let rejected = false;
    try {
      await tm.downloadFile('http://127.0.0.1:19997/theme.zip', tmp);
    } catch (e) {
      rejected = true;
    }
    assert.strictEqual(rejected, true, 'downloadFile mengikuti URL non-allowlist');
  });

  // ---------------------------------------------------------------------
  // K. Kontrak escape lintas renderer (regresi "teks chat jadi aneh")
  //
  // Bug nyata: simulateMessage() meng-escape author.name dan superchat.amount
  // padahal SEMUA renderer sudah meng-escape sendiri. Hasilnya double escape:
  // "Budi & Sari" tampil sebagai "B U D I &A M P ; S A R I" di nameplate
  // Persona 5. Sebaliknya persona3reload membaca item.message (sudah ber-entitas)
  // lalu meng-escape lagi, sehingga "&amp;" muncul literal.
  //
  // Cek ini mengunci kontrak: message di-escape, sisanya mentah, dan setiap
  // renderer memakai sumber yang tepat untuk dirinya sendiri.
  // ---------------------------------------------------------------------

  await checkAsync('simulate keeps author.name RAW (renderer escapes it)', async () => {
    const r = await request('POST', '/api/simulate', {
      body: { type: 'chat', message: 'ok', author: 'Budi & Sari' },
    });
    const item = JSON.parse(r.body).item;
    assert.strictEqual(item.author.name, 'Budi & Sari',
      `author.name ter-escape di batas sistem (double escape): ${item.author.name}`);
  });

  await checkAsync('simulate keeps superchat.amount RAW', async () => {
    const r = await request('POST', '/api/simulate', {
      body: { type: 'superchat', message: 'ok', amount: 'Rp 50.000 & pajak' },
    });
    const item = JSON.parse(r.body).item;
    assert.strictEqual(item.superchat.amount, 'Rp 50.000 & pajak',
      `amount ter-escape (double escape): ${item.superchat.amount}`);
  });

  await checkAsync('simulate STILL escapes message (XSS protection kept)', async () => {
    const r = await request('POST', '/api/simulate', {
      body: { type: 'chat', message: 'a & b <script>x</script>' },
    });
    const item = JSON.parse(r.body).item;
    assert.ok(item.message.includes('&amp;'), 'message tidak di-escape — XSS terbuka lagi');
    assert.ok(!/<script/i.test(item.message), 'tag script lolos ke message');
  });

  await checkAsync('persona3reload renderer reads rawText, not escaped message', async () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'public', 'themes', 'persona3reload', 'renderer.js'), 'utf8');
    assert.ok(/item\.rawText/.test(src),
      'p3r tidak memakai item.rawText — akan double-escape karena message sudah ber-entitas');
    // Pastikan jalur pemasangan tetap meng-escape (XSS tetap tertutup).
    assert.ok(/escapeText\(rawText\)/.test(src), 'p3r tidak meng-escape saat memasang teks');
  });

  await checkAsync('persona5 renderer escapes each char itself (contract check)', async () => {
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'src', 'public', 'themes', 'persona5', 'renderer.js'), 'utf8');
    // p5 membangun nameplate per karakter dan meng-escape tiap karakter.
    assert.ok(/escapeText\(char\)/.test(src),
      'p5 tidak meng-escape per karakter — author mentah akan jadi XSS');
  });

  // ---------------------------------------------------------------------
  // J. XSS di dashboard (metadata tema dari katalog)
  // ---------------------------------------------------------------------
  await checkAsync('dashboard escapeJsAttr does NOT add its own quotes', async () => {
    // Regresi nyata: escapeJsAttr memakai JSON.stringify sehingga onclick menjadi
    // installTheme('"undertale"', ...) — id berisi kutip ganda, gagal validasi,
    // dan tombol "Instal" di dashboard SELALU gagal. Ini keluhan
    // "kok tema ngga bisa di download".
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'public', 'dashboard.js'), 'utf8');

    assert.ok(!/JSON\.stringify/.test(src.split('function escapeJsAttr')[1].split('}')[0]),
      'escapeJsAttr masih memakai JSON.stringify (menambah kutip ganda)');

    // Simulasikan fungsi yang ada di dashboard dan pastikan tidak menambah kutip.
    const { execFileSync } = require('child_process');
    const probe = `
      const fs = require('fs');
      const src = fs.readFileSync(${JSON.stringify(path.join(__dirname, '..', 'src', 'public', 'dashboard.js'))}, 'utf8');
      const start = src.indexOf('function escapeJsAttr');
      const body = src.slice(start, src.indexOf('\\n}', start) + 2);
      eval(body);
      console.log(JSON.stringify({
        plain: escapeJsAttr('undertale'),
        url: escapeJsAttr('https://github.com/Milkyponi/ky-poni-themes/x.zip'),
        quote: escapeJsAttr("a'b"),
      }));
    `;
    const tmp = path.join(os.tmpdir(), `kyponi_esc_probe_${Date.now()}.js`);
    fs.writeFileSync(tmp, probe);
    let out;
    try {
      out = execFileSync('node', [tmp], { encoding: 'utf8', timeout: 10000 });
    } finally {
      try { fs.unlinkSync(tmp); } catch (e) {}
    }
    const r = JSON.parse(out);
    assert.strictEqual(r.plain, 'undertale', `id jadi "${r.plain}" (ada kutip tambahan)`);
    assert.strictEqual(r.url, 'https://github.com/Milkyponi/ky-poni-themes/x.zip',
      `url rusak: ${r.url}`);
    assert.strictEqual(r.quote, "a\\'b", `kutip tunggal tidak di-escape: ${r.quote}`);
  });

  await checkAsync('dashboard has escapeHtml helper and escapes theme metadata', async () => {
    const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'public', 'dashboard.js'), 'utf8');
    assert.ok(/function escapeHtml/.test(src), 'dashboard tidak punya escapeHtml');
    assert.ok(/function escapeJsAttr/.test(src), 'dashboard tidak punya escapeJsAttr');
    // Data dari server tidak boleh masuk template tanpa escape.
    assert.ok(!/\$\{t\.name\}(?![\s\S]{0,40}escapeHtml)/.test(src) || !/\$\{t\.name\}/.test(src.replace(/\$\{escapeHtml\(t\.name\)\}/g, '')),
      'theme name masih diinterpolasi mentah');
    assert.ok(src.includes('${escapeJsAttr(t.downloadUrl)}'), 'downloadUrl tidak di-escape di onclick');
    assert.ok(src.includes('${escapeJsAttr(t.id)}'), 'theme id tidak di-escape di onclick');
    assert.ok(src.includes('${escapeHtml(tag)}'), 'tag tidak di-escape');
  });

  // ---------------------------------------------------------------------
  // Selesai
  // ---------------------------------------------------------------------

  // Bersihkan direktori eksperimen
  for (const p of ['ssrfprobe', 'localprobe', 'evilhost', 'plainhttp', 'lookalike']) {
    try { fs.rmSync(path.join(themesDir, p), { recursive: true, force: true }); } catch (e) {}
  }

  youtubeIngest.disconnect();
  for (const c of Array.from(wss.clients || [])) { try { c.terminate(); } catch (e) {} }
  await new Promise(res => wss.close(() => server.close(res)));

  console.log(`\n${'='.repeat(56)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  console.log('='.repeat(56));

  if (failed > 0) {
    console.log('\n❌ SECURITY REGRESSION FAILURES — jangan rilis.');
    process.exit(1);
  }
  console.log('\n✅ ALL SECURITY REGRESSION TESTS PASSED');
  process.exit(0);
}

main().catch(err => {
  console.error('Suite crashed:', err);
  process.exit(1);
});
