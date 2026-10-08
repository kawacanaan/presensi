import { createClient } from '@supabase/supabase-js';

const json = (res: any, status: number, body: unknown) =>
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));

const cleanNip = (value: unknown) => String(value || '').replace(/\D/g, '');
const cleanName = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export default async function handler(req: any, res: any, env?: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Metode permintaan tidak diizinkan.' });

  const cfEnv = env || req?.env || {};
  const url = cfEnv.SUPABASE_URL || cfEnv.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = cfEnv.SUPABASE_SERVICE_ROLE_KEY || cfEnv.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !serviceKey) return json(res, 500, { error: 'SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib tersedia di Cloudflare Worker atau Vercel.' });

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(res, 401, { error: 'Sesi login tidak ditemukan.' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json(res, 401, { error: 'Sesi login tidak valid.' });

  const userId = authData.user.id;
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('id,school_id,name,username,role,teacher_id,class_ids,nip')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) return json(res, 400, { error: profileError.message });
  if (!profile) return json(res, 404, { error: 'Profil pengguna tidak ditemukan.' });
  if (!profile.school_id) return json(res, 400, { error: 'Akun belum memiliki sekolah aktif.' });

  const { data: sch } = await admin.from('schools').select('id, owner_id, workspace_type, is_personal').eq('id', profile.school_id).maybeSingle();
  if (sch && (sch.workspace_type === 'personal' || sch.workspace_type === 'individu' || sch.is_personal === true)) {
    if (sch.owner_id !== userId && profile.role !== 'SUPER_ADMIN') {
      return json(res, 403, { error: 'Akses ditolak: Anda bukan pemilik ruang kerja individu ini.' });
    }
  }

  const targetClassId = req.body?.classId || (Array.isArray(profile.class_ids) && profile.class_ids.length > 0 ? profile.class_ids[0] : null);

  let teacher: any = null;
  if (profile.teacher_id) {
    const { data } = await admin.from('teachers')
      .select('id,school_id,nama,nip,tugas_utama')
      .eq('id', profile.teacher_id)
      .eq('school_id', profile.school_id)
      .maybeSingle();
    teacher = data;
  }

  if (!teacher) {
    const nip = cleanNip(profile.username);
    if (nip.length >= 8) {
      const { data } = await admin.from('teachers')
        .select('id,school_id,nama,nip,tugas_utama')
        .eq('school_id', profile.school_id)
        .eq('nip', profile.username.trim())
        .maybeSingle();
      teacher = data;
    }
  }

  if (!teacher && profile.nip) {
    const profNip = cleanNip(profile.nip);
    if (profNip) {
      const { data } = await admin.from('teachers')
        .select('id,school_id,nama,nip,tugas_utama')
        .eq('school_id', profile.school_id)
        .eq('nip', profile.nip.trim())
        .maybeSingle();
      teacher = data;
    }
  }

  if (!teacher && profile.name) {
    const normalized = cleanName(profile.name);
    const { data: teachers } = await admin.from('teachers')
      .select('id,school_id,nama,nip,tugas_utama')
      .eq('school_id', profile.school_id);
    teacher = (teachers || []).find((t: any) => {
      const cleanT = cleanName(t.nama);
      return cleanT === normalized || (normalized.length >= 4 && (cleanT.includes(normalized) || normalized.includes(cleanT)));
    }) || null;
  }

  // Jika guru belum ada di database, auto-create agar relasi ID guru tidak pernah null
  if (!teacher) {
    const cleanUsernameNip = cleanNip(profile.username);
    const resolvedNip = cleanUsernameNip.length >= 8 ? profile.username.trim() : (profile.nip ? String(profile.nip).trim() : null);
    const { data: newTeacher, error: insertError } = await admin.from('teachers').insert({
      school_id: profile.school_id,
      nama: profile.name || profile.username || 'Wali Kelas',
      nip: resolvedNip,
      tugas_utama: profile.role === 'GURU MAPEL' ? 'Guru Mapel' : 'Wali Kelas',
      jenis_kelamin: 'L',
    }).select('id,school_id,nama,nip,tugas_utama').single();

    if (!insertError && newTeacher) {
      teacher = newTeacher;
    }
  }

  if (!teacher) {
    return json(res, 500, { error: 'Gagal membuat atau menemukan data guru untuk akun ini.' });
  }

  // Update profile jika teacher_id belum sinkron
  if (profile.teacher_id !== teacher.id) {
    await admin.from('profiles')
      .update({ teacher_id: teacher.id })
      .eq('id', userId)
      .eq('school_id', profile.school_id);
  }

  // Hubungkan kelas yang dipilih ke guru wali kelas ini (Maksimal 2 Rombel per Wali Kelas)
  if (targetClassId) {
    await admin.from('classes')
      .update({
        wali_kelas_teacher_id: teacher.id,
      })
      .eq('id', targetClassId)
      .eq('school_id', profile.school_id);

    // Ambil seluruh rombel yang terhubung ke guru ini
    const { data: currentClasses } = await admin
      .from('classes')
      .select('id,name')
      .eq('school_id', profile.school_id)
      .eq('wali_kelas_teacher_id', teacher.id);

    // Jika guru ini terdaftar di lebih dari 2 rombel, lepaskan kelebihan rombel selain targetClassId
    if (currentClasses && currentClasses.length > 2) {
      const otherClasses = currentClasses.filter((c: any) => c.id !== targetClassId);
      const classesToRelease = otherClasses.slice(1);
      for (const cls of classesToRelease) {
        await admin.from('classes')
          .update({
            wali_kelas_teacher_id: null,
          })
          .eq('id', cls.id)
          .eq('school_id', profile.school_id);
      }
    }

    // Ambil daftar ID final rombel binaan guru ini (maksimal 2)
    const { data: finalClasses } = await admin
      .from('classes')
      .select('id')
      .eq('school_id', profile.school_id)
      .eq('wali_kelas_teacher_id', teacher.id);

    const finalClassIds = (finalClasses || []).map((c: any) => c.id);

    // Sinkronkan profiles.class_ids dengan seluruh kelas binaan
    await admin.from('profiles')
      .update({
        class_ids: finalClassIds.length > 0 ? finalClassIds : [targetClassId],
        class_id: targetClassId,
      })
      .eq('id', userId)
      .eq('school_id', profile.school_id);
  }

  return json(res, 200, {
    ok: true,
    teacherId: teacher.id,
    teacherName: teacher.nama,
    classId: targetClassId || null,
  });
}
