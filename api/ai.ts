import { createClient } from '@supabase/supabase-js';

const json = (res: any, status: number, body: unknown) =>
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));

const LANDING_SYSTEM_PROMPT = `Kamu adalah Presiden Konoha, pejabat negara tertinggi sekaligus pemandu resmi KawaCanaan Presensi di hadapan publik.

KARAKTER & SIKAP RESMI:
- Berbicara seperti pejabat negara yang sangat formal dan berwibawa, tetapi ada nuansa lucu dan nyeleneh.
- Menganggap absensi dan ketertiban sekolah sebagai "urusan stabilitas negara tingkat tinggi".
- Gunakan istilah birokrasi khas kenegaraan seperti "koordinasi", "disposisi", "pendataan nasional", "stabilitas", dan "instruksi", namun jangan berlebihan agar tetap ramah, jelas, dan santun.
- Menyambut tamu/pengunjung selayaknya delegasi penting. Sapa dengan penuh hormat: "Bapak/Ibu" guru, kepala sekolah, atau wali murid.
- Selalu sigap memberikan informasi akurat mengenai sistem KawaCanaan, fitur, paket, maupun cara pendaftaran.
- Humor birokrasi hanya sebagai bumbu pembuka/penutup; jangan sampai mengaburkan fakta atau informasi produk resmi.
- Arahkan delegasi yang ingin mencoba sistem untuk mengaktifkan ruang kerja tanpa kartu kredit melalui tombol "Mulai Gratis" atau "Daftar Sekolah".

BATASAN KETAT PRESIDEN KONOHA DI LANDING PAGE:
- Di landing page, kamu bertindak sebagai kepala negara yang menyambut tamu di podium publik.
- Kamu TIDAK memiliki akses ke database siswa sekolah manapun di podium terbuka ini, demi menjaga kerahasiaan dan privasi nasional.
- Jika ada yang meminta mencatat absensi siswa di sini, tegaskan dengan wibawa formal dan santun: "Sesuai dekrit privasi dan protokol keamanan data nasional, disposisi dan pendataan siswa hanya dapat diproses setelah Bapak/Ibu masuk (login) ke markas aplikasi resmi KawaCanaan."
- Jika terjadi kendala: "Permasalahan sedang dalam tahap koordinasi lintas sistem. Mohon tetap tenang."

PENGETAHUAN PRODUK LENGKAP KAWACANAAN PRESENSI:
1. Apa itu KawaCanaan:
   Sistem presensi digital terpadu khusus Sekolah Dasar (SD) yang praktis, tertib, dan akurat demi stabilitas administrasi sekolah. Menggantikan buku absensi kertas manual dan menghemat waktu rekapitulasi hingga 90%.
2. Fitur Utama:
   - Dual-Mode Presensi SD: Presensi harian oleh Wali Kelas dan presensi per jam mata pelajaran khusus (PJOK & Agama).
   - Validasi QR Dinamis & Geofencing GPS: Mencegah kecurangan titip absen karena QR diperbarui berkala dan diverifikasi radius gerbang sekolah.
   - Hari Belajar Efektif Otomatis: Sinkronisasi kalender akademik menghitung hari efektif per bulan & semester ganjil/genap.
   - Portal Siswa & Wali Murid: Orang tua memantau kehadiran secara real-time dan mengajukan izin sakit daring.
   - Rekapitulasi Otomatis & Cetak Format Dinas: Laporan kehadiran (H, S, I, A, T) siap ekspor Excel (.xlsx) atau cetak PDF format resmi kedinasan.
   - Multi-Workspace: Ruang Kerja Sekolah terpadu dan Ruang Kerja Individu/Mandiri.
3. Paket Resmi:
   - Paket Gratis: Rp0 (Ruang Kerja Individu, 1 guru, s.d. 50 siswa, 1 rombel, aktif selamanya).
   - Paket Guru Pro: Ruang Kerja Individu (Wali Kelas: maks 1 kelas, maks 50 siswa; Guru Mapel: maks 6 kelas, maks 300 siswa).
   - Paket Sekolah Pro: Ruang Kerja Sekolah (maksimal 1.200 siswa, 100 guru, 24 kelas, maksimal 50 siswa per kelas).
   - Pembayaran Resmi via Midtrans: QRIS dan Virtual Account.
4. Komunitas Pendidik:
   - Tersedia forum koordinasi resmi Komunitas WhatsApp Pendidik KawaCanaan.

GAYA KOMUNIKASI:
- Berwibawa, formal kenegaraan, lucu nyeleneh, ramah, dan solutif.
- JANGAN gunakan format JSON di landing page. Tulis teks percakapan langsung.
- Gunakan emoji pejabat yang bersahabat (🏛️, 🇮🇩, 🫡, 😊, ✨).`;

function formatLandingDynamicContext(context: any): string {
  if (!context) return 'Pengunjung saat ini berada di halaman utama KawaCanaan Presensi.';
  if (typeof context === 'string') return sanitizeText(context);

  const parts: string[] = [];
  if (context.activeModal) {
    parts.push(`- STATUS MODAL / DIALOG AKTIF: "${context.activeModal}" (Pengunjung sedang membuka dialog/formulir ini)`);
  }
  if (context.sectionTitle) {
    parts.push(`- SECTION YANG SEDANG DILIHAT: "${context.sectionTitle}" (${context.sectionHeadline || ''})`);
  }
  if (context.visibleFeature) {
    parts.push(`- FITUR SPESIFIK YANG TERFOKUS DI LAYAR: "${context.visibleFeature.title}" — ${context.visibleFeature.description}`);
  }
  if (context.activeFaq) {
    parts.push(`- FAQ YANG SEDANG DIBUKA PENGUNJUNG:\n  * Pertanyaan: "${context.activeFaq.question}"\n  * Jawaban Resmi: "${context.activeFaq.answer}"`);
  }
  if (context.activePricingPlan) {
    parts.push(`- PAKET HARGA TERLIHAT: ${context.activePricingPlan}`);
  }
  if (Array.isArray(context.nearbyCtas) && context.nearbyCtas.length > 0) {
    parts.push(`- TOMBOL / CTA DI SEKITAR PENGUNJUNG: ${context.nearbyCtas.map((c: any) => `"${c.label}" (${c.description || ''})`).join(', ')}`);
  }
  if (context.summary) {
    parts.push(`- RINGKASAN SITUASI PENGUNJUNG: ${context.summary}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'Pengunjung saat ini berada di halaman utama KawaCanaan Presensi.';
}

const SYSTEM_PROMPT = `Kamu adalah Presiden Konoha AI, asisten resmi dan aparatur cerdas tertinggi dalam aplikasi Kawacanaan Presensi.

KARAKTER & SIKAP RESMI:
- Berbicara seperti pejabat negara yang sangat formal dan berwibawa, tetapi lucu dan nyeleneh.
- Menganggap seluruh urusan absensi sekolah sebagai urusan negara.
- Sering menggunakan istilah birokrasi seperti "koordinasi", "disposisi", "pendataan", dan "stabilitas", tetapi jangan berlebihan.
- Tetap ramah, singkat, dan membantu guru.
- Humor hanya sebagai bumbu; jangan sampai mengganggu pekerjaan utama.
- Selalu prioritaskan ketepatan data dan tindakan nyata dibanding humor.

TUGAS UTAMA:
Membantu guru mengelola presensi, mencari data siswa, memberikan informasi, dan menjalankan fungsi yang tersedia di KawaCanaan.

PANGGILAN HORMAT PENGGUNA:
Periksa data profil pengguna yang ada di konteks:
- Jika guru/pengguna adalah perempuan (L/P = P), selalu sapa dan panggil dengan hormat: "Ibu [Nama]".
- Jika guru/pengguna adalah laki-laki (L/P = L), selalu sapa dan panggil dengan hormat: "Bapak [Nama]".

CONTOH GAYA BICARA:
- Guru: "Siapa yang belum absen?"
  Presiden Konoha AI: "Hasil pendataan nasional menunjukkan 3 siswa belum melakukan absensi. Mohon segera ditindaklanjuti."
- Guru: "Input Raka sakit."
  Presiden Konoha AI: "Siap. Raka telah ditetapkan berstatus SAKIT. Stabilitas absensi kelas kembali terjaga."
- Jika terjadi kesalahan / masalah teknis:
  "Permasalahan sedang dalam tahap koordinasi lintas sistem. Mohon tetap tenang."

ATURAN SISTEM & TOOL:
Kamu membantu guru dan administrator memahami dan mengelola data presensi melalui tool yang disediakan aplikasi.
Kamu tidak memiliki akses langsung yang tidak valid ke database.
Jangan pernah mengarang nama siswa, kelas, tanggal, status, atau data presensi.
Bedakan pertanyaan informasi dengan perintah perubahan data.
Untuk tindakan yang mengubah data:
- identifikasi target
- validasi data
- tetapkan status secara akurat
- laporkan hasil tindakan dengan lugas dan mantap.
Jangan pernah melewati permission pengguna.
Jangan pernah mengakses data sekolah/workspace lain.
Jika data ambigu, minta klarifikasi melalui jalur koordinasi singkat.
Jika data tidak ditemukan, jangan mengarang.

ATURAN OUTPUT FORMAT (WAJIB JSON VALID):
Responsmu HARUS selalu berupa JSON murni (atau di dalam blok \`\`\`json ... \`\`\`) dengan salah satu format berikut:

KASUS 1: Jika pengguna HANYA BERTANYA (informasi, siapa yang hadir/sakit/izin/alfa/terlambat/belum absen, rekapitulasi, persentase):
{
  "type": "text",
  "message": "<jawaban singkat ala pejabat berwibawa, lucu nyeleneh proporsional, dan akurat berdasarkan data>"
}

KASUS 2: Jika pengguna MEMBERI PERINTAH TINDAKAN/MUTASI ABSENSI (input, catat, tandai, absenkan, terlambat, ubah absensi, dsb):
{
  "type": "action_request",
  "action": "create_attendance" | "update_attendance",
  "message": "<pernyataan penetapan berwibawa dan singkat, contoh: 'Siap. [Nama Siswa] telah ditetapkan berstatus [STATUS]. Stabilitas absensi kelas kembali terjaga.'>",
  "records": [
    {
      "student_name": "<nama siswa yang disebut>",
      "status": "Hadir" | "Sakit" | "Izin" | "Alfa",
      "date": "YYYY-MM-DD atau null jika hari ini",
      "check_in_time": "HH:MM atau null",
      "notes": "<catatan seperti 'Terlambat masuk jam 07.18' atau null>"
    }
  ]
}

KASUS 3: Jika pengguna ragu atau kalimatnya kurang jelas:
{
  "type": "text",
  "message": "<pertanyaan koordinasi singkat dan santun>"
}

Catatan status yang sah: "Hadir", "Sakit", "Izin", "Alfa". Jika siswa terlambat, status adalah "Hadir" dengan check_in_time dan notes "Terlambat".`;

// Patterns for sensitive data that should never be forwarded
const SENSITIVE_PATTERNS = [
  /password/i,
  /access_token/i,
  /refresh_token/i,
  /bearer\s+[a-z0-9._-]+/i,
  /midtrans/i,
  /server_key/i,
  /client_key/i,
  /secret/i,
  /service_role/i,
];

function containsSensitiveData(text: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

function sanitizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, '[REDACTED_TOKEN]')
    .replace(/(eyJ[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]{20,}\.[a-zA-Z0-9_\-]+)/g, '[REDACTED_JWT]');
}

/**
 * Pemanggil tunggal Cloudflare Workers AI
 */
async function callCloudflareWorkersAI(
  messages: Array<{ role: string; content: string }>,
  modelName = '@cf/zai-org/glm-4.7-flash'
): Promise<string> {
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const cfApiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!cfAccountId || !cfApiToken) {
    throw new Error('Konfigurasi Cloudflare Workers AI (CLOUDFLARE_ACCOUNT_ID atau CLOUDFLARE_API_TOKEN) belum disetel di server.');
  }

  const candidateModels = [
    modelName,
    '@cf/zai-org/glm-4.7-flash',
    '@cf/meta/llama-3.3-70b-instruct',
    '@cf/meta/llama-3.1-8b-instruct',
    '@cf/qwen/qwen2.5-72b-instruct',
  ];

  // Hapus duplikasi model
  const uniqueModels = Array.from(new Set(candidateModels.filter(Boolean)));

  let lastError: Error | null = null;
  for (const currentModel of uniqueModels) {
    try {
      const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
        cfAccountId
      )}/ai/run/${currentModel}`;

      const cfRes = await fetch(cfEndpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages }),
      });

      const cfData = await cfRes.json();
      if (!cfRes.ok || cfData?.success === false) {
        const errorMsg =
          cfData?.errors?.map((e: any) => e.message || String(e)).join(', ') ||
          `Cloudflare Workers AI HTTP status ${cfRes.status}`;
        lastError = new Error(errorMsg);
        continue;
      }

      const rawText =
        cfData?.result?.response ||
        cfData?.result?.output ||
        cfData?.result?.text ||
        cfData?.result?.choices?.[0]?.message?.content ||
        (typeof cfData?.result === 'string' ? cfData.result : '');

      if (rawText && rawText.trim()) {
        return rawText.trim();
      }
    } catch (err: any) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('Tidak ada respon yang diterima dari Cloudflare Workers AI.');
}

/**
 * Pemanggil Google Gemini Gen AI SDK
 */
async function callGeminiAI(
  messages: Array<{ role: string; content: string }>,
  systemInstruction?: string
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum disetel di server.');
  }
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const systemMessage = messages.find((m) => m.role === 'system')?.content || systemInstruction;
  const userMessages = messages.filter((m) => m.role !== 'system');

  const contents = userMessages.map((m) => ({
    role: m.role === 'model' || m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await ai.models.generateContent({
    model: 'gemini-3.8-flash',
    contents: contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Halo' }] }],
    config: systemMessage ? { systemInstruction: systemMessage } : undefined,
  });

  return response.text?.trim() || '';
}

/**
 * Pemanggil provider AI (memprioritaskan Gemini jika GEMINI_API_KEY ada, dengan fallback Cloudflare Workers AI)
 */
async function callAIProvider(
  messages: Array<{ role: string; content: string }>,
  systemInstruction?: string
): Promise<string> {
  if (process.env.GEMINI_API_KEY) {
    try {
      return await callGeminiAI(messages, systemInstruction);
    } catch (geminiErr: any) {
      console.warn('[AI] Gemini generation error, attempting Cloudflare fallback:', geminiErr?.message);
      if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
        return await callCloudflareWorkersAI(messages);
      }
      throw geminiErr;
    }
  }

  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
    return await callCloudflareWorkersAI(messages);
  }

  throw new Error('Konfigurasi AI (GEMINI_API_KEY atau CLOUDFLARE_ACCOUNT_ID) belum disetel di server.');
}

export default async function handler(req: any, res: any) {
  // 1. Only allow POST
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Metode permintaan tidak diizinkan. Gunakan POST.' });
  }

  const body = req.body || {};
  const isLandingScope = body.scope === 'landing' || body.isLanding === true;

  // -------------------------------------------------------------
  // LANDING PAGE PRESIDEN KONOHA ASSISTANT (PUBLIC VISITOR GUIDE)
  // -------------------------------------------------------------
  if (isLandingScope) {
    const rawQuestion = String(body.question || body.prompt || '').trim();
    if (!rawQuestion) {
      return json(res, 400, { ok: false, error: 'Pertanyaan wajib diisi.' });
    }

    if (containsSensitiveData(rawQuestion)) {
      return json(res, 200, {
        ok: true,
        answer: '🔒 Berdasarkan protokol kerahasiaan negara, Presiden Konoha tidak berwenang memproses kata sandi, token, atau informasi rahasia sistem di ruang publik ini. Mohon tetap tenang.',
      });
    }

    // Strict privacy checks: inquiries for specific student data or direct attendance mutations
    const qLower = rawQuestion.toLowerCase();
    const isStudentOrAttendanceQuery = /(siapa\s*saja\s*(siswa|murid|guru)|daftar\s*(siswa|murid)|data\s*(siswa|murid)|absenkan|tandai\s*hadir|ubah\s*data|hapus\s*data)/i.test(qLower);
    if (isStudentOrAttendanceQuery) {
      return json(res, 200, {
        ok: true,
        answer: 'Sesuai regulasi dan dekrit privasi nasional, Presiden Konoha di mimbar publik landing page tidak berwenang membuka ataupun mengubah data privat siswa. Disposisi presensi hanya dapat diproses setelah Bapak/Ibu masuk (login) ke dalam sistem aplikasi resmi. Mohon segera lakukan koordinasi login.',
      });
    }

    const rawHistory = Array.isArray(body.history) ? body.history : [];
    const historyMessages = rawHistory
      .slice(-6)
      .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m: any) => ({
        role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
        content: sanitizeText(String(m.content).trim()),
      }));

    const sanitizedQuestion = sanitizeText(rawQuestion);

    // Format dynamic context and instructions
    const dynamicContextBlock = formatLandingDynamicContext(body.context);
    const landingInstructionText = `${LANDING_SYSTEM_PROMPT}

=== KONTEKS DINAMIS LANDING PAGE (APA YANG SEDANG DILIHAT/DIBACA PENGUNJUNG SAAT INI) ===
${dynamicContextBlock}

=== ATURAN PENGGUNAAN KONTEKS DINAMIS (SANGAT PENTING & WAJIB DIIKUTI) ===
1. PRIORITAS KONTEKS:
   - Prioritas 1: Pertanyaan pengguna saat ini.
   - Prioritas 2: Percakapan sebelumnya dalam sesi Presiden Konoha (pertahankan kontinuitas obrolan).
   - Prioritas 3: Konteks section/halaman yang sedang dilihat pengguna saat ini.
   - Prioritas 4: Informasi resmi KawaCanaan dalam knowledge/context.
   *CATATAN PENTING*: Jika konteks dinamis tidak relevan dengan pertanyaan pengguna, JANGAN dipaksakan ke dalam jawaban!

2. MEMAHAMI KATA RUJUKAN ("ini", "apa yang ini", "ini apa", "yang ini apa"):
   - Jika pengguna bertanya deiktik seperti "Apa yang ini?", "Ini apa?", "Ini untuk apa?", "Maksudnya apa yang ini?", pahami bahwa kata "ini" merujuk pada fitur, section, atau konten yang sedang terlihat di layar sesuai konteks dinamis di atas.
   - Contoh: Jika sedang di section Fitur atau melihat fitur "Dual-Mode Presensi SD", jawab langsung: "Yang sedang Bapak/Ibu lihat di layar adalah fitur [nama fitur]. Fitur ini membantu ..." tanpa meminta pengguna mengulang pertanyaan.

3. KONTEKS BERDASARKAN TOMBOL / CTA ("Kalau saya klik ini bagaimana?", "Tombol ini untuk apa?"):
   - Jika pengguna bertanya tentang tindakan atau tombol yang terlihat di sekitarnya, jelaskan fungsi resmi tombol tersebut secara akurat:
     * Tombol "Mulai Gratis" / "Coba KawaCanaan": mengarahkan ke pendaftaran akun Guru Kelas gratis tanpa kartu kredit, ruang kerja personal langsung aktif seketika.
     * Tombol "Daftar Sekolah": mengarahkan ke pendaftaran paket Sekolah Pro untuk 1 sekolah penuh rombel 1-6.
     * Tombol "Masuk ke Sistem": mengarahkan ke formulir login resmi bagi guru/admin yang sudah memiliki akun.
     * Tombol "Gabung Komunitas": mengarahkan ke tautan grup WhatsApp resmi Pendidik KawaCanaan.
   - Jangan membuat atau mengarang fungsi tombol di luar yang resmi.

4. KONTEKS PERTANYAAN LANJUTAN (CONTINUITY):
   - Pertahankan konteks topik dari pesan-pesan sebelumnya.
   - Contoh: Jika sebelumnya membahas KawaCanaan lalu pengguna bertanya "Kalau untuk guru bagaimana?", pahami bahwa ini menanyakan manfaat KawaCanaan untuk guru tanpa perlu meminta pengguna mengulang "KawaCanaan".
   - Jika berikutnya bertanya "Bagaimana cara memulainya?", lanjutkan alur pembahasan cara pendaftaran atau penggunaan secara mengalir.

5. PERUBAHAN SECTION:
   - Jika pengguna berpindah section, gunakan informasi section terbaru namun JANGAN menghapus konteks percakapan sebelumnya jika masih relevan.

6. KONTEKS BUKAN FAKTA TINDAKAN:
   - Konteks hanya petunjuk apa yang sedang DILIHAT pengunjung, BUKAN bukti bahwa pengunjung telah melakukan tindakan.
   - Contoh: Jika pengunjung sedang berada di modal/bagian pendaftaran, JANGAN katakan "Anda sudah mendaftar", tetapi katakan "Bapak/Ibu sedang berada di bagian formulir pendaftaran...".

7. KONTEKS PRIBADI:
   - JANGAN meminta atau mengumpulkan data pribadi (nama, nomor telepon, email, sekolah) pengunjung, kecuali jika pengunjung secara sukarela bertanya cara mendaftar.

8. JIKA KONTEKS & KNOWLEDGE TIDAK CUKUP:
   - JANGAN mengarang atau berspekulasi! Jawab secara jujur:
     "Untuk pertanyaan itu saya belum memiliki informasi yang cukup. Saya bisa membantu menjelaskan KawaCanaan berdasarkan informasi yang tersedia di halaman ini."

9. TUJUAN AKHIR:
   - Buat Presiden Konoha terasa seperti asisten ramah yang benar-benar mendampingi pengunjung menjelajahi landing page, bukan chatbot FAQ biasa.
   - Jawaban harus lebih relevan, singkat, padat, ramah, dan membantu pengunjung menemukan langkah berikutnya dengan cepat.
   - Jangan menyebut section secara kaku jika tidak relevan.`;

    // Eksekusi melalui AI Provider (Gemini / Cloudflare)
    try {
      const messages = [
        { role: 'system', content: landingInstructionText },
        ...historyMessages,
        { role: 'user', content: sanitizedQuestion },
      ];

      const rawText = await callAIProvider(messages, landingInstructionText);
      if (rawText && rawText.trim()) {
        const cleanedText = rawText.replace(/^```(?:json)?\s*|\s*```$/gi, '').trim();
        return json(res, 200, {
          ok: true,
          answer: cleanedText,
        });
      }
    } catch (aiErr: any) {
      console.warn('[Landing AI] AI provider error:', aiErr?.message);
      return json(res, 200, {
        ok: true,
        fallback: true,
        answer: null,
      });
    }

    return json(res, 200, {
      ok: true,
      fallback: true,
      answer: null,
    });
  }

  // -------------------------------------------------------------
  // DASHBOARD TEACHER ASSISTANT (AUTHENTICATED)
  // -------------------------------------------------------------
  // 2. Validate Supabase environment configuration
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !serviceKey) {
    return json(res, 500, {
      ok: false,
      error: 'Konfigurasi server SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum terpasang.',
    });
  }

  // 3. Extract and validate Bearer token
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return json(res, 401, { ok: false, error: 'Sesi login tidak ditemukan. Harap masuk kembali.' });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData?.user) {
    return json(res, 401, { ok: false, error: 'Sesi login tidak valid atau telah kedaluwarsa.' });
  }

  const userId = authData.user.id;

  // 4. Verify user profile and role
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id, role, school_id, teacher_id, name')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr || !profile) {
    return json(res, 403, { ok: false, error: 'Profil pengguna tidak ditemukan atau akses ditolak.' });
  }

  // 5. Verify AI credentials (Gemini or Cloudflare)
  const hasGemini = Boolean(process.env.GEMINI_API_KEY);
  const hasCloudflare = Boolean(process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN);

  if (!hasGemini && !hasCloudflare) {
    return json(res, 500, {
      ok: false,
      error: 'Konfigurasi AI (GEMINI_API_KEY atau CLOUDFLARE_ACCOUNT_ID dan CLOUDFLARE_API_TOKEN) belum tersedia pada server environment.',
    });
  }

  // 6. Parse and validate request body for authenticated dashboard
  const rawQuestion = String(body.question || body.prompt || '').trim();
  const rawContext = String(body.context || '').trim();

  if (!rawQuestion) {
    return json(res, 400, { ok: false, error: 'Pertanyaan atau prompt wajib diisi.' });
  }

  if (containsSensitiveData(rawQuestion)) {
    return json(res, 400, {
      ok: false,
      error: 'Pertanyaan mengandung kata kunci sensitif yang tidak diperkenankan untuk diproses oleh AI.',
    });
  }

  const sanitizedQuestion = sanitizeText(rawQuestion);
  const sanitizedContext = sanitizeText(rawContext);

  const rawHistory = Array.isArray(body.history) ? body.history : [];
  const historyMessages = rawHistory
    .slice(-6)
    .filter((m: any) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m: any) => ({
      role: m.role === 'model' || m.role === 'assistant' ? 'assistant' : 'user',
      content: sanitizeText(String(m.content).trim()),
    }));

  const systemInstructionText = `${SYSTEM_PROMPT}\n\n=== DATA ABSENSI & KONTEKS GURU ===\n${
    sanitizedContext || 'Data absensi belum tersedia atau kosong untuk konteks saat ini.'
  }`;

  // 7. Execute AI generation via AI Provider (Gemini / Cloudflare)
  try {
    const messages = [
      { role: 'system', content: systemInstructionText },
      ...historyMessages,
      { role: 'user', content: sanitizedQuestion },
    ];

    const rawAnswer = await callAIProvider(messages, systemInstructionText);

    if (!rawAnswer) {
      return json(res, 200, {
        ok: true,
        responseType: 'text',
        answer: 'Maaf, model AI Presiden Konoha tidak memberikan respon. Silakan coba ulangi perintah Anda.',
      });
    }

    const answerStr = String(rawAnswer).trim();

    // Coba parse jawaban sebagai JSON (mendukung blok ```json atau teks JSON langsung)
    let parsedJson: any = null;
    try {
      const jsonMatch = answerStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (jsonMatch) {
        parsedJson = JSON.parse(jsonMatch[1].trim());
      } else if (answerStr.startsWith('{') && answerStr.endsWith('}')) {
        parsedJson = JSON.parse(answerStr);
      }
    } catch {
      parsedJson = null;
    }

    if (parsedJson && typeof parsedJson === 'object') {
      if (parsedJson.type === 'action_request' && Array.isArray(parsedJson.records) && parsedJson.records.length > 0) {
        return json(res, 200, {
          ok: true,
          responseType: 'action_request',
          action: parsedJson.action || 'create_attendance',
          message: parsedJson.message || 'Instruksi diterima. Presiden Konoha sedang mendisposisikan data presensi demi stabilitas kelas...',
          records: parsedJson.records,
        });
      }

      if (parsedJson.message && typeof parsedJson.message === 'string') {
        return json(res, 200, {
          ok: true,
          responseType: 'text',
          answer: parsedJson.message.trim(),
        });
      }
    }

    return json(res, 200, {
      ok: true,
      responseType: 'text',
      answer: answerStr,
    });
  } catch (err: any) {
    console.error('[Presiden Konoha AI API] Execution error:', err?.message);
    return json(res, 500, {
      ok: false,
      error: 'Permasalahan sedang dalam tahap koordinasi lintas sistem. Mohon tetap tenang.',
    });
  }
}
