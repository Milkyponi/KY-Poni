# Audit Keamanan KY-Poni — Verifikasi Pekerjaan OpenCode (GLM)

**Tanggal:** 2026-11-11
**Auditor:** Fonzy (Kepala Divisi Software Development)
**Objek:** KY-Poni v1.0.0 + 2 commit hardening oleh agent GLM (via OpenCode)
**Commit yang diaudit:** `79a2488` (fix) dan `432c780` (test + laporan handover)
**Metode:** Source review + **uji eksploitasi live** (server nyata di port terpisah, browser nyata, curl)

---

## TL;DR

| # | Temuan | Severity | Status |
|---|---|---|---|
| 1 | `sendJson()` masih hardcode `Access-Control-Allow-Origin: *` → **seluruh origin guard bisa di-bypass** | **KRITIS** | Terbukti live di browser |
| 2 | `exec()` + `filePath` dari HTTP body di `/api/updater/open` → **RCE** (eksekusi perintah arbitrary) | **KRITIS** | Terbukti, `id` jalan sebagai user |
| 3 | `extractZip()` shell interpolation (`zipPath`, `destDir` ke `exec`) → RCE turunan | **TINGGI** | Terkonfirmasi via source |
| 4 | Stored XSS: `simulateMessage()` tidak escape, renderer pakai `innerHTML` | **TINGGI** | Terbukti, `document.title` berubah |
| 5 | Zip slip — entri ZIP tidak divalidasi | **TINGGI** | Sesuai laporan GLM, belum ditambal |
| 6 | Test CORS GLM **green padahal lubangnya masih terbuka** | **PROSES** | False sense of security |
| 7 | Tidak ada batas ukuran body request (20 MB diterima) | RENDAH | Terbukti |
| 8 | `/api/themes/install` menerima `downloadUrl` arbitrari (SSRF / baca path lokal) | SEDANG | Terbukti sebagian |

**Kesimpulan:** dua perbaikan GLM **benar secara arah tetapi belum menutup lubangnya**. Origin guard di `routes/index.js` bekerja, tetapi langsung dinetralkan oleh `sendJson()` di `helpers.js` yang masih mengirim wildcard. Test yang menyatakan "CORS header is no longer wildcard" hanya memeriksa preflight `OPTIONS` — bukan response nyata. **Jangan rilis versi baru sebelum temuan #1 dan #2 ditutup.**

---

## 1. KRITIS — Origin guard di-bypass oleh `sendJson()`

### Masalah

`src/routes/index.js` sudah benar: menolak origin eksternal dengan 403 dan hanya meng-echo CORS untuk origin lokal. **Tetapi** setiap handler route memanggil `sendJson()` dari `src/routes/helpers.js`, yang menulis header sendiri dan **menimpa** logika di atas:

```js
// src/routes/helpers.js
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',   // <-- wildcard, selalu
  });
  res.end(JSON.stringify(data));
}
```

`index.js` men-set header lewat `res.setHeader()` **sebelum** handler jalan; `res.writeHead()` di `sendJson()` kemudian mengirim header final yang menggantikannya.

### Bukti empiris

Response nyata dari server (bukan teori):

```
--- GET /api/version tanpa Origin ---
HTTP/1.1 200 OK
Access-Control-Allow-Origin: *

--- GET /api/version dengan Origin: https://evil.com ---
HTTP/1.1 403 Forbidden
Access-Control-Allow-Origin: *
```

Di browser nyata, dari origin berbeda (`127.0.0.1:19999` → `127.0.0.1:19842`):

```
GET /api/version -> status 200 ACAO=null
BODY READABLE: {"version":"1.0.0","appName":"KY-Poni"}
```

Karena `parseJsonBody()` **mengabaikan** `Content-Type`, penyerang bisa memakai `text/plain` sehingga tidak terjadi preflight, dan POST langsung dieksekusi:

```
POST /api/simulate (text/plain, no preflight) -> status 200
BODY: {"success":true,"item":{...,"message":"<b>INJECTED-FROM-EVIL-SITE</b>",...}}
```

**Artinya: seluruh origin guard yang dikerjakan GLM bisa dilewati dari website mana pun.**

### Kenapa test GLM hijau

`test/test_security_hardening.js` baris 65–69 hanya menguji **preflight `OPTIONS`**:

```js
const preflight = await fetchOptions(`.../api/status`, `http://localhost:${TEST_PORT}`);
assert.notStrictEqual(preflight.headers['access-control-allow-origin'], '*');
```

Jalur `OPTIONS` ditangani langsung oleh `index.js` dan **tidak pernah** memanggil `sendJson()`, jadi lulus. Response GET/POST nyata (yang dipakai browser dan penyerang) tidak pernah diuji.

### Perbaikan yang benar

Otoritas CORS harus **satu tempat**. Hapus header CORS dari `sendJson()`, biarkan `index.js` yang menentukan:

```js
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
```

Dan di `index.js`, gunakan `res.setHeader()` **atau** kirim lewat options — jangan campur keduanya di jalur berbeda. Tambahkan test yang memeriksa response **GET/POST nyata** dengan `Origin` eksternal, bukan hanya `OPTIONS`.

---

## 2. KRITIS — RCE lewat `/api/updater/open`

### Masalah

`src/routes/updater.js` mengambil `filePath` mentah dari body HTTP dan meneruskannya ke `appUpdater.openDownloadedFile()`, yang menyusun perintah shell dengan interpolasi string lalu `exec()`:

```js
// src/updater.js — openDownloadedFile()
} else {
  cmd = `xdg-open "${filePath}" 2>/dev/null || open "${filePath}"`;
}
exec(cmd, () => resolve(filePath));
```

Tidak ada validasi path, tidak ada allowlist, tidak ada escaping. Kutip ganda tidak melindungi dari `"` di dalam input.

### Bukti empiris

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"filePath":"/tmp/a\" ; id > /tmp/kyponi_whoami ; echo \""}' \
  http://127.0.0.1:19843/api/updater/open
```

Hasil isi `/tmp/kyponi_whoami`:

```
uid=1000(milkyponi) gid=1000(milkyponi) groups=1000(milkyponi),10(wheel),970(gamemode)
    context=unconfined_u:unconfined_r:unconfined_t:s0-s0:c0.c1023
```

Perintah shell jalan **sebagai user Bos, di grup `wheel`**. Dikombinasikan dengan temuan #1, penyerang cukup menyuruh korban membuka satu halaman web untuk mendapat eksekusi kode di workstation-nya.

### Perbaikan yang benar

1. Ganti `exec()` dengan `execFile()` / `spawn()` tanpa shell untuk semua pembukaan file (argumen array, bukan string).
2. Jangan terima path dari klien. `openDownloadedFile()` seharusnya hanya menerima **nama berkas** dan me-resolve-nya di dalam direktori unduhan yang sudah ditentukan server:

```js
const downloadsDir = path.join(os.homedir(), 'Downloads');
const resolved = path.resolve(downloadsDir, path.basename(filePath));
if (path.dirname(resolved) !== downloadsDir) throw new Error('Path tidak sah');
```

3. Verifikasi ulang di `/api/updater/restart` (`installAndRestart` juga menerima path mentah).

---

## 3. TINGGI — Shell injection di `extractZip()`

```js
// src/theme_manager.js
cmd = `unzip -o -q "${zipPath}" -d "${destDir}" || tar -xf "${zipPath}" -C "${destDir}"`;
exec(cmd, ...);
```

`themeId` sekarang divalidasi (bagus), tetapi `zipPath` berasal dari `os.tmpdir()` + `themeId` + timestamp, dan `destDir` = `path.join(userThemesDir, themeId)`. Selama `themeId` lolos regex `isValidThemeId`, nilai ini relatif aman — **tetapi pola `exec` dengan interpolasi string tetap bom waktu**: begitu ada parameter baru (misal nama berkas dari katalog remote) masuk ke fungsi ini, RCE kembali terbuka.

**Perbaikan:** pakai `execFile('unzip', ['-o','-q', zipPath, '-d', destDir])`. Untuk Windows, hindari `powershell -Command` dengan interpolasi — pakai pustaka ZIP murni (mis. `unzipper`/`yauzl`) atau `execFile` dengan argumen array.

---

## 4. TINGGI — Stored XSS pada overlay

### Masalah

`simulateMessage()` menyimpan `customData.message` / `customData.author` mentah tanpa `escapeHtml()`:

```js
message: customData.message || 'For real?! ...',
author: { name: customData.author || 'PhantomViewer', ... },
```

Renderer lalu menulisnya ke DOM via `innerHTML`:

- `src/public/themes/persona5/renderer.js:131` — `messageText.innerHTML = prefixHtml + item.message;`
- `src/public/themes/classic/renderer.js:60` — `msgSpan.innerHTML = item.message;`
- `src/public/overlay.js:165` — `textSpan.innerHTML = item.message || '';` (fallback renderer)

Catatan: `persona3reload` **sudah benar** (memakai `escapeText()`), jadi ini inkonsistensi antar-tema — pola yang berbahaya untuk dipertahankan.

### Bukti empiris

Payload `<img src=x onerror="document.title='XSS-FIRED'">` dikirim ke `/api/simulate`, lalu overlay dibuka. Hasil:

```
status: 200
XSS fired? title = XSS-FIRED
```

Halaman overlay benar-benar mengeksekusi JavaScript dari isi pesan.

### Analisis dampak

Pesan chat asli dari YouTube **sudah** di-escape (`escapeHtml()` di `youtube_ingest.js`), jadi ini bukan jalur penonton-langsung. Yang terekspos adalah `/api/simulate` (dipakai dashboard untuk preview) dan setiap jalur yang menyuntik pesan tanpa escaping. Namun karena `innerHTML` dipakai di 3 renderer, satu regresi di jalur ingest = XSS langsung ke overlay yang tampil di siaran.

**Perbaikan:**
- Escape di **batas sistem** (`simulateMessage`), jangan mengandalkan tiap renderer.
- Ubah renderer ke `textContent` bila tidak butuh markup, atau sanitasi dengan allowlist tag (`<b>`, `<i>`, `<img class="chat-emote">`).

---

## 5. TINGGI — Zip slip (diakui GLM, belum ditambal)

`extractZip()` memanggil `unzip` tanpa memeriksa path entri. ZIP berisi `../../.config/autostart/x.desktop` akan menulis di luar `destDir`. `unzip` modern memblokir `..` absolut, tetapi tidak semua implementasi (dan `tar` fallback) konsisten.

**Perbaikan:** validasi setiap entri (tolak path absolut dan `..`), atau gunakan `unzipper` dengan filter path eksplisit.

---

## 6. PROSES — Test memberi rasa aman palsu

Selain bug CORS di atas, dua test lain perlu diperketat:

- **`test_security_hardening.js` #4** hanya menguji `OPTIONS`. Harus menguji GET dan POST nyata dengan `Origin` eksternal → ekspektasi 403 **dan** tanpa header CORS wildcard.
- **Tidak ada test untuk `/api/updater/*`.** Endpoint paling berbahaya di aplikasi ini tidak punya regresi sama sekali. Tambahkan test yang memastikan `filePath` dengan metachar ditolak.

Prinsip: test keamanan harus menyerang **jalur yang dipakai penyerang**, bukan jalur yang paling mudah di-assert.

---

## 7. RENDAH — Tidak ada batas ukuran body

```
20MB body -> 200
```

`parseJsonBody()` mengakumulasi body tanpa batas → DoS memori. Tambahkan cap (mis. 1 MB) dan tolak `413`.

---

## 8. SEDANG — `downloadUrl` arbitrari pada `/api/themes/install`

`routes/themes.js` memakai `payload.downloadUrl` bila paket lokal tidak ada. Terbukti:

```
POST /api/themes/install {"themeId":"ssrftest","downloadUrl":"http://169.254.169.254/..."} 
  -> connect EHOSTUNREACH 169.254.169.254:80   (SSRF attempt reachable)

POST /api/themes/install {"themeId":"ssrftest3","downloadUrl":"/etc/passwd"}
  -> error: tema berhasil diunduh tetapi tidak memiliki "style.css"
```

Artinya path lokal absolut **diterima** dan disalin ke direktori tema. Tidak berujung RCE dengan sendirinya (berkas harus punya `style.css`), tetapi memungkinkan penyerang menaruh berkas arbitrari ke `~/.config/ky-poni/themes/`. **Perbaikan:** hanya izinkan URL `https://raw.githubusercontent.com/Milkyponi/ky-poni-themes/` (allowlist host + path prefix).

---

## Item yang dilaporkan GLM dan sudah diverifikasi benar

| Klaim GLM | Verifikasi |
|---|---|
| Origin guard HTTP menolak origin eksternal | ✅ Benar — 403 terbukti (tapi dinetralkan oleh sendJson) |
| `verifyClient` WS menolak origin eksternal | ✅ Benar di level upgrade |
| `Origin: null` ditolak | ✅ Benar — 403 |
| DNS-rebinding-style `Host` + `Origin` attacker ditolak | ✅ Benar — 403 |
| `themeId` traversal / metachar ditolak 400 | ✅ Benar untuk install & delete |
| `themeId` valid (`undertale`) tetap install/delete | ✅ Benar — test lulus |
| Suite test lama tetap hijau | ✅ Benar — 11 + 17 + persistence + 13 + 14 lulus |

GLM juga **jujur** mencantumkan 5 hal yang sengaja tidak diubah (zip slip, XSS simulator, graceful shutdown, axios transitive, dashboard monolit) di laporan handover-nya. Itu praktik yang baik.

---

## Rekomendasi urutan kerja

1. **Blocker rilis** — #1 (CORS di `sendJson`) dan #2 (RCE `/api/updater/open`). Keduanya kecil, dampaknya besar.
2. **Segerakan** — #3 (`execFile` di extractZip), #4 (escape di batas sistem), #5 (zip slip).
3. **Test hardening** — tambahkan regresi untuk response nyata (GET/POST) dan endpoint updater. Test lama jangan dihapus, cukup diperkuat.
4. **Housekeeping** — #7 batas body, #8 allowlist host katalog.
5. Setelah semua hijau dengan **bukti serangan yang gagal**, baru naikkan versi (rekomendasi: **1.0.1** patch release — tidak ada perubahan fitur, murni keamanan) dan ikuti SOP rilis.

---

## Catatan versi

`package.json` masih `1.0.0`. Audit ini **tidak menaikkan versi** dan **tidak mengubah satu baris source pun** — murni investigasi. Perubahan kode menunggu persetujuan Bos.
