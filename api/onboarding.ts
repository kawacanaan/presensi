import { createClient } from '@supabase/supabase-js';

const json = (res: any, status: number, body: unknown) =>
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));

/**
 * Menghasilkan 8 karakter alfanumerik huruf besar tanpa awalan SCH- (contoh: 9B3366AB)
 */
function generateSchoolInviteCode(): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Normalisasi paket sistem (Canonical):
 * - Paket baru hanya: 'guru_gratis' | 'guru_pro' | 'sekolah_pro'
 * - Legacy compatibility (baca):
 *     free / mulai -> guru_gratis
 *     teacher / guru -> guru_pro
 *     school / sekolah -> sekolah_pro
 */
export function normalizePlan(rawPlan?: string | null): 'guru_gratis' | 'guru_pro' | 'sekolah_pro' {
  const p = String(rawPlan || '').toLowerCase().trim();
  if (p === 'sekolah_pro' || p === 'school' || p === 'sekolah' || p === 'sekolah_uji_coba' || p === 'pro' || p === 'enterprise') {
    return 'sekolah_pro';
  }
  if (p === 'guru_pro' || p === 'teacher' || p === 'guru' || p === 'guru_uji_coba') {
    return 'guru_pro';
  }
  return 'guru_gratis';
}

/**
 * Pengecekan & downgrade aman untuk paket yang telah kedaluwarsa.
 * Aturan:
 * - Paket Guru expired -> simpan schools.plan = guru_gratis
 * - Paket Sekolah expired -> simpan schools.plan = guru_gratis
 * - workspace_type TIDAK BOLEH BERUBAH
 * - Idempotent dan tidak menghapus data tenant.
 */
async function checkAndDowngradeExpiredSchool(db: any, school: any): Promise<string> {
  if (!school || !school.id) return 'guru_gratis';
  const now = new Date();
  if (school.subscription_expires_at && new Date(school.subscription_expires_at) <= now) {
    const raw = String(school.plan || '').toLowerCase();
    if (raw !== 'guru_gratis') {
      try {
        await db.from('schools').update({
          plan: 'guru_gratis',
        }).eq('id', school.id);
        school.plan = 'guru_gratis';
      } catch (err) {
        console.warn(`[Onboarding] Gagal downgrade sekolah expired (${school.id}):`, err);
      }
    }
    return 'guru_gratis';
  }
  return normalizePlan(school.plan);
}

/**
 * Konfigurasi awal akun Guru Gratis untuk ruang kerja individu baru.
 * Berlaku seumur hidup (tanpa batas kedaluwarsa).
 */
function calculateGuruProTrialPeriod(now: Date = new Date()) {
  const startedAt = now.toISOString().slice(0, 10);

  return {
    plan: 'guru_gratis' as const, // Paket Baru Canonical: guru_gratis
    status: 'active',
    startedAt,
    expiresAt: null, // Tanpa batas kedaluwarsa (Seumur Hidup)
    notes: `[Akun Guru Gratis: Aktif tanpa batas waktu kedaluwarsa]`,
    maxTeachers: 1,
    maxStudents: 50,
    maxClasses: 1,
  };
}

export default async function handler(req: any, res: any, env?: any) {
  // 1. Dukungan Header CORS & Preflight Request (Sangat penting saat diakses via tautan WhatsApp / WebView HP)
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Metode permintaan tidak diizinkan. Gunakan POST.' });
  }

  const cfEnv = env || req?.env || {};
  const url = cfEnv.SUPABASE_URL || cfEnv.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey =
    cfEnv.SUPABASE_SERVICE_ROLE_KEY ||
    cfEnv.SUPABASE_SECRET_KEY ||
    cfEnv.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    cfEnv.SERVICE_ROLE_KEY ||
    cfEnv.SUPABASE_KEY ||
    cfEnv.VITE_SUPABASE_ANON_KEY ||
    cfEnv.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }
  const action = body.action;

  // Fallback jika kredensial server belum tersedia sama sekali
  if (!url || !serviceKey) {
    if (action === 'lookup_school') {
      return json(res, 200, {
        ok: true,
        schools: [
          {
            id: 'mock-school-1',
            name: 'SDN Cibubur 01',
            npsn: '20100123',
            jenjang: 'SD',
            alamat: 'Jl. Raya Lapangan Tembak No. 1, Jakarta Timur',
            classes: [
              { id: 'mock-cls-1', name: 'Kelas 1A', grade: 1 },
              { id: 'mock-cls-2', name: 'Kelas 2A', grade: 2 },
              { id: 'mock-cls-3', name: 'Kelas 3A', grade: 3 },
              { id: 'mock-cls-4', name: 'Kelas 4A', grade: 4 },
              { id: 'mock-cls-5', name: 'Kelas 5A', grade: 5 },
              { id: 'mock-cls-6', name: 'Kelas 6A', grade: 6 },
            ],
          },
        ],
      });
    }

    if (action === 'get_public_daily_report') {
      return json(res, 500, {
        ok: false,
        error: 'Konfigurasi database server belum terhubung. Silakan hubungi admin sekolah.',
      });
    }

    return json(res, 200, {
      ok: true,
      success: true,
      message: 'Onboarding berhasil diselesaikan (Mode Preview).',
      userId: body.userId || 'mock-user-id',
      schoolId: body.schoolId || 'mock-school-id',
    });
  }

  const db = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const normalizeTeacherRole = (value: unknown): 'WALI KELAS' | 'GURU MAPEL' | 'OTHER' => {
    const v = String(value || '').trim().toUpperCase();
    if (v.includes('WALI KELAS')) return 'WALI KELAS';
    if (v.includes('GURU MAPEL')) return 'GURU MAPEL';
    return 'OTHER';
  };

  // Guru dan Akun sengaja dipisahkan. profiles.id adalah ID akun/Auth,
  // sedangkan teachers.id adalah ID master guru yang independen.
  const getAcademicYear = async (schoolId: string, fallback = '2026/2027') => {
    const { data } = await db.from('school_profile').select('tahun_pelajaran').eq('school_id', schoolId).maybeSingle();
    return String(data?.tahun_pelajaran || fallback).trim() || fallback;
  };
  const assignHomeroom = async (schoolId: string, teacherId: string, classId: string | null, actorUserId: string) => {
    const academicYear = await getAcademicYear(schoolId);
    let rpcOk = false;
    try {
      const { error } = await db.rpc('assign_homeroom_teacher', {
        p_school_id: schoolId, p_teacher_id: teacherId, p_class_id: classId,
        p_academic_year: academicYear, p_actor_user_id: actorUserId,
      });
      if (!error) rpcOk = true;
      else console.warn('[onboarding] assign_homeroom_teacher RPC warning:', error.message);
    } catch (e: any) {
      console.warn('[onboarding] assign_homeroom_teacher call error:', e?.message);
    }

    if (!rpcOk) {
      if (classId) {
        await db.from('classes').update({ wali_kelas_teacher_id: teacherId }).eq('id', classId).eq('school_id', schoolId);

        // Ambil semua rombel yang saat ini diampu oleh guru ini
        const { data: currentClasses } = await db.from('classes')
          .select('id')
          .eq('school_id', schoolId)
          .eq('wali_kelas_teacher_id', teacherId);

        // Jika melebihi 2 rombel, lepaskan kelebihan rombel selain classId
        if (currentClasses && currentClasses.length > 2) {
          const others = currentClasses.filter((c: any) => c.id !== classId);
          const toRelease = others.slice(1);
          for (const r of toRelease) {
            await db.from('classes').update({ wali_kelas_teacher_id: null }).eq('id', r.id).eq('school_id', schoolId);
          }
        }

        const { data: finalClasses } = await db.from('classes')
          .select('id')
          .eq('school_id', schoolId)
          .eq('wali_kelas_teacher_id', teacherId);
        const finalClassIds = (finalClasses || []).map((c: any) => c.id);

        await db.from('profiles').update({
          class_ids: finalClassIds.length > 0 ? finalClassIds : [classId],
          class_id: classId,
        }).eq('school_id', schoolId).or(`teacher_id.eq.${teacherId},id.eq.${actorUserId}`);

        try {
          await db.from('teacher_assignments').delete().eq('school_id', schoolId).eq('class_id', classId).eq('role', 'WALI_KELAS');
          await db.from('teacher_assignments').insert({
            school_id: schoolId,
            teacher_id: teacherId,
            role: 'WALI_KELAS',
            class_id: classId,
            subject_id: null,
            academic_year: academicYear,
            is_active: true,
          });
        } catch (_) {}
      } else {
        await db.from('classes').update({ wali_kelas_teacher_id: null }).eq('school_id', schoolId).eq('wali_kelas_teacher_id', teacherId);
        await db.from('profiles').update({ class_ids: [], class_id: null }).eq('school_id', schoolId).or(`teacher_id.eq.${teacherId},id.eq.${actorUserId}`);
      }
    }
    return academicYear;
  };
  const assignSubject = async (schoolId: string, subjectId: string, teacherId: string, classIds: string[], actorUserId: string) => {
    const academicYear = await getAcademicYear(schoolId);
    const uniqueClassIds = [...new Set(classIds)];
    let rpcOk = false;
    try {
      const { error } = await db.rpc('replace_subject_assignment', {
        p_school_id: schoolId, p_subject_id: subjectId, p_teacher_id: teacherId,
        p_class_ids: uniqueClassIds, p_academic_year: academicYear, p_actor_user_id: actorUserId,
      });
      if (!error) rpcOk = true;
      else console.warn('[onboarding] replace_subject_assignment RPC warning:', error.message);
    } catch (e: any) {
      console.warn('[onboarding] replace_subject_assignment call error:', e?.message);
    }

    if (!rpcOk) {
      try {
        await db.from('subject_teacher_assignments').upsert({
          school_id: schoolId, subject_id: subjectId, teacher_id: teacherId, academic_year: academicYear
        });
        for (const cid of uniqueClassIds) {
          await db.from('subject_class_assignments').upsert({
            school_id: schoolId, subject_id: subjectId, class_id: cid, academic_year: academicYear
          });
          await db.from('teacher_assignments').upsert({
            school_id: schoolId, teacher_id: teacherId, role: 'GURU_MAPEL', class_id: cid, subject_id: subjectId, academic_year: academicYear, is_active: true
          });
        }
        await db.from('profiles').update({ class_ids: uniqueClassIds }).eq('school_id', schoolId).or(`teacher_id.eq.${teacherId},id.eq.${actorUserId}`);
      } catch (_) {}
    }
    return academicYear;
  };

  const ensureTeacherForAccount = async (opts: {
    profileId: string;
    schoolId: string;
    nama: string;
    nip?: string | null;
    jenisKelamin?: 'L' | 'P';
    tugasUtama?: string;
    tugas_utama?: string;
  }) => {
    const { data: profile, error: profileReadError } = await db
      .from('profiles')
      .select('id,teacher_id,school_id')
      .eq('id', opts.profileId)
      .maybeSingle();
    if (profileReadError) throw profileReadError;

    let teacherId = profile?.teacher_id || null;
    if (teacherId) {
      const { data: existingTeacher, error: teacherReadError } = await db
        .from('teachers').select('*').eq('id', teacherId).maybeSingle();
      if (teacherReadError) throw teacherReadError;
      // Hanya perbarui guru yang ada jika memang berada pada school_id yang sama.
      // JANGAN PERNAH mengubah school_id guru dari sekolah lain, karena melanggar constraint database
      // "Profile dan guru harus berada pada sekolah yang sama" dan merusak data sekolah asal.
      if (existingTeacher && existingTeacher.school_id === opts.schoolId) {
        const { data: updatedTeacher, error } = await db.from('teachers').update({
          nama: opts.nama,
          nip: (opts.nip || existingTeacher.nip || '').trim() || null,
          jenis_kelamin: opts.jenisKelamin || existingTeacher.jenis_kelamin || 'L',
          tugas_utama: opts.tugas_utama || opts.tugasUtama || null,
        }).eq('id', teacherId).select().single();
        if (error) throw error;
        return updatedTeacher;
      }
    }

    // Reuse master guru yang sudah ada di opts.schoolId berdasarkan school_id + NIP.
    const normalizedNip = String(opts.nip || '').trim();
    if (normalizedNip && normalizedNip !== '-') {
      const { data: existingByNip, error: nipLookupError } = await db
        .from('teachers').select('*').eq('school_id', opts.schoolId).eq('nip', normalizedNip).maybeSingle();
      if (nipLookupError) throw nipLookupError;
      if (existingByNip) {
        const updateFields: any = {};
        if (opts.tugas_utama || opts.tugasUtama) updateFields.tugas_utama = opts.tugas_utama || opts.tugasUtama;
        if (opts.nama && opts.nama !== 'Pengguna' && opts.nama !== 'Guru') updateFields.nama = opts.nama;
        if (Object.keys(updateFields).length > 0) {
          await db.from('teachers').update(updateFields).eq('id', existingByNip.id);
          Object.assign(existingByNip, updateFields);
        }
        return existingByNip;
      }
    }

    // Reuse master guru di opts.schoolId berdasarkan Nama
    if (opts.nama) {
      const { data: existingByName } = await db
        .from('teachers').select('*').eq('school_id', opts.schoolId).ilike('nama', opts.nama.trim()).maybeSingle();
      if (existingByName) {
        const updateFields: any = {};
        if (opts.tugas_utama || opts.tugasUtama) updateFields.tugas_utama = opts.tugas_utama || opts.tugasUtama;
        if (Object.keys(updateFields).length > 0) {
          await db.from('teachers').update(updateFields).eq('id', existingByName.id);
          Object.assign(existingByName, updateFields);
        }
        return existingByName;
      }
    }

    // Buat data guru baru khusus untuk target ruang kerja (opts.schoolId)
    const { data: insertedTeacher, error: insertError } = await db.from('teachers').insert({
      school_id: opts.schoolId,
      nama: opts.nama,
      nip: normalizedNip && normalizedNip !== '-' ? normalizedNip : null,
      jenis_kelamin: opts.jenisKelamin || 'L',
      tugas_utama: opts.tugas_utama || opts.tugasUtama || null,
    }).select().single();
    if (insertError) throw insertError;

    return insertedTeacher;
  };

  try {
    // -------------------------------------------------------------
    // 1. LOOKUP SEKOLAH / KODE UNDANGAN / NPSN (PUBLIC)
    // -------------------------------------------------------------
    if (action === 'lookup_school' || action === 'lookup_school_code') {
      const rawQuery = String(body.code || body.query || '').trim();
      if (!rawQuery) {
        return json(res, 400, { error: 'Masukkan kode sekolah, NPSN, atau nama sekolah.' });
      }

      // Bersihkan awalan SCH- jika ada agar pengguna yang memasukkan format lama tetap terlayani
      const strippedQuery = rawQuery.toUpperCase().replace(/^SCH-?/i, '').trim();
      const cleanCode = strippedQuery.replace(/[^A-Z0-9]/g, '');
      const cleanDigits = rawQuery.replace(/\D/g, '');

      // Cari di tabel schools
      let schQuery = db.from('schools').select('id, name, npsn, code, plan, status, workspace_type');
      if (cleanDigits.length >= 4) {
        schQuery = schQuery.or(`code.ilike.%${cleanCode}%,code.ilike.%${strippedQuery}%,code.ilike.%${rawQuery}%,name.ilike.%${rawQuery}%,npsn.ilike.%${cleanDigits}%`);
      } else {
        schQuery = schQuery.or(`code.ilike.%${cleanCode}%,code.ilike.%${strippedQuery}%,code.ilike.%${rawQuery}%,name.ilike.%${rawQuery}%`);
      }
      const { data: matchedSchools } = await schQuery.limit(15);

      // Cari di school_profile
      let spQuery = db
        .from('school_profile')
        .select('school_id, nama_sekolah, npsn, jenjang, alamat, tahun_pelajaran');

      if (cleanDigits.length >= 3) {
        spQuery = spQuery.or(`npsn.ilike.%${cleanDigits}%,nama_sekolah.ilike.%${rawQuery}%`);
      } else {
        spQuery = spQuery.ilike('nama_sekolah', `%${rawQuery}%`);
      }
      const { data: matchedProfiles } = await spQuery.limit(15);

      const schoolMap = new Map<string, any>();

      for (const sc of matchedSchools || []) {
        if (!sc.id) continue;
        const normalizedCode = sc.code ? String(sc.code).replace(/^SCH-?/i, '').trim().toUpperCase() : '';
        const fallbackCode = normalizedCode || sc.npsn || sc.id.slice(0, 8).toUpperCase();
        schoolMap.set(sc.id, {
          id: sc.id,
          name: sc.name || 'Sekolah Terdaftar',
          code: fallbackCode,
          npsn: sc.npsn || '',
          jenjang: 'SD',
          alamat: '',
        });
      }

      for (const sp of matchedProfiles || []) {
        if (!sp.school_id) continue;
        const existing = schoolMap.get(sp.school_id);
        const normalizedCode = existing?.code ? String(existing.code).replace(/^SCH-?/i, '').trim().toUpperCase() : '';
        const fallbackCode = normalizedCode || sp.npsn || sp.school_id.slice(0, 8).toUpperCase();
        schoolMap.set(sp.school_id, {
          id: sp.school_id,
          name: sp.nama_sekolah || existing?.name || 'Sekolah Terdaftar',
          code: fallbackCode,
          npsn: sp.npsn || existing?.npsn || '',
          jenjang: sp.jenjang || existing?.jenjang || 'SD',
          alamat: sp.alamat || existing?.alamat || '',
        });
      }

      const schools = [];
      for (const [, sc] of schoolMap) {
        const { data: cls } = await db
          .from('classes')
          .select('id, name, grade, academic_year')
          .eq('school_id', sc.id)
          .order('grade')
          .order('name');

        schools.push({
          id: sc.id,
          name: sc.name,
          code: sc.code,
          npsn: sc.npsn,
          jenjang: sc.jenjang || 'SD',
          alamat: sc.alamat,
          classes: cls || [],
        });
      }

      return json(res, 200, { ok: true, schools });
    }

    // -------------------------------------------------------------
    // 2. LOOKUP DATA SISWA BERDASARKAN NISN (PUBLIC)
    // -------------------------------------------------------------
    if (action === 'lookup_student') {
      const nisn = String(body.nisn || '').replace(/\D/g, '').trim();
      const schoolId = body.schoolId || null;

      if (!nisn || nisn.length < 5) {
        return json(res, 400, { error: 'Masukkan minimal 5-10 digit NISN yang valid.' });
      }

      let stuQuery = db
        .from('students')
        .select('id, nisn, nama, gender, class_id, school_id, classes:class_id(id, name, grade)')
        .eq('nisn', nisn);

      if (schoolId) {
        stuQuery = stuQuery.eq('school_id', schoolId);
      }

      const { data: studentRows, error: sErr } = await stuQuery.limit(1);
      if (sErr) throw sErr;

      const student = studentRows?.[0];
      if (!student) {
        return json(res, 404, {
          error: 'Data siswa belum ditemukan. Silakan hubungi wali kelas atau administrator sekolah.',
        });
      }

      const { data: sp } = await db
        .from('school_profile')
        .select('nama_sekolah, npsn')
        .eq('school_id', student.school_id)
        .maybeSingle();

      return json(res, 200, {
        ok: true,
        student: {
          id: student.id,
          nisn: student.nisn,
          nama: student.nama,
          gender: student.gender,
          schoolId: student.school_id,
          schoolName: sp?.nama_sekolah || 'Sekolah Terdaftar',
          npsn: sp?.npsn || '',
          classId: student.class_id,
          className: (student.classes as any)?.name || 'Kelas Terdaftar',
        },
      });
    }

    // -------------------------------------------------------------
    // 2.1. GET PUBLIC DAILY REPORT ON-THE-FLY (DYNAMIC SMART LINK)
    // -------------------------------------------------------------
    if (action === 'get_public_daily_report') {
      const classIdOrName = String(body.classId || '').trim();
      const explicitClassName = String(body.className || body.cn || '').trim();
      const scopedSchoolId = String(body.schoolId || body.school_id || body.sid || '').trim() || null;
      const reportDate = String(body.date || new Date().toISOString().slice(0, 10)).trim();
      const attType = String(body.attendanceType || 'DAILY').toUpperCase() === 'SUBJECT' ? 'SUBJECT' : 'DAILY';
      const subjectId = body.subjectId || null;
      const period = String(body.period || body.p || body.reportType || 'Laporan Harian').toLowerCase().trim();
      const weekStr = String(body.week || body.w || body.selectedWeek || 'Minggu Ke-1').trim();
      const cleanMonthRaw = String(body.month || body.mo || '').trim();
      let mNum = new Date().getMonth() + 1;
      if (/^\d+$/.test(cleanMonthRaw)) {
        mNum = Math.min(12, Math.max(1, parseInt(cleanMonthRaw, 10)));
      } else if (cleanMonthRaw) {
        const mLower = cleanMonthRaw.toLowerCase();
        const map: Record<string, number> = {
          januari: 1, january: 1, jan: 1,
          februari: 2, february: 2, feb: 2,
          maret: 3, march: 3, mar: 3,
          april: 4, apr: 4,
          mei: 5, may: 5,
          juni: 6, june: 6, jun: 6,
          juli: 7, july: 7, jul: 7,
          agustus: 8, august: 8, aug: 8,
          september: 9, sep: 9, sept: 9,
          oktober: 10, october: 10, okt: 10, oct: 10,
          november: 11, nov: 11,
          desember: 12, december: 12, des: 12, dec: 12,
        };
        mNum = map[mLower] || mNum;
      }

      const indonesianMonthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];
      const resolvedMonthName = indonesianMonthNames[mNum - 1] || 'September';
      const cleanYearNum = parseInt(String(body.year || body.y || new Date().getFullYear()).replace(/\D/g, ''), 10) || new Date().getFullYear();
      const rawSemester = String(body.semester || body.sem || 'Ganjil').trim();
      const semester = (rawSemester.toLowerCase() === 'genap' || rawSemester === '2') ? 'Genap' : 'Ganjil';
      const rawAy = String(body.academicYear || body.ay || '').trim();
      let startYear = cleanYearNum;
      let endYear = cleanYearNum + 1;
      if (rawAy.includes('/')) {
        const parts = rawAy.split('/');
        startYear = parseInt(parts[0], 10) || startYear;
        endYear = parseInt(parts[1], 10) || (startYear + 1);
      }
      const academicYear = rawAy || `${startYear}/${endYear}`;

      // 1. Cari kelas secara aman dengan isolasi tenant sekolah (Aman dari cross-tenant leak)
      let targetClass: any = null;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(classIdOrName);

      // 1.a. Jika parameter classId adalah UUID yang valid
      if (isUuid) {
        let clsQuery = db
          .from('classes')
          .select('id, name, grade, academic_year, school_id, wali_kelas_teacher_id')
          .eq('id', classIdOrName);
        if (scopedSchoolId) {
          clsQuery = clsQuery.eq('school_id', scopedSchoolId);
        }
        const { data: clsRows } = await clsQuery.limit(1);
        targetClass = clsRows?.[0] || null;

        // Fallback jika tidak ditemukan dengan scopedSchoolId: cari via UUID saja
        if (!targetClass && scopedSchoolId) {
          const { data: globalClsRows } = await db
            .from('classes')
            .select('id, name, grade, academic_year, school_id, wali_kelas_teacher_id')
            .eq('id', classIdOrName)
            .limit(1);
          targetClass = globalClsRows?.[0] || null;
        }
      }

      // 1.b. Pencarian berdasarkan nama kelas atau explicitClassName
      if (!targetClass) {
        const candidateNames = [explicitClassName, classIdOrName].filter(
          (n) => n && n !== 'default' && n !== 'all' && n !== 'null' && n !== 'undefined'
        );

        for (const rawName of candidateNames) {
          const cleanName = rawName.replace(/^cls[-_]?/i, '').replace(/^kelas\s*/i, '').trim();

          let foundQuery = db
            .from('classes')
            .select('id, name, grade, academic_year, school_id, wali_kelas_teacher_id')
            .or(`name.ilike.%${cleanName}%,name.ilike.%${rawName}%`);

          if (scopedSchoolId) {
            foundQuery = foundQuery.eq('school_id', scopedSchoolId);
          }

          const { data: found } = await foundQuery.limit(1);
          if (found && found.length > 0) {
            targetClass = found[0];
            break;
          }
        }

        // Jika dengan scopedSchoolId belum ketemu, cari secara global berdasarkan nama kelas
        if (!targetClass) {
          for (const rawName of candidateNames) {
            const cleanName = rawName.replace(/^cls[-_]?/i, '').replace(/^kelas\s*/i, '').trim();
            const { data: foundGlobal } = await db
              .from('classes')
              .select('id, name, grade, academic_year, school_id, wali_kelas_teacher_id')
              .or(`name.ilike.%${cleanName}%,name.ilike.%${rawName}%`)
              .limit(1);
            if (foundGlobal && foundGlobal.length > 0) {
              targetClass = foundGlobal[0];
              break;
            }
          }
        }
      }

      // 1.c. Jika masih belum ditemukan namun scopedSchoolId ada
      if (!targetClass && scopedSchoolId) {
        const { data: fallbackClasses } = await db
          .from('classes')
          .select('id, name, grade, academic_year, school_id, wali_kelas_teacher_id')
          .eq('school_id', scopedSchoolId)
          .order('grade', { ascending: true })
          .limit(1);
        targetClass = fallbackClasses?.[0] || null;
      }

      // 1.d. Fallback terakhir: ambil kelas pertama di tabel classes
      if (!targetClass) {
        const { data: anyClass } = await db
          .from('classes')
          .select('id, name, grade, academic_year, school_id, wali_kelas_teacher_id')
          .order('grade', { ascending: true })
          .limit(1);
        targetClass = anyClass?.[0] || null;
      }

      // Validasi ketat: Jika kelas tidak ditemukan, kembalikan 404
      if (!targetClass) {
        return json(res, 404, {
          ok: false,
          error: 'Dokumen rekap kehadiran untuk rombel dan periode ini tidak ditemukan di sistem.',
        });
      }

      const schoolId = targetClass.school_id || scopedSchoolId;

      // 2. Ambil profil sekolah, konfigurasi sistem, data sekolah master, dan guru
      const [{ data: sp }, { data: sc }, { data: teachersList }, { data: schoolRow }] = await Promise.all([
        db.from('school_profile').select('*').eq('school_id', schoolId).maybeSingle(),
        db.from('system_config').select('*').eq('school_id', schoolId).maybeSingle(),
        db.from('teachers').select('id, nama, nip, tugas_utama').eq('school_id', schoolId),
        db.from('schools').select('*').eq('id', schoolId).maybeSingle(),
      ]);

      // Ekstraksi data alamat & profil dari format JSON terstruktur (__EXTJSON__:)
      let extJson: any = {};
      const rawAlamat = sp?.alamat || '';
      if (rawAlamat.startsWith('__EXTJSON__:') || rawAlamat.startsWith('{')) {
        try {
          const jsonText = rawAlamat.startsWith('__EXTJSON__:') ? rawAlamat.slice(12) : rawAlamat;
          extJson = JSON.parse(jsonText);
        } catch (_) {}
      }

      const cleanAlamat = extJson.full || (rawAlamat.startsWith('__EXTJSON__:') || rawAlamat.startsWith('{') ? '' : rawAlamat) || [extJson.jalan, extJson.desaKelurahan, extJson.kecamatan, extJson.kabupatenKota, extJson.provinsi].filter(Boolean).join(', ') || '';

      const schoolName = sp?.nama_sekolah || extJson.namaSekolah || schoolRow?.name || 'SD NEGERI';
      const npsn = sp?.npsn || extJson.npsn || schoolRow?.npsn || '';

      // Tentukan Pemerintah Daerah secara akurat berdasarkan data profil sekolah (bukan hardcoded Jakarta)
      let resolvedPemda = sc?.pemerintah_daerah || '';
      if (!resolvedPemda) {
        const rawKab = extJson.kabupatenKota || sp?.kabupaten_kota || '';
        const rawProv = extJson.provinsi || sp?.provinsi || '';
        if (rawKab) {
          const upperKab = rawKab.trim().toUpperCase();
          resolvedPemda = (upperKab.startsWith('KOTA') || upperKab.startsWith('KABUPATEN'))
            ? `PEMERINTAH ${upperKab}`
            : `PEMERINTAH KABUPATEN/KOTA ${upperKab}`;
        } else if (rawProv) {
          resolvedPemda = `PEMERINTAH PROVINSI ${rawProv.trim().toUpperCase()}`;
        }
      }
      const dinasPendidikan = sc?.dinas_pendidikan || 'DINAS PENDIDIKAN';

      // 3. Ambil daftar siswa kelas tersebut (atau seluruh siswa jika laporan kepala sekolah)
      const isKepsek = period.includes('kepsek');
      let students: any[] = [];

      if (isKepsek) {
        const { data: allStus } = await db
          .from('students')
          .select('id, nisn, nama, gender, class_id')
          .eq('school_id', schoolId)
          .order('nama', { ascending: true });
        students = allStus || [];
      } else {
        // Query siswa pada class_id tersebut tanpa mereferensikan kolom non-existent (class_name)
        const { data: studentRows, error: stuErr } = await db
          .from('students')
          .select('id, nisn, nama, gender, class_id')
          .eq('class_id', targetClass.id)
          .order('nama', { ascending: true });

        if (stuErr) {
          console.warn('[get_public_daily_report] studentRows query error:', stuErr.message);
        }

        let resolvedStudents = studentRows || [];

        // Fallback jika belum ada siswa pada class_id tersebut, ambil siswa dari sekolah yang sama
        if (resolvedStudents.length === 0 && schoolId) {
          const { data: schoolStudents } = await db
            .from('students')
            .select('id, nisn, nama, gender, class_id')
            .eq('school_id', schoolId)
            .order('nama', { ascending: true });

          if (schoolStudents && schoolStudents.length > 0) {
            resolvedStudents = schoolStudents;
          }
        }

        students = resolvedStudents;
      }

      const studentIds = students.map((s: any) => s.id);

      // 4. Ambil catatan absensi sesuai cakupan periode laporan (Harian, Mingguan, Bulanan, Semester)
      let attRecords: any[] = [];
      if (studentIds.length > 0) {
        let attQuery = db
          .from('attendance_records')
          .select('id, student_id, teacher_id, status, check_in_time, check_out_time, notes, type, subject_id, date')
          .in('student_id', studentIds);

        let startDate = '';
        let endDate = '';
        let semStart = '';
        let semEnd = '';
        let minDateStr = '';
        let maxDateStr = '';

        if (period.includes('bulanan') || period === 'monthly' || period === 'kepsek' || period === 'kepsek_monthly') {
          const lastDayOfMonth = new Date(cleanYearNum, mNum, 0).getDate();
          const monthPrefix = `${cleanYearNum}-${String(mNum).padStart(2, '0')}`;
          startDate = `${monthPrefix}-01`;
          endDate = `${monthPrefix}-${String(lastDayOfMonth).padStart(2, '0')}`;
          attQuery = attQuery.gte('date', startDate).lte('date', endDate);
        } else if (period.includes('semester') || period === 'kepsek_semester') {
          if (semester === 'Genap') {
            semStart = `${startYear}-01-01`;
            semEnd = `${endYear}-06-30`;
          } else {
            semStart = `${startYear}-07-01`;
            semEnd = `${endYear}-01-15`;
          }
          attQuery = attQuery.gte('date', semStart).lte('date', semEnd);
        } else if (period.includes('mingguan') || period === 'weekly') {
          try {
            const weekNum = parseInt(weekStr.replace(/\D/g, ''), 10) || 1;

            // Hari Senin pertama untuk bulan tersebut
            const firstOfMonth = new Date(cleanYearNum, mNum - 1, 1);
            const dow = firstOfMonth.getDay();
            let firstMonday: Date;
            if (dow === 1) {
              firstMonday = new Date(cleanYearNum, mNum - 1, 1);
            } else if (dow === 6) {
              firstMonday = new Date(cleanYearNum, mNum - 1, 3);
            } else if (dow === 0) {
              firstMonday = new Date(cleanYearNum, mNum - 1, 2);
            } else {
              firstMonday = new Date(cleanYearNum, mNum - 1, 1 - (dow - 1));
            }

            const weekMonday = new Date(firstMonday);
            weekMonday.setDate(firstMonday.getDate() + (weekNum - 1) * 7);

            const weekStart = new Date(weekMonday);
            const weekEnd = new Date(weekMonday);
            weekEnd.setDate(weekMonday.getDate() + 6);

            const lastDayOfMonth = new Date(cleanYearNum, mNum, 0).getDate();
            const monthPrefix = `${cleanYearNum}-${String(mNum).padStart(2, '0')}`;

            minDateStr = weekStart.toISOString().slice(0, 10) < `${monthPrefix}-01`
              ? weekStart.toISOString().slice(0, 10)
              : `${monthPrefix}-01`;
            maxDateStr = weekEnd.toISOString().slice(0, 10) > `${monthPrefix}-${String(lastDayOfMonth).padStart(2, '0')}`
              ? weekEnd.toISOString().slice(0, 10)
              : `${monthPrefix}-${String(lastDayOfMonth).padStart(2, '0')}`;

            attQuery = attQuery.gte('date', minDateStr).lte('date', maxDateStr);
          } catch (_) {
            attQuery = attQuery.eq('date', reportDate);
          }
        } else {
          // Laporan Harian default
          attQuery = attQuery.eq('date', reportDate);
        }

        if (attType === 'SUBJECT') {
          attQuery = attQuery.eq('type', 'SUBJECT');
          if (subjectId) {
            attQuery = attQuery.eq('subject_id', subjectId);
          }
        } else {
          // Seluruh absensi harian umum (bisa bertipe DAILY atau NULL)
          attQuery = attQuery.or('type.eq.DAILY,type.is.null');
        }

        const { data: recordsData, error: recordsErr } = await attQuery.range(0, 999);
        if (recordsErr) {
          console.warn('[get_public_daily_report] attQuery error:', recordsErr.message);
        }
        attRecords = recordsData ? [...recordsData] : [];

        // Paginate jika jumlah data mencapai limit 1000 baris (misalnya pada semester dengan ribuan log)
        if (attRecords.length === 1000) {
          let page = 1;
          while (page < 10) {
            let nextQuery = db
              .from('attendance_records')
              .select('id, student_id, teacher_id, status, check_in_time, check_out_time, notes, type, subject_id, date')
              .in('student_id', studentIds);

            if (period.includes('bulanan') || period === 'monthly' || period === 'kepsek' || period === 'kepsek_monthly') {
              nextQuery = nextQuery.gte('date', startDate).lte('date', endDate);
            } else if (period.includes('semester') || period === 'kepsek_semester') {
              nextQuery = nextQuery.gte('date', semStart).lte('date', semEnd);
            } else if (period.includes('mingguan') || period === 'weekly') {
              nextQuery = nextQuery.gte('date', minDateStr).lte('date', maxDateStr);
            } else {
              nextQuery = nextQuery.eq('date', reportDate);
            }

            if (attType === 'SUBJECT') {
              nextQuery = nextQuery.eq('type', 'SUBJECT');
              if (subjectId) nextQuery = nextQuery.eq('subject_id', subjectId);
            } else {
              nextQuery = nextQuery.or('type.eq.DAILY,type.is.null');
            }

            const { data: nextPage, error: nextErr } = await nextQuery.range(page * 1000, (page + 1) * 1000 - 1);
            if (nextErr || !nextPage || nextPage.length === 0) break;
            attRecords = attRecords.concat(nextPage);
            if (nextPage.length < 1000) break;
            page++;
          }
        }
      }

      // Map subject name jika ada
      let subjectName = null;
      let subjectTeacherId = null;
      if (attType === 'SUBJECT' && subjectId) {
        const { data: subj } = await db.from('subjects').select('name, teacher_id').eq('id', subjectId).maybeSingle();
        subjectName = subj?.name || null;
        subjectTeacherId = subj?.teacher_id || null;
      }

      // Resolve nama wali kelas / guru mapel
      let teacherName = '';
      let teacherNip = '';
      if (attType === 'SUBJECT') {
        if (subjectTeacherId) {
          const st = (teachersList || []).find((t: any) => t.id === subjectTeacherId);
          if (st) {
            teacherName = st.nama;
            teacherNip = st.nip || '';
          }
        }
        if (!teacherName && subjectId) {
          const { data: subAssign } = await db.from('subject_teacher_assignments').select('teacher_id').eq('subject_id', subjectId).limit(1);
          const assignedTid = subAssign?.[0]?.teacher_id;
          if (assignedTid) {
            const st = (teachersList || []).find((t: any) => t.id === assignedTid);
            if (st) {
              teacherName = st.nama;
              teacherNip = st.nip || '';
            }
          }
        }
      } else if (targetClass.wali_kelas_teacher_id) {
        const wk = (teachersList || []).find((t: any) => t.id === targetClass.wali_kelas_teacher_id);
        if (wk) {
          teacherName = wk.nama;
          teacherNip = wk.nip || '';
        }
      } else if (sp?.nama_wali_kelas || extJson.namaWaliKelas) {
        const candidateWali = sp?.nama_wali_kelas || extJson.namaWaliKelas;
        const wk = (teachersList || []).find((t: any) => t.nama && t.nama.trim().toLowerCase() === candidateWali.trim().toLowerCase());
        if (wk) {
          teacherName = wk.nama;
          teacherNip = wk.nip || '';
        } else {
          teacherName = candidateWali;
          teacherNip = sp?.nip_wali_kelas || extJson.nipWaliKelas || '';
        }
      }

      if ((!teacherName || teacherName === 'Wali Kelas' || teacherName === 'Guru Mata Pelajaran') && attRecords.length > 0) {
        const attTeacherId = attRecords.find((r: any) => r.teacher_id)?.teacher_id;
        if (attTeacherId) {
          const tObj = (teachersList || []).find((t: any) => t.id === attTeacherId);
          if (tObj) {
            teacherName = tObj.nama;
            teacherNip = tObj.nip || teacherNip;
          }
        }
      }

      let principalName = sp?.nama_kepala_sekolah || extJson.namaKepalaSekolah || 'Kepala Sekolah';
      let principalNip = sp?.nip_kepala_sekolah || extJson.nipKepalaSekolah || '';
      if (!principalNip && principalName) {
        const pt = (teachersList || []).find((t: any) => t.nama && t.nama.trim().toLowerCase() === principalName.trim().toLowerCase());
        if (pt?.nip) {
          principalNip = pt.nip;
        }
      }
      if (!principalNip) {
        const ptByTugas = (teachersList || []).find((t: any) => t.tugas_utama && t.tugas_utama.toLowerCase().includes('kepala'));
        if (ptByTugas) {
          if (!principalName || principalName === 'Kepala Sekolah') principalName = ptByTugas.nama;
          principalNip = ptByTugas.nip || '';
        }
      }

      // Ringkasan kehadiran harian
      const recordMap = new Map<string, any>();
      attRecords.forEach((r: any) => {
        if (!recordMap.has(r.student_id) || r.date === reportDate) {
          recordMap.set(r.student_id, r);
        }
      });

      let hadir = 0;
      let sakit = 0;
      let izin = 0;
      let alfa = 0;
      let terlambat = 0;

      const studentList = students.map((s: any, idx: number) => {
        const rec = recordMap.get(s.id);
        const status = rec?.status || '-';
        if (status === 'Hadir' || status === 'Terlambat') hadir++;
        else if (status === 'Sakit') sakit++;
        else if (status === 'Izin') izin++;
        else if (status === 'Alfa') alfa++;

        const checkIn = rec?.check_in_time || '';
        const isLate = status === 'Terlambat' || (checkIn && checkIn > '07:00' && checkIn < '11:00');
        if (isLate) {
          terlambat++;
        }

        return {
          id: s.id,
          no: idx + 1,
          nisn: s.nisn || '',
          nama: s.nama,
          gender: s.gender === 'P' || s.gender === 'Perempuan' ? 'P' : 'L',
          status,
          checkInTime: rec?.check_in_time || '',
          checkOutTime: rec?.check_out_time || '',
          notes: rec?.notes || '',
        };
      });

      const totalStudents = students.length || 1;
      const persentase = Math.round((hadir / totalStudents) * 100);

      // Data komparasi kelas untuk Laporan Kepala Sekolah (Supervisi)
      let kepsekClassesData: any[] = [];
      if (isKepsek) {
        const { data: allCls } = await db
          .from('classes')
          .select('id, name, grade, academic_year, school_id, wali_kelas_teacher_id')
          .eq('school_id', schoolId)
          .order('grade', { ascending: true })
          .order('name', { ascending: true });

        const daysInMonth = new Date(cleanYearNum, mNum, 0).getDate();
        let effDaysCount = 0;
        for (let d = 1; d <= daysInMonth; d++) {
          const dow = new Date(cleanYearNum, mNum - 1, d).getDay();
          if (dow >= 1 && dow <= 5) effDaysCount++;
        }
        if (effDaysCount === 0) effDaysCount = 20;

        kepsekClassesData = (allCls || []).map((cls: any) => {
          const clsStudents = students.filter((s: any) => s.class_id === cls.id);
          const clsStudentIds = new Set(clsStudents.map((s: any) => s.id));
          const clsRecords = attRecords.filter((r: any) => clsStudentIds.has(r.student_id));

          const maleCount = clsStudents.filter((s: any) => s.gender === 'L' || s.gender === 'Laki-laki').length;
          const femaleCount = clsStudents.filter((s: any) => s.gender === 'P' || s.gender === 'Perempuan').length;
          const totalClsStudents = clsStudents.length;

          const clsHadir = clsRecords.filter((r: any) => r.status === 'Hadir' || r.status === 'Terlambat').length;
          const clsSakit = clsRecords.filter((r: any) => r.status === 'Sakit').length;
          const clsIzin = clsRecords.filter((r: any) => r.status === 'Izin').length;
          const clsAlfa = clsRecords.filter((r: any) => r.status === 'Alfa').length;
          const totalRecorded = clsHadir + clsSakit + clsIzin + clsAlfa;

          const denom = (totalClsStudents * effDaysCount) || totalRecorded || 1;
          const pctHadir = (clsHadir / denom) * 100;

          let predicate = 'Sangat Baik';
          if (pctHadir < 75) predicate = 'Perlu Pembinaan';
          else if (pctHadir < 85) predicate = 'Cukup';
          else if (pctHadir < 95) predicate = 'Baik';

          let waliName = '-';
          if (cls.wali_kelas_teacher_id) {
            const tch = (teachersList || []).find((t: any) => t.id === cls.wali_kelas_teacher_id);
            if (tch) waliName = tch.nama;
          }

          let clsFase = 'A';
          const gNum = parseInt(String(cls.grade).replace(/[^0-9]/g, ''), 10) || 1;
          if (gNum >= 1 && gNum <= 2) clsFase = 'A';
          else if (gNum >= 3 && gNum <= 4) clsFase = 'B';
          else if (gNum >= 5 && gNum <= 6) clsFase = 'C';
          else if (gNum >= 7 && gNum <= 9) clsFase = 'D';
          else if (gNum === 10) clsFase = 'E';
          else if (gNum >= 11 && gNum <= 12) clsFase = 'F';

          return {
            classId: cls.id,
            className: String(cls.name || '').replace(/^kelas\s*/i, ''),
            grade: cls.grade,
            fase: `Fase ${clsFase}`,
            waliKelasName: waliName,
            maleCount,
            femaleCount,
            totalStudents: totalClsStudents,
            hadir: clsHadir,
            sakit: clsSakit,
            izin: clsIzin,
            alfa: clsAlfa,
            totalRecorded,
            pctHadir: (pctHadir % 1 === 0 ? pctHadir.toFixed(0) : pctHadir.toFixed(1)),
            predicate,
          };
        });
      }

      let resolvedFase = 'A';
      const gradeNum = parseInt(String(targetClass.grade).replace(/[^0-9]/g, ''), 10);
      if (gradeNum >= 1 && gradeNum <= 2) resolvedFase = 'A';
      else if (gradeNum >= 3 && gradeNum <= 4) resolvedFase = 'B';
      else if (gradeNum >= 5 && gradeNum <= 6) resolvedFase = 'C';
      else if (gradeNum >= 7 && gradeNum <= 9) resolvedFase = 'D';
      else if (gradeNum === 10) resolvedFase = 'E';
      else if (gradeNum >= 11 && gradeNum <= 12) resolvedFase = 'F';

      return json(res, 200, {
        ok: true,
        report: {
          schoolId,
          classId: targetClass.id,
          schoolName,
          pemerintahDaerah: resolvedPemda,
          dinasPendidikan,
          npsn,
          alamat: cleanAlamat,
          logoUrl: sc?.school_logo_url || null,
          letterheadType: sc?.letterhead_type || 'standard_text',
          letterheadImageUrl: sc?.letterhead_image_url || null,
          showLetterhead: sc?.show_letterhead ?? true,
          className: targetClass.name.toLowerCase().startsWith('kelas') ? targetClass.name : `Kelas ${targetClass.name}`,
          grade: targetClass.grade,
          fase: `Fase ${resolvedFase}`,
          semester: semester || sp?.semester || extJson.semester || 'Ganjil',
          academicYear,
          tahunPelajaran: targetClass.academic_year || academicYear || sp?.tahun_pelajaran || extJson.tahunPelajaran || `${startYear}/${endYear}`,
          date: reportDate,
          month: resolvedMonthName,
          year: String(cleanYearNum),
          period,
          week: weekStr,
          attendanceType: attType,
          subjectName,
          teacherName,
          teacherNip,
          principalName,
          principalNip,
          reportPlace: sc?.report_place || 'Jakarta',
          reportDateOfficial: sc?.report_date?.trim() || new Date().toISOString().slice(0, 10),
          stats: {
            totalStudents: students.length,
            hadir,
            sakit,
            izin,
            alfa,
            terlambat,
            persentase,
          },
          students: studentList,
          classes: kepsekClassesData,
          records: attRecords.map((r: any) => ({
            id: r.id,
            studentId: r.student_id,
            date: r.date || reportDate,
            status: r.status,
            checkInTime: r.check_in_time || '',
            checkOutTime: r.check_out_time || '',
            notes: r.notes || '',
            type: r.type || 'DAILY',
            subjectId: r.subject_id || null,
          })),
        },
      });
    }

    // -------------------------------------------------------------
    // 2.2. SHORTEN URL (TINYURL / IS.GD SMART SHORT LINK GENERATOR)
    // -------------------------------------------------------------
    if (action === 'shorten_url') {
      const longUrl = String(body.url || '').trim();
      if (!longUrl) {
        return json(res, 400, { error: 'URL wajib diisi.' });
      }

      // Coba TinyURL terlebih dahulu
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const resp = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (resp.ok) {
          const shortText = (await resp.text()).trim();
          if (shortText.startsWith('http://') || shortText.startsWith('https://')) {
            return json(res, 200, { ok: true, shortUrl: shortText });
          }
        }
      } catch (_) {}

      // Fallback ke is.gd
      try {
        const controller2 = new AbortController();
        const timeout2 = setTimeout(() => controller2.abort(), 3500);
        const resp2 = await fetch(`https://is.gd/create.php?format=simple&url=${encodeURIComponent(longUrl)}`, {
          signal: controller2.signal,
        });
        clearTimeout(timeout2);
        if (resp2.ok) {
          const shortText2 = (await resp2.text()).trim();
          if (shortText2.startsWith('http://') || shortText2.startsWith('https://')) {
            return json(res, 200, { ok: true, shortUrl: shortText2 });
          }
        }
      } catch (_) {}

      // Jika jaringan eksternal terkendala, kembalikan URL asli
      return json(res, 200, { ok: true, shortUrl: longUrl });
    }

    // -------------------------------------------------------------
    // CHANGE OWN PASSWORD & MARK PASSWORD CHANGED
    // -------------------------------------------------------------
    if (action === 'change_own_password' || action === 'mark_password_changed') {
      const userToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!userToken) {
        return json(res, 401, { error: 'Sesi login diperlukan.' });
      }

      const { data: userAuth, error: userAuthError } = await db.auth.getUser(userToken);
      if (userAuthError || !userAuth?.user) {
        return json(res, 401, { error: 'Sesi login tidak valid atau telah kedaluwarsa.' });
      }

      const userId = userAuth.user.id;
      if (body.userId && String(body.userId).trim() !== userId) {
        return json(res, 403, { error: 'Tidak diizinkan mengubah password pengguna lain melalui endpoint ini.' });
      }

      const newPassword = body.password ? String(body.password) : '';

      // 1. Jika ada password baru yang diberikan, perbarui akun auth via admin service role
      if (newPassword) {
        if (newPassword.length < 8) {
          return json(res, 400, { error: 'Password minimal 8 karakter.' });
        }
        const { error: pwdErr } = await db.auth.admin.updateUserById(userId, {
          password: newPassword,
          user_metadata: { must_change_password: false },
        });
        if (pwdErr) {
          console.warn('Gagal updateUserById di auth admin:', pwdErr.message);
          // Jika error bukan fatal atau password sudah terupdate di client, tetap lanjutkan update profile
        }
      }

      // 2. Pastikan must_change_password bernilai false pada tabel profiles
      const { error: profErr } = await db
        .from('profiles')
        .update({ must_change_password: false })
        .eq('id', userId);

      if (profErr) {
        console.error('Gagal update must_change_password pada profiles:', profErr);
        return json(res, 400, { error: profErr.message || 'Gagal memperbarui status password pada profil.' });
      }

      return json(res, 200, { ok: true, success: true, message: 'Password berhasil diperbarui.' });
    }

    // -------------------------------------------------------------
    // 3. GET USER WORKSPACES
    // -------------------------------------------------------------
    if (action === 'get_user_workspaces') {
      const workspaceToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!workspaceToken) {
        return json(res, 401, { error: 'Sesi login diperlukan untuk membaca ruang kerja.' });
      }
      const { data: workspaceAuth, error: workspaceAuthError } = await db.auth.getUser(workspaceToken);
      if (workspaceAuthError || !workspaceAuth.user) {
        return json(res, 401, { error: 'Sesi login tidak valid atau telah kedaluwarsa.' });
      }
      const userId = workspaceAuth.user.id;
      const userEmail = (workspaceAuth.user.email || '').trim().toLowerCase();

      let { data: profile } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();

      // Jika profil belum ditemukan berdasarkan ID auth (atau profil stub baru tanpa school_id),
      // cari apakah email Google ini telah didaftarkan/diperbarui pada tabel profiles (melalui Data Pengguna -> Edit)
      if ((!profile || !profile.school_id) && userEmail) {
        const { data: matchedProfilesByEmail } = await db
          .from('profiles')
          .select('*')
          .ilike('email', userEmail);

        const profileByEmail =
          (matchedProfilesByEmail || []).find(
            (p: any) =>
              p.id !== userId &&
              (p.school_id || String(p.role || '').toUpperCase().trim() === 'SUPER_ADMIN')
          ) ||
          (matchedProfilesByEmail || []).find((p: any) => p.id !== userId);

        if (profileByEmail) {
          const oldId = profileByEmail.id;
          if (String(profileByEmail.role || '').toUpperCase().trim() === 'SUPER_ADMIN') {
            if (profileByEmail.is_active !== false) {
              profile = profileByEmail;
            }
          } else {
            // Pindahkan seluruh relasi kepemilikan & penugasan dari oldId ke userId Google yang baru
            try {
              await db.from('schools').update({ owner_id: userId }).eq('owner_id', oldId);
            } catch (_) {}
            try {
              await db.from('user_class_assignments').update({ user_id: userId }).eq('user_id', oldId);
            } catch (_) {}
            try {
              await db.from('teachers').update({ user_id: userId }).eq('user_id', oldId);
            } catch (_) {}
            try {
              await db.from('audit_logs').update({ actor_id: userId }).eq('actor_id', oldId);
            } catch (_) {}

            // Jika ada baris stub kosong pada id = userId, hapus terlebih dahulu agar tidak bentrok PK
            if (profile && profile.id === userId && !profile.school_id) {
              try {
                await db.from('profiles').delete().eq('id', userId);
              } catch (_) {}
            }

            let migratedProfile: any = null;
            try {
              const { data: updatedProf, error: updErr } = await db
                .from('profiles')
                .update({
                  id: userId,
                  email: userEmail,
                  is_active: true,
                  must_change_password: false,
                })
                .eq('id', oldId)
                .select('*')
                .maybeSingle();

              if (!updErr && updatedProf) {
                migratedProfile = updatedProf;
              }
            } catch (_) {}

            // Fallback jika database tidak mengizinkan update kolom primary key `id` secara langsung:
            // hapus baris oldId lalu upsert ulang dengan id = userId
            if (!migratedProfile) {
              try {
                await db.from('profiles').delete().eq('id', oldId);
                const { data: upsertedProf } = await db
                  .from('profiles')
                  .upsert({
                    ...profileByEmail,
                    id: userId,
                    email: userEmail,
                    is_active: true,
                    must_change_password: false,
                  })
                  .select('*')
                  .maybeSingle();
                migratedProfile =
                  upsertedProf || {
                    ...profileByEmail,
                    id: userId,
                    email: userEmail,
                    is_active: true,
                    must_change_password: false,
                  };
                await db.from('schools').update({ owner_id: userId }).eq('owner_id', oldId);
              } catch (_) {
                migratedProfile = {
                  ...profileByEmail,
                  id: userId,
                  email: userEmail,
                  is_active: true,
                  must_change_password: false,
                };
              }
            }

            // Hapus akun auth lama (oldId) yang tidak lagi terpakai agar tidak duplikat
            if (oldId && oldId !== userId) {
              try {
                await db.auth.admin.deleteUser(oldId);
              } catch (_) {}
            }

            profile = migratedProfile;
          }
        }
      }
      
      let workspaces: any[] = [];
      const visitedSchoolIds = new Set<string>();

      // 1. Ambil sekolah yang dimiliki (owned) oleh user
      const candidateOwnerIds: string[] = [userId];
      if (profile?.id && !candidateOwnerIds.includes(profile.id)) {
        candidateOwnerIds.push(profile.id);
      }
      const { data: ownedSchools } = await db
        .from('schools')
        .select('*')
        .in('owner_id', candidateOwnerIds)
        .order('created_at', { ascending: false });

      // 2. Kumpulkan seluruh record guru yang terkait dengan akun ini
      // (Berdasarkan teacher_id aktif, NIP profil/username, Nama, dan Email)
      const allTeacherRecords: any[] = [];
      const seenTeacherIds = new Set<string>();

      if (profile?.teacher_id) {
        const { data: currentTeacher } = await db
          .from('teachers')
          .select('id, school_id, nama, nip, tugas_utama')
          .eq('id', profile.teacher_id)
          .maybeSingle();
        if (currentTeacher) {
          allTeacherRecords.push(currentTeacher);
          seenTeacherIds.add(currentTeacher.id);
        }
      }

      // Hubungkan record guru jika email cocok
      if (userEmail) {
        const { data: teachersByEmail } = await db
          .from('teachers')
          .select('id, school_id, nama, nip, tugas_utama, email, user_id')
          .ilike('email', userEmail);
        for (const t of teachersByEmail || []) {
          if (!seenTeacherIds.has(t.id)) {
            seenTeacherIds.add(t.id);
            allTeacherRecords.push(t);
            if (!t.user_id) {
              try {
                await db.from('teachers').update({ user_id: userId }).eq('id', t.id);
              } catch (_) {}
            }
          }
        }
      }

      // Hubungkan record guru jika user_id cocok
      const { data: teachersByUserId } = await db
        .from('teachers')
        .select('id, school_id, nama, nip, tugas_utama, email, user_id')
        .eq('user_id', userId);
      for (const t of teachersByUserId || []) {
        if (!seenTeacherIds.has(t.id)) {
          seenTeacherIds.add(t.id);
          allTeacherRecords.push(t);
        }
      }

      // Cari berdasarkan NIP resmi (minimal 16 digit dan bukan placeholder)
      const rawNip = String((profile as any)?.nip || profile?.username || workspaceAuth.user.user_metadata?.nip || '').trim();
      const cleanNip = rawNip.replace(/[^0-9]/g, '');
      if (cleanNip.length >= 16 && rawNip !== '-') {
        const { data: teachersByNip } = await db
          .from('teachers')
          .select('id, school_id, nama, nip, tugas_utama')
          .eq('nip', cleanNip);
        for (const t of teachersByNip || []) {
          if (!seenTeacherIds.has(t.id)) {
            seenTeacherIds.add(t.id);
            allTeacherRecords.push(t);
          }
        }
      }

      // Jika belum memiliki profil tetapi memiliki record guru terdaftar di sekolah, otomatis hubungkan profil:
      if (!profile && allTeacherRecords.length > 0) {
        const primaryTeacher = allTeacherRecords[0];
        const teacherName = primaryTeacher.nama || workspaceAuth.user.user_metadata?.full_name || workspaceAuth.user.user_metadata?.name || 'Guru';
        const teacherRole = primaryTeacher.tugas_utama?.toUpperCase().includes('WALI') ? 'WALI KELAS' : 'GURU MAPEL';
        const cleanUsername = userEmail ? userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') : `user_${userId.slice(0, 8)}`;
        try {
          const { data: createdProfile } = await db.from('profiles').upsert({
            id: userId,
            school_id: primaryTeacher.school_id,
            name: teacherName,
            username: cleanUsername,
            email: userEmail || undefined,
            role: teacherRole,
            teacher_id: primaryTeacher.id,
            is_active: true,
            must_change_password: false,
          }).select().maybeSingle();
          if (createdProfile) profile = createdProfile;
        } catch (err) {
          console.warn('Error auto-linking profile for teacher:', err);
        }
      }

      // ATURAN STRICT SINGLE WORKSPACE:
      // Setiap pengguna hanya memiliki tepat 1 ruang kerja permanen yang melekat ke akunnya.
      const isPersonalProfile =
        (profile as any)?.workspace_type === 'personal' ||
        (profile as any)?.registration_mode === 'personal';
      let targetSchoolId: string | null = profile?.school_id || (profile as any)?.workspace_id || null;

      // Jika profil belum memiliki school_id (misal pendaftaran awal), cari apakah user telah memiliki sekolah/ruang kerja
      if (!targetSchoolId && ownedSchools && ownedSchools.length > 0) {
        targetSchoolId = ownedSchools[0].id;
        try {
          await db.from('profiles').update({ school_id: targetSchoolId, workspace_id: targetSchoolId }).eq('id', userId);
        } catch (_) {}
      }

      // Jika masih belum ada, cek apakah tertaut ke data guru di suatu sekolah
      if (!targetSchoolId && allTeacherRecords.length > 0) {
        targetSchoolId = allTeacherRecords[0].school_id;
        try {
          await db.from('profiles').update({ school_id: targetSchoolId, workspace_id: targetSchoolId }).eq('id', userId);
        } catch (_) {}
      }

      // Hanya izinkan 1 ruang kerja (tidak ada opsi multiple workspaces)
      const candidateSchoolIds: string[] = targetSchoolId ? [targetSchoolId] : [];

      for (const sId of candidateSchoolIds) {
        if (!sId || visitedSchoolIds.has(sId)) continue;
        visitedSchoolIds.add(sId);

        const { data: school } = await db.from('schools').select('*').eq('id', sId).maybeSingle();
        if (!school) continue;
        await checkAndDowngradeExpiredSchool(db, school);
        const { data: sp } = await db.from('school_profile').select('*').eq('school_id', sId).maybeSingle();

        let schoolCode = school?.code ? String(school.code).replace(/^SCH-?/i, '').trim().toUpperCase() : '';
        if (school && !schoolCode) {
          schoolCode = generateSchoolInviteCode();
          try {
            await db.from('schools').update({ code: schoolCode }).eq('id', sId);
          } catch (_) {}
        }

        const isPersonal =
          school?.workspace_type === 'personal' ||
          school?.workspace_type === 'individu' ||
          (school as any)?.is_personal === true;

        if (isPersonal) {
          // ISOLASI KETAT RUANG KERJA INDIVIDU:
          // Ruang kerja individu hanya boleh diakses oleh pemilik sahnya (owner_id)
          // ATAU pengguna resmi (Guru / Kepala Sekolah / Siswa) yang terdaftar pada ruang kerja individu tersebut (profile.school_id === sId)
          const isLegitimatePersonalMember =
            candidateOwnerIds.includes(school.owner_id) ||
            sId === profile?.school_id ||
            allTeacherRecords.some((t: any) => t.school_id === sId);
          if (!isLegitimatePersonalMember) {
            continue;
          }
        } else {
          // ISOLASI DATA SEKOLAH INSTITUSI:
          // Pastikan user memiliki hak akses resmi yang sah ke sekolah tersebut:
          // - Pemilik sekolah (owner_id)
          // - Atau profile.school_id sesuai DAN bukan mode personal
          // - Atau akun memiliki record guru resmi (allTeacherRecords) di sekolah tersebut
          const isLegitimateSchoolMember =
            school.owner_id === userId ||
            (sId === profile?.school_id && !isPersonalProfile) ||
            allTeacherRecords.some((t: any) => t.school_id === sId);

          if (!isLegitimateSchoolMember) {
            continue;
          }
        }

        const teacherForSchool = allTeacherRecords.find((t: any) => t.school_id === sId);
        const academicYear = String(sp?.tahun_pelajaran || '2026/2027').trim() || '2026/2027';
        let assignmentRole: 'WALI KELAS' | 'GURU MAPEL' | 'OTHER' = 'OTHER';

        if (!isPersonal && teacherForSchool) {
          const { data: waliAssignments } = await db
            .from('classes')
            .select('id')
            .eq('school_id', sId)
            .eq('academic_year', academicYear)
            .eq('wali_kelas_teacher_id', teacherForSchool.id)
            .limit(1);
          if (waliAssignments?.length) assignmentRole = 'WALI KELAS';

          const { data: subjectAssignments } = await db
            .from('subject_teacher_assignments')
            .select('subject_id')
            .eq('school_id', sId)
            .eq('academic_year', academicYear)
            .eq('teacher_id', teacherForSchool.id)
            .limit(1);
          if (subjectAssignments?.length) {
            if (assignmentRole !== 'WALI KELAS') {
              assignmentRole = 'GURU MAPEL';
            }
          }

          // Fallback tugas utama guru jika belum ada assignment rombel tahun aktif
          if (assignmentRole === 'OTHER' && teacherForSchool.tugas_utama) {
            const tu = String(teacherForSchool.tugas_utama).toLowerCase();
            if (tu.includes('wali')) assignmentRole = 'WALI KELAS';
            else if (tu.includes('mapel')) assignmentRole = 'GURU MAPEL';
          }
        }

        const profileRole = sId === profile?.school_id ? String(profile?.role || '').toUpperCase() : '';
        const nonTeacherRole = ['SUPER_ADMIN','ADMIN','KEPALA SEKOLAH','SISWA'].includes(profileRole) ? profileRole : '';
        
        let userRole = nonTeacherRole;
        if (!userRole) {
          if (assignmentRole !== 'OTHER') {
            userRole = assignmentRole;
          } else if (isPersonal) {
            userRole = profileRole || 'WALI KELAS';
          } else if (teacherForSchool) {
            userRole = teacherForSchool.tugas_utama?.toLowerCase()?.includes('mapel') ? 'GURU MAPEL' : 'WALI KELAS';
          } else if (school.owner_id === userId) {
            userRole = 'ADMIN';
          }
        }

        if (!userRole) continue;

        workspaces.push({
          id: `ws-mem-${userId}-${sId}`,
          userId: userId,
          workspaceId: sId,
          workspaceCode: schoolCode || null,
          role: userRole,
          workspaceName: isPersonal ? 'Ruang Kerja Individu' : (school?.name || sp?.nama_sekolah || 'Ruang Kerja Sekolah'),
          workspaceType: school?.workspace_type || (isPersonal ? 'personal' : 'school'),
          registrationMode: isPersonal ? 'personal' : 'school',
          npsn: isPersonal ? null : (school?.npsn || sp?.npsn || null),
          subscriptionPlan: normalizePlan(school?.plan),
          subscriptionExpiresAt: school?.subscription_expires_at || null,
          status: school?.status || 'active',
          joinedAt: school?.created_at || profile?.created_at || new Date().toISOString(),
        });

        // Simpan referensi ruang kerja ke auth user_metadata sesuai jenisnya
        if (!isPersonal) {
          try {
            await db.auth.admin.updateUserById(userId, {
              user_metadata: {
                ...(workspaceAuth.user.user_metadata || {}),
                school_workspace_id: sId,
                school_workspace_role: userRole,
                school_workspace_name: school?.name || sp?.nama_sekolah || 'Ruang Kerja Sekolah',
              }
            });
          } catch (_) {}
        } else {
          try {
            await db.auth.admin.updateUserById(userId, {
              user_metadata: {
                ...(workspaceAuth.user.user_metadata || {}),
                personal_workspace_id: sId,
                workspace_type: 'personal',
              }
            });
          } catch (_) {}
        }
      }

      // OPSI B (Kunci Total): Jika salah satu ruang kerja sekolah tempat pengguna bernaung sedang aktif Paket Sekolah Pro,
      // maka ruang kerja individu tidak ditawarkan/dinonaktifkan (seluruh aktivitas guru wajib 100% di Ruang Kerja Sekolah).
      const nowCheck = new Date();
      const hasActiveSchoolPro = workspaces.some((w) => {
        if (w.workspaceType === 'personal' || w.workspaceType === 'individu') return false;
        const plan = normalizePlan(w.subscriptionPlan);
        const isSchoolPlan = plan === 'sekolah_pro';
        const isNotSuspended = w.status !== 'suspended' && w.status !== 'inactive';
        const isNotExpired = !w.subscriptionExpiresAt || new Date(w.subscriptionExpiresAt) > nowCheck;
        return isSchoolPlan && isNotSuspended && isNotExpired;
      });

      if (hasActiveSchoolPro) {
        workspaces = workspaces.filter(
          (w) => w.workspaceType !== 'personal' && w.workspaceType !== 'individu'
        );
      }

      return json(res, 200, {
        ok: true,
        success: true,
        workspaces,
        profile: profile || null,
        userMetadata: workspaceAuth.user.user_metadata || null,
      });
    }

    // -------------------------------------------------------------
    // 3.1. CREATE FRESH PERSONAL WORKSPACE
    // -------------------------------------------------------------
    if (action === 'create_personal_workspace') {
      const personalToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!personalToken) {
        return json(res, 401, { error: 'Sesi login diperlukan untuk membuat ruang kerja individu.' });
      }
      const { data: personalAuth, error: personalAuthError } = await db.auth.getUser(personalToken);
      if (personalAuthError || !personalAuth.user) {
        return json(res, 401, { error: 'Sesi login tidak valid atau telah kedaluwarsa.' });
      }
      const userId = personalAuth.user.id;
      const fullName = String(body.fullName || body.name || '').trim() || 'Pendidik';
      const nip = String(body.nip || '-').trim();
      let linkedTeacher: any = null;

      const { data: currentProfile, error: currentProfileError } = await db
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (currentProfileError) throw currentProfileError;

      // ATURAN STRICT SINGLE WORKSPACE: Akun yang sudah punya ruang kerja tidak bisa membuat ruang kerja baru
      if (currentProfile?.school_id) {
        return json(res, 400, {
          ok: false,
          error: 'Akun Anda telah terikat secara permanen dengan ruang kerja saat ini. Sesuai kebijakan KawaCanaan, Anda tidak dapat membuat ruang kerja baru.',
        });
      }

      const role = normalizeTeacherRole(currentProfile?.role);
      if (!['WALI KELAS', 'GURU MAPEL'].includes(role)) {
        return json(res, 403, { error: 'Ruang kerja individu guru hanya dapat dibuat setelah role guru ditetapkan melalui onboarding/assignment yang valid.' });
      }

      // Catat sekolah institusi sebelumnya jika ada agar tidak hilang saat beralih ke individu
      const previousSchoolId = currentProfile?.school_id;
      if (previousSchoolId) {
        const { data: prevSchool } = await db
          .from('schools')
          .select('id, name, plan, status, subscription_expires_at, workspace_type, is_personal')
          .eq('id', previousSchoolId)
          .maybeSingle();
        if (prevSchool && prevSchool.workspace_type !== 'personal' && !prevSchool.is_personal) {
          await checkAndDowngradeExpiredSchool(db, prevSchool);
          const isSchoolPlan = normalizePlan(prevSchool.plan) === 'sekolah_pro';
          const isNotSuspended = prevSchool.status !== 'suspended' && prevSchool.status !== 'inactive';
          const isNotExpired = !prevSchool.subscription_expires_at || new Date(prevSchool.subscription_expires_at) > new Date();
          if (isSchoolPlan && isNotSuspended && isNotExpired) {
            return json(res, 403, {
              error: `Sekolah Anda (${prevSchool.name || 'Sekolah Anda'}) sedang aktif berlangganan Paket Sekolah Pro. Seluruh aktivitas guru dipusatkan pada Ruang Kerja Sekolah.`,
            });
          }

          try {
            await db.auth.admin.updateUserById(userId, {
              user_metadata: {
                ...(personalAuth.user.user_metadata || {}),
                school_workspace_id: previousSchoolId,
                school_workspace_role: role,
                school_workspace_name: prevSchool.name || 'Ruang Kerja Sekolah',
              },
            });
          } catch (_) {}
        }
      }

      // Periksa apakah user sudah memiliki ruang kerja individu
      const { data: existingPersonal } = await db
        .from('schools')
        .select('*')
        .eq('owner_id', userId)
        .or('workspace_type.eq.personal,is_personal.eq.true,plan.eq.teacher,plan.eq.mulai,plan.eq.guru_gratis,plan.eq.guru_pro')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingPersonal) {
        await checkAndDowngradeExpiredSchool(db, existingPersonal);
        if (role === 'WALI KELAS' || role === 'GURU MAPEL') {
          linkedTeacher = await ensureTeacherForAccount({ profileId: userId, schoolId: existingPersonal.id, nama: fullName, nip, jenisKelamin: 'L', tugasUtama: role === 'WALI KELAS' ? 'Wali Kelas' : 'Guru Mapel' });
        }
        await db.from('profiles').update({
          school_id: existingPersonal.id,
          teacher_id: linkedTeacher?.id || null,
          workspace_type: 'personal',
        }).eq('id', userId);

        const wsObj = {
          id: `ws-mem-${userId}-${existingPersonal.id}`,
          userId,
          workspaceId: existingPersonal.id,
          workspaceCode: existingPersonal.code ? String(existingPersonal.code).replace(/^SCH-?/i, '').trim().toUpperCase() : null,
          role: role as any,
          workspaceName: 'Ruang Kerja Individu',
          workspaceType: existingPersonal.workspace_type || 'personal',
          registrationMode: 'personal',
          npsn: null,
          subscriptionPlan: normalizePlan(existingPersonal.plan),
          joinedAt: existingPersonal.created_at || new Date().toISOString(),
        };

        return json(res, 200, { ok: true, success: true, workspace: wsObj, isNew: false });
      }

      // Buat Ruang Kerja Individu baru dengan data fresh (kosong)
      const trial = calculateGuruProTrialPeriod();
      const inviteCode = generateSchoolInviteCode();
      const { data: newSchool, error: schoolErr } = await db.from('schools').insert({
        name: 'Ruang Kerja Individu',
        code: inviteCode,
        plan: trial.plan,
        status: 'active',
        workspace_type: 'personal',
        is_personal: true,
        owner_id: userId,
        subscription_started_at: trial.startedAt,
        subscription_expires_at: trial.expiresAt,
        max_teachers: trial.maxTeachers,
        max_students: trial.maxStudents,
        max_classes: trial.maxClasses,
      }).select().single();

      if (schoolErr || !newSchool) {
        return json(res, 500, { error: schoolErr?.message || 'Gagal membuat ruang kerja individu baru.' });
      }

      // Inisialisasi school_profile kosong (fresh workspace)
      await db.from('school_profile').upsert({
        school_id: newSchool.id,
        nama_sekolah: '',
        npsn: '',
        jenjang: 'SD',
        nama_wali_kelas: role === 'WALI KELAS' ? fullName : '',
        nip_wali_kelas: role === 'WALI KELAS' ? nip : '',
        tahun_pelajaran: '2026/2027',
        semester: '1',
        kelas: '',
      }, { onConflict: 'school_id' });

      await db.from('system_config').delete().eq('school_id', newSchool.id);
      await db.from('system_config').insert({
        school_id: newSchool.id,
        app_title: 'Kawacanaan Presensi',
        app_subtitle: '',
      });

      // Daftarkan data guru untuk user ini di ruang kerja individu
      linkedTeacher = await ensureTeacherForAccount({ profileId: userId, schoolId: newSchool.id, nama: fullName, nip, jenisKelamin: 'L', tugasUtama: role === 'WALI KELAS' ? 'Wali Kelas' : 'Guru Mapel' });

      // Update profil aktif secara atomik
      await db.from('profiles').update({
        school_id: newSchool.id,
        teacher_id: linkedTeacher?.id || null,
        workspace_type: 'personal',
      }).eq('id', userId);

      const wsObj = {
        id: `ws-mem-${userId}-${newSchool.id}`,
        userId,
        workspaceId: newSchool.id,
        workspaceCode: inviteCode,
        role: role as any,
        workspaceName: 'Ruang Kerja Individu',
        workspaceType: 'personal',
        registrationMode: 'personal',
        npsn: null,
        subscriptionPlan: 'guru_gratis',
        joinedAt: new Date().toISOString(),
      };

      return json(res, 200, { ok: true, success: true, workspace: wsObj, isNew: true });
    }

    // -------------------------------------------------------------
    // 3.1b. SWITCH ACTIVE WORKSPACE ATOMICALLY
    // -------------------------------------------------------------
    if (action === 'switch_workspace') {
      return json(res, 403, {
        ok: false,
        success: false,
        error: 'Sistem KawaCanaan Presensi menggunakan model 1 Pengguna = 1 Ruang Kerja Permanen. Pergantian ruang kerja tidak diizinkan.',
      });
    }

    // -------------------------------------------------------------
    // 3.2. JOIN SCHOOL WORKSPACE VIA CODE
    // -------------------------------------------------------------
    if (action === 'join_school_workspace') {
      const joinToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!joinToken) {
        return json(res, 401, { error: 'Sesi login diperlukan untuk bergabung ke sekolah.' });
      }
      const { data: joinAuth, error: joinAuthError } = await db.auth.getUser(joinToken);
      if (joinAuthError || !joinAuth.user) {
        return json(res, 401, { error: 'Sesi login tidak valid atau telah kedaluwarsa.' });
      }
      const authenticatedUserId = joinAuth.user.id;
      const userId = String(body.user_id || body.userId || '').trim();
      if (userId && userId !== authenticatedUserId) {
        return json(res, 403, { error: 'User ID tidak sesuai dengan sesi login.' });
      }
      const rawCode = String(body.code || body.schoolCode || body.schoolId || '').trim();
      const effectiveUserId = authenticatedUserId;

      // ATURAN STRICT SINGLE WORKSPACE: Akun yang sudah memiliki ruang kerja tidak dapat bergabung ke sekolah lain
      const { data: existingProf } = await db
        .from('profiles')
        .select('id, school_id, workspace_type')
        .eq('id', effectiveUserId)
        .maybeSingle();

      if (existingProf?.school_id) {
        return json(res, 400, {
          ok: false,
          error: 'Akun Anda telah terikat secara permanen dengan ruang kerja saat ini. Pengguna individu atau sekolah tidak dapat beralih atau bergabung ke sekolah lain.',
        });
      }
      const role = String(body.role || '').toUpperCase();
      const teacherName = String(body.teacherName || body.name || '').trim();
      const nip = String(body.nip || '-').trim();
      const classId = body.classId || null;
      const className = body.className || null;
      const grade = Number(body.grade || 5);
      const subjectName = String(body.subjectName || '').trim();
      const classIds: string[] = Array.from(new Set<string>((Array.isArray(body.classIds) ? body.classIds : []).map((v: any) => String(v)).filter(Boolean)));

      if (!rawCode) {
        return json(res, 400, { error: 'User ID dan Kode Sekolah wajib disertakan.' });
      }

      const strippedCode = rawCode.toUpperCase().replace(/^SCH-?/i, '').trim();
      const cleanCode = strippedCode.replace(/[^A-Z0-9]/g, '');

      // Cari sekolah target berdasarkan kode atau ID
      let schQuery = db.from('schools').select('*');
      if (cleanCode.length >= 4) {
        schQuery = schQuery.or(`code.ilike.%${cleanCode}%,code.ilike.%${strippedCode}%,id.eq.${rawCode}`);
      } else {
        schQuery = schQuery.or(`code.ilike.%${strippedCode}%,id.eq.${rawCode}`);
      }
      let { data: targetSchool } = await schQuery.limit(1).maybeSingle();

      if (!targetSchool) {
        const { data: sp } = await db
          .from('school_profile')
          .select('school_id')
          .or(`npsn.eq.${rawCode}`)
          .limit(1)
          .maybeSingle();

        if (sp?.school_id) {
          const { data: sch } = await db.from('schools').select('*').eq('id', sp.school_id).maybeSingle();
          targetSchool = sch;
        }
      }

      if (!targetSchool) {
        return json(res, 404, { error: 'Kode sekolah tidak valid atau sekolah tidak ditemukan. Silakan periksa kembali kode sekolah dari administrator.' });
      }

      await checkAndDowngradeExpiredSchool(db, targetSchool);

      const isPersonalWorkspace =
        targetSchool.workspace_type === 'personal' ||
        targetSchool.workspace_type === 'individu' ||
        targetSchool.is_personal === true;

      if (isPersonalWorkspace) {
        return json(res, 400, { error: 'Kode ini merupakan Ruang Kerja Individu dan tidak dapat menerima anggota guru lain.' });
      }

      const schoolId = targetSchool.id;

      if (!['WALI KELAS', 'GURU MAPEL'].includes(role)) {
        return json(res, 400, { error: 'Role join sekolah tidak valid.' });
      }

      const { data: currentProfile, error: currentProfileErr } = await db.from('profiles').select('role, teacher_id').eq('id', effectiveUserId).maybeSingle();
      if (currentProfileErr) throw currentProfileErr;
      if (currentProfile?.role) {
        const currentRole = normalizeTeacherRole(currentProfile.role);
        if ((currentRole === 'WALI KELAS' || currentRole === 'GURU MAPEL') && currentRole !== role) {
          return json(res, 409, { error: `Akun ini sudah memiliki role ${currentRole === 'WALI KELAS' ? 'Wali Kelas' : 'Guru Mapel'} dan tidak dapat bergabung sebagai ${role === 'WALI KELAS' ? 'Wali Kelas' : 'Guru Mapel'}.` });
        }
      }
      if (role === 'GURU MAPEL' && classIds.length === 0) {
        const { data: anyCls } = await db.from('classes').select('id').eq('school_id', schoolId).limit(1);
        if (anyCls && anyCls.length > 0) {
          return json(res, 400, { error: 'Guru Mapel wajib memilih minimal satu kelas yang diajar.' });
        }
      }

      const linkedTeacher = (role === 'WALI KELAS' || role === 'GURU MAPEL')
        ? await ensureTeacherForAccount({ profileId: effectiveUserId, schoolId, nama: teacherName || 'Guru', nip, jenisKelamin: 'L', tugasUtama: role === 'WALI KELAS' ? 'Wali Kelas' : 'Guru Mapel' })
        : null;

      // Handle penugasan rombel/kelas
      let targetClassId = classId;
      if (role === 'WALI KELAS') {
        if (className && (!targetClassId || targetClassId === '__NEW_CLASS__')) {
          const { data: newCls, error: clsErr } = await db.from('classes').insert({
            school_id: schoolId, name: className, grade, academic_year: await getAcademicYear(schoolId), wali_kelas_teacher_id: linkedTeacher.id,
          }).select('id').single();
          if (clsErr) throw clsErr;
          targetClassId = newCls.id;
        } else if (targetClassId) {
          const { data: cls, error: clsErr } = await db.from('classes').select('id').eq('id', targetClassId).eq('school_id', schoolId).maybeSingle();
          if (clsErr) throw clsErr;
          if (!cls) throw new Error('Kelas yang dipilih tidak ditemukan di sekolah tersebut.');
          await assignHomeroom(schoolId, linkedTeacher.id, targetClassId, effectiveUserId);
        }
      } else {
        if (classIds.length > 0) {
          const { data: validClasses, error: classErr } = await db.from('classes').select('id').eq('school_id', schoolId).in('id', classIds);
          if (classErr) throw classErr;
          if ((validClasses || []).length !== classIds.length) throw new Error('Ada kelas Guru Mapel yang tidak berasal dari sekolah yang dipilih.');
        }
        const subjectLabel = subjectName || 'Guru Mapel';
        const { data: existingSub } = await db.from('subjects').select('id').eq('school_id', schoolId).ilike('name', subjectLabel).maybeSingle();
        let subjectRow = existingSub;
        if (!subjectRow) {
          const { data: createdSub, error: subjectErr } = await db.from('subjects').insert({ school_id: schoolId, name: subjectLabel, code: subjectLabel.slice(0, 4).toUpperCase(), is_specialized: true }).select('id').single();
          if (subjectErr) throw subjectErr;
          subjectRow = createdSub;
        }
        await assignSubject(schoolId, subjectRow.id, linkedTeacher.id, classIds, effectiveUserId);
      }


      // Update profil aktif ke ruang kerja sekolah
      await db.from('profiles').update({
        school_id: schoolId,
        teacher_id: linkedTeacher?.id || null,
        role: role as any,
        workspace_type: 'school',
      }).eq('id', effectiveUserId);

      const { data: sp } = await db.from('school_profile').select('nama_sekolah, npsn').eq('school_id', schoolId).maybeSingle();

      const wsObj = {
        id: `ws-mem-${effectiveUserId}-${schoolId}`,
        userId: effectiveUserId,
        workspaceId: schoolId,
        workspaceCode: targetSchool.code ? String(targetSchool.code).replace(/^SCH-?/i, '').trim().toUpperCase() : null,
        role: role as any,
        workspaceName: targetSchool.name || sp?.nama_sekolah || 'Ruang Kerja Sekolah',
        workspaceType: targetSchool.workspace_type || 'school',
        registrationMode: 'school',
        npsn: targetSchool.npsn || sp?.npsn || null,
        subscriptionPlan: normalizePlan(targetSchool.plan),
        joinedAt: new Date().toISOString(),
      };

      try {
        await db.auth.admin.updateUserById(effectiveUserId, {
          user_metadata: {
            ...(joinAuth.user.user_metadata || {}),
            school_workspace_id: schoolId,
            school_workspace_role: role,
            school_workspace_name: wsObj.workspaceName,
          },
        });
      } catch (_) {}

      return json(res, 200, {
        ok: true,
        success: true,
        message: `Berhasil terhubung ke Ruang Kerja Sekolah: ${wsObj.workspaceName}!`,
        workspace: wsObj,
        school: targetSchool,
      });
    }

    // -------------------------------------------------------------
    // 3.5. SCHOOL PROFILE MANAGEMENT (SAVE & GET)
    // -------------------------------------------------------------
    if (action === 'save_school_profile' || action === 'update_school_profile') {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        return json(res, 401, { error: 'Sesi login diperlukan untuk memperbarui profil sekolah.' });
      }
      const { data: authData, error: authErr } = await db.auth.getUser(token);
      if (authErr || !authData?.user) {
        return json(res, 401, { error: 'Sesi login tidak valid atau telah kedaluwarsa.' });
      }
      const callerUserId = authData.user.id;
      const { data: callerProf } = await db.from('profiles').select('id, role, school_id').eq('id', callerUserId).maybeSingle();

      let schoolId = body.schoolId || body.school_id || callerProf?.school_id || null;
      if (!schoolId) {
        return json(res, 400, { error: 'ID ruang kerja/sekolah wajib disertakan.' });
      }

      // Verifikasi hak akses secara ketat:
      const isSuper = callerProf?.role === 'SUPER_ADMIN';
      const { data: sch } = await db.from('schools').select('owner_id, workspace_type, is_personal').eq('id', schoolId).maybeSingle();
      if (!sch) {
        return json(res, 404, { error: 'Ruang kerja atau sekolah tidak ditemukan.' });
      }

      const isPersonal = sch.workspace_type === 'personal' || sch.workspace_type === 'individu' || sch.is_personal === true;
      const isOwner = sch.owner_id === callerUserId;

      if (isPersonal) {
        // RUANG KERJA INDIVIDU: HANYA pemilik sah yang dapat mengubah profil
        if (!isSuper && !isOwner) {
          return json(res, 403, { error: 'Akses ditolak: Hanya pemilik yang dapat memperbarui profil Ruang Kerja Individu ini.' });
        }
      } else {
        // RUANG KERJA SEKOLAH: Admin Sekolah, Kepala Sekolah, atau Pemilik sekolah
        const isSameSchoolAdmin = callerProf?.school_id === schoolId && ['ADMIN', 'KEPALA SEKOLAH'].includes(callerProf?.role);
        if (!isSuper && !isOwner && !isSameSchoolAdmin) {
          return json(res, 403, { error: 'Akses ditolak: Hanya Administrator atau Pemilik yang dapat memperbarui profil sekolah ini.' });
        }
      }

      const namaSekolah = String(body.namaSekolah || body.nama_sekolah || '').trim();
      const npsn = String(body.npsn || '').trim();
      const jenjang = String(body.jenjang || 'SD/MI').trim();
      const alamat = body.alamat || '';
      const tahunPelajaran = String(body.tahunPelajaran || body.tahun_pelajaran || '2025/2026').trim();
      const semester = String(body.semester || '1 (Ganjil)').trim();
      const kelas = String(body.kelas || '').trim();
      const namaKepalaSekolah = String(body.namaKepalaSekolah || body.nama_kepala_sekolah || '').trim();
      const nipKepalaSekolah = String(body.nipKepalaSekolah || body.nip_kepala_sekolah || '').trim();
      const namaWaliKelas = String(body.namaWaliKelas || body.nama_wali_kelas || '').trim();
      const nipWaliKelas = String(body.nipWaliKelas || body.nip_wali_kelas || '').trim();

      // 1. Simpan ke tabel school_profile secara aman dan kompatibel dengan semua versi schema
      const safeProfilePayload: any = {
        school_id: schoolId,
        nama_sekolah: namaSekolah,
        npsn: npsn || null,
        alamat,
        tahun_pelajaran: tahunPelajaran,
        semester,
        kelas,
        nama_kepala_sekolah: namaKepalaSekolah,
        nip_kepala_sekolah: nipKepalaSekolah,
      };

      let spData = null;
      try {
        // Cek keberadaan record terlebih dahulu untuk menghindari kegagalan unique constraint
        const { data: existingSp } = await db.from('school_profile').select('id, school_id').eq('school_id', schoolId).maybeSingle();
        if (existingSp?.id) {
          const { data: updatedSp, error: updateErr } = await db.from('school_profile').update(safeProfilePayload).eq('id', existingSp.id).select().maybeSingle();
          if (!updateErr && updatedSp) {
            spData = updatedSp;
          } else {
            const { error: updateBySchoolErr } = await db.from('school_profile').update(safeProfilePayload).eq('school_id', schoolId);
            if (!updateBySchoolErr) spData = { ...existingSp, ...safeProfilePayload };
          }
        } else {
          const { data: insertedSp, error: insertErr } = await db.from('school_profile').insert(safeProfilePayload).select().maybeSingle();
          if (!insertErr && insertedSp) {
            spData = insertedSp;
          } else {
            // Coba upsert dengan onConflict jika insert gagal
            const { data: upsertedSp } = await db.from('school_profile').upsert(safeProfilePayload, { onConflict: 'school_id' }).select().maybeSingle();
            spData = upsertedSp || safeProfilePayload;
          }
        }
      } catch (upsertErr: any) {
        console.warn('Upsert school_profile error:', upsertErr?.message);
        try {
          await db.from('school_profile').upsert(safeProfilePayload, { onConflict: 'school_id' });
        } catch (_) {}
      }

      // 2. Terintegrasi penuh dengan data Superadmin di tabel `schools`
      const schoolUpdate: any = {};
      if (namaSekolah) {
        schoolUpdate.name = namaSekolah;
      }
      if (npsn) {
        schoolUpdate.npsn = npsn;
      }
      if (Object.keys(schoolUpdate).length > 0) {
        try {
          await db.from('schools').update(schoolUpdate).eq('id', schoolId);
        } catch (schErr: any) {
          console.warn('Update schools table warning:', schErr?.message);
        }
      }

      return json(res, 200, {
        ok: true,
        success: true,
        message: 'Identitas satuan pendidikan berhasil disimpan dan terintegrasi.',
        profile: spData || safeProfilePayload,
      });
    }

    if (action === 'get_school_profile') {
      const schoolId = body.schoolId || body.school_id;
      if (!schoolId) {
        return json(res, 400, { error: 'ID sekolah wajib disertakan.' });
      }
      let [{ data: sp }, { data: sch }] = await Promise.all([
        db.from('school_profile').select('*').eq('school_id', schoolId).maybeSingle(),
        db.from('schools').select('id, name, npsn, code, plan, status, workspace_type, is_personal').eq('id', schoolId).maybeSingle()
      ]);

      let schoolCode = sch?.code ? String(sch.code).replace(/^SCH-?/i, '').trim().toUpperCase() : '';
      if (sch && !schoolCode) {
        schoolCode = generateSchoolInviteCode();
        try {
          await db.from('schools').update({ code: schoolCode }).eq('id', schoolId);
          if (sch) sch.code = schoolCode;
        } catch (_) {}
      }

      return json(res, 200, {
        ok: true,
        profile: sp ? { ...sp, kode_sekolah: schoolCode, kodeSekolah: schoolCode } : null,
        school: sch ? { ...sch, code: schoolCode } : null
      });
    }

    // -------------------------------------------------------------
    // 3B. GET SCHOOL MASTER DATA & USER RECONCILIATION
    // Authoritative service-role endpoint for syncing Admin Sekolah data
    // with Wali Kelas & Guru Mapel accounts
    // -------------------------------------------------------------
    if (action === 'get_school_master_data' || action === 'sync_school_user_data') {
      const schoolId = String(body.schoolId || body.school_id || '').trim();
      let userId = '';
      const masterToken = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (masterToken) {
        const { data: masterAuth } = await db.auth.getUser(masterToken);
        if (masterAuth?.user?.id) {
          userId = masterAuth.user.id;
        }
      }
      if (!schoolId) {
        return json(res, 400, { error: 'ID sekolah wajib disertakan.' });
      }

      // Helper untuk mengambil seluruh riwayat absensi sekolah dengan pagination (melewati batas 1000 baris PostgREST)
      const fetchAllAttendanceForSchool = async (client: any, targetSchoolId: string) => {
        let all: any[] = [];
        let page = 0;
        const pageSize = 1000;
        while (page < 10) {
          const { data, error } = await client
            .from('attendance_records')
            .select('*')
            .eq('school_id', targetSchoolId)
            .order('date', { ascending: false })
            .range(page * pageSize, (page + 1) * pageSize - 1);
          if (error || !data || data.length === 0) break;
          all = all.concat(data);
          if (data.length < pageSize) break;
          page++;
        }
        return { data: all };
      };

      // Ambil seluruh data master sekolah secara authoritative (Service Role)
      const [
        { data: sp },
        { data: sch },
        { data: teachersList },
        { data: classesList },
        { data: studentsList },
        { data: subjectsList },
        { data: teacherAssignments },
        { data: classAssignments },
        { data: scheduleDays },
        { data: attendanceList },
        { data: effectiveDaysList },
        { data: eventsList },
        { data: systemConfigData },
      ] = await Promise.all([
        db.from('school_profile').select('*').eq('school_id', schoolId).maybeSingle(),
        db.from('schools').select('id, name, npsn, code, plan, status, workspace_type, is_personal, owner_id').eq('id', schoolId).maybeSingle(),
        db.from('teachers').select('*').eq('school_id', schoolId).order('nama'),
        db.from('classes').select('*, wali:wali_kelas_teacher_id(id,nama)').eq('school_id', schoolId).order('grade').order('name'),
        db.from('students').select('*, classes:class_id(id,name,grade,academic_year)').eq('school_id', schoolId).order('nama'),
        db.from('subjects').select('*').eq('school_id', schoolId).order('name'),
        db.from('subject_teacher_assignments').select('subject_id, teacher_id, academic_year').eq('school_id', schoolId),
        db.from('subject_class_assignments').select('subject_id, class_id, academic_year').eq('school_id', schoolId),
        db.from('subject_schedule_days').select('subject_id, day_of_week, lesson_period').eq('school_id', schoolId),
        fetchAllAttendanceForSchool(db, schoolId),
        db.from('effective_days').select('*').eq('school_id', schoolId),
        db.from('academic_events').select('*').eq('school_id', schoolId),
        db.from('system_config').select('*').eq('school_id', schoolId).maybeSingle(),
      ]);

      const allTeachers = teachersList || [];
      const allClasses = classesList || [];
      const allSubjects = subjectsList || [];

      let callerProfile: any = null;
      let matchedTeacher: any = null;
      let resolvedClassIds: string[] = [];

      if (userId) {
        const { data: prof } = await db.from('profiles').select('*').eq('id', userId).maybeSingle();
        callerProfile = prof;
      }

      // Validasi otorisasi akses master data
      if (!sch) {
        return json(res, 404, { error: 'Sekolah atau ruang kerja tidak ditemukan.' });
      }
      const isTargetPersonal = sch.workspace_type === 'personal' || sch.workspace_type === 'individu' || sch.is_personal === true;
      const isTargetOwner = sch.owner_id === userId;
      const isCallerSuperAdmin = callerProfile?.role === 'SUPER_ADMIN';

      if (isTargetPersonal) {
        if (!isTargetOwner && !isCallerSuperAdmin) {
          return json(res, 403, { error: 'Akses ditolak: Hanya pemilik yang dapat mengakses data Ruang Kerja Individu ini.' });
        }
      } else {
        const isLegitimateMember =
          isCallerSuperAdmin ||
          isTargetOwner ||
          callerProfile?.school_id === schoolId ||
          allTeachers.some((t: any) => t.id === callerProfile?.teacher_id);
        if (!isLegitimateMember) {
          return json(res, 403, { error: 'Akses ditolak: Anda tidak memiliki wewenang mengakses data sekolah ini.' });
        }
      }

      if (callerProfile) {
        const normalize = (s: string) =>
          String(s || '')
            .toLowerCase()
            .replace(/\b(dr|dra|drs|h|hj|prof|ir)\b\.?/gi, '')
            .replace(/,\s*(s\.pd|m\.pd|s\.pd\.i|m\.pd\.i|s\.ag|m\.ag|s\.si|m\.si|s\.kom|m\.kom|s\.e|m\.m|gr|b\.a|m\.a)\.?/gi, '')
            .replace(/\b(s\.pd|m\.pd|s\.pd\.i|m\.pd\.i|s\.ag|m\.ag|s\.si|m\.si|s\.kom|m\.kom|s\.e|m\.m|gr)\b/gi, '')
            .replace(/[^a-z0-9]/gi, '')
            .trim();
        const normNip = (s: string) => String(s || '').replace(/\D/g, '').trim();

        // 1. Cari teacher yang cocok berdasarkan ID
        if (callerProfile.teacher_id) {
          matchedTeacher = allTeachers.find((t: any) => t.id === callerProfile.teacher_id);
        }

        // 2. Cari berdasarkan NIP / Username jika berformat angka NIP
        if (!matchedTeacher && callerProfile.username) {
          const userNip = normNip(callerProfile.username);
          if (userNip && userNip.length >= 8) {
            matchedTeacher = allTeachers.find((t: any) => normNip(t.nip) === userNip);
          }
        }

        if (!matchedTeacher && callerProfile.nip) {
          const profNip = normNip(callerProfile.nip);
          if (profNip) {
            matchedTeacher = allTeachers.find((t: any) => normNip(t.nip) === profNip);
          }
        }

        // 3. Cari berdasarkan kemiripan nama
        if (!matchedTeacher && callerProfile.name) {
          const cleanCallerName = normalize(callerProfile.name);
          matchedTeacher = allTeachers.find((t: any) => {
            const cleanTName = normalize(t.nama);
            return cleanTName === cleanCallerName || (cleanCallerName.length >= 4 && cleanTName.includes(cleanCallerName)) || (cleanTName.length >= 4 && cleanCallerName.includes(cleanTName));
          });
        }

        // 4. Cek apakah ada data wali kelas di school_profile
        if (!matchedTeacher && sp?.nama_wali_kelas && callerProfile.name) {
          if (normalize(sp.nama_wali_kelas) === normalize(callerProfile.name)) {
            matchedTeacher = allTeachers.find((t: any) => normalize(t.nama) === normalize(sp.nama_wali_kelas));
          }
        }

        // Auto-create teacher record jika belum ada di database untuk role WALI KELAS atau GURU MAPEL
        if (!matchedTeacher && (callerProfile.role === 'WALI KELAS' || callerProfile.role === 'GURU MAPEL')) {
          try {
            const userNip = normNip(callerProfile.username);
            const resolvedNip = userNip && userNip.length >= 8 ? callerProfile.username.trim() : (callerProfile.nip || null);
            const isWali = callerProfile.role === 'WALI KELAS';
            const teacherName = (callerProfile.name && callerProfile.name !== 'Pengguna' && callerProfile.name !== 'Guru')
              ? callerProfile.name
              : (callerProfile.username || (isWali ? 'Wali Kelas' : 'Guru Mapel'));
            const { data: insertedT, error: insTErr } = await db.from('teachers').insert({
              school_id: schoolId,
              nama: teacherName,
              nip: resolvedNip,
              tugas_utama: isWali ? 'Wali Kelas' : 'Guru Mapel',
              jenis_kelamin: 'L',
            }).select().single();

            if (!insTErr && insertedT) {
              matchedTeacher = insertedT;
              allTeachers.push(insertedT);
            }
          } catch (err: any) {
            console.warn('[onboarding] auto-create teacher error:', err?.message);
          }
        }

        // Jika guru ditemukan, lakukan auto-link ke akun profile agar relasi teacher_id terhubung
        if (matchedTeacher && callerProfile?.role !== 'SUPER_ADMIN') {
          const updates: any = {};
          if (callerProfile.teacher_id !== matchedTeacher.id) {
            updates.teacher_id = matchedTeacher.id;
          }
          if (callerProfile.school_id !== schoolId) {
            updates.school_id = schoolId;
          }
          if (Object.keys(updates).length > 0) {
            try {
              if (updates.teacher_id && !updates.school_id && callerProfile.school_id !== schoolId) {
                updates.school_id = schoolId;
              }
              const { error: profileLinkError } = await db.from('profiles').update(updates).eq('id', callerProfile.id);
              if (profileLinkError) {
                console.warn('[onboarding] link profile ke teacher_id gagal:', profileLinkError.message);
              } else {
                callerProfile = { ...callerProfile, ...updates };
              }
            } catch (err: any) {
              console.warn('[onboarding] link profile exception:', err?.message);
            }
          }
        }

        // 5. Resolusi Kelas untuk WALI KELAS (Eksklusif: 1 Guru = 1 Rombel Binaan)
        if (callerProfile.role === 'WALI KELAS') {
          // Tentukan rombel binaan tunggal berdasarkan prioritas:
          // 1. class_ids resmi dari profil akun (hasil input Admin)
          // 2. Relasi ID guru pada tabel classes
          // 3. Nama wali kelas pada tabel classes
          // 4. Fallback school_profile.kelas
          let chosenClass: any = null;

          if (Array.isArray(callerProfile.class_ids) && callerProfile.class_ids.length > 0) {
            chosenClass = allClasses.find((c: any) => callerProfile.class_ids.includes(c.id));
          }

          if (!chosenClass && matchedTeacher) {
            chosenClass = allClasses.find((c: any) => c.wali_kelas_teacher_id === matchedTeacher.id);
          }

          if (!chosenClass) {
            chosenClass = allClasses.find((c: any) => {
              if (!c.wali_kelas_name) return false;
              return (
                normalize(c.wali_kelas_name) === normalize(callerProfile.name) ||
                (matchedTeacher && normalize(c.wali_kelas_name) === normalize(matchedTeacher.nama))
              );
            });
          }

          if (!chosenClass && sp?.kelas) {
            chosenClass = allClasses.find((c: any) => normalize(c.name) === normalize(sp.kelas));
          }

          if (chosenClass && matchedTeacher) {
            // Update rombel yang sah menjadi milik guru ini
            if (chosenClass.wali_kelas_teacher_id !== matchedTeacher.id) {
              try {
                await db.from('classes').update({
                  wali_kelas_teacher_id: matchedTeacher.id,
                }).eq('id', chosenClass.id);
                chosenClass.wali_kelas_teacher_id = matchedTeacher.id;
              } catch (_) {}
            }

            // Lepaskan dan bersihkan rombel lain jika sebelumnya masih terkait ke guru ini
            for (const otherCls of allClasses) {
              if (otherCls.id !== chosenClass.id) {
                const wasAssignedToThisTeacher =
                  otherCls.wali_kelas_teacher_id === matchedTeacher.id;

                if (wasAssignedToThisTeacher) {
                  try {
                    await db.from('classes').update({
                      wali_kelas_teacher_id: null,
                    }).eq('id', otherCls.id);
                    otherCls.wali_kelas_teacher_id = null;
                  } catch (_) {}
                }
              }
            }

            resolvedClassIds = [chosenClass.id];

            // Pastikan class_ids pada akun profil pengguna hanya berisi rombel tunggal ini
            if (!Array.isArray(callerProfile.class_ids) || callerProfile.class_ids.length !== 1 || callerProfile.class_ids[0] !== chosenClass.id) {
              try {
                await db.from('profiles').update({
                  class_ids: [chosenClass.id],
                }).eq('id', callerProfile.id);
                callerProfile.class_ids = [chosenClass.id];
              } catch (_) {}
            }
          } else if (chosenClass) {
            resolvedClassIds = [chosenClass.id];
          } else {
            resolvedClassIds = [];
          }
        } else if (callerProfile.role === 'GURU MAPEL') {
          // 6. Resolusi Kelas untuk GURU MAPEL
          const classIdSet = new Set<string>();
          const matchedSubjectIds = new Set<string>();

          allSubjects.forEach((s: any) => {
            const isMatch =
              (matchedTeacher && s.teacher_id === matchedTeacher.id) ||
              (callerProfile.teacher_id && s.teacher_id === callerProfile.teacher_id) ||
              (callerProfile.subject_id && s.id === callerProfile.subject_id) ||
              (s.teacher_name && callerProfile.name && normalize(s.teacher_name) === normalize(callerProfile.name)) ||
              (matchedTeacher && s.teacher_name && normalize(s.teacher_name) === normalize(matchedTeacher.nama));

            if (isMatch) {
              matchedSubjectIds.add(s.id);
              if (Array.isArray(s.target_class_ids)) {
                s.target_class_ids.forEach((cid: string) => classIdSet.add(cid));
              }
            }
          });

          // Cek subject_teacher_assignments
          const tId = matchedTeacher?.id || callerProfile.teacher_id;
          if (tId) {
            (teacherAssignments || []).forEach((ta: any) => {
              if (ta.teacher_id === tId) {
                matchedSubjectIds.add(ta.subject_id);
              }
            });
          }

          // Cek subject_class_assignments
          (classAssignments || []).forEach((ca: any) => {
            if (matchedSubjectIds.has(ca.subject_id)) {
              classIdSet.add(ca.class_id);
            }
          });

          // Cek penugasan eksplisit di profile jika ada
          if (Array.isArray(callerProfile.class_ids)) {
            callerProfile.class_ids.forEach((cid: string) => classIdSet.add(cid));
          }

          // Jika guru mapel juga memiliki penugasan wali kelas
          if (tId) {
            allClasses
              .filter((c: any) => c.wali_kelas_teacher_id === tId)
              .forEach((c: any) => classIdSet.add(c.id));
          }

          // Fallback cerdas: Jika belum ada pembatasan mapel spesifik dari Admin,
          // berikan akses ke seluruh kelas sekolah agar data referensi dan siswa tidak kosong
          if (classIdSet.size === 0 && allClasses.length > 0) {
            allClasses.forEach((c: any) => classIdSet.add(c.id));
          }

          resolvedClassIds = Array.from(classIdSet);
        }
      }

      let schoolCode = sch?.code ? String(sch.code).replace(/^SCH-?/i, '').trim().toUpperCase() : '';

      return json(res, 200, {
        ok: true,
        success: true,
        school: sch ? { ...sch, code: schoolCode } : null,
        schoolProfile: sp ? { ...sp, kode_sekolah: schoolCode, kodeSekolah: schoolCode } : null,
        teachers: allTeachers,
        classes: allClasses,
        students: studentsList || [],
        subjects: allSubjects,
        subjectTeacherAssignments: teacherAssignments || [],
        subjectClassAssignments: classAssignments || [],
        subjectScheduleDays: scheduleDays || [],
        attendanceRecords: attendanceList || [],
        effectiveDays: effectiveDaysList || [],
        academicEvents: eventsList || [],
        systemConfig: systemConfigData || null,
        callerProfile,
        matchedTeacher,
        resolvedClassIds,
      });
    }

    // -------------------------------------------------------------
    // 4. AUTHENTICATED ACTIONS: ONBOARDING DARI GOOGLE SSO & SESI AKTIF
    // -------------------------------------------------------------
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();

    // -------------------------------------------------------------
    // A. REGISTER & ONBOARD (NON-GOOGLE NEW USER FORM)
    // -------------------------------------------------------------
    if (action === 'register_and_onboard') {
      const fullName = String(body.fullName || '').trim();
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const email = String(body.email || '').trim().toLowerCase();
      const role = String(body.role || '').toUpperCase();
      const mode = String(body.mode || 'school');
      const schoolId = body.schoolId || null;
      const nip = String(body.nip || '-').trim();
      const gender = body.gender === 'P' ? 'P' : 'L';
      const phone = String(body.phone || '-').trim();
      const employmentStatus = String(body.employmentStatus || 'PNS').trim();

      if (!['WALI KELAS', 'GURU MAPEL', 'SISWA'].includes(role)) {
        return json(res, 400, { error: 'Role onboarding tidak valid.' });
      }
      if (role === 'GURU MAPEL' && mode === 'school' && (!Array.isArray(body.classIds) || body.classIds.length === 0)) {
        return json(res, 400, { error: 'Guru Mapel wajib memilih minimal satu kelas yang diajar.' });
      }

      if (!fullName || !username || !password) {
        return json(res, 400, { error: 'Nama lengkap, username, dan kata sandi wajib diisi.' });
      }

      const { data: existingUser } = await db.from('profiles').select('id').eq('username', username).maybeSingle();
      if (existingUser) {
        return json(res, 400, { error: 'Username sudah digunakan. Silakan pilih username lain.' });
      }

      const authEmail = email || `${username}@login.edushift.local`;
      const { data: authData, error: authErr } = await db.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: { name: fullName, username },
      });

      if (authErr || !authData.user) {
        return json(res, 400, { error: authErr?.message || 'Gagal mendaftarkan akun di sistem autentikasi.' });
      }

      const newUserId = authData.user.id;
      let finalSchoolId = schoolId;
      let createdTeacher: any = null;
      let newSchoolRecord: any = null;
      let wsName = '';

      if (mode === 'personal' || !finalSchoolId) {
        const isPersonal = mode === 'personal';
        const inputSchoolName = String(body.schoolName || body.workspaceName || '').trim();
        wsName = inputSchoolName || (isPersonal ? 'Ruang Kerja Individu' : `Ruang Kerja ${fullName}`);
        const trial = calculateGuruProTrialPeriod();
        const inviteCode = generateSchoolInviteCode();
        // Seluruh pendaftaran akun baru mandiri dimulai dari Paket Guru Gratis (guru_gratis).
        // Peningkatan ke guru_pro resmi hanya terjadi setelah pembayaran Midtrans berstatus SETTLED.
        const initialPlan = trial.plan || 'guru_gratis';
        const initialMaxClasses = trial.maxClasses || 1;
        const initialMaxStudents = trial.maxStudents || 50;
        const { data: newSchool, error: schoolErr } = await db.from('schools').insert({
          name: wsName,
          code: inviteCode,
          plan: initialPlan,
          status: 'active',
          workspace_type: 'personal',
          is_personal: true,
          owner_id: newUserId,
          subscription_started_at: trial.startedAt,
          subscription_expires_at: null,
          max_teachers: 1,
          max_students: initialMaxStudents,
          max_classes: initialMaxClasses,
        }).select('id, code, name').single();

        if (schoolErr) throw schoolErr;
        newSchoolRecord = newSchool;
        finalSchoolId = newSchool.id;

        // Nama satuan pendidikan diisi sesuai input pendaftar
        await db.from('school_profile').upsert({
          school_id: finalSchoolId,
          nama_sekolah: inputSchoolName || (isPersonal ? '' : wsName),
          npsn: '',
          jenjang: 'SD',
          nama_wali_kelas: role === 'WALI KELAS' ? fullName : '',
          nip_wali_kelas: role === 'WALI KELAS' ? nip : '',
          tahun_pelajaran: '2026/2027',
          semester: '1',
          kelas: '',
        }, { onConflict: 'school_id' });

        await db.from('system_config').delete().eq('school_id', finalSchoolId);
        await db.from('system_config').insert({
          school_id: finalSchoolId,
          app_title: 'Kawacanaan Presensi',
          app_subtitle: inputSchoolName || (isPersonal ? '' : wsName),
        });

        // Kelas untuk sekolah diproses setelah teacher berhasil dibuat.
      }

      if (role === 'WALI KELAS' || role === 'GURU MAPEL') {
        createdTeacher = await ensureTeacherForAccount({
          profileId: newUserId,
          schoolId: finalSchoolId,
          nama: fullName,
          nip,
          jenisKelamin: gender,
          tugasUtama: role === 'WALI KELAS' ? 'Wali Kelas' : (body.tugasUtama || 'Guru Mapel'),
          tugas_utama: role === 'WALI KELAS' ? 'Wali Kelas' : (body.tugasUtama || 'Guru Mapel'),
        });

        if (role === 'WALI KELAS') {
          const requestedClassId = body.classId && body.classId !== '__NEW_CLASS__' ? String(body.classId) : null;
          let targetClassId = requestedClassId;
          if (!targetClassId) {
            const clsName = String(body.className || (body.grade ? `Kelas ${body.grade}` : 'Kelas 1')).trim();
            const clsGrade = Number(body.grade || 1);
            const { data: newCls, error: clsErr } = await db.from('classes').insert({
              school_id: finalSchoolId,
              name: clsName,
              grade: clsGrade,
              academic_year: await getAcademicYear(finalSchoolId),
              wali_kelas_teacher_id: createdTeacher.id
            }).select('id').single();
            if (clsErr) {
              console.warn('[register_and_onboard] Warning: Failed to create class:', clsErr.message);
            } else {
              targetClassId = newCls?.id;
            }
          } else {
            const { data: cls, error: clsErr } = await db.from('classes').select('id').eq('id', targetClassId).eq('school_id', finalSchoolId).maybeSingle();
            if (clsErr) throw clsErr;
            if (!cls) throw new Error('Kelas yang dipilih tidak ditemukan di sekolah tersebut.');
            await assignHomeroom(finalSchoolId, createdTeacher.id, targetClassId, newUserId);
          }
        }

        if (role === 'GURU MAPEL') {
          const subjectLabel = String(body.subjectName || 'Guru Mapel').trim();
          const { data: existingSub } = await db.from('subjects').select('id').eq('school_id', finalSchoolId).ilike('name', subjectLabel).maybeSingle();
          let subjectRow = existingSub;
          if (!subjectRow) {
            const { data: createdSub, error: subjectErr } = await db.from('subjects').insert({
              school_id: finalSchoolId,
              name: subjectLabel,
              code: subjectLabel.slice(0, 4).toUpperCase(),
              is_specialized: true
            }).select('id').single();
            if (subjectErr) {
              console.warn('[register_and_onboard] Warning: Failed to create subject:', subjectErr.message);
            } else {
              subjectRow = createdSub;
            }
          }

          if (mode === 'personal') {
            const { data: personalCls } = await db.from('classes').insert({
              school_id: finalSchoolId,
              name: 'Kelas 1',
              grade: 1,
              academic_year: await getAcademicYear(finalSchoolId),
            }).select('id').single();

            if (personalCls && subjectRow) {
              await assignSubject(finalSchoolId, subjectRow.id, createdTeacher.id, [personalCls.id], newUserId);
            }
          } else {
            const classIds: string[] = Array.from(new Set<string>((Array.isArray(body.classIds) ? body.classIds : []).map((v: any) => String(v)).filter(Boolean)));
            const { data: validClasses, error: classErr } = await db.from('classes').select('id').eq('school_id', finalSchoolId).in('id', classIds);
            if (classErr) throw classErr;
            if ((validClasses || []).length !== classIds.length) throw new Error('Ada kelas Guru Mapel yang tidak berasal dari sekolah yang dipilih.');
            if (subjectRow) {
              await assignSubject(finalSchoolId, subjectRow.id, createdTeacher.id, classIds, newUserId);
            }
          }
        }
      }

      // Upsert profile
      await db.from('profiles').upsert({
        id: newUserId,
        school_id: finalSchoolId,
        teacher_id: (role === 'WALI KELAS' || role === 'GURU MAPEL') ? createdTeacher.id : null,
        name: fullName,
        username,
        email: authEmail,
        role: role as any,
        is_active: true,
        must_change_password: false,
        student_id: body.studentId || null,
      });

      // Update user_metadata pada akun autentikasi agar secara permanen terikat ke ruang kerjanya
      try {
        await db.auth.admin.updateUserById(newUserId, {
          user_metadata: {
            name: fullName,
            username,
            registration_mode: mode === 'personal' ? 'personal' : 'school',
            workspace_type: mode === 'personal' ? 'personal' : 'school',
            school_id: finalSchoolId,
            ...(mode === 'personal'
              ? {
                  personal_workspace_id: finalSchoolId,
                  personal_workspace_name: wsName || 'Ruang Kerja Individu',
                }
              : {
                  school_workspace_id: finalSchoolId,
                  school_workspace_role: role,
                }),
          },
        });
      } catch (_) {}

      return json(res, 200, {
        ok: true,
        success: true,
        message: 'Pendaftaran akun dan ruang kerja berhasil!',
        userId: newUserId,
        email: authEmail,
        schoolId: finalSchoolId,
        schoolCode: newSchoolRecord?.code || null,
        schoolName: wsName || 'Ruang Kerja Individu',
      });
    }

    // -------------------------------------------------------------
    // B. GOOGLE SSO ACTIONS (WAJIB ADA TOKEN SESI LOGIN)
    // -------------------------------------------------------------
    if (!token) {
      return json(res, 401, { error: 'Sesi login Google tidak ditemukan. Silakan masuk kembali.' });
    }

    const { data: authData, error: authError } = await db.auth.getUser(token);
    if (authError || !authData.user) {
      return json(res, 401, { error: 'Sesi login tidak valid atau telah kedaluwarsa.' });
    }

    const callerUser = authData.user;
    const userEmail = callerUser.email || '';

    const assertExistingProfileRole = async (requestedRole: 'WALI KELAS' | 'GURU MAPEL') => {
      const { data: existingProfile, error } = await db.from('profiles').select('role').eq('id', callerUser.id).maybeSingle();
      if (error) throw error;
      if (existingProfile?.role) {
        const existingRole = normalizeTeacherRole(existingProfile.role);
        if ((existingRole === 'WALI KELAS' || existingRole === 'GURU MAPEL') && existingRole !== requestedRole) {
          throw new Error(`Akun ini sudah memiliki role ${existingRole === 'WALI KELAS' ? 'Wali Kelas' : 'Guru Mapel'} dan tidak dapat berpindah role.`);
        }
      }
    };
    const rawMeta = callerUser.user_metadata || {};
    const defaultName = rawMeta.full_name || rawMeta.name || userEmail.split('@')[0] || 'Pengguna';
    const defaultUsername = userEmail ? userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9._-]/g, '') : `user.${callerUser.id.slice(0, 8)}`;

    // -------------------------------------------------------------
    // ONBOARD WALI KELAS
    // -------------------------------------------------------------
    if (action === 'onboard_homeroom') {
      const mode = body.mode === 'personal' ? 'personal' : 'school';
      const teacherName = String(body.teacherName || defaultName).trim();
      const nip = String(body.nip || '-').trim();
      const gender = body.gender === 'P' ? 'P' : 'L';
      const phone = String(body.phone || '-').trim();
      const employmentStatus = String(body.employmentStatus || 'PNS').trim();
      await assertExistingProfileRole('WALI KELAS');

      let targetSchoolId = body.schoolId || null;
      let linkedTeacher: any = null;

      if (mode === 'personal' || !targetSchoolId) {
        // Guru mandiri yang onboard tanpa sekolah selalu diarahkan ke Ruang Kerja Individu (guru_gratis)
        const isPersonal = true;
        const wsName = 'Ruang Kerja Individu';
        const trial = calculateGuruProTrialPeriod();
        const inviteCode = generateSchoolInviteCode();
        const { data: newSchool, error: schoolErr } = await db.from('schools').insert({
          name: wsName,
          code: inviteCode,
          plan: trial.plan || 'guru_gratis',
          status: 'active',
          workspace_type: 'personal',
          is_personal: true,
          owner_id: callerUser.id,
          subscription_started_at: trial.startedAt,
          subscription_expires_at: null,
          max_teachers: 1,
          max_students: trial.maxStudents || 50,
          max_classes: trial.maxClasses || 1,
        }).select('id').single();

        if (schoolErr) throw schoolErr;
        targetSchoolId = newSchool.id;
        linkedTeacher = await ensureTeacherForAccount({ profileId: callerUser.id, schoolId: targetSchoolId, nama: teacherName, nip, jenisKelamin: gender, tugasUtama: 'Wali Kelas' });

        // Ruang kerja individu: nama satuan pendidikan dibiarkan kosong agar diisi sendiri oleh guru/wali kelas
        await db.from('school_profile').upsert({
          school_id: targetSchoolId,
          nama_sekolah: isPersonal ? '' : wsName,
          npsn: '',
          jenjang: 'SD',
          nama_wali_kelas: teacherName,
          nip_wali_kelas: nip,
          tahun_pelajaran: '2026/2027',
          semester: '1',
          kelas: '',
        }, { onConflict: 'school_id' });

        await db.from('system_config').delete().eq('school_id', targetSchoolId);
        await db.from('system_config').insert({
          school_id: targetSchoolId,
          app_title: 'Kawacanaan Presensi',
          app_subtitle: isPersonal ? '' : wsName,
        });

        // Ruang kerja individu (personal): Jangan buat kelas default.
        // Biarkan data kelas kosong agar pengguna menginput sendiri di Data Referensi -> Data Kelas.
        if (!isPersonal && body.className) {
          const clsName = String(body.className).trim();
          const clsGrade = Number(body.grade || 1);
          const { error: clsErr } = await db.from('classes').insert({
            school_id: targetSchoolId,
            name: clsName,
            grade: clsGrade,
            academic_year: await getAcademicYear(targetSchoolId),
            wali_kelas_teacher_id: linkedTeacher.id,
          });
          if (clsErr) throw clsErr;
        }
      } else {
        linkedTeacher = await ensureTeacherForAccount({ profileId: callerUser.id, schoolId: targetSchoolId, nama: teacherName, nip, jenisKelamin: gender, tugasUtama: 'Wali Kelas' });
        // Mode School
        let targetClassId = body.classId || null;
        if (!targetClassId || targetClassId === '__NEW_CLASS__') {
          const clsName = String(body.className || 'Kelas 5').trim();
          const clsGrade = Number(body.grade || 5);
          const { data: newCls } = await db.from('classes').insert({
            school_id: targetSchoolId,
            name: clsName,
            grade: clsGrade,
            academic_year: await getAcademicYear(targetSchoolId),
            wali_kelas_teacher_id: linkedTeacher.id,
          }).select('id').single();

          if (newCls) targetClassId = newCls.id;
        } else {
          await assignHomeroom(targetSchoolId, linkedTeacher.id, targetClassId, callerUser.id);
        }

      }

      // Upsert profile dengan penanganan robust
      const { data: existingProf } = await db.from('profiles').select('id, username').eq('id', callerUser.id).maybeSingle();
      const finalUsername = existingProf?.username || defaultUsername;

      const profilePayload: any = {
        id: callerUser.id,
        school_id: targetSchoolId,
        teacher_id: linkedTeacher.id,
        name: teacherName,
        username: finalUsername,
        email: userEmail,
        role: 'WALI KELAS',
        is_active: true,
        must_change_password: false,
      };

      const { error: profErr } = await db.from('profiles').upsert(profilePayload, { onConflict: 'id' });
      if (profErr) {
        console.error('Error upserting profile in onboard_homeroom:', profErr);
        const { error: fallbackProfileErr } = await db.from('profiles').update({
          school_id: targetSchoolId, name: teacherName, role: 'WALI KELAS', is_active: true,
        }).eq('id', callerUser.id);
        if (fallbackProfileErr) throw new Error(`Gagal menyimpan profil Wali Kelas: ${fallbackProfileErr.message}`);
      }

      try {
        await db.from('profiles').update({
          is_google_auth: true, auth_provider: 'google',
        }).eq('id', callerUser.id);
        await db.auth.admin.updateUserById(callerUser.id, {
          user_metadata: {
            workspace_type: mode === 'personal' ? 'personal' : 'school',
            registration_mode: mode === 'personal' ? 'personal' : 'school',
          }
        });
      } catch (_) {}

      // Upsert teacher record

      return json(res, 200, {
        ok: true,
        success: true,
        message: 'Ruang kerja Wali Kelas berhasil diaktifkan!',
        userId: callerUser.id,
        schoolId: targetSchoolId,
      });
    }

    // -------------------------------------------------------------
    // ONBOARD GURU MAPEL
    // -------------------------------------------------------------
    if (action === 'onboard_subject_teacher' || action === 'onboard_subject') {
      const mode = body.mode === 'personal' ? 'personal' : 'school';
      const teacherName = String(body.teacherName || defaultName).trim();
      const nip = String(body.nip || '-').trim();
      const gender = body.gender === 'P' ? 'P' : 'L';
      const phone = String(body.phone || '-').trim();
      const employmentStatus = String(body.employmentStatus || 'PNS').trim();
      const subjectName = String(body.subjectName || 'Pendidikan Jasmani / Agama').trim();
      await assertExistingProfileRole('GURU MAPEL');

      let targetSchoolId = body.schoolId || null;
      let linkedTeacher: any = null;

      if (mode === 'personal' || !targetSchoolId) {
        // Guru mapel yang onboard tanpa sekolah selalu diarahkan ke Ruang Kerja Individu (guru_gratis)
        const isPersonal = true;
        const wsName = 'Ruang Kerja Individu';
        const trial = calculateGuruProTrialPeriod();
        const inviteCode = generateSchoolInviteCode();
        const { data: newSchool, error: schoolErr } = await db.from('schools').insert({
          name: wsName,
          code: inviteCode,
          plan: trial.plan || 'guru_gratis',
          status: 'active',
          workspace_type: 'personal',
          is_personal: true,
          owner_id: callerUser.id,
          subscription_started_at: trial.startedAt,
          subscription_expires_at: null,
          max_teachers: 1,
          max_students: trial.maxStudents || 50,
          max_classes: trial.maxClasses || 1,
        }).select('id').single();

        if (schoolErr) throw schoolErr;
        targetSchoolId = newSchool.id;
        linkedTeacher = await ensureTeacherForAccount({ profileId: callerUser.id, schoolId: targetSchoolId, nama: teacherName, nip, jenisKelamin: gender, tugasUtama: 'Guru Mapel' });

        await db.from('school_profile').upsert({
          school_id: targetSchoolId,
          nama_sekolah: isPersonal ? '' : wsName,
          npsn: '',
          jenjang: 'SD',
          tahun_pelajaran: '2026/2027',
          semester: '1',
          kelas: '',
        }, { onConflict: 'school_id' });

        await db.from('system_config').delete().eq('school_id', targetSchoolId);
        await db.from('system_config').insert({
          school_id: targetSchoolId,
          app_title: 'Kawacanaan Presensi',
          app_subtitle: isPersonal ? '' : wsName,
        });

        // Ruang kerja individu (personal): Jangan buat kelas default.
        // Biarkan data kelas kosong agar pengguna menginput sendiri di Data Referensi -> Data Kelas.
        if (!isPersonal && body.className) {
          const clsName = String(body.className).trim();
          const clsGrade = Number(body.grade || 1);

          const { error: clsErr } = await db.from('classes').insert({
            school_id: targetSchoolId,
            name: clsName,
            grade: clsGrade,
            academic_year: await getAcademicYear(targetSchoolId),
          });
          if (clsErr) throw clsErr;

        }
      }

      if (!linkedTeacher) linkedTeacher = await ensureTeacherForAccount({ profileId: callerUser.id, schoolId: targetSchoolId, nama: teacherName, nip, jenisKelamin: gender, tugasUtama: 'Guru Mapel' });

      // Upsert profile dengan penanganan robust
      const { data: existingProf } = await db.from('profiles').select('id, username').eq('id', callerUser.id).maybeSingle();
      const finalUsername = existingProf?.username || defaultUsername;

      const profilePayload: any = {
        id: callerUser.id,
        school_id: targetSchoolId,
        teacher_id: linkedTeacher.id,
        name: teacherName,
        username: finalUsername,
        email: userEmail,
        role: 'GURU MAPEL',
        is_active: true,
        must_change_password: false,
      };

      const { error: profErr } = await db.from('profiles').upsert(profilePayload, { onConflict: 'id' });
      if (profErr) {
        console.error('Error upserting profile in onboard_subject_teacher:', profErr);
        const { error: fallbackProfileErr } = await db.from('profiles').update({
          school_id: targetSchoolId, name: teacherName, role: 'GURU MAPEL', is_active: true,
        }).eq('id', callerUser.id);
        if (fallbackProfileErr) throw new Error(`Gagal menyimpan profil Guru Mapel: ${fallbackProfileErr.message}`);
      }

      try {
        await db.from('profiles').update({
          is_google_auth: true, auth_provider: 'google',
        }).eq('id', callerUser.id);
        await db.auth.admin.updateUserById(callerUser.id, {
          user_metadata: {
            workspace_type: mode === 'personal' ? 'personal' : 'school',
            registration_mode: mode === 'personal' ? 'personal' : 'school',
          }
        });
      } catch (_) {}

      // Upsert teacher record
      // Upsert subject record
      const { data: existingSub } = await db.from('subjects').select('id').eq('school_id', targetSchoolId).ilike('name', subjectName).maybeSingle();
      let subjectRow = existingSub;
      if (!subjectRow) {
        const { data: createdSubject, error: subjectCreateError } = await db.from('subjects').insert({
          school_id: targetSchoolId,
          name: subjectName,
          code: String(subjectName || '').slice(0, 4).toUpperCase(),
          is_specialized: true,
        }).select('id').single();
        if (subjectCreateError) throw subjectCreateError;
        subjectRow = createdSubject;
      }
      if (linkedTeacher?.id && subjectRow?.id) {
        const classIds: string[] = mode === 'school' ? Array.from(new Set<string>((Array.isArray(body.classIds) ? body.classIds : []).map((v: any) => String(v)).filter(Boolean))) : [];
        if (mode === 'school' && classIds.length === 0) throw new Error('Guru Mapel wajib memilih minimal satu kelas yang diajar.');
        await assignSubject(targetSchoolId, subjectRow.id, linkedTeacher.id, classIds, callerUser.id);
      }

      return json(res, 200, {
        ok: true,
        success: true,
        message: 'Ruang kerja Guru Mata Pelajaran berhasil diaktifkan!',
        userId: callerUser.id,
        schoolId: targetSchoolId,
      });
    }

    // -------------------------------------------------------------
    // ONBOARD SISWA
    // -------------------------------------------------------------
    if (action === 'onboard_student') {
      const targetSchoolId = body.schoolId;
      const targetClassId = body.classId;
      const studentName = String(body.studentName || defaultName).trim();
      const gender = body.gender === 'P' ? 'P' : 'L';
      const nisn = String(body.nisn || '').replace(/\D/g, '').trim();

      if (!targetSchoolId || !targetClassId) {
        return json(res, 400, { error: 'Sekolah dan kelas wajib dipilih.' });
      }

      // Cari atau buat data siswa di tabel students
      let studentId: string | null = null;
      if (nisn) {
        const { data: matchedStudent } = await db.from('students').select('id').eq('school_id', targetSchoolId).eq('nisn', nisn).maybeSingle();
        if (matchedStudent) {
          studentId = matchedStudent.id;
        }
      }

      if (!studentId) {
        const fallbackNisn = nisn || `S${Date.now().toString().slice(-8)}`;
        const { data: newStudent, error: stuErr } = await db.from('students').insert({
          school_id: targetSchoolId,
          class_id: targetClassId,
          nama: studentName,
          gender,
          nisn: fallbackNisn,
        }).select('id').single();

        if (stuErr) throw stuErr;
        studentId = newStudent.id;
      }

      // Upsert profile siswa
      await db.from('profiles').upsert({
        id: callerUser.id,
        school_id: targetSchoolId,
        name: studentName,
        username: defaultUsername,
        email: userEmail,
        role: 'SISWA',
        student_id: studentId,
        is_active: true,
        is_google_auth: true,
        auth_provider: 'google',
        must_change_password: false,
      });

      return json(res, 200, {
        ok: true,
        success: true,
        message: 'Pendaftaran akun siswa berhasil! Membuka Portal Siswa...',
        userId: callerUser.id,
        schoolId: targetSchoolId,
      });
    }

    // -------------------------------------------------------------
    // DELETE TEACHER (HAPUS DATA GURU & SINKRONISASI DATABASE)
    // -------------------------------------------------------------
    if (action === 'delete_teacher') {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) return json(res, 401, { error: 'Sesi login diperlukan untuk menghapus data guru.' });
      const { data: authData, error: authErr } = await db.auth.getUser(token);
      if (authErr || !authData?.user) return json(res, 401, { error: 'Sesi login tidak valid atau telah kedaluwarsa.' });

      const teacherId = body.teacherId || body.id;
      let schoolId = body.schoolId || null;
      const teacherName = body.teacherName || null;

      if (!teacherId && !teacherName) {
        return json(res, 400, { error: 'ID guru atau nama guru wajib disertakan.' });
      }

      const callerUserId = authData.user.id;
      const { data: callerProf } = await db.from('profiles').select('id, role, school_id').eq('id', callerUserId).maybeSingle();
      const isSuper = callerProf?.role === 'SUPER_ADMIN';

      if (teacherId && !schoolId) {
        const { data: tch } = await db.from('teachers').select('school_id').eq('id', teacherId).maybeSingle();
        schoolId = tch?.school_id || null;
      }
      if (!schoolId) {
        schoolId = callerProf?.school_id || null;
      }

      let targetSch: any = null;
      if (schoolId) {
        const { data: sData } = await db.from('schools').select('owner_id, workspace_type, is_personal').eq('id', schoolId).maybeSingle();
        targetSch = sData;
      }

      const isPersonal = targetSch ? (targetSch.workspace_type === 'personal' || targetSch.workspace_type === 'individu' || targetSch.is_personal === true) : false;
      const isOwner = Boolean(targetSch && targetSch.owner_id === callerUserId);

      if (isPersonal) {
        if (!isSuper && !isOwner) {
          return json(res, 403, { error: 'Akses ditolak: Hanya pemilik yang dapat mengelola data guru di ruang kerja individu ini.' });
        }
      } else {
        const isSameSchoolAdmin = schoolId && callerProf?.school_id === schoolId && ['ADMIN', 'KEPALA SEKOLAH'].includes(callerProf?.role);
        if (!isSuper && !isSameSchoolAdmin && !isOwner) {
          return json(res, 403, { error: 'Akses ditolak: Hanya Administrator atau Kepala Sekolah yang dapat menghapus data guru.' });
        }
      }

      // 1. Hapus dari tabel teachers
      if (teacherId) {
        await db.from('teachers').delete().eq('id', teacherId);
      }
      if (schoolId && teacherName) {
        await db.from('teachers').delete().eq('school_id', schoolId).eq('nama', teacherName);
      }

      // 2. Hapus penugasan di classes
      if (teacherId) {
        await db.from('classes').update({ wali_kelas_teacher_id: null }).eq('wali_kelas_teacher_id', teacherId);
      }
      if (schoolId && teacherName) {
        await db.from('school_profile').update({ nama_wali_kelas: '', nip_wali_kelas: '' }).eq('school_id', schoolId).eq('nama_wali_kelas', teacherName);
      }

      // 3. Hapus seluruh penugasan guru secara terpadu (teacher_assignments & subject_teacher_assignments)
      if (teacherId) {
        await Promise.all([
          db.from('teacher_assignments').delete().eq('teacher_id', teacherId),
          db.from('subject_teacher_assignments').delete().eq('teacher_id', teacherId),
          db.from('teacher_class_assignments').delete().eq('teacher_id', teacherId),
        ]);
      }

      return json(res, 200, {
        ok: true,
        success: true,
        message: 'Data guru berhasil dihapus dari database.',
      });
    }

    // -------------------------------------------------------------
    // SAVE TEACHER (TAMBAH / PERBARUI DATA GURU)
    // -------------------------------------------------------------
    if (action === 'save_teacher') {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) return json(res, 401, { error: 'Sesi login diperlukan untuk menyimpan data guru.' });
      const { data: authData, error: authErr } = await db.auth.getUser(token);
      if (authErr || !authData?.user) return json(res, 401, { error: 'Sesi login tidak valid atau telah kedaluwarsa.' });

      const teacherId = body.teacherId || body.id;
      let schoolId = body.schoolId || null;
      const nama = String(body.nama || '').trim();
      const nip = String(body.nip || '').trim();
      const jenisKelamin = body.jenisKelamin || 'L';
      const tugasUtama = String(body.tugasUtama || body.tugas_utama || 'Wali Kelas').trim();

      if (!nama) {
        return json(res, 400, { error: 'Nama guru wajib diisi.' });
      }

      const callerUserId = authData.user.id;
      const { data: callerProf } = await db.from('profiles').select('id, role, school_id').eq('id', callerUserId).maybeSingle();
      const isSuper = callerProf?.role === 'SUPER_ADMIN';

      if (teacherId && !schoolId) {
        const { data: tch } = await db.from('teachers').select('school_id').eq('id', teacherId).maybeSingle();
        schoolId = tch?.school_id || null;
      }
      if (!schoolId) {
        schoolId = callerProf?.school_id || null;
      }

      let targetSch: any = null;
      if (schoolId) {
        const { data: sData } = await db.from('schools').select('owner_id, workspace_type, is_personal').eq('id', schoolId).maybeSingle();
        targetSch = sData;
      }

      const isPersonal = targetSch ? (targetSch.workspace_type === 'personal' || targetSch.workspace_type === 'individu' || targetSch.is_personal === true) : false;
      const isOwner = Boolean(targetSch && targetSch.owner_id === callerUserId);

      if (isPersonal) {
        if (!isSuper && !isOwner) {
          return json(res, 403, { error: 'Akses ditolak: Hanya pemilik yang dapat mengelola data guru di ruang kerja individu ini.' });
        }
      } else {
        const isSameSchoolAdmin = schoolId && callerProf?.school_id === schoolId && ['ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS'].includes(callerProf?.role);
        if (!isSuper && !isSameSchoolAdmin && !isOwner) {
          return json(res, 403, { error: 'Akses ditolak: Anda tidak memiliki hak akses untuk mengelola data guru di sekolah ini.' });
        }
      }

      if (teacherId) {
        const { data: updated, error: uErr } = await db
          .from('teachers')
          .update({
            nama,
            nip: nip || null,
            jenis_kelamin: jenisKelamin,
            tugas_utama: tugasUtama || null,
          })
          .eq('id', teacherId)
          .select()
          .maybeSingle();

        if (uErr) {
          console.error('Error updating teacher in onboarding:', uErr);
          return json(res, 500, { error: `Gagal memperbarui data guru: ${uErr.message}` });
        }

        if (updated) {
          // Sinkronkan nama profil yang tertaut ke teacher ini jika ada
          try {
            await db.from('profiles').update({ name: nama }).eq('teacher_id', teacherId);
            if (schoolId && tugasUtama === 'Wali Kelas') {
              await db.from('school_profile').update({
                nama_wali_kelas: nama,
                nip_wali_kelas: nip || null,
              }).eq('school_id', schoolId);
            }
          } catch (_) {}

          return json(res, 200, {
            ok: true,
            success: true,
            teacher: { ...updated, tugas_utama: updated.tugas_utama },
            teacherId: updated.id,
          });
        }
      }

      const { data: inserted, error: iErr } = await db
        .from('teachers')
        .insert({
          nama,
          nip: nip || null,
          jenis_kelamin: jenisKelamin,
          tugas_utama: tugasUtama || null,
          school_id: schoolId,
        })
        .select()
        .maybeSingle();

      if (iErr) {
        console.error('Error inserting teacher in onboarding:', iErr);
        return json(res, 500, { error: `Gagal menambahkan data guru: ${iErr.message}` });
      }

      return json(res, 200, {
        ok: true,
        success: true,
        teacher: { ...(inserted || {}), tugas_utama: inserted?.tugas_utama || tugasUtama },
        teacherId: inserted?.id,
      });
    }

    // -------------------------------------------------------------
    // SAVE STUDENT (TAMBAH / PERBARUI DATA SISWA)
    // -------------------------------------------------------------
    if (action === 'save_student') {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) return json(res, 401, { error: 'Sesi login diperlukan untuk menyimpan data siswa.' });
      const { data: authData, error: authErr } = await db.auth.getUser(token);
      if (authErr || !authData?.user) return json(res, 401, { error: 'Sesi login tidak valid atau telah kedaluwarsa.' });

      const callerUserId = authData.user.id;
      const { data: callerProf } = await db.from('profiles').select('id, role, school_id').eq('id', callerUserId).maybeSingle();
      const isSuper = callerProf?.role === 'SUPER_ADMIN';

      const studentId = body.studentId || body.id || null;
      let schoolId = body.schoolId || body.school_id || callerProf?.school_id || null;
      const nama = String(body.nama || '').trim();
      let gender: 'L' | 'P' = String(body.gender || 'L').toUpperCase() === 'P' ? 'P' : 'L';

      if (!nama) {
        return json(res, 400, { error: 'Nama lengkap siswa wajib diisi.' });
      }

      if (!schoolId) {
        schoolId = callerProf?.school_id || authData.user.user_metadata?.school_id || authData.user.user_metadata?.school_workspace_id;
      }

      if (!schoolId) {
        return json(res, 400, { error: 'ID sekolah / ruang kerja wajib disertakan.' });
      }

      let targetSch: any = null;
      if (schoolId) {
        const { data: sData } = await db.from('schools').select('owner_id, workspace_type, is_personal').eq('id', schoolId).maybeSingle();
        targetSch = sData;
      }

      const isPersonal = targetSch ? (targetSch.workspace_type === 'personal' || targetSch.workspace_type === 'individu' || targetSch.is_personal === true) : false;
      const isOwner = Boolean(targetSch && targetSch.owner_id === callerUserId);

      if (isPersonal) {
        if (!isSuper && !isOwner) {
          return json(res, 403, { error: 'Akses ditolak: Hanya pemilik yang dapat mengelola data siswa di ruang kerja individu ini.' });
        }
      } else {
        const isSameSchoolUser = callerProf?.school_id === schoolId;
        if (!isSuper && !isSameSchoolUser && !isOwner) {
          return json(res, 403, { error: 'Akses ditolak: Anda tidak memiliki hak akses untuk mengelola data siswa di sekolah ini.' });
        }
      }

      let classId = body.classId || body.class_id || null;
      if (!classId) {
        const { data: existingClass } = await db
          .from('classes')
          .select('id')
          .eq('school_id', schoolId)
          .limit(1)
          .maybeSingle();

        if (existingClass?.id) {
          classId = existingClass.id;
        } else {
          const { data: newCls } = await db
            .from('classes')
            .insert({
              school_id: schoolId,
              name: 'Kelas 1A',
              grade: 1,
              academic_year: '2026/2027',
            })
            .select('id')
            .maybeSingle();
          classId = newCls?.id || null;
        }
      }

      // Validasi batas maksimal 50 siswa per kelas (kebijakan sistem paket - Hard Block)
      if (classId) {
        let countQuery = db
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', classId);
        if (studentId) {
          countQuery = countQuery.neq('id', studentId);
        }
        const { count: studentCountInClass } = await countQuery;

        if ((studentCountInClass || 0) >= 50) {
          const { data: clsInfo } = await db.from('classes').select('name').eq('id', classId).maybeSingle();
          const clsName = clsInfo?.name || 'kelas ini';
          return json(res, 400, {
            error: `Kapasitas ${clsName} maksimal 50 siswa. Sistem menolak input karena kuota rombel telah mencapai batas maksimal (50 siswa).`,
          });
        }
      }

      // Validasi batas total siswa sesuai paket
      if (!studentId && schoolId) {
        const { data: sch } = await db.from('schools').select('plan, max_students, workspace_type').eq('id', schoolId).maybeSingle();
        const { count: totalStudents } = await db.from('students').select('id', { count: 'exact', head: true }).eq('school_id', schoolId);
        const isPersonalWs = sch?.workspace_type === 'personal';
        const normPlan = sch?.plan || 'guru_gratis';
        let maxAllowed = 1200;
        if (isPersonalWs) {
          if (normPlan === 'guru_pro') {
            maxAllowed = callerProf?.role === 'GURU MAPEL' ? 300 : 100;
          } else {
            maxAllowed = 100; // 2 kelas x 50 siswa
          }
        } else {
          maxAllowed = 1200;
        }
        if ((totalStudents || 0) >= maxAllowed) {
          return json(res, 400, {
            error: `Kapasitas total siswa telah mencapai batas maksimal (${maxAllowed} siswa).`,
          });
        }
      }

      let nisn = String(body.nisn || '').trim();
      if (!nisn || nisn === '-') {
        nisn = '99' + Math.floor(10000000 + Math.random() * 90000000);
      }

      let studentRow: any = null;
      if (studentId) {
        const { data: updated, error: uErr } = await db
          .from('students')
          .update({
            nama,
            gender,
            nisn,
            class_id: classId,
          })
          .eq('id', studentId)
          .eq('school_id', schoolId)
          .select('*, classes:class_id(id,name)')
          .maybeSingle();

        if (uErr) {
          console.error('Error updating student in onboarding:', uErr);
          return json(res, 500, { error: `Gagal memperbarui data siswa: ${uErr.message}` });
        }
        studentRow = updated;
      } else {
        const { data: inserted, error: iErr } = await db
          .from('students')
          .insert({
            school_id: schoolId,
            class_id: classId,
            nama,
            gender,
            nisn,
          })
          .select('*, classes:class_id(id,name)')
          .maybeSingle();

        if (iErr) {
          console.error('Error inserting student in onboarding:', iErr);
          return json(res, 500, { error: `Gagal menambahkan data siswa: ${iErr.message}` });
        }
        studentRow = inserted;
      }

      return json(res, 200, {
        ok: true,
        success: true,
        student: studentRow,
        studentId: studentRow?.id,
        message: `Data siswa ${nama} berhasil disimpan.`,
      });
    }

    // -------------------------------------------------------------
    // SAVE SYSTEM CONFIG (PENGATURAN SISTEM)
    // -------------------------------------------------------------
    if (action === 'save_system_config' || action === 'update_system_config') {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) return json(res, 401, { error: 'Sesi login diperlukan untuk menyimpan pengaturan sistem.' });
      const { data: authData, error: authErr } = await db.auth.getUser(token);
      if (authErr || !authData?.user) return json(res, 401, { error: 'Sesi login tidak valid atau telah kedaluwarsa.' });

      const callerUserId = authData.user.id;
      const { data: callerProf } = await db.from('profiles').select('id, role, school_id').eq('id', callerUserId).maybeSingle();
      const isSuper = callerProf?.role === 'SUPER_ADMIN';

      let schoolId = body.schoolId || body.school_id || callerProf?.school_id || null;
      if (!schoolId) {
        return json(res, 400, { error: 'ID ruang kerja / sekolah wajib disertakan.' });
      }

      let targetSch: any = null;
      if (schoolId) {
        const { data: sData } = await db.from('schools').select('owner_id, workspace_type, is_personal').eq('id', schoolId).maybeSingle();
        targetSch = sData;
      }

      const isPersonal = targetSch ? (targetSch.workspace_type === 'personal' || targetSch.workspace_type === 'individu' || targetSch.is_personal === true) : false;
      const isOwner = Boolean(targetSch && targetSch.owner_id === callerUserId);

      if (isPersonal) {
        if (!isSuper && !isOwner) {
          return json(res, 403, { error: 'Akses ditolak: Hanya pemilik yang dapat mengubah pengaturan ruang kerja individu ini.' });
        }
      } else {
        const isSameSchoolAdmin = callerProf?.school_id === schoolId && ['ADMIN', 'KEPALA SEKOLAH'].includes(callerProf?.role);
        if (!isSuper && !isSameSchoolAdmin && !isOwner) {
          return json(res, 403, { error: 'Akses ditolak: Hanya Administrator Sekolah atau Pemilik yang dapat mengubah pengaturan sistem.' });
        }
      }

      const payload: any = {
        school_id: schoolId,
        app_title: body.appTitle || body.app_title || 'Kawacanaan Presensi',
        app_subtitle: body.appSubtitle !== undefined ? body.appSubtitle : (body.app_subtitle || ''),
        footer_copyright: body.footerCopyright !== undefined ? body.footerCopyright : (body.footer_copyright || ''),
        school_logo_url: body.schoolLogoUrl !== undefined ? body.schoolLogoUrl : (body.school_logo_url || ''),
        letterhead_type: body.letterheadType || body.letterhead_type || 'standard_text',
        letterhead_image_url: body.letterheadImageUrl !== undefined ? body.letterheadImageUrl : (body.letterhead_image_url || ''),
        show_letterhead: body.showLetterhead !== undefined ? body.showLetterhead : (body.show_letterhead !== undefined ? body.show_letterhead : true),
        default_check_in_time: body.defaultCheckInTime || body.default_check_in_time || '06:30',
        default_check_out_time: body.defaultCheckOutTime || body.default_check_out_time || '12:20',
        report_place: body.reportPlace !== undefined ? body.reportPlace : (body.report_place || ''),
        report_date: body.reportDate !== undefined ? body.reportDate : (body.report_date || ''),
        pemerintah_daerah: body.pemerintahDaerah !== undefined ? body.pemerintahDaerah : (body.pemerintah_daerah || null),
        dinas_pendidikan: body.dinasPendidikan !== undefined ? body.dinasPendidikan : (body.dinas_pendidikan || null),
        active_study_days: Array.isArray(body.activeStudyDays) ? body.activeStudyDays : (Array.isArray(body.active_study_days) ? body.active_study_days : [1, 2, 3, 4, 5]),
        student_self_attendance_enabled: body.studentSelfAttendanceEnabled !== undefined ? body.studentSelfAttendanceEnabled : (body.student_self_attendance_enabled !== undefined ? body.student_self_attendance_enabled : true),
        check_in_start_time: body.checkInStartTime || body.check_in_start_time || '06:00',
        check_in_deadline_time: body.checkInDeadlineTime || body.check_in_deadline_time || '07:00',
        check_out_start_time: body.checkOutStartTime || body.check_out_start_time || '12:30',
        auto_mark_late: body.autoMarkLate !== undefined ? body.autoMarkLate : (body.auto_mark_late !== undefined ? body.auto_mark_late : true),
      };

      // Pola delete-then-insert aman dari trigger BEFORE UPDATE yang mencari kolom updated_at
      let updatedConfig: any = null;
      let cfgErr: any = null;

      try {
        await db.from('system_config').delete().eq('school_id', schoolId);
        const { data: insertedConfig, error: insErr } = await db
          .from('system_config')
          .insert(payload)
          .select()
          .maybeSingle();

        if (insErr) {
          cfgErr = insErr;
        } else {
          updatedConfig = insertedConfig;
        }
      } catch (err: any) {
        cfgErr = err;
      }

      if (cfgErr) {
        console.error('Error saving system_config in onboarding:', cfgErr);
        return json(res, 500, { error: `Gagal menyimpan pengaturan sistem: ${cfgErr.message}` });
      }

      return json(res, 200, {
        ok: true,
        success: true,
        config: updatedConfig || payload,
      });
    }

    if (action === 'save_class') {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) return json(res, 401, { error: 'Sesi login diperlukan untuk menyimpan data rombel kelas.' });
      const { data: authData, error: authErr } = await db.auth.getUser(token);
      if (authErr || !authData?.user) return json(res, 401, { error: 'Sesi login tidak valid atau telah kedaluwarsa.' });

      const callerUserId = authData.user.id;
      const { data: callerProf } = await db.from('profiles').select('id, role, school_id').eq('id', callerUserId).maybeSingle();
      const isSuper = callerProf?.role === 'SUPER_ADMIN';

      const classId = body.classId || body.id;
      const schoolId = body.schoolId || (body.school_id as string) || callerProf?.school_id || '';
      const name = String(body.name || '').trim();
      const grade = Number(body.grade) || 1;
      const academicYear = String(body.academicYear || body.academic_year || '2026/2027').trim();
      const waliKelasTeacherId = body.waliKelasTeacherId || null;

      if (!schoolId) {
        return json(res, 400, { error: 'ID sekolah / ruang kerja wajib tersedia.' });
      }
      if (!name) {
        return json(res, 400, { error: 'Nama rombel kelas wajib diisi.' });
      }

      let targetSch: any = null;
      if (schoolId) {
        const { data: sData } = await db.from('schools').select('owner_id, workspace_type, is_personal').eq('id', schoolId).maybeSingle();
        targetSch = sData;
      }

      const isPersonal = targetSch ? (targetSch.workspace_type === 'personal' || targetSch.workspace_type === 'individu' || targetSch.is_personal === true) : false;
      const isOwner = Boolean(targetSch && targetSch.owner_id === callerUserId);

      if (isPersonal) {
        if (!isSuper && !isOwner) {
          return json(res, 403, { error: 'Akses ditolak: Hanya pemilik yang dapat mengelola rombel kelas di ruang kerja individu ini.' });
        }
      } else {
        const isSameSchoolAuth = callerProf?.school_id === schoolId && ['ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL'].includes(callerProf?.role);
        if (!isSuper && !isSameSchoolAuth && !isOwner) {
          return json(res, 403, { error: 'Akses ditolak: Anda tidak memiliki wewenang untuk mengelola rombel kelas di sekolah ini.' });
        }
      }

      // Validasi batas kapasitas kelas berdasarkan ruang kerja & peran
      if (!classId) {
        const { count: currentClassCount } = await db
          .from('classes')
          .select('id', { count: 'exact', head: true })
          .eq('school_id', schoolId);

        const { data: schData } = await db
          .from('schools')
          .select('workspace_type, is_personal')
          .eq('id', schoolId)
          .maybeSingle();

        const isPersonalWs = schData?.workspace_type === 'personal' || schData?.is_personal === true;
        const callerRole = (callerProf?.role || '').toUpperCase().trim();

        if (isPersonalWs) {
          if (callerRole === 'GURU MAPEL') {
            if ((currentClassCount || 0) >= 6) {
              return json(res, 400, {
                error: 'Kapasitas Guru Mapel di Ruang Kerja Individu maksimal 6 kelas. Batas kuota rombel telah tercapai.',
              });
            }
          } else {
            // Wali Kelas: Kapasitas maksimal 2 kelas (setiap kelas maksimal 50 siswa)
            if ((currentClassCount || 0) >= 2) {
              return json(res, 400, {
                error: 'Kapasitas Wali Kelas di Ruang Kerja Individu maksimal 2 kelas (setiap kelas maksimal 50 siswa). Silakan perbarui rombel yang sudah ada.',
              });
            }
          }
        }
      }

      // Validasi duplikasi nama kelas di tahun ajaran yang sama
      let dupQuery = db.from('classes')
        .select('id')
        .eq('school_id', schoolId)
        .eq('academic_year', academicYear)
        .ilike('name', name);
      if (classId) {
        dupQuery = dupQuery.neq('id', classId);
      }
      const { data: dup } = await dupQuery.maybeSingle();
      if (dup) {
        return json(res, 400, { error: `Rombel "${name}" sudah ada pada tahun ajaran ${academicYear}.` });
      }

      // Jika ada wali kelas, pastikan 1 guru maksimal 2 rombel pada tahun ajaran yang sama
      if (waliKelasTeacherId) {
        let existingAssignedQuery = db.from('classes')
          .select('id, name')
          .eq('school_id', schoolId)
          .eq('academic_year', academicYear)
          .eq('wali_kelas_teacher_id', waliKelasTeacherId);
        if (classId) {
          existingAssignedQuery = existingAssignedQuery.neq('id', classId);
        }
        const { data: existingAssigned } = await existingAssignedQuery;
        const otherCount = (existingAssigned || []).length;

        if (otherCount >= 2) {
          const classNames = (existingAssigned || []).map((c: any) => c.name).join(', ');
          return json(res, 400, {
            error: `Pendidik ini sudah menjadi Wali Kelas untuk ${otherCount} rombel (${classNames}). Batas maksimal penugasan adalah 2 rombel per tahun ajaran.`,
          });
        }
      }

      let classRow: any = null;
      if (classId) {
        const { data: updated, error: uErr } = await db.from('classes')
          .update({
            name,
            grade,
            academic_year: academicYear,
            wali_kelas_teacher_id: waliKelasTeacherId,
          })
          .eq('id', classId)
          .select('*, wali:wali_kelas_teacher_id(id,nama)')
          .maybeSingle();
        if (uErr) throw uErr;
        classRow = updated;
      } else {
        const { data: inserted, error: iErr } = await db.from('classes')
          .insert({
            school_id: schoolId,
            name,
            grade,
            academic_year: academicYear,
            wali_kelas_teacher_id: waliKelasTeacherId,
          })
          .select('*, wali:wali_kelas_teacher_id(id,nama)')
          .maybeSingle();
        if (iErr) throw iErr;
        classRow = inserted;
      }

      // Sinkronkan profiles.class_ids dengan seluruh rombel yang dibina oleh guru ini (maksimal 2 rombel)
      if (waliKelasTeacherId) {
        const { data: allWaliClasses } = await db.from('classes')
          .select('id')
          .eq('school_id', schoolId)
          .eq('academic_year', academicYear)
          .eq('wali_kelas_teacher_id', waliKelasTeacherId);
        const allWaliClassIds = (allWaliClasses || []).map((c: any) => c.id);
        if (allWaliClassIds.length > 0) {
          await db.from('profiles')
            .update({ class_ids: allWaliClassIds, class_id: allWaliClassIds[0] })
            .eq('school_id', schoolId)
            .eq('teacher_id', waliKelasTeacherId);
        }
      }

      // Update school_profile.kelas jika ini ruang kerja personal
      try {
        const { data: schoolRow } = await db.from('schools').select('workspace_type,is_personal').eq('id', schoolId).maybeSingle();
        if (schoolRow?.workspace_type === 'personal' || schoolRow?.is_personal) {
          await db.from('school_profile').update({ kelas: name }).eq('school_id', schoolId);
        }
      } catch (_) {}

      return json(res, 200, {
        ok: true,
        success: true,
        class: classRow,
      });
    }

    if (action === 'delete_class') {
      const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
      if (!token) return json(res, 401, { error: 'Sesi login diperlukan untuk menghapus kelas.' });
      const { data: authData, error: authErr } = await db.auth.getUser(token);
      if (authErr || !authData?.user) return json(res, 401, { error: 'Sesi login tidak valid atau telah kedaluwarsa.' });

      const callerUserId = authData.user.id;
      const { data: callerProf } = await db.from('profiles').select('id, role, school_id').eq('id', callerUserId).maybeSingle();
      const isSuper = callerProf?.role === 'SUPER_ADMIN';

      const classId = body.classId || body.id;
      let schoolId = body.schoolId || (body.school_id as string) || '';
      if (!classId) return json(res, 400, { error: 'ID kelas wajib diisi.' });

      if (!schoolId) {
        const { data: cls } = await db.from('classes').select('school_id').eq('id', classId).maybeSingle();
        schoolId = cls?.school_id || callerProf?.school_id || '';
      }

      let targetSch: any = null;
      if (schoolId) {
        const { data: sData } = await db.from('schools').select('owner_id, workspace_type, is_personal').eq('id', schoolId).maybeSingle();
        targetSch = sData;
      }

      const isPersonal = targetSch ? (targetSch.workspace_type === 'personal' || targetSch.workspace_type === 'individu' || targetSch.is_personal === true) : false;
      const isOwner = Boolean(targetSch && targetSch.owner_id === callerUserId);

      if (isPersonal) {
        if (!isSuper && !isOwner) {
          return json(res, 403, { error: 'Akses ditolak: Hanya pemilik yang dapat menghapus rombel kelas di ruang kerja individu ini.' });
        }
      } else {
        const isSameSchoolAdmin = schoolId && callerProf?.school_id === schoolId && ['ADMIN', 'KEPALA SEKOLAH'].includes(callerProf?.role);
        if (!isSuper && !isSameSchoolAdmin && !isOwner) {
          return json(res, 403, { error: 'Akses ditolak: Hanya Administrator atau Kepala Sekolah yang dapat menghapus rombel kelas.' });
        }
      }

      const { data: stus } = await db.from('students').select('id').eq('class_id', classId).limit(1);
      if (stus && stus.length > 0) {
        return json(res, 400, { error: 'Tidak dapat menghapus kelas yang masih memiliki siswa.' });
      }

      const { error: dErr } = await db.from('classes').delete().eq('id', classId).eq('school_id', schoolId);
      if (dErr) throw dErr;

      return json(res, 200, { ok: true, success: true });
    }

    return json(res, 400, { error: `Aksi ${action} tidak dikenali.` });
  } catch (err: any) {
    console.error('Onboarding handler error:', err);
    return json(res, 500, { error: err.message || 'Terjadi kesalahan pada server onboarding.' });
  }
}
