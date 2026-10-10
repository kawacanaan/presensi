# Sistem Aktivasi Lisensi Paket Guru Berdasarkan Nominal Pembayaran

Implementasi logika aktivasi lisensi Paket Guru (`guru_pro`) berdasarkan rentang nominal pembayaran yang diverifikasi melalui Midtrans secara bertingkat (1 sampai 12 bulan) di sisi backend, dengan antarmuka modal dukungan yang sangat bersih tanpa input nominal (cukup satu tombol aksi langsung mengarahkan ke Midtrans Snap), serta menampilkan masa aktif resmi setelah pembayaran berhasil diverifikasi.

---

### User Review & Critical Decisions

> [!IMPORTANT]
> - **Tanpa Input Nominal di Aplikasi**: Modal aplikasi **tidak meminta input nominal** atau chip pilihan harga apa pun. Seluruh peran pembayaran langsung diserahkan kepada Midtrans.
> - **Satu Tombol Aksi Langsung**: Modal hanya menyajikan pesan ajakan dukungan sukarela dan satu tombol langsung: *"Beri Dukungan via Midtrans"*, yang seketika memicu popup resmi Midtrans Snap.
> - **Kerahasiaan Durasi Sebelum Pembayaran**: Pengguna **tidak melihat durasi lisensi atau rumus konversi bulan di awal**.
> - **Penyingkapan Masa Aktif Pasca Pembayaran**: Pengguna baru mengetahui masa aktif lisensi Paket Guru (tanggal kedaluwarsa resmi) **setelah pembayaran berhasil diverifikasi** melalui webhook Midtrans (pada layar sukses, invoice lunas, dan kartu profil).
> - **Logika Backend Ketat & Otoritatif**: Berapa pun nominal yang dibayarkan dan diverifikasi oleh Midtrans, backend (`api/midtrans.ts`) secara otomatis memetakan ke durasi lisensi:
>   - `Rp1` – `Rp5.000` ➔ **1 Bulan**
>   - `Rp5.001` – `Rp10.000` ➔ **2 Bulan**
>   - `Rp10.001` – `Rp15.000` ➔ **3 Bulan**
>   - `Rp15.001` – `Rp20.000` ➔ **4 Bulan**
>   - `Rp20.001` – `Rp25.000` ➔ **5 Bulan**
>   - `Rp25.001` – `Rp30.000` ➔ **6 Bulan**
>   - `Rp30.001` – `Rp35.000` ➔ **7 Bulan**
>   - `Rp35.001` – `Rp40.000` ➔ **8 Bulan**
>   - `Rp40.001` – `Rp45.000` ➔ **9 Bulan**
>   - `Rp45.001` – `Rp50.000` ➔ **10 Bulan**
>   - `Rp50.001` – `Rp55.000` ➔ **11 Bulan**
>   - `Rp55.001` atau lebih ➔ **12 Bulan (Maksimal 1 Tahun)**
> - **Idempotensi Webhook**: Sistem memverifikasi SHA-512 signature Midtrans dan status `SETTLED`. Notifikasi berulang tidak akan menambahkan durasi lisensi secara ganda.

---

### 1. Overview & Core Concept

- **Apa yang Dibangun**: Menyederhanakan modal dukungan Paket Guru secara maksimal. Aplikasi tidak lagi menampilkan pilihan paket bulanan/tahunan ataupun input nominal manual. Pengguna cukup menekan satu tombol dukungan, lalu jendela resmi Midtrans Snap terbuka. Backend membaca `gross_amount` hasil verifikasi Midtrans, mengalkulasi durasi bulan (1 s.d. 12 bulan), dan mengaktifkan akun seketika.
- **Target Pengguna**: Guru mandiri, Wali Kelas, dan Guru Mapel pada Ruang Kerja Individu.
- **Nilai Utama**:
  1. Pengalaman pengguna yang super simpel dan tanpa hambatan: cukup 1 klik langsung ke Midtrans.
  2. Bebas kebingungan teknis maupun input angka yang merepotkan guru di HP/komputer.
  3. Keamanan perhitungan lisensi 100% dijamin oleh server backend.

---

### 2. User Experience & Visual Design

#### A. Alur Interaksi Pra-Pembayaran (Modal Aplikasi)
1. **Modal Dukungan Bersih & Menenangkan**:
   - Tajuk: *"Bantu Kami Terus Berkembang"*.
   - Ilustrasi visual pendidikan yang hangat.
   - Pesan apresiasi: *"Dukungan dari Anda membantu kami menjaga aplikasi tetap aktif, aman, dan terus dikembangkan untuk kebutuhan sekolah."*
   - Satu tombol utama: **"Beri Dukungan via Midtrans"** (langsung memicu popup Snap).
   - *Tanpa input nominal, tanpa pilihan paket, tanpa rumus bulan.*

#### B. Alur Interaksi Popup Midtrans Snap
- Jendela Midtrans Snap muncul langsung di atas aplikasi, memfasilitasi pilihan metode pembayaran (QRIS, VA Bank, dsb).

#### C. Alur Interaksi Pasca-Pembayaran (Setelah Verifikasi Sukses)
- Layar sukses / konfirmasi menampilkan:
  - *"Terima kasih atas dukungan Anda!"*
  - *"Pembayaran sebesar Rp [Nominal Riil] telah terverifikasi."*
  - *"Paket Guru aktif pada akun Anda hingga: [Tanggal Berakhir]"*.

```
┌─────────────────────────────────────────────────────────────┐
│                 DUKUNG PENGEMBANGAN APLIKASI                │
│             Bantu Kami Menjaga Layanan Tetap Aktif          │
├─────────────────────────────────────────────────────────────┤
│  Setiap dukungan dari Anda sangat berarti untuk menjaga     │
│  aplikasi tetap stabil, aman, dan terus diperbarui demi     │
│  kelancaran operasional presensi sekolah.                   │
│                                                             │
│  [ ❤️ Beri Dukungan via Midtrans ]                          │
└─────────────────────────────────────────────────────────────┘
                             │
                             ▼ (Popup Midtrans Snap Terbuka & Selesai)
┌─────────────────────────────────────────────────────────────┐
│               TERIMA KASIH ATAS DUKUNGAN ANDA!              │
│                                                             │
│  ✓ Pembayaran sebesar Rp [Nominal] telah diverifikasi.      │
│  ✓ Akun Anda resmi berstatus Paket Guru.                    │
│  ★ Masa Aktif Lisensi: Aktif hingga [Tanggal Berakhir]      │
│                                                             │
│  [ Masuk ke Ruang Kerja Guru ] [ Cetak Bukti Pembayaran ]   │
└─────────────────────────────────────────────────────────────┘
```

---

### 3. Key Product Decisions & Trade-Offs

#### Keputusan 1: Zero-Input UI di Modal Aplikasi
- **Alasan**: Sesuai arahan pengguna, tidak perlu ada input nominal di modal aplikasi. Mengarahkan pengguna langsung ke Midtrans membuat antarmuka menjadi sangat bersih dan menghilangkan gesekan (friction) bagi guru.

#### Keputusan 2: Pemetaan Nominal ke Durasi di Backend
- **Aturan Backend**:
  - `Rp1` – `Rp5.000` ➔ **1 Bulan**
  - `Rp5.001` – `Rp10.000` ➔ **2 Bulan**
  - `Rp10.001` – `Rp15.000` ➔ **3 Bulan**
  - `Rp15.001` – `Rp20.000` ➔ **4 Bulan**
  - `Rp20.001` – `Rp25.000` ➔ **5 Bulan**
  - `Rp25.001` – `Rp30.000` ➔ **6 Bulan**
  - `Rp30.001` – `Rp35.000` ➔ **7 Bulan**
  - `Rp35.001` – `Rp40.000` ➔ **8 Bulan**
  - `Rp40.001` – `Rp45.000` ➔ **9 Bulan**
  - `Rp45.001` – `Rp50.000` ➔ **10 Bulan**
  - `Rp50.001` – `Rp55.000` ➔ **11 Bulan**
  - `Rp55.001` atau lebih ➔ **12 Bulan (Maksimal 1 Tahun)**
- **Nominal < Rp1 atau Rp0**: Tidak mengaktifkan lisensi.

#### Keputusan 3: Penentuan Tanggal Mulai Lisensi
- **Pengguna Baru / Paket Gratis**: Durasi dihitung mulai dari tanggal aktivasi pembayaran yang berhasil (`now + N bulan`).
- **Pengguna dengan Lisensi Aktif**: Jika lisensi saat ini belum kedaluwarsa (`currentExpiry > now`), perpanjangan dihitung dari tanggal kedaluwarsa aktif tersebut (`currentExpiry + N bulan`).

#### Keputusan 4: Idempotensi Webhook Midtrans
- Sebelum memproses aktivasi, server memeriksa status transaksi di tabel `payments`. Jika invoice sudah `SETTLED`, proses aktivasi dihentikan lebih awal (`early return`) untuk mencegah penambahan durasi ganda akibat webhook retry.

---

### 4. Technical Architecture & Data Strategy

```
┌──────────────────────────────────────────────────────────┐
│                      Client UI                           │
│  - UpgradePromptModal.tsx (Zero-input, 1-Click to Snap)  │
│  - TeacherUpgradeModal.tsx (Direct Trigger to Snap)      │
└────────────────────────────┬─────────────────────────────┘
                             │ POST /api/midtrans
                             │ { action: 'create_transaction', plan_id: 'guru_pro' }
                             ▼
┌──────────────────────────────────────────────────────────┐
│                   Midtrans Server API                    │
│  - Request Snap Token dari Midtrans (open/base amount)   │
│  - Simpan transaksi ke tabel payments (status: PENDING)  │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼ Webhook Callback (Midtrans Settlement)
┌──────────────────────────────────────────────────────────┐
│                   Midtrans Webhook                       │
│  - Verifikasi Signature SHA-512                          │
│  - Idempotency Guard: if status == SETTLED -> skip       │
│  - Baca gross_amount riil yang diverifikasi Midtrans     │
│  - Hitung durasi bulan via calculateMonths(gross_amount) │
│  - Hitung newExpiry (now / currentExpiry + N bulan)      │
│  - Update payments (SETTLED, paid_at, gross_amount)      │
│  - Update schools/profile (plan: 'guru_pro', newExpiry)  │
│  - Catat audit_logs                                      │
└────────────────────────────┬─────────────────────────────┘
                             │
                             ▼ Client Poll / Callback
┌──────────────────────────────────────────────────────────┐
│            Layar Sukses (Pasca-Pembayaran)               │
│  - Menampilkan tanggal kedaluwarsa resmi dari server     │
└──────────────────────────────────────────────────────────┘
```

#### Komponen dan File yang Dimodifikasi:
1. `api/midtrans.ts`:
   - Pasang fungsi kalkulasi:
     ```typescript
     export function calculateTeacherLicenseMonths(amount: number): number {
       if (!amount || amount < 1) return 0;
       return Math.min(12, Math.ceil(amount / 5000));
     }
     ```
   - Di handler `webhook`, `check_status`, dan `simulate_settlement`: hitung `newExpiry` berbasis `calculateTeacherLicenseMonths(amount)` dengan penambahan bulan kalender yang akurat.
   - Guard idempotensi untuk transaksi `SETTLED` agar tidak terjadi penambahan lisensi ganda.
2. `src/utils/packageSystem.ts`:
   - Tambahkan fungsi kalkulasi bulan dan tanggal kedaluwarsa.
   - Perbarui teks Paket Guru menjadi "Dukungan Pengembangan Guru".
3. `src/components/UpgradePromptModal.tsx`:
   - Hapus seluruh opsi radio bulanan/tahunan dan kartu harga.
   - Sediakan tombol tunggal *"Beri Dukungan via Midtrans"* yang langsung membuka Midtrans Snap.
   - Tampilkan masa aktif lisensi (tanggal kedaluwarsa) pada layar konfirmasi sukses setelah pembayaran berhasil.
4. `src/components/TeacherUpgradeModal.tsx`:
   - Hapus pilihan paket bulanan/tahunan.
   - Langsung sediakan aksi pembukaan Midtrans Snap dan tampilkan tanggal kedaluwarsa resmi di langkah akhir.
5. `src/context/AppContext.tsx`:
   - Sesuaikan `createTeacherMidtransTransaction` agar tidak bergantung pada siklus `monthly`/`yearly`.
