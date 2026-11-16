# QA & Technical Audit Report: Fix Connected Profile Card Edit Lock

- **Proyek**: KY-Poni (v1.3.0)
- **Target File**: `src/public/dashboard.js`, `package.json`
- **Test Suite Baru**: `test/test_dashboard_profile_ui.js`
- **Tanggal**: 16 November 2026
- **Status**: ✅ PASSED (Semua gate lulus 100%)

---

## 1. Ringkasan Akar Masalah (Root Cause)
Sebelumnya, pada `src/public/dashboard.js`, terdapat background heartbeat berupa polling cadangan 3–5 detik (`pollStatus()`) dan event stream WebSocket (`SYSTEM_STATUS`) yang memanggil `applyStreamStatus(data)`.

Ketika `data.profile` tersedia, fungsi tersebut secara agresif mengeksekusi `renderChannelProfile()` yang memaksa:
- `ytInputView.style.display = 'none'`
- `ytProfileView.style.display = 'block'`

Akibatnya, ketika pengguna menekan tombol **"Ganti"** (`btnEditTarget`), form input handle/URL yang baru terbuka akan tertimpa dan ditutup paksa dalam hitungan 1–3 detik, mengembalikan tampilan kartu profil lama dan membuang teks yang sedang diketik.

---

## 2. Implementasi Solusi (Clean Architecture: UI Edit Lock)

### A. State Guard `isEditingTarget`
1. Ditambahkan flag state `let isEditingTarget = false;` di sebelah `currentChannelProfile`.
2. Fungsi `showTargetInputForm(allowCancel, markEditing = true)` memasang lock (`isEditingTarget = true`) sebelum menyentuh DOM.
3. Boot awal (`applyConfigToUI`) memanggil `showTargetInputForm(false, false)` agar resting state form kosong tidak mengunci mekanisme autoconnect.
4. `renderChannelProfile()` merilis lock (`isEditingTarget = false`) sebagai tanda deliberate render selesai.
5. Handler tombol **"Batal"** (`btnCancelEdit`) merilis lock dan merender ulang profil sebelumnya.
6. Handler tombol **"Connect"** (`btnConnect`) merilis lock jika koneksi sukses. Jika gagal, lock tetap aktif agar form input tidak hilang saat pengguna memperbaiki typo.

### B. Guarding Background Heartbeat
Pada `applyStreamStatus(data)`:
```javascript
if (data.profile && !isEditingTarget) {
  currentChannelProfile = data.profile;
  renderChannelProfile(data.profile, data.target || (ytTargetInput ? ytTargetInput.value.trim() : ''));
}
```
Badge, dot avatar, dan liveId tetap diperbarui di background; hanya layout kartu profil dan form input yang dibekukan saat pengeditan aktif.

---

## 3. Bukti Verifikasi & Hasil Pengujian

### A. Self-Test Subagent (DeepSeek)
- Eksekusi mandiri test suite `test/test_dashboard_profile_ui.js`: **19/19 checks passed**.
- Eksekusi mandiri `npm test` (2x run): **Semua 13 suite passed**, exit code 0.

### B. Lead Engineer Re-Verification (Fonzy / Gemini Flash)

1. **Unit Test Khusus Profile Edit-Lock**:
```text
node test/test_dashboard_profile_ui.js
[PASS] isEditingTarget is declared exactly once
[PASS] Declaration sits next to currentChannelProfile
[PASS] showTargetInputForm() raises the edit lock
[PASS] renderChannelProfile() clears the edit lock
[PASS] btnCancelEdit handler clears the edit lock
[PASS] btnConnect handler clears the edit lock
[PASS] applyStreamStatus() guards the profile render with !isEditingTarget
[PASS] Boot opens the form without locking edit mode
[PASS] Boot with a saved profile renders the card and clears the lock
[PASS] Clicking "Ganti" opens the form and raises the lock
[PASS] THE BUG: background poll mid-edit does not steal the form back
[PASS] The WebSocket SYSTEM_STATUS path is guarded too
[PASS] Badges still update from the background feed while editing
[PASS] "Batal" restores the card and releases the lock
[PASS] After cancel, background polling may render the card again
[PASS] Connect renders the new card and releases the lock
[PASS] A failed connect keeps the form usable and does not lock the user out
[PASS] First run (no saved target) does not lock out autoconnect
[PASS] Repeated heartbeats never reopen the form over a rendered card

19/19 profile edit-lock checks passed
```

2. **Full Regression Suite (`npm test`)**:
- `test_server.js`: 11/11 tests passed
- `test_anti_rto.js`: 100% resilience passed
- `test_connectivity.js`: 50/50 checks passed
- `test_autoconnect.js`: 5/5 checks passed
- `test_persistence.js`: 18/18 tests passed
- `test_dashboard_boot.js`: 18/18 checks passed
- `test_dashboard_profile_ui.js`: 19/19 checks passed
- `test_windows_compat.js`: 14/14 checks passed
- `test_security_hardening.js`: passed
- `test_security_regression.js`: passed
- `test_overlay_settings.js`: passed
- `test_config_broadcast.js`: passed
- `test_transitions.js`: 45/45 transitions passed

**Hasil Akhir**: Exit code 0, 0 error, 0 regresi.
