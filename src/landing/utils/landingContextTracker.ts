/**
 * Landing Page Dynamic Context Tracker for Koka Assistant.
 *
 * Mendeteksi secara real-time posisi pengunjung di landing page:
 * - Section yang sedang dilihat (beranda, fitur, harga, faq, kontak, dll.)
 * - Fitur spesifik atau kartu yang sedang berada di tengah layar
 * - FAQ yang sedang dibuka oleh pengunjung
 * - Tombol / CTA terdekat yang dapat diklik
 * - Modal yang sedang aktif (pendaftaran, login, dll.)
 * - URL & Bahasa aktif
 */

export interface LandingNearbyCta {
  label: string;
  target: string;
  description: string;
}

export interface LandingDynamicContext {
  sectionId: string;
  sectionTitle: string;
  sectionHeadline?: string;
  visibleFeature?: {
    title: string;
    description: string;
  } | null;
  activeFaq?: {
    question: string;
    answer: string;
  } | null;
  activePricingPlan?: string | null;
  nearbyCtas: LandingNearbyCta[];
  activeModal?: string | null;
  currentUrl: string;
  language: 'ID' | 'EN';
  summary: string;
}

const SECTION_METADATA: Record<
  string,
  { titleID: string; titleEN: string; headlineID: string; headlineEN: string; defaultCtas: LandingNearbyCta[] }
> = {
  beranda: {
    titleID: 'Beranda (Hero)',
    titleEN: 'Hero Section',
    headlineID: 'Presensi Sekolah Dasar Lebih Tertib & Akurat',
    headlineEN: 'Primary School Digital Attendance System',
    defaultCtas: [
      {
        label: 'Mulai Gratis',
        target: 'modal_free_start',
        description: 'Membuka formulir pendaftaran akun Guru Kelas gratis selamanya tanpa kartu kredit.',
      },
      {
        label: 'Daftar Sekolah',
        target: 'modal_register_school',
        description: 'Membuka formulir pendaftaran Paket Sekolah untuk rombel kelas 1-6 satu sekolah penuh.',
      },
      {
        label: 'Masuk ke Sistem',
        target: 'action_login',
        description: 'Membuka halaman login bagi guru atau admin sekolah yang sudah memiliki akun.',
      },
    ],
  },
  fitur: {
    titleID: 'Fitur Utama Sekolah Dasar',
    titleEN: 'Primary School Core Features',
    headlineID: 'Sistem Lengkap Presensi Sekolah Dasar',
    headlineEN: 'Complete Primary School Attendance Platform',
    defaultCtas: [
      {
        label: 'Mulai Gratis',
        target: 'modal_free_start',
        description: 'Mencoba langsung fitur presensi kelas melalui akun gratis.',
      },
    ],
  },
  keunggulan: {
    titleID: 'Keunggulan Khusus SD',
    titleEN: 'Primary School Advantages',
    headlineID: 'Keunggulan Khusus Sekolah Dasar',
    headlineEN: 'Purpose-Built for Primary Schools',
    defaultCtas: [
      {
        label: 'Daftar Sekolah',
        target: 'modal_register_school',
        description: 'Mendaftarkan sekolah untuk mengadopsi sistem presensi berstandar kedinasan.',
      },
    ],
  },
  'cara-kerja': {
    titleID: 'Cara Kerja (3 Langkah Praktis)',
    titleEN: 'How It Works (3 Steps)',
    headlineID: '3 Langkah Praktis Penerapan di Sekolah Dasar',
    headlineEN: '3 Simple Steps to Implement in Elementary Schools',
    defaultCtas: [
      {
        label: 'Mulai Coba Gratis Sekarang',
        target: 'modal_free_start',
        description: 'Mulai mendaftar akun guru mandiri secara instan dalam 2 menit.',
      },
    ],
  },
  harga: {
    titleID: 'Pilihan Paket Lisensi Resmi',
    titleEN: 'Official Pricing Plans',
    headlineID: 'Pilihan Paket Transparan & Terjangkau',
    headlineEN: 'Transparent & Affordable School Plans',
    defaultCtas: [
      {
        label: 'Mulai Gratis (Rp0)',
        target: 'modal_free_start',
        description: 'Pendaftaran gratis untuk 1 guru kelas, s.d. 50 siswa, aktif selamanya.',
      },
      {
        label: 'Pilih Paket Guru (Rp5.000/bln)',
        target: 'modal_teacher_pro',
        description: 'Pendaftaran Paket Guru untuk Wali Kelas (1 rombel, 50 siswa) atau Guru Mapel (s.d. 6 rombel, 300 siswa).',
      },
      {
        label: 'Daftar Paket Sekolah (Rp25.000/bln)',
        target: 'modal_register_school',
        description: 'Pendaftaran Paket Sekolah 1 sekolah penuh (maksimal 1.200 siswa, 100 guru, 24 kelas, maks 50 siswa/kelas).',
      },
      {
        label: 'Konsultasi Paket Custom',
        target: 'whatsapp_custom',
        description: 'Menghubungi tim KawaCanaan via WhatsApp untuk penawaran khusus yayasan atau kedinasan.',
      },
    ],
  },
  testimoni: {
    titleID: 'Testimoni Pendidik & Kepala Sekolah',
    titleEN: 'Educator & Principal Testimonials',
    headlineID: 'Pengalaman Nyata Guru dan Kepala Sekolah SD',
    headlineEN: 'Real Experiences from Elementary Educators',
    defaultCtas: [],
  },
  blog: {
    titleID: 'Artikel & Panduan Edukasi',
    titleEN: 'Educational Articles & Guides',
    headlineID: 'Wawasan Manajemen Kelas & Presensi Digital',
    headlineEN: 'Classroom Insights & Digital Attendance Guides',
    defaultCtas: [],
  },
  faq: {
    titleID: 'Tanya Jawab (FAQ)',
    titleEN: 'Frequently Asked Questions',
    headlineID: 'Pertanyaan Sering Ditanyakan Seputar KawaCanaan',
    headlineEN: 'Common Questions & Answers',
    defaultCtas: [
      {
        label: 'Mulai Coba Gratis',
        target: 'modal_free_start',
        description: 'Mencoba langsung sistem presensi secara gratis.',
      },
    ],
  },
  kontak: {
    titleID: 'Kontak & Komunitas WhatsApp Pendidik',
    titleEN: 'Contact & Educator WhatsApp Community',
    headlineID: 'Konsultasi, Adopsi & Komunitas WhatsApp Pendidik',
    headlineEN: 'Consultation, Adoption & WhatsApp Educator Community',
    defaultCtas: [
      {
        label: 'Gabung Komunitas WhatsApp',
        target: 'whatsapp_community',
        description: 'Membuka link grup WhatsApp resmi Pendidik KawaCanaan untuk berdiskusi dengan sesama guru SD.',
      },
      {
        label: 'Daftar Sekolah',
        target: 'modal_register_school',
        description: 'Mendaftarkan sekolah untuk pendampingan implementasi presensi digital.',
      },
      {
        label: 'Salin Tautan WhatsApp',
        target: 'action_copy_wa_link',
        description: 'Menyalin tautan undangan grup WhatsApp ke clipboard.',
      },
    ],
  },
};

/**
 * Mengambil konteks dinamis saat ini dari layar peramban (DOM & viewport).
 */
export function getCurrentLandingContext(lang: 'ID' | 'EN' = 'ID'): LandingDynamicContext {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return {
      sectionId: 'beranda',
      sectionTitle: lang === 'ID' ? 'Beranda (Hero)' : 'Hero Section',
      nearbyCtas: [],
      currentUrl: '',
      language: lang,
      summary: 'Pengunjung berada di halaman KawaCanaan Presensi.',
    };
  }

  // 1. Cek apakah ada Modal yang sedang terbuka di layar
  let activeModal: string | null = null;
  const modalTitles = Array.from(document.querySelectorAll('[role="dialog"] h2, [role="dialog"] h3'));
  if (modalTitles.length > 0) {
    const titleText = modalTitles[modalTitles.length - 1]?.textContent?.trim();
    if (titleText) {
      activeModal = titleText;
    }
  }

  // 2. Deteksi Section yang paling banyak terlihat di viewport
  const sectionIds = ['beranda', 'fitur', 'keunggulan', 'harga', 'testimoni', 'blog', 'faq', 'kontak'];
  let currentSectionId = 'beranda';
  let maxVisibleHeight = -1;

  const windowHeight = window.innerHeight || 800;

  for (const id of sectionIds) {
    const el = document.getElementById(id);
    if (el) {
      const rect = el.getBoundingClientRect();
      const visibleTop = Math.max(0, rect.top);
      const visibleBottom = Math.min(windowHeight, rect.bottom);
      const visibleHeight = Math.max(0, visibleBottom - visibleTop);

      if (visibleHeight > maxVisibleHeight) {
        maxVisibleHeight = visibleHeight;
        currentSectionId = id;
      }
    }
  }

  const meta = SECTION_METADATA[currentSectionId] || SECTION_METADATA.beranda;
  const sectionTitle = lang === 'ID' ? meta.titleID : meta.titleEN;
  const sectionHeadline = lang === 'ID' ? meta.headlineID : meta.headlineEN;

  // 3. Deteksi Fitur spesifik yang sedang terlihat di section Fitur
  let visibleFeature: { title: string; description: string } | null = null;
  if (currentSectionId === 'fitur') {
    const featureSection = document.getElementById('fitur');
    if (featureSection) {
      // Cari kartu-kartu fitur
      const featureCards = featureSection.querySelectorAll('h3');
      let closestCard: { title: string; description: string; distance: number } | null = null;
      const centerY = windowHeight / 2;

      featureCards.forEach((h3) => {
        const title = h3.textContent?.trim() || '';
        if (title) {
          const rect = h3.getBoundingClientRect();
          const p = h3.parentElement?.querySelector('p');
          const description = p?.textContent?.trim() || '';
          const distance = Math.abs(rect.top + rect.height / 2 - centerY);

          if (rect.bottom > 0 && rect.top < windowHeight) {
            if (!closestCard || distance < closestCard.distance) {
              closestCard = { title, description, distance };
            }
          }
        }
      });

      if (closestCard) {
        visibleFeature = {
          title: (closestCard as any).title,
          description: (closestCard as any).description,
        };
      }
    }
  }

  // 4. Deteksi FAQ yang sedang dibuka / aktif
  let activeFaq: { question: string; answer: string } | null = null;
  if (currentSectionId === 'faq' || document.getElementById('faq')) {
    const faqContainer = document.getElementById('faq');
    if (faqContainer) {
      // Cari item yang memiliki border biru atau terbuka
      const openFaqElements = faqContainer.querySelectorAll('[id^="faq-item-"]');
      openFaqElements.forEach((item) => {
        const btn = item.querySelector('button');
        const p = item.querySelector('p');
        // Jika ada tombol dan paragraf jawaban yang terlihat
        if (btn && p && p.textContent && p.textContent.trim().length > 0) {
          const qText = btn.textContent?.trim() || '';
          const aText = p.textContent.trim();
          if (qText && aText) {
            activeFaq = { question: qText, answer: aText };
          }
        }
      });
    }
  }

  // 5. Deteksi Paket Harga yang terlihat
  let activePricingPlan: string | null = null;
  if (currentSectionId === 'harga') {
    activePricingPlan = 'Paket Gratis (Rp0), Paket Guru (Rp5.000/bln / Rp60.000/thn), Paket Sekolah (Rp25.000/bln / Rp250.000/thn perdana & Rp300.000/thn perpanjangan), dan Custom Yayasan';
  }

  // 6. Kumpulkan CTA di sekitar pengguna
  const nearbyCtas = [...meta.defaultCtas];

  // 7. Buat Ringkasan Konteks Dinamis Bahasa Alami
  let summaryParts: string[] = [];
  if (activeModal) {
    summaryParts.push(`Pengunjung sedang membuka dialog/modal: "${activeModal}".`);
  } else {
    summaryParts.push(`Pengunjung sedang melihat section "${sectionTitle}" (${sectionHeadline}).`);
  }

  if (visibleFeature) {
    summaryParts.push(
      `Kartu fitur yang paling fokus di layar: "${visibleFeature.title}" (${visibleFeature.description}).`
    );
  }

  if (activeFaq) {
    summaryParts.push(
      `FAQ yang sedang dibuka: Pertanyaan: "${activeFaq.question}" — Jawaban: "${activeFaq.answer}".`
    );
  }

  if (nearbyCtas.length > 0) {
    summaryParts.push(
      `Tombol/CTA di sekitar layar: ${nearbyCtas.map((c) => `"${c.label}" (${c.description})`).join(', ')}.`
    );
  }

  const summary = summaryParts.join(' ');

  return {
    sectionId: currentSectionId,
    sectionTitle,
    sectionHeadline,
    visibleFeature,
    activeFaq,
    activePricingPlan,
    nearbyCtas,
    activeModal,
    currentUrl: window.location.href,
    language: lang,
    summary,
  };
}
