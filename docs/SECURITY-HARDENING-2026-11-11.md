# Laporan Security Hardening — 2026-11-11

> **Konteks untuk agent Hermes:** perubahan di laporan ini dikerjakan oleh agent **GLM
> (via OpenCode)** atas permintaan langsung Milkyponi, setelah sesi audit read-only
> source code KY-Poni v1.0.0. Tidak ada fitur yang berubah — semua perubahan bersifat
> penguatan keamanan pada dua masalah yang disepakati bersama. Jika ada perilaku API
> yang terasa berbeda, baca dulu bagian "Perubahan perilaku" di bawah; itu memang
> disengaja, bukan bug.

## Ringkasan perubahan

Dua masalah yang diperbaiki (hasil audit 2026-11-11):

1. **CORS wildcard `*` + endpoint tak ber-autentikasi** — sebelumnya website apa pun
   yang dibuka di browser user bisa POST ke `http://127.0.0.1:19840` (shutdown,
   connect, install theme) karena semua route memakai `Access-Control-Allow-Origin: *`.
2. **`themeId` tanpa validasi** — sebelumnya `themeId` dari payload API langsung dipakai
   di `path.join()` dan command ekstraksi shell, sehingga nilai seperti `../escape`
   atau `x'; <perintah shell>` bisa traversal keluar folder themes / menitip perintah.

## File yang diubah

| File | Perubahan |
|---|---|
| `src/routes/helpers.js` | Helper baru `isTrustedLocalOrigin(origin, hostHeader)` — memverifikasi header `Origin` hanya localhost/127.0.0.1, atau tidak ada (curl/OBS/Electron). |
| `src/routes/index.js` | Origin guard di awal `dispatchRequest`: origin eksternal → **403**. Header CORS tidak lagi wildcard; hanya di-echo untuk origin lokal terpercaya. |
| `src/server.js` | `verifyClient` pada WebSocketServer: upgrade WS dari origin eksternal ditolak (melengkapi guard HTTP). |
| `src/theme_manager.js` | Aturan baru `THEME_ID_PATTERN` (`/^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/`) + `isValidThemeId()`; divalidasi di `installTheme()` dan `deleteTheme()`. Helper `isSafeThemeLookupId()` memblok traversal (`/`, `\`, `..`) di `getThemePath()` tanpa membatasi nama folder user yang dibuat manual. Keduanya diekspor. |
| `src/routes/themes.js` | Route install/delete memvalidasi `themeId` lebih dulu → **400** dengan pesan jelas (bukan 500 samar). |
| `package.json` | `npm test` kini juga menjalankan `test/test_security_hardening.js`. |
| `test/test_security_hardening.js` | **File baru** — 9 regresi test untuk kedua perbaikan (detail di bawah). |

## Perubahan perilaku yang disengaja

- API **tetap bekerja normal** dari dashboard, overlay OBS, dan Electron (semuanya
  satu-origin dengan server, atau tanpa header Origin).
- Permintaan dari browser dengan `Origin` **eksternal** (website lain) → 403. Ini inti
  perbaikannya: browser adalah celah masuk sebelumnya.
- `themeId` dengan karakter selain `a-z`, `0-9`, `-` → 400. Semua id tema bawaan dan
  dari katalog (`persona5`, `classic`, `persona3reload`, `cyberpunk2077`,
  `undertale`, dst.) memenuhi pola ini.
- Jika suatu saat ada tema publik yang butuh karakter lain di id-nya, longgarkan
  `THEME_ID_PATTERN` di `src/theme_manager.js` — tapi jangan sampai mengizinkan
  `/`, `\`, `..`, spasi, atau metacharacter shell.

## Bukti uji

Semua suite lolos setelah perubahan (`npm test`):

```
🎉 ALL 11 TESTS PASSED SUCCESSFULLY! (test_server)
17/17 tests passed (test_anti_rto)
✅ All persistence & cross-platform tests passed (test_persistence)
13/13 boot-order checks passed (test_dashboard_boot)
14/14 Windows compatibility checks passed (test_windows_compat)
🎉 ALL SECURITY HARDENING TESTS PASSED! (test_security_hardening)
```

`test_security_hardening.js` mencakup: request tanpa Origin diterima; origin localhost
diterima; origin eksternal ditolak 403; CORS tidak lagi `*`; upgrade WS eksternal
ditolak; WS tanpa Origin diterima; `themeId` berbahaya (`../escape`, metachar shell,
uppercase, dll.) → 400 di install & delete; id valid `undertale` tetap install/delete
bersih.

## Yang sengaja TIDAK diubah (masalah audit lain, belum disepakati)

Agar lingkup perubahan tetap sesuai permintaan Milkyponi, masalah audit berikut
dibiarkan apa adanya dan bisa jadi pekerjaan berikutnya:

- **Zip slip** — `extractZip()` belum memvalidasi path entri di dalam ZIP.
- **Simulator tidak meng-escape pesan** — `simulateMessage()` melewati `escapeHtml()`.
- **Graceful shutdown bisa menggantung** — `server.close()` tidak menutup `wss` dulu.
- **`axios` transitive dependency** — di-`require` langsung tapi tak terdaftar di
  `package.json`.
- **`dashboard.js` monolit** — 1.156 baris, perlu dipecah (pengorganisasian, bukan bug).

## Cara memverifikasi manual

```bash
npm test                      # semua suite termasuk security hardening
npm run start:server          # lalu dari terminal terpisah:
curl -i http://localhost:19840/api/status                    # 200 OK (tanpa Origin)
curl -i -H "Origin: https://contoh.com" -X POST \
     -d '{"type":"chat"}' http://localhost:19840/api/simulate # 403 ditolak
curl -i -X POST -H "Content-Type: application/json" \
     -d '{"themeId":"../escape"}' http://localhost:19840/api/themes/install # 400 ditolak
```
