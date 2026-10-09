/**
 * Presiden Konoha Knowledge Base & Privacy Guardrails Engine for KawaCanaan Presensi Landing Page.
 *
 * PERAN PRESIDEN KONOHA:
 * Asisten virtual / pemandu cerdas untuk pengunjung landing page KawaCanaan Presensi.
 * Presiden Konoha bukan admin sekolah, bukan pengolah data presensi, dan bukan pengganti fitur utama aplikasi.
 * Fokus: Membantu pengunjung mengenal KawaCanaan, memahami fitur, mendapatkan jawaban atas
 * pertanyaan umum, dan diarahkan ke tindakan yang tepat secara natural.
 */

import type { LandingDynamicContext } from './landingContextTracker';

export type KokaActionType =
  | 'open_register_free'
  | 'open_register_school'
  | 'open_login'
  | 'open_community'
  | 'scroll_features'
  | 'scroll_how_it_works'
  | 'scroll_pricing'
  | 'scroll_faq'
  | 'scroll_contact';

export interface KokaAnswerResult {
  text: string;
  category: string;
  suggestions?: string[];
  actionType?: KokaActionType | null;
  actionLabel?: string | null;
}

// 1. Pola Pertanyaan yang Dilarang Keras (Batasan Privasi & Keamanan)
// - Akses data siswa
// - Akses data presensi
// - Mengubah / membuat / menghapus data
// - Mengklaim telah melakukan aksi di aplikasi
// - Mengakses credential, token, database internal
// - Mengaku sebagai manusia
const STRICT_PRIVACY_BLOCKED_PATTERNS = [
  /(daftar|nama|nomor|biodata|identitas|profil|data)\s*(siswa|murid|anak|wali|ortu|orang\s*tua)/i,
  /siapa\s*saja\s*(siswa|murid|guru|anak)/i,
  /(melihat|cek|lihat|intip|cari|buka)\s*(data|nilai|rapor|absensi|kehadiran|catatan)\s*(siswa|murid|anak|si\s+[a-z]+)/i,
  /apakah\s+([a-z]+)\s+(hadir|masuk|absen|sakit|izin|alfa)/i,
  /siapa\s+yang\s+(sakit|izin|alfa|tidak\s+masuk|terlambat|telat)\s+hari\s+ini/i,
  /(absenkan|tandai\s*hadir|catatkan|ubah\s*data|hapus\s*data|input\s*presensi|edit\s*siswa|tambah\s*siswa)/i,
  /password|kata\s*sandi|pin|token|credential|rahasia|kunci\s*rahasia|service_role|anon_key|api_key/i,
  /database|supabase|tabel|table|query|schema|sql|select\s+\*|dump\s*data|backup\s*database/i,
  /gaji\s*(guru|staf)|dana\s*bos|anggaran\s*sekolah/i,
  /apakah\s*(kamu|anda)\s*(manusia|orang\s*asli)/i,
];

// Kata kunci in-scope seputar KawaCanaan
const IN_SCOPE_KEYWORDS = [
  'kawacanaan', 'kawa', 'koka', 'presensi', 'absensi', 'absen', 'kehadiran',
  'guru', 'wali kelas', 'mapel', 'mata pelajaran', 'kepala sekolah', 'kepsek', 'sekolah', 'sd',
  'siswa', 'murid', 'kelas', 'rombel', 'ruang kerja', 'workspace',
  'qr', 'barcode', 'scan', 'kode qr', 'presensi qr',
  'hari efektif', 'kalender', 'kedinasan', 'format kedinasan', 'rapor', 'rekap', 'laporan', 'excel', 'pdf',
  'harga', 'biaya', 'paket', 'langganan', 'tarif', 'bayar', 'gratis', 'free', 'trial',
  'daftar', 'mendaftar', 'registrasi', 'login', 'masuk', 'portal', 'coba', 'mencoba',
  'fitur', 'manfaat', 'keunggulan', 'cara kerja', 'faq', 'tanya', 'komunitas', 'whatsapp', 'wa',
  'keamanan', 'privasi', 'uu pdp', 'midtrans', 'qris', 'kontak', 'hubungi'
];

export function getKokaLandingResponse(
  question: string,
  lang: 'ID' | 'EN' = 'ID',
  dynamicContext?: LandingDynamicContext | null,
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
): KokaAnswerResult {
  const qLower = question.toLowerCase().trim();

  // -------------------------------------------------------------
  // 1. BATASAN KETAT PRIVASI & KEAMANAN
  // -------------------------------------------------------------
  const isPrivacyViolation = STRICT_PRIVACY_BLOCKED_PATTERNS.some((pattern) => pattern.test(qLower));
  if (isPrivacyViolation) {
    if (lang === 'EN') {
      return {
        text: "🔒 **National Privacy Protocol & System Guardrail**\n\nAs Presiden Konoha on the public podium, I do not have constitutional authority to disclose or alter private student records. Official attendance disposition is securely accessible inside the application after formal sign-in.\n\nIs there any feature or pricing regulation I can coordinate with you?",
        category: 'privacy_guarded',
        suggestions: [],
      };
    }
    return {
      text: "🔒 **Protokol Kerahasiaan Negara & Dekrit Privasi**\n\nDemi menjaga stabilitas dan kerahasiaan data sekolah, Presiden Konoha di mimbar terbuka landing page ini tidak berwenang membuka ataupun mendisposisikan data privat siswa. Seluruh pendataan presensi wajib diproses secara tertib melalui login resmi aplikasi KawaCanaan.\n\nApakah ada regulasi fitur atau paket resmi yang ingin kita koordinasikan lebih lanjut, Bapak/Ibu?",
      category: 'privacy_guarded',
      suggestions: [],
    };
  }

  // -------------------------------------------------------------
  // 2. DETEKSI PERTANYAAN RUJUKAN DEIKTIK ("ini", "apa yang ini", "ini apa")
  // Prioritas tinggi: jika pengguna merujuk langsung pada apa yang ada di layar
  // -------------------------------------------------------------
  const isDeicticQuery =
    /^(apa\s*yang\s*ini|ini\s*apa|apa\s*ini|yang\s*ini\s*apa|ini\s*maksudnya\s*apa|maksudnya\s*yang\s*ini\s*apa|ini\s*fitur\s*apa|apa\s*maksudnya\s*ini|ini\s*tentang\s*apa)$/i.test(
      qLower
    ) ||
    /^(apa\s*ini\?*|ini\s*apa\?*|yang\s*ini\?*)$/i.test(qLower);

  if (isDeicticQuery) {
    // 2a. Jika pengguna sedang melihat modal tertentu
    if (dynamicContext?.activeModal) {
      return {
        text: `Yang sedang Bapak/Ibu buka di layar adalah formulir **${dynamicContext.activeModal}** 😊\n\nFormulir ini dapat langsung diisi untuk melanjutkan langkah pendaftaran atau akses ke dalam sistem KawaCanaan. Jika ada kendala dalam mengisi formulir, silakan beritahu saya ya!`,
        category: 'dynamic_modal',
        suggestions: [],
      };
    }

    // 2b. Jika pengguna sedang melihat fitur tertentu di section Fitur
    if (dynamicContext?.sectionId === 'fitur') {
      if (dynamicContext.visibleFeature) {
        return {
          text: `Yang sedang Bapak/Ibu lihat di layar adalah fitur **${dynamicContext.visibleFeature.title}** 😊\n\n${dynamicContext.visibleFeature.description}\n\nFitur ini dirancang khusus agar administrasi presensi siswa Sekolah Dasar menjadi lebih praktis, rapi, dan transparan bagi sekolah maupun orang tua.`,
          category: 'dynamic_feature',
          suggestions: [],
        };
      }
      return {
        text: 'Yang sedang Bapak/Ibu lihat di layar adalah bagian **Fitur Utama KawaCanaan Presensi SD** 😊 Di bagian ini ditampilkan sistem Dual-Mode Presensi, validasi QR dinamis otomatis, penghitungan hari belajar efektif otomatis, hingga cetak rekap format kedinasan.',
        category: 'dynamic_section',
        suggestions: [],
      };
    }

    // 2c. Jika pengguna sedang membuka FAQ tertentu
    if (dynamicContext?.activeFaq) {
      return {
        text: `Yang sedang Bapak/Ibu buka adalah pertanyaan:\n\n**"${dynamicContext.activeFaq.question}"**\n\n${dynamicContext.activeFaq.answer}\n\nSemoga penjelasan ini membantu menjawab keraguan Bapak/Ibu 😊 Ada yang ingin ditanyakan lagi?`,
        category: 'dynamic_faq',
        suggestions: [],
      };
    }

    // 2d. Jika pengguna sedang melihat section Harga
    if (dynamicContext?.sectionId === 'harga') {
      return {
        text: 'Yang sedang Bapak/Ibu lihat di layar adalah **Pilihan Paket Lisensi KawaCanaan** 😊\n\n• **Paket Gratis (Rp0)**: Cocok untuk 1 guru kelas mandiri (s.d. 50 siswa, 1 rombel).\n• **Paket Guru (Rp5.000/bln / Rp60.000/thn)**: Untuk Wali Kelas (1 rombel, 50 siswa) atau Guru Mapel (hingga 6 rombel, 300 siswa).\n• **Paket Sekolah (Rp25.000/bln / Rp250.000/thn perdana)**: Untuk 1 sekolah penuh (maks 1.200 siswa, 100 guru, 24 kelas, maks 50 siswa/kelas, hemat 2 bulan untuk pembelian perdana; perpanjangan Rp300.000/thn).',
        category: 'dynamic_pricing',
        suggestions: [],
      };
    }

    // 2e. Jika pengguna sedang melihat section Cara Kerja
    if (dynamicContext?.sectionId === 'cara-kerja') {
      return {
        text: 'Yang sedang Bapak/Ibu lihat di layar adalah **3 Langkah Praktis Penerapan KawaCanaan** di Sekolah Dasar:\n\n1. Konfigurasi awal rombel kelas 1–6.\n2. Sinkronisasi data siswa dan penugasan guru.\n3. Pelaksanaan presensi harian serta cetak laporan format kedinasan.',
        category: 'dynamic_how_it_works',
        suggestions: [],
      };
    }

    // 2f. Jika pengguna sedang melihat section Kontak & Komunitas
    if (dynamicContext?.sectionId === 'kontak') {
      return {
        text: 'Yang sedang Bapak/Ibu lihat di layar adalah bagian **Konsultasi Adopsi Sekolah & Komunitas WhatsApp Pendidik** 😊 Bapak/Ibu dapat memindai barcode atau mengklik tombol bergabung untuk terhubung langsung dengan sesama guru SD lainnya.',
        category: 'dynamic_contact',
        suggestions: [],
      };
    }

    // 2g. Default jika di section lain
    if (dynamicContext?.sectionTitle) {
      return {
        text: `Yang sedang Bapak/Ibu lihat di layar adalah bagian **${dynamicContext.sectionTitle}** 😊 Di bagian ini Bapak/Ibu dapat mempelajari bagaimana KawaCanaan membantu sekolah dasar menyelenggarakan presensi yang tertib dan akurat.`,
        category: 'dynamic_section',
        suggestions: [],
      };
    }
  }

  // -------------------------------------------------------------
  // 3. DETEKSI PERTANYAAN TENTANG TOMBOL / CTA ("Kalau saya klik ini bagaimana?")
  // -------------------------------------------------------------
  const isCtaActionQuery =
    /kalau\s*(saya\s*)?klik\s*(ini|tombol\s*ini)|tombol\s*ini\s*(buat|untuk)\s*apa|fungsi\s*tombol\s*ini|klik\s*ini\s*(gimana|bagaimana|ke\s*mana)|apa\s*yang\s*terjadi\s*jika\s*(saya\s*)?klik/i.test(
      qLower
    );

  if (isCtaActionQuery) {
    const nearbyCtas = dynamicContext?.nearbyCtas || [];
    const primaryCta = nearbyCtas[0];

    if (primaryCta) {
      if (/gratis|coba/i.test(primaryCta.label)) {
        return {
          text: `Jika Bapak/Ibu mengklik tombol **"${primaryCta.label}"**, Bapak/Ibu akan langsung diarahkan untuk membuat akun Guru Kelas secara gratis tanpa kartu kredit 😊 Ruang kerja personal Bapak/Ibu akan langsung aktif seketika sehingga bisa langsung mulai mencoba mencatat presensi rombel kelas.`,
          category: 'dynamic_cta',
          suggestions: [],
        };
      }
      if (/sekolah/i.test(primaryCta.label)) {
        return {
          text: `Jika Bapak/Ibu mengklik tombol **"${primaryCta.label}"**, Bapak/Ibu akan diarahkan ke formulir pendaftaran Paket Sekolah untuk mengadopsi sistem presensi satu sekolah penuh rombel kelas 1–6 dengan multi-guru dan format kedinasan resmi.`,
          category: 'dynamic_cta',
          suggestions: [],
        };
      }
      if (/komunitas|whatsapp|wa/i.test(primaryCta.label)) {
        return {
          text: `Jika Bapak/Ibu mengklik tombol **"${primaryCta.label}"**, Bapak/Ibu akan langsung terhubung ke tautan undangan grup WhatsApp resmi Komunitas Pendidik KawaCanaan untuk berdiskusi dengan sesama guru SD.`,
          category: 'dynamic_cta',
          suggestions: [],
        };
      }
      if (/masuk|login/i.test(primaryCta.label)) {
        return {
          text: `Tombol **"${primaryCta.label}"** berfungsi untuk membuka halaman login resmi bagi Bapak/Ibu guru, wali kelas, atau kepala sekolah yang sudah memiliki akun di sistem KawaCanaan.`,
          category: 'dynamic_cta',
          suggestions: [],
        };
      }
      return {
        text: `Tombol **"${primaryCta.label}"** yang terlihat di sekitar layar berfungsi untuk: ${primaryCta.description} 😊`,
        category: 'dynamic_cta',
        suggestions: [],
      };
    }

    return {
      text: 'Tombol yang tersedia di halaman ini umumnya berfungsi untuk memudahkan Bapak/Ibu mencoba aplikasi secara gratis ("Mulai Gratis"), mendaftarkan sekolah ("Daftar Sekolah"), atau bergabung ke komunitas pendidik kami. Ada tombol tertentu yang ingin Bapak/Ibu tanyakan?',
      category: 'dynamic_cta_general',
      suggestions: [],
    };
  }

  // -------------------------------------------------------------
  // 4. KONTINUITAS PERCAKAPAN (FOLLOW-UP QUESTIONS)
  // Menangani pertanyaan lanjutan berbasis pesan sebelumnya dalam sesi
  // -------------------------------------------------------------
  const prevUserMessage = history && history.length > 0
    ? [...history].reverse().find((m) => m.role === 'user')?.content.toLowerCase() || ''
    : '';

  // Pertanyaan lanjutan: "kalau untuk guru bagaimana?", "untuk guru gimana?"
  if (/^(kalau\s*)?(untuk|bagi)\s*guru(\s*bagaimana|\s*gimana)?$/i.test(qLower)) {
    return {
      text: 'Untuk Bapak/Ibu Guru, KawaCanaan sangat membantu meringankan beban administrasi harian:\n\n• **Bebas Rekap Manual**: Tidak perlu lagi menghitung persentase kehadiran berjam-jam tiap akhir bulan.\n• **Presensi Kilat**: Cukup beberapa sentuhan di HP atau biarkan murid scan QR kelas.\n• **Dukungan Guru Mapel**: Guru PJOK & Agama memiliki catatan presensi tersendiri tanpa tumpang tindih dengan Wali Kelas.\n• **Paket Gratis**: Guru kelas mandiri dapat menggunakan Ruang Kerja Pribadi gratis selamanya!',
      category: 'benefits_teachers',
      suggestions: [],
    };
  }

  // Pertanyaan lanjutan: "kalau untuk sekolah bagaimana?", "untuk kepala sekolah?"
  if (/^(kalau\s*)?(untuk|bagi)\s*(sekolah|kepala\s*sekolah|kepsek)(\s*bagaimana|\s*gimana)?$/i.test(qLower)) {
    return {
      text: 'Bagi pihak Sekolah dan Kepala Sekolah, KawaCanaan memberikan manfaat strategis:\n\n• **Data Real-Time**: Memantau rekapitulasi kehadiran seluruh kelas 1–6 dalam satu layar dasbor.\n• **Cegah Titip Absen**: Didukung validasi QR dinamis terpadu.\n• **Standar Format Kedinasan**: Laporan resmi A4 siap cetak bertanda tangan untuk keperluan akreditasi dan arsip instansi kedinasan.',
      category: 'benefits_school',
      suggestions: [],
    };
  }

  // Pertanyaan lanjutan: "bagaimana cara memulainya?", "cara mulainya gimana?", "mulainya gimana?"
  if (/^(bagaimana\s*)?(cara\s*)?memulainya(\s*gimana|\s*bagaimana)?$/i.test(qLower) || /mulainya\s*gimana/i.test(qLower)) {
    return {
      text: 'Cara memulainya sangat mudah dan cepat Bapak/Ibu 😊:\n\n1. Klik tombol **"Mulai Gratis"** di bagian atas atau bawah halaman ini.\n2. Isi nama, email, dan nama kelas Bapak/Ibu (tanpa kartu kredit).\n3. Ruang kerja presensi akan langsung terbuka dan siap digunakan untuk mencatat kehadiran siswa hari ini!',
      category: 'how_to_start',
      suggestions: [],
    };
  }

  // -------------------------------------------------------------
  // 5. SAPAAN RESMI KENEGARAAN (WELCOME GREETINGS)
  // -------------------------------------------------------------
  if (/^(halo|hai|hi|hey|helo|halo\s*koka|hai\s*koka|halo\s*presiden|hai\s*presiden|pagi|siang|sore|malam|selamat\s*(pagi|siang|sore|malam)|assalamu['a]?laikum|sampurasun|salam)/i.test(qLower)) {
    if (lang === 'EN') {
      return {
        text: "Hello, welcome to KawaCanaan Presensi! 👋 I am Presiden Konoha.\n\nIs there any information about attendance features, school workflows, or package options you would like to know today? Feel free to ask!",
        category: 'greeting',
        suggestions: [],
      };
    }
    return {
      text: "Halo, selamat datang di KawaCanaan Presensi! 👋 Saya Presiden Konoha.\n\nAda yang bisa saya bantu seputar fitur presensi, alur operasional sekolah, atau pilihan paket yang tersedia? Silakan tanyakan langsung!",
      category: 'greeting',
      suggestions: [],
    };
  }

  // UCAPAN TERIMA KASIH
  if (/terima\s*kasih|makasih|thanks|thank\s*you|syukron|matur\s*nuwun|nuhun/i.test(qLower)) {
    return {
      text: "Terima kasih kembali Bapak/Ibu! Koordinasi ini berjalan sangat produktif 🫡 Tetap jaga stabilitas administrasi sekolah, dan sampaikan jika ada hal lain yang perlu diproses!",
      category: 'courtesy',
      suggestions: [],
    };
  }

  // PERTANYAAN IDENTITAS PRESIDEN KONOHA
  if (/siapa\s*(kamu|anda|koka|presiden|konoha)|kamu\s*siapa|presiden\s*konoha|koka\s*itu\s*apa|tentang\s*(koka|presiden)/i.test(qLower)) {
    return {
      text: "Salam kehormatan! Saya adalah Presiden Konoha, aparatur cerdas tertinggi pengawal stabilitas presensi di KawaCanaan 🇮🇩🏛️\n\nTugas kenegaraan saya adalah memastikan seluruh pendataan, rekapitulasi, dan pelaporan absensi berjalan tertib tanpa kecurangan titip absen. Ada perihal fitur atau paket yang ingin kita bahas dalam koordinasi ini?",
      category: 'identity',
      suggestions: [],
    };
  }

  // -------------------------------------------------------------
  // 6. PERTANYAAN RESMI: "Apa itu KawaCanaan?"
  // -------------------------------------------------------------
  if (/apa\s*itu\s*kawacanaan|tentang\s*kawacanaan|mengenal\s*kawacanaan|aplikasi\s*apa\s*ini/i.test(qLower)) {
    if (lang === 'EN') {
      return {
        text: "**KawaCanaan Presensi** is an integrated digital attendance system purpose-built for Primary Schools (SD).\n\nIt completely replaces manual paper attendance books with an accurate, practical digital solution supporting daily homeroom attendance, specialized subject sessions (PE & Religion), automatic calculation of effective learning days, and official printable reports.",
        category: 'about',
        suggestions: [],
      };
    }
    return {
      text: "**KawaCanaan Presensi** adalah sistem presensi digital terpadu yang dirancang khusus untuk Sekolah Dasar (SD) 😊\n\nAplikasi ini menggantikan buku absensi kertas manual dengan sistem digital yang praktis, tertib, dan akurat. Mendukung presensi harian oleh Wali Kelas, presensi per jam pelajaran khusus (PJOK & Agama), penghitungan otomatis hari belajar efektif, hingga cetak laporan administrasi format kedinasan.",
      category: 'about',
      suggestions: [],
    };
  }

  // -------------------------------------------------------------
  // 7. PERTANYAAN RESMI: "Bagaimana cara kerjanya?"
  // -------------------------------------------------------------
  if (/bagaimana\s*cara\s*kerjanya|cara\s*kerja|alur\s*presensi|langkah\s*kerja/i.test(qLower)) {
    if (lang === 'EN') {
      return {
        text: "KawaCanaan works seamlessly in **3 easy steps**:\n\n1. **Setup School & Classes**: Register your school and Grade 1-6 cohorts (takes less than 2 minutes, free plan available).\n2. **Daily & Subject Attendance**: Students check in via dynamic QR code, or teachers check off attendance directly on their mobile/laptop.\n3. **Automated Reports**: Attendance percentages, sick leave, and unexcused counts calculate automatically and are instantly ready to export to Excel or official printable PDF.",
        category: 'how_it_works',
        suggestions: [],
      };
    }
    return {
      text: "Cara kerja KawaCanaan sangat mudah dan ramah guru dalam **3 langkah praktis**:\n\n1. **Daftar & Siapkan Kelas**: Bapak/Ibu membuat akun dan menyiapkan rombel kelas 1–6 (bisa langsung dicoba gratis tanpa kartu kredit).\n2. **Lakukan Presensi**: Presensi bisa dilakukan via scan QR Code dinamis otomatis, atau guru mencentang langsung daftar kehadiran di kelas lewat HP/laptop.\n3. **Rekap Otomatis**: Kehadiran otomatis terhitung (persentase, sakit, izin, alfa), siap diunduh ke Excel maupun dicetak ke lembar PDF format kedinasan.",
        category: 'how_it_works',
        suggestions: [],
    };
  }

  // -------------------------------------------------------------
  // 8. PERTANYAAN RESMI: "Apa saja fiturnya?"
  // -------------------------------------------------------------
  if (/apa\s*saja\s*fiturnya|fitur|fitur\s*utama|kemampuan|keunggulan/i.test(qLower)) {
    return {
      text: "KawaCanaan memiliki beragam fitur unggulan yang dirancang khusus untuk SD:\n\n• **Dual-Mode Presensi SD**: Presensi harian oleh Wali Kelas dan presensi per jam mata pelajaran khusus (PJOK & Agama).\n• **QR Code Dinamis Otomatis**: Mencegah titip absen karena kode QR terus diperbarui secara berkala.\n• **Penghitungan Otomatis Hari Belajar Efektif**: Kalender akademik otomatis menghitung hari efektif per bulan dan semester.\n• **Portal Siswa & Wali Murid**: Orang tua dapat memantau status kehadiran anak dan mengajukan surat izin sakit online.\n• **Cetak Rekap Format Kedinasan**: Lembar presensi rapi siap cetak PDF dengan kop sekolah dan ekspor spreadsheet Excel.\n• **Multi-Workspace Fleksibel**: Pilihan Ruang Kerja Sekolah terpadu atau Ruang Kerja Individu.",
      category: 'features',
      suggestions: [],
    };
  }

  // -------------------------------------------------------------
  // 9. ARAHAN MENCOBA / MENDAFTAR
  // -------------------------------------------------------------
  if (/ingin\s*mencoba|tertarik\s*mencoba|coba\s*aplikasi|mau\s*coba|coba\s*kawacanaan|tes\s*aplikasi|daftar|registrasi/i.test(qLower)) {
    return {
      text: "Tentu sekali Bapak/Ibu! Bapak/Ibu bisa langsung memilih tombol **'Mulai Gratis'** atau **'Daftar Sekolah'** di halaman ini untuk mulai mencoba tanpa perlu kartu kredit 😊 Pendaftarannya sangat cepat dan ruang kerja langsung aktif seketika!",
      category: 'conversion_trial',
      suggestions: [],
    };
  }

  // -------------------------------------------------------------
  // 10. HARGA, BIAYA, & PAKET
  // -------------------------------------------------------------
  if (/harga|biaya|paket|langganan|tarif|bayar|gratis|free|sekolah\s*pro|guru\s*pro|berapa/i.test(qLower)) {
    return {
      text: "Berikut pilihan paket resmi di KawaCanaan Presensi:\n\n1. **Paket Gratis**: **Rp0 (Aktif Selamanya)** — untuk Ruang Kerja Individu, maksimal 50 siswa SD, 1 rombel, presensi harian & unduh Excel.\n2. **Paket Guru**: **Rp5.000 / bulan** (atau **Rp60.000 / tahun**) — Ruang Kerja Individu (Wali Kelas: 1 rombel, 50 siswa; Guru Mapel: hingga 6 rombel, 300 siswa).\n3. **Paket Sekolah**: **Rp25.000 / bulan** (atau **Rp250.000 / tahun** untuk pembelian perdana dengan hemat 2 bulan, perpanjangan tahun berikutnya Rp300.000 / tahun) — Ruang Kerja Sekolah (maksimal 1.200 siswa, 100 guru, 24 kelas, maks 50 siswa/kelas).\n\nPembayaran resmi didukung Midtrans melalui QRIS dan Virtual Account bank terpercaya.",
      category: 'pricing',
      suggestions: [],
    };
  }

  // -------------------------------------------------------------
  // 11. KOMUNITAS WHATSAPP
  // -------------------------------------------------------------
  if (/komunitas|community|grup\s*wa|whatsapp|gabung\s*komunitas/i.test(qLower)) {
    return {
      text: "Bapak/Ibu pendidik dapat bergabung dengan **Komunitas Pendidik KawaCanaan di WhatsApp** untuk berdiskusi, bertukar pengalaman, dan memperoleh informasi pembaruan sistem bersama sesama guru SD lainnya! Link grup resmi tersedia di bagian Kontak halaman ini 😊",
      category: 'community',
      suggestions: [],
    };
  }

  // -------------------------------------------------------------
  // 12. FAQ: SISWA TIDAK BAWA HP
  // -------------------------------------------------------------
  if (/tidak\s*bawa\s*hp|tanpa\s*hp|siswa\s*belum\s*punya\s*hp|bawa\s*handphone/i.test(qLower)) {
    return {
      text: "Siswa Sekolah Dasar **tidak diwajibkan membawa HP ke sekolah** kok Bapak/Ibu 😊\n\nBapak/Ibu Guru atau Wali Kelas dapat melakukan presensi langsung melalui HP guru atau laptop kelas menggunakan fitur centang kehadiran digital. Presensi mandiri via scan QR siswa bersifat opsional dan fleksibel.",
      category: 'faq_devices',
      suggestions: [],
    };
  }

  // -------------------------------------------------------------
  // 13. ATURAN JIKA KONTEKS & KNOWLEDGE TIDAK CUKUP
  // Jangan menebak atau berhalusinasi informasi yang tidak diketahui
  // -------------------------------------------------------------
  const words = qLower.split(/\s+/);
  const isOutOfScope = words.length > 2 && !IN_SCOPE_KEYWORDS.some((kw) => qLower.includes(kw));

  if (isOutOfScope) {
    return {
      text: "Terkait urusan tersebut, saluran koordinasi lintas sistem belum menerima laporan resmi. Namun untuk seluruh regulasi, stabilitas fitur, dan paket resmi KawaCanaan, Presiden Konoha siap memaparkannya.",
      category: 'insufficient_context',
      suggestions: [],
    };
  }

  // -------------------------------------------------------------
  // 14. DEFAULT CONVERSATIONAL RESPONSE (PEJABAT KENEGARAAN)
  // -------------------------------------------------------------
  return {
    text: "KawaCanaan Presensi adalah infrastruktur presensi digital terpadu untuk Sekolah Dasar demi menjaga ketertiban dan stabilitas administrasi sekolah 🇮🇩\n\nAda agenda kenegaraan atau urusan fitur dan paket yang ingin dikoordinasikan lebih lanjut, Bapak/Ibu?",
    category: 'general',
    suggestions: [],
  };
}

