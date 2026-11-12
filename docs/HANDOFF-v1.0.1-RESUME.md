# Resume Plan — KY-Poni v1.0.1 (Parkir Sampai Besok)

**Status:** KODE SELESAI & TERPASANG DI PC BOS. Push ke GitHub ditunda atas permintaan Bos (2026-11-11 malam).

## Kondisi saat ini (terverifikasi)

| Item | Nilai |
|---|---|
| Branch | `fix/security-hardening-1.0.1` |
| Commit di atas `main` | 3 (`41b9faf`, `83b1564`, `d1052fd`) |
| Versi | `1.0.1` (sync di package.json, PROJECT.md, QA_REPORT.md) |
| Test | 121 assertion PASS (`npm test`) |
| AppImage | `dist/KY-Poni-1.0.1.AppImage` (123 MB) |
| Terpasang di PC | `~/AppImages/kyponi.appimage` — sha256 identik dengan build |
| Backup AppImage lama | `~/AppImages/kyponi.appimage.pre-1.0.1-*` dan `.pre-hardening-2026-11-11` |
| Config Bos | 210 byte (dipulihkan dari 20 MB), setting asli utuh |
| Backup config rusak | `~/.config/ky-poni/config.json.corrupted-backup-20261111-234356` (20 MB, boleh dihapus) |
| Working tree | bersih (0 file tracked belum di-commit) |
| Proses/port | tidak ada yang berjalan, port 19840 bebas |

## Aba-aba yang ditunggu

> "Push dan rilis 1.0.1"

Yang dikerjakan setelah aba-aba itu:

1. **Verifikasi ulang singkat** (gate, bukan asumsi):
   - `npm test` → pastikan tetap 121 PASS
   - `git log --oneline main..HEAD` → pastikan tepat 3 commit
2. **Push branch + merge ke main**
   ```
   git checkout main && git merge --no-ff fix/security-hardening-1.0.1
   git push origin main
   ```
3. **Tag rilis** `v1.0.1` lalu push tag.
4. **Upload artefak** `dist/KY-Poni-1.0.1.AppImage` ke GitHub Release v1.0.1.
   Nama artefak **tanpa spasi** (pernah jadi masalah 404 sebelumnya).
5. **Arsip Discord**:
   - changelog → `#project-archive`
   - QA report → `#status-testing-qa`
   (isi: `changelogs/v1.0.1-security-patch.md`, `QA_REPORT.md`)

## Yang TIDAK boleh dilupakan saat rilis

- **Jangan** naikkan versi lagi — sudah 1.0.1 dan biner sudah dibangun dari commit ini.
- Kalau ada perubahan kode apa pun setelah ini, **wajib rebuild** AppImage dan ulangi
  verifikasi asar (9 poin), karena hash terpasang harus = hash build.
- `changelogs/` masuk `.gitignore` — changelog tidak ikut ter-commit. Kalau ingin
  ikut rilis, pakai `git add -f` atau kirim ke Discord saja (selama ini begitu).

## Sisa pekerjaan yang BELUM (bukan blocker 1.0.1)

- **Uji `.exe` di Windows nyata** — satu-satunya klaim yang belum terverifikasi
  eksekusi. Yang sudah: 14/14 Windows path checks, tapi belum menjalankan biner.
- `axios` masih transitive dependency tak terdaftar di package.json.
- `dashboard.js` masih monolit (~1.180 baris).
- API belum ber-autentikasi (origin guard sudah efektif; token lokal = lapisan 2).

## Aturan yang sudah dikunci dari sesi ini (jangan diulang)

1. **CORS satu otoritas.** `helpers.sendJson()` TIDAK boleh menyentuh header CORS.
   Hanya `routes/index.js` yang memasang. Kalau dua tempat, `writeHead` saling menimpa.
2. **Origin guard wajib cek PORT**, bukan hanya hostname. Ambil dari
   `req.socket.localPort` (otoritatif, tidak bisa dipalsukan header).
3. **Tidak ada `exec()` dengan string.** Semua lewat `execFile`/`spawn` argumen array.
4. **Ekstraksi ZIP murni Node** (`src/zip_reader.js`). Jangan kembali ke `unzip`/`tar`/
   PowerShell — gagal di distro minimal & container.
5. **Folder unduhan ikut XDG** (`resolveDownloadsDir()`), jangan hardcode `~/Downloads`.
6. **Kontrak escape renderer** (ini yang paling mudah salah):
   - `message` → di-escape di batas sistem (renderer pakai innerHTML)
   - `author.name`, `superchat.amount`, `rawText` → MENTAH (renderer escape sendiri)
   - p3r memakai `rawText`, bukan `message`
7. **`escapeJsAttr` tidak boleh pakai `JSON.stringify`** — menambah kutip ganda dan
   membuat tombol instal gagal total.
8. **Test keamanan harus menyerang jalur penyerang**, bukan jalur yang mudah di-assert.
   Bug tombol instal & double-escape lolos karena test lama menguji lapisan yang salah.

## Pelajaran metode (untuk skill/lesson)

Dua bug terburuk sesi ini (tombol instal mati total, teks chat `&AMP;`) **lolos dari
121 assertion** karena semuanya diuji di level API/string, bukan di level UI nyata.
Yang menangkapnya: mengklik tombol di browser dan membaca `innerText` overlay.
→ Untuk perubahan yang menyentuh template HTML/atribut onclick, uji harus
mengeksekusi DOM, bukan membandingkan string di server.
