import { createClient, SupabaseClient } from '@supabase/supabase-js';

const json = (res: any, status: number, body: unknown) =>
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));

export async function reconcileTeacherAssignments(
  admin: SupabaseClient,
  schoolId: string,
  academicYear: string = '2026/2027'
) {
  if (!schoolId) return { ok: false, count: 0, error: 'school_id wajib diisi' };

  // 1. Ambil seluruh kelas yang memiliki wali kelas
  const { data: classes, error: classErr } = await admin
    .from('classes')
    .select('id, school_id, academic_year, wali_kelas_teacher_id')
    .eq('school_id', schoolId)
    .not('wali_kelas_teacher_id', 'is', null);

  if (classErr) return { ok: false, count: 0, error: classErr.message };

  // 2. Ambil penugasan Guru Mapel (guru <-> mapel dan mapel <-> kelas)
  const [{ data: sta, error: staErr }, { data: sca, error: scaErr }] = await Promise.all([
    admin
      .from('subject_teacher_assignments')
      .select('school_id, subject_id, teacher_id, academic_year')
      .eq('school_id', schoolId),
    admin
      .from('subject_class_assignments')
      .select('school_id, subject_id, class_id, academic_year')
      .eq('school_id', schoolId),
  ]);

  if (staErr) return { ok: false, count: 0, error: staErr.message };
  if (scaErr) return { ok: false, count: 0, error: scaErr.message };

  const unifiedRows: Array<{
    school_id: string;
    teacher_id: string;
    role: 'WALI_KELAS' | 'GURU_MAPEL';
    class_id: string | null;
    subject_id: string | null;
    academic_year: string;
    is_active: boolean;
  }> = [];

  // Baris penugasan Wali Kelas (Eksklusif: 1 Guru = 1 Rombel per Tahun Ajaran)
  const assignedHomeroomTeachers = new Set<string>();
  for (const c of classes || []) {
    if (c.wali_kelas_teacher_id) {
      const year = c.academic_year || academicYear;
      const key = `${c.wali_kelas_teacher_id}_${year}`;
      if (!assignedHomeroomTeachers.has(key)) {
        assignedHomeroomTeachers.add(key);
        unifiedRows.push({
          school_id: c.school_id,
          teacher_id: c.wali_kelas_teacher_id,
          role: 'WALI_KELAS',
          class_id: c.id,
          subject_id: null,
          academic_year: year,
          is_active: true,
        });
      }
    }
  }

  // Baris penugasan Guru Mapel
  for (const st of sta || []) {
    const matchedClasses = (sca || []).filter((sc) => sc.subject_id === st.subject_id);
    if (matchedClasses.length > 0) {
      for (const mc of matchedClasses) {
        unifiedRows.push({
          school_id: st.school_id,
          teacher_id: st.teacher_id,
          role: 'GURU_MAPEL',
          class_id: mc.class_id,
          subject_id: st.subject_id,
          academic_year: st.academic_year || academicYear,
          is_active: true,
        });
      }
    } else {
      unifiedRows.push({
        school_id: st.school_id,
        teacher_id: st.teacher_id,
        role: 'GURU_MAPEL',
        class_id: null,
        subject_id: st.subject_id,
        academic_year: st.academic_year || academicYear,
        is_active: true,
      });
    }
  }

  // Hapus data penugasan lama di teacher_assignments untuk sekolah ini
  const { error: delErr } = await admin
    .from('teacher_assignments')
    .delete()
    .eq('school_id', schoolId);

  if (delErr) {
    console.warn('[syncTeacherAssignments] Gagal menghapus data lama di teacher_assignments:', delErr.message);
  }

  let insertedCount = 0;
  if (unifiedRows.length > 0) {
    const { data: inserted, error: insErr } = await admin
      .from('teacher_assignments')
      .insert(unifiedRows)
      .select('id');

    if (insErr) {
      console.error('[syncTeacherAssignments] Gagal insert ke teacher_assignments:', insErr.message);
      return { ok: false, count: 0, error: insErr.message };
    }
    insertedCount = inserted?.length || 0;
  }

  return { ok: true, count: insertedCount, error: null };
}

const ALLOWED_ROLES = ['ADMIN', 'SUPER_ADMIN', 'KEPALA SEKOLAH', 'GURU MAPEL'];

export default async function handler(req: any, res: any, env?: any) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Metode permintaan tidak diizinkan.' });
  }

  const cfEnv = env || req?.env || {};
  const url = cfEnv.SUPABASE_URL || cfEnv.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = cfEnv.SUPABASE_SERVICE_ROLE_KEY || cfEnv.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !serviceKey) {
    return json(res, 500, { error: 'SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum dikonfigurasi di Cloudflare Worker atau Vercel.' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(res, 401, { error: 'Sesi login tidak ditemukan.' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json(res, 401, { error: 'Sesi login tidak valid.' });

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id, school_id, role, teacher_id, username, name')
    .eq('id', authData.user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    return json(res, 403, { error: 'Profil pengguna tidak ditemukan.' });
  }

  const body = req.body || {};
  const action = body.action || 'sync';
  const schoolId = body.schoolId || body.school_id || profile.school_id;

  if (!schoolId) {
    return json(res, 400, { error: 'ID sekolah aktif tidak ditemukan.' });
  }

  if (profile.role !== 'SUPER_ADMIN' && profile.school_id && profile.school_id !== schoolId) {
    return json(res, 403, { error: 'Akses ke data sekolah tersebut tidak diizinkan.' });
  }

  const { data: sch } = await admin.from('schools').select('id, owner_id, workspace_type, is_personal').eq('id', schoolId).maybeSingle();
  if (sch && (sch.workspace_type === 'personal' || sch.workspace_type === 'individu' || sch.is_personal === true)) {
    if (sch.owner_id !== authData.user.id && profile.role !== 'SUPER_ADMIN') {
      return json(res, 403, { error: 'Akses ditolak: Anda bukan pemilik ruang kerja individu ini.' });
    }
  }

  const academicYear = String(body.academicYear || body.academic_year || '2026/2027').trim();

  // 1. Simpan Mata Pelajaran & Jadwal
  if (action === 'save_subject') {
    if (!ALLOWED_ROLES.includes(profile.role)) {
      return json(res, 403, { error: 'Role pengguna Anda tidak memiliki wewenang mengelola mata pelajaran.' });
    }

    try {
      const subjectName = String(body.name || '').trim();
      if (!subjectName) {
        return json(res, 400, { error: 'Nama mata pelajaran wajib diisi.' });
      }

      const subjectCode = (String(body.code || '').trim() || subjectName.slice(0, 4)).toUpperCase();
      const targetClassIds: string[] = Array.isArray(body.targetClassIds) ? body.targetClassIds : [];
      const scheduleDays: string[] = Array.isArray(body.scheduleDays) ? body.scheduleDays : [];
      const classSchedules: Array<{
        classId: string;
        className?: string;
        days: string[];
        startTime?: string;
        endTime?: string;
      }> = Array.isArray(body.classSchedules) ? body.classSchedules : [];

      let teacherId = body.teacherId || null;

      if (!teacherId && profile.role === 'GURU MAPEL') {
        if (profile.teacher_id) {
          teacherId = profile.teacher_id;
        } else {
          const { data: matchedTeachers } = await admin
            .from('teachers')
            .select('id, nama, nip')
            .eq('school_id', schoolId);

          const found = (matchedTeachers || []).find(
            (t) => (t.nip && t.nip === profile.username) || (t.nama && t.nama.toLowerCase() === profile.name.toLowerCase())
          );
          if (found) {
            teacherId = found.id;
            await admin.from('profiles').update({ teacher_id: found.id }).eq('id', profile.id);
          }
        }
      }

      let subjectId = body.id || null;

      if (subjectId) {
        const { error: updErr } = await admin
          .from('subjects')
          .update({
            name: subjectName,
            code: subjectCode,
            is_specialized: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', subjectId)
          .eq('school_id', schoolId);

        if (updErr) throw updErr;
      } else {
        const { data: newSub, error: insErr } = await admin
          .from('subjects')
          .insert({
            school_id: schoolId,
            name: subjectName,
            code: subjectCode,
            is_specialized: true,
          })
          .select('id')
          .single();

        if (insErr) throw insErr;
        subjectId = newSub.id;
      }

      if (teacherId) {
        await admin
          .from('subject_teacher_assignments')
          .delete()
          .eq('school_id', schoolId)
          .eq('subject_id', subjectId)
          .eq('academic_year', academicYear);

        const { error: insTeacherErr } = await admin
          .from('subject_teacher_assignments')
          .insert({
            school_id: schoolId,
            subject_id: subjectId,
            teacher_id: teacherId,
            academic_year: academicYear,
          });

        if (insTeacherErr) {
          console.warn('[sync-teacher-assignments] Warning saat menyimpan subject_teacher_assignments:', insTeacherErr.message);
        }
      }

      await admin
        .from('subject_class_assignments')
        .delete()
        .eq('school_id', schoolId)
        .eq('subject_id', subjectId)
        .eq('academic_year', academicYear);

      if (targetClassIds.length > 0) {
        const scaRows = targetClassIds.map((cid) => ({
          school_id: schoolId,
          subject_id: subjectId,
          class_id: cid,
          academic_year: academicYear,
        }));

        const { error: insClassErr } = await admin
          .from('subject_class_assignments')
          .insert(scaRows);

        if (insClassErr) {
          console.warn('[sync-teacher-assignments] Warning saat menyimpan subject_class_assignments:', insClassErr.message);
        }
      }

      await admin
        .from('subject_schedule_days')
        .delete()
        .eq('school_id', schoolId)
        .eq('subject_id', subjectId);

      const scheduleInserts: Array<{
        school_id: string;
        subject_id: string;
        day_of_week: string;
        lesson_period: string | null;
      }> = [];

      if (classSchedules.length > 0) {
        classSchedules.forEach((cs) => {
          const timeInfo = cs.startTime && cs.endTime ? `@${cs.startTime}-${cs.endTime}` : '';
          (cs.days || []).forEach((d) => {
            scheduleInserts.push({
              school_id: schoolId,
              subject_id: subjectId,
              day_of_week: d,
              lesson_period: `cls:${cs.classId}${timeInfo}`,
            });
          });
        });
      } else if (scheduleDays.length > 0) {
        scheduleDays.forEach((d) => {
          scheduleInserts.push({
            school_id: schoolId,
            subject_id: subjectId,
            day_of_week: d,
            lesson_period: null,
          });
        });
      }

      if (scheduleInserts.length > 0) {
        const { error: insSchedErr } = await admin
          .from('subject_schedule_days')
          .insert(scheduleInserts);

        if (insSchedErr) {
          console.warn('[sync-teacher-assignments] Warning saat menyimpan subject_schedule_days:', insSchedErr.message);
        }
      }

      try {
        await reconcileTeacherAssignments(admin, schoolId, academicYear);
      } catch (recErr: any) {
        console.warn('[sync-teacher-assignments] Warning saat rekonsiliasi penugasan:', recErr?.message);
      }

      return json(res, 200, {
        ok: true,
        subjectId,
        message: `Mata pelajaran ${subjectName} berhasil disimpan.`,
      });
    } catch (err: any) {
      console.error('[sync-teacher-assignments] Error save_subject:', err);
      return json(res, 500, {
        error: err?.message || 'Terjadi kesalahan sistem saat menyimpan mata pelajaran.',
      });
    }
  }

  // 2. Hapus Mata Pelajaran
  if (action === 'delete_subject') {
    if (!ALLOWED_ROLES.includes(profile.role)) {
      return json(res, 403, { error: 'Role pengguna Anda tidak memiliki wewenang mengelola mata pelajaran.' });
    }

    try {
      const subjectId = body.id;
      if (!subjectId) {
        return json(res, 400, { error: 'ID mata pelajaran wajib disertakan.' });
      }

      await admin.from('subject_schedule_days').delete().eq('subject_id', subjectId).eq('school_id', schoolId);
      await admin.from('subject_class_assignments').delete().eq('subject_id', subjectId).eq('school_id', schoolId);
      await admin.from('subject_teacher_assignments').delete().eq('subject_id', subjectId).eq('school_id', schoolId);

      const { error: delErr } = await admin
        .from('subjects')
        .delete()
        .eq('id', subjectId)
        .eq('school_id', schoolId);

      if (delErr) throw delErr;

      try {
        await reconcileTeacherAssignments(admin, schoolId, academicYear);
      } catch (recErr: any) {
        console.warn('[sync-teacher-assignments] Warning saat rekonsiliasi hapus:', recErr?.message);
      }

      return json(res, 200, {
        ok: true,
        message: 'Mata pelajaran berhasil dihapus.',
      });
    } catch (err: any) {
      console.error('[sync-teacher-assignments] Error delete_subject:', err);
      return json(res, 500, {
        error: err?.message || 'Terjadi kesalahan sistem saat menghapus mata pelajaran.',
      });
    }
  }

  // 3. Default: Rekonsiliasi tabel terpadu teacher_assignments
  const result = await reconcileTeacherAssignments(admin, schoolId, academicYear);

  if (!result.ok) {
    return json(res, 400, { error: result.error || 'Gagal merekonsiliasi penugasan guru.' });
  }

  return json(res, 200, {
    ok: true,
    message: `Berhasil merekonsiliasi ${result.count} penugasan guru ke tabel terpadu teacher_assignments.`,
    count: result.count,
  });
}
