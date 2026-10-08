import { createClient } from '@supabase/supabase-js';

const json = (res: any, status: number, body: unknown) =>
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));

const ALLOWED_ROLES = ['ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL', 'SISWA'] as const;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,63}$/i;
const PASSWORD_MIN = 8;

type Role = typeof ALLOWED_ROLES[number];

async function reconcileTeacherAssignments(
  admin: any,
  schoolId: string,
  academicYear: string = '2026/2027'
) {
  if (!schoolId) return { ok: false, count: 0, error: 'school_id wajib diisi' };
  try {
    const { data: classes } = await admin
      .from('classes')
      .select('id, school_id, academic_year, wali_kelas_teacher_id')
      .eq('school_id', schoolId)
      .not('wali_kelas_teacher_id', 'is', null);

    const [{ data: sta }, { data: sca }] = await Promise.all([
      admin
        .from('subject_teacher_assignments')
        .select('school_id, subject_id, teacher_id, academic_year')
        .eq('school_id', schoolId),
      admin
        .from('subject_class_assignments')
        .select('school_id, subject_id, class_id, academic_year')
        .eq('school_id', schoolId),
    ]);

    const unifiedRows: Array<{
      school_id: string;
      teacher_id: string;
      role: 'WALI_KELAS' | 'GURU_MAPEL';
      class_id: string | null;
      subject_id: string | null;
      academic_year: string;
      is_active: boolean;
    }> = [];

    for (const c of classes || []) {
      if (c.wali_kelas_teacher_id) {
        unifiedRows.push({
          school_id: c.school_id,
          teacher_id: c.wali_kelas_teacher_id,
          role: 'WALI_KELAS',
          class_id: c.id,
          subject_id: null,
          academic_year: c.academic_year || academicYear,
          is_active: true,
        });
      }
    }

    for (const st of sta || []) {
      const matchedClasses = (sca || []).filter((sc: any) => sc.subject_id === st.subject_id);
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

    await admin.from('teacher_assignments').delete().eq('school_id', schoolId);
    if (unifiedRows.length > 0) {
      await admin.from('teacher_assignments').insert(unifiedRows);
    }
    return { ok: true, count: unifiedRows.length };
  } catch (err: any) {
    return { ok: false, count: 0, error: err?.message };
  }
}

export default async function handler(req: any, res: any, env?: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Metode permintaan tidak diizinkan.' });

  const cfEnv = env || req?.env || {};
  const url = cfEnv.SUPABASE_URL || cfEnv.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = cfEnv.SUPABASE_SERVICE_ROLE_KEY || cfEnv.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !serviceKey) return json(res, 500, { error: 'SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib tersedia di Cloudflare Worker atau Vercel.' });

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(res, 401, { error: 'Sesi login tidak ditemukan.' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: callerErr } = await admin.auth.getUser(token);
  if (callerErr || !caller.user) return json(res, 401, { error: 'Sesi login tidak valid.' });

  const { data: profile } = await admin
    .from('profiles')
    .select('id,role,school_id,name,username')
    .eq('id', caller.user.id)
    .maybeSingle();

  // Role dapat bersumber dari profiles ataupun auth user_metadata (kecuali SUPER_ADMIN wajib dari database profiles)
  const rawMetaRole = String(
    caller.user.user_metadata?.school_workspace_role ||
    caller.user.user_metadata?.role ||
    ''
  ).trim().toUpperCase();
  const safeMetaRole = rawMetaRole === 'SUPER_ADMIN' ? '' : rawMetaRole;
  const callerRole = String(
    profile?.role ||
    safeMetaRole ||
    ''
  ).trim().toUpperCase();

  const body = req.body || {};
  const action = body.action;
  const role = body.role as Role | undefined;
  const callerSchoolId = profile?.school_id || caller.user.user_metadata?.school_workspace_id || caller.user.user_metadata?.school_id || null;
  const requestedSchoolId = callerRole === 'SUPER_ADMIN'
    ? (body.schoolId || body.school_id || callerSchoolId)
    : (callerSchoolId || body.schoolId || body.school_id);
  const schoolId = requestedSchoolId;

  // Verifikasi data workspace target
  let targetSchoolData: any = null;
  if (schoolId) {
    const { data: sch } = await admin
      .from('schools')
      .select('id, owner_id, is_personal, workspace_type')
      .eq('id', schoolId)
      .maybeSingle();
    targetSchoolData = sch;
  }

  const isPersonalWorkspace = targetSchoolData
    ? (targetSchoolData.workspace_type === 'personal' ||
       targetSchoolData.workspace_type === 'individu' ||
       targetSchoolData.is_personal === true)
    : false;

  // Ruang kerja individu dimiliki oleh user yang sama dengan owner_id (atau self-heal jika owner_id kosong pada sekolah user tersebut)
  const isOwner = Boolean(
    targetSchoolData &&
      (targetSchoolData.owner_id === caller.user.id ||
        (isPersonalWorkspace && !targetSchoolData.owner_id && callerSchoolId && targetSchoolData.id === callerSchoolId))
  );
  const isPersonalOwner = isPersonalWorkspace && isOwner;

  // Proteksi mutlak Ruang Kerja Individu: jika target adalah personal, HANYA pemilik sah atau SUPER_ADMIN yang boleh mengakses
  if (isPersonalWorkspace && !isOwner && callerRole !== 'SUPER_ADMIN') {
    return json(res, 403, { error: 'Akses ditolak: Hanya pemilik yang dapat mengelola Ruang Kerja Individu ini.' });
  }

  const studentAndClassActions = [
    'import_students',
    'save_student',
    'delete_student',
    'delete_students_by_class',
    'import_classes',
    'save_class',
    'delete_class',
    'import_teachers',
  ];
  const isStudentOrClassAction = studentAndClassActions.includes(action);
  const isTeacherOrWali = ['WALI KELAS', 'GURU MAPEL', 'KEPALA SEKOLAH'].includes(callerRole);
  const isSchoolAdmin = ['ADMIN', 'SUPER_ADMIN', 'ADMIN SEKOLAH', 'KEPALA SEKOLAH'].includes(callerRole);
  const isSameSchoolUser = Boolean(callerSchoolId && schoolId && callerSchoolId === schoolId);

  const isAuthorizedAdmin =
    callerRole === 'SUPER_ADMIN' ||
    isPersonalOwner ||
    (isOwner && !isPersonalWorkspace) ||
    (isSameSchoolUser && isSchoolAdmin) ||
    (isStudentOrClassAction && isSameSchoolUser && isTeacherOrWali);

  if (!isAuthorizedAdmin) {
    return json(res, 403, { error: 'Hanya ADMIN sekolah atau SUPER ADMIN yang dapat mengelola akun.' });
  }

  const getAcademicYear = async (id: string) => {
    const { data } = await admin.from('school_profile').select('tahun_pelajaran').eq('school_id', id).maybeSingle();
    return String(data?.tahun_pelajaran || '2026/2027').trim() || '2026/2027';
  };

  const targetSchool = async (id: string | null) => {
    if (!id) return null;
    const { data } = await admin.from('schools').select('id').eq('id', id).maybeSingle();
    return data;
  };

  const ensureSameSchool = async (targetId: string, allowSuperAdmin = true) => {
    if (callerRole === 'SUPER_ADMIN' && allowSuperAdmin) return true;
    const { data: targetProfile } = await admin.from('profiles').select('id, school_id').eq('id', targetId).maybeSingle();
    if (!targetProfile || !targetProfile.school_id) return false;

    const targetSchoolId = targetProfile.school_id;

    const { data: targetSch } = await admin
      .from('schools')
      .select('id, owner_id, workspace_type, is_personal')
      .eq('id', targetSchoolId)
      .maybeSingle();

    if (!targetSch) return false;

    const isPersonal =
      targetSch.workspace_type === 'personal' ||
      targetSch.workspace_type === 'individu' ||
      targetSch.is_personal === true;

    if (isPersonal) {
      // Ruang kerja individu HANYA boleh dikelola oleh pemilik sahnya
      return targetSch.owner_id === caller.user.id || (!targetSch.owner_id && callerSchoolId === targetSchoolId);
    }

    // Sekolah institusi:
    if (targetSch.owner_id === caller.user.id) return true;
    if (callerSchoolId && targetSchoolId === callerSchoolId) {
      return ['ADMIN', 'KEPALA SEKOLAH', 'ADMIN SEKOLAH'].includes(callerRole);
    }
    return false;
  };

  try {
    if (action === 'create') {
      const name = String(body.name || '').trim();
      const username = String(body.username || '').trim().toLowerCase();
      const password = String(body.password || '');
      const email = String(body.email || '').trim().toLowerCase();
      const studentId = body.studentId || null;
      const classIds = [...new Set((Array.isArray(body.classIds) ? body.classIds : []).map((v: any) => String(v)).filter(Boolean))];
      const subjectId = body.subjectId ? String(body.subjectId) : null;
      const subjectName = body.subjectName ? String(body.subjectName).trim() : null;

      if (!name || !username || !password || !role) return json(res, 400, { error: 'Nama, username, password, dan role wajib diisi.' });
      if (!ALLOWED_ROLES.includes(role)) return json(res, 400, { error: 'Role pengguna tidak valid.' });
      if (!USERNAME_RE.test(username)) return json(res, 400, { error: 'Username harus 3-64 karakter dan hanya boleh huruf, angka, titik, garis bawah, atau tanda hubung.' });
      if (password.length < PASSWORD_MIN) return json(res, 400, { error: `Password minimal ${PASSWORD_MIN} karakter.` });
      if (!schoolId) return json(res, 400, { error: 'Sekolah pengguna belum ditentukan.' });
      if (profile.role !== 'SUPER_ADMIN' && role === 'ADMIN' && profile.school_id !== schoolId) return json(res, 403, { error: 'Akses sekolah tidak sesuai.' });

      if (role === 'SISWA') {
        if (!studentId) return json(res, 400, { error: 'Akun SISWA wajib terhubung dengan data siswa.' });
        const { data: student } = await admin.from('students').select('id,school_id').eq('id', studentId).maybeSingle();
        if (!student || student.school_id !== schoolId) return json(res, 400, { error: 'Data siswa tidak ditemukan di sekolah yang dipilih.' });
      } else if (studentId) {
        return json(res, 400, { error: 'studentId hanya boleh digunakan untuk akun SISWA.' });
      }

      if (classIds.length && !['WALI KELAS', 'GURU MAPEL'].includes(role)) return json(res, 400, { error: 'Penugasan kelas hanya untuk WALI KELAS/GURU MAPEL.' });
      if (role === 'WALI KELAS' && classIds.length > 1) return json(res, 400, { error: 'Wali Kelas hanya boleh memiliki 1 kelas.' });
      if (classIds.length) {
        const { data: classes, error: classErr } = await admin.from('classes').select('id').eq('school_id', schoolId).in('id', classIds);
        if (classErr) return json(res, 400, { error: classErr.message });
        if ((classes || []).length !== classIds.length) return json(res, 400, { error: 'Ada kelas yang bukan milik sekolah pengguna.' });
      }

      const { data: duplicate } = await admin.from('profiles').select('id,school_id').eq('username', username).maybeSingle();
      if (duplicate && duplicate.school_id !== schoolId) {
        return json(res, 409, { error: 'Username sudah digunakan oleh pengguna di sekolah lain.' });
      }

      const authEmail = email || `${username}@login.edushift.local`;
      let authUserId: string | null = null;
      const { data: authData, error: authErr } = await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: { name, username, role, school_id: schoolId },
      });

      if (authErr || !authData?.user) {
        if (authErr && (authErr.message?.toLowerCase().includes('already') || authErr.message?.toLowerCase().includes('exists') || duplicate)) {
          if (duplicate) {
            authUserId = duplicate.id;
          } else {
            const { data: userList } = await admin.auth.admin.listUsers();
            const existingAuthUser = (userList?.users || []).find((u) => u.email === authEmail);
            if (existingAuthUser) {
              authUserId = existingAuthUser.id;
            }
          }
          if (authUserId) {
            const { data: existingProfRole } = await admin.from('profiles').select('role').eq('id', authUserId).maybeSingle();
            if (String(existingProfRole?.role || '').toUpperCase().trim() === 'SUPER_ADMIN') {
              return json(res, 403, { error: 'Tidak diizinkan mengubah atau menimpa akun Super Admin.' });
            }
            await admin.auth.admin.updateUserById(authUserId, {
              password,
              user_metadata: { name, username, role, school_id: schoolId },
            });
          } else {
            return json(res, 400, { error: authErr?.message || 'Gagal membuat akun Auth Supabase.' });
          }
        } else {
          return json(res, 400, { error: authErr?.message || 'Gagal membuat akun Auth Supabase.' });
        }
      } else {
        authUserId = authData.user.id;
      }

      if (!authUserId) {
        return json(res, 400, { error: 'Gagal memperoleh ID pengguna autentikasi.' });
      }

      const { error: profileError } = await admin.from('profiles').upsert({
        id: authUserId,
        school_id: schoolId,
        name,
        username,
        email: authEmail,
        role,
        student_id: role === 'SISWA' ? studentId : null,
        is_active: true,
        must_change_password: false,
      });
      if (profileError) {
        return json(res, 400, { error: profileError.message });
      }

      let teacherId: string | null = body.teacherId || null;
      let teacher: any = null;
      if (role === 'WALI KELAS' || role === 'GURU MAPEL') {
        if (teacherId) {
          const { data: t } = await admin.from('teachers').select('id,tugas_utama,nama,nip').eq('school_id', schoolId).eq('id', teacherId).maybeSingle();
          teacher = t;
        }
        if (!teacher) {
          const normalizedNip = (username || '').trim();
          if (normalizedNip && normalizedNip !== '-') {
            const { data: existingTeacher } = await admin.from('teachers')
              .select('id,tugas_utama,nama,nip').eq('school_id', schoolId).eq('nip', normalizedNip).maybeSingle();
            teacher = existingTeacher;
          }
        }
        if (!teacher && name) {
          const { data: existingByName } = await admin.from('teachers')
            .select('id,tugas_utama,nama,nip').eq('school_id', schoolId).ilike('nama', name.trim()).maybeSingle();
          teacher = existingByName;
        }
        if (teacher) {
          teacherId = teacher.id;
          const desiredTugas = role === 'WALI KELAS' ? 'Wali Kelas' : 'Guru Mapel';
          await admin.from('teachers').update({ tugas_utama: desiredTugas }).eq('id', teacherId).eq('school_id', schoolId);
        } else {
          const { data: insertedTeacher, error: teacherError } = await admin.from('teachers').insert({
            school_id: schoolId,
            nama: name,
            nip: (username && !username.startsWith('guru_') && !username.startsWith('ks_')) ? username : null,
            jenis_kelamin: 'L',
            tugas_utama: role === 'WALI KELAS' ? 'Wali Kelas' : 'Guru Mapel',
          }).select('id').single();
          if (teacherError || !insertedTeacher) {
            return json(res, 400, { error: teacherError?.message || 'Gagal membuat data guru.' });
          }
          teacher = insertedTeacher;
          teacherId = insertedTeacher.id;
        }
        const { error: teacherLinkError } = await admin.from('profiles').update({ teacher_id: teacherId }).eq('id', authUserId);
        if (teacherLinkError) return json(res, 400, { error: `Gagal menghubungkan akun ke data guru: ${teacherLinkError.message}` });
      }

      if (teacherId && role === 'WALI KELAS') {
        const year = await getAcademicYear(schoolId);
        const targetClassId = classIds[0] || null;
        try {
          await admin.rpc('assign_homeroom_teacher', {
            p_school_id: schoolId,
            p_teacher_id: teacherId,
            p_class_id: targetClassId,
            p_academic_year: year,
            p_actor_user_id: caller.user.id,
          });
        } catch (e: any) {
          console.warn('[admin-users] assign_homeroom_teacher warning:', e?.message);
        }

        if (targetClassId) {
          await admin.from('classes').update({
            wali_kelas_teacher_id: teacherId,
          }).eq('id', targetClassId).eq('school_id', schoolId);

          // Cek total rombel yang diampu guru ini (maksimal 2 rombel)
          const { data: curClasses } = await admin
            .from('classes')
            .select('id')
            .eq('school_id', schoolId)
            .eq('wali_kelas_teacher_id', teacherId);

          if (curClasses && curClasses.length > 2) {
            const others = curClasses.filter((c: any) => c.id !== targetClassId);
            const toRelease = others.slice(1);
            for (const r of toRelease) {
              await admin.from('classes').update({ wali_kelas_teacher_id: null }).eq('id', r.id).eq('school_id', schoolId);
            }
          }
        }
        const { data: finalWaliClasses } = await admin
          .from('classes')
          .select('id')
          .eq('school_id', schoolId)
          .eq('wali_kelas_teacher_id', teacherId);
        const finalWaliClassIds = (finalWaliClasses || []).map((c: any) => c.id);
        await admin.from('profiles').update({
          class_ids: finalWaliClassIds.length > 0 ? finalWaliClassIds : (targetClassId ? [targetClassId] : []),
          class_id: targetClassId || finalWaliClassIds[0] || null,
        }).eq('id', authUserId);
      }
      if (teacherId && role === 'GURU MAPEL' && (classIds.length || subjectId)) {
        const year = await getAcademicYear(schoolId);
        let effectiveSubjectIds: string[] = subjectId ? [subjectId] : [];
        if (!effectiveSubjectIds.length) {
          const { data: existingSubjects, error: subjectErr } = await admin.from('subject_teacher_assignments').select('subject_id').eq('school_id',schoolId).eq('teacher_id',teacherId).eq('academic_year',year);
          if (!subjectErr && existingSubjects) {
            effectiveSubjectIds = existingSubjects.map((x: any) => x.subject_id);
          }
        }
        if (effectiveSubjectIds.length > 0) {
          for (const effectiveSubjectId of effectiveSubjectIds) {
            const { data: subjectRow } = await admin.from('subjects').select('id').eq('id', effectiveSubjectId).eq('school_id', schoolId).maybeSingle();
            if (subjectRow) {
              try {
                await admin.rpc('replace_subject_assignment', {
                  p_school_id: schoolId,
                  p_subject_id: effectiveSubjectId,
                  p_teacher_id: teacherId,
                  p_class_ids: classIds,
                  p_academic_year: year,
                  p_actor_user_id: caller.user.id
                });
              } catch (e: any) {
                console.warn('[admin-users] replace_subject_assignment warning:', e?.message);
              }
            }
          }
        }
      }

      if (teacherId || role === 'WALI KELAS' || role === 'GURU MAPEL') {
        try {
          const year = await getAcademicYear(schoolId);
          await reconcileTeacherAssignments(admin, schoolId, year);
        } catch (e: any) {
          console.warn('[admin-users] reconcileTeacherAssignments create warning:', e?.message);
        }
      }

      await admin.from('audit_logs').insert({
        actor_id: caller.user.id,
        actor_name: profile.role,
        actor_role: profile.role,
        action: 'CREATE_USER',
        table_name: 'profiles',
        record_id: authUserId,
        school_id: schoolId,
        details: { username, email: authEmail, role },
      });

      return json(res, 200, { ok: true, userId: authUserId, teacherId });
    }

    if (action === 'list' || action === 'list_users' || action === 'list_admins') {
      const requestedSchool = body.schoolId || body.school_id || profile.school_id;
      if (!requestedSchool) return json(res, 400, { error: 'ID sekolah wajib disertakan.' });

      if (profile.role !== 'SUPER_ADMIN') {
        if (targetSchoolData && isPersonalWorkspace) {
          if (!isOwner) {
            return json(res, 403, { error: 'Akses ditolak: Hanya pemilik yang dapat mengakses data ruang kerja individu ini.' });
          }
        } else if (requestedSchool !== profile.school_id && !isOwner) {
          return json(res, 403, { error: 'Akses sekolah tidak sesuai.' });
        }
      }

      let query = admin.from('profiles').select('id,school_id,name,username,email,role,student_id,is_active,must_change_password,created_at').eq('school_id', requestedSchool);
      if (action === 'list_admins') query = query.in('role', ['ADMIN','KEPALA SEKOLAH','GURU MAPEL','WALI KELAS']);
      if (body.role) query = query.eq('role', body.role);
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { ok: true, users: data || [], admins: data || [] });
    }

    if (action === 'update') {
      const userId = body.userId || body.user_id;
      const name = String(body.name || '').trim();
      const username = String(body.username || '').trim().toLowerCase();
      const email = String(body.email || '').trim().toLowerCase();
      const studentId = body.studentId || null;
      const classIds = [...new Set((Array.isArray(body.classIds) ? body.classIds : []).map((v: any) => String(v)).filter(Boolean))];
      const subjectId = body.subjectId ? String(body.subjectId) : null;
      if (role === 'WALI KELAS' && classIds.length > 1) return json(res, 400, { error: 'Wali Kelas hanya boleh memiliki 1 kelas.' });
      if (!userId || !name || !username || !role || !ALLOWED_ROLES.includes(role)) return json(res, 400, { error: 'Data akun tidak lengkap atau role tidak valid.' });
      if (!(await ensureSameSchool(userId))) return json(res, 403, { error: 'Akun tersebut bukan bagian dari sekolah Anda.' });
      if (role === 'SISWA' && !studentId) return json(res, 400, { error: 'Akun SISWA wajib terhubung ke data siswa.' });

      const isCustomEmail = Boolean(email && !email.endsWith('@login.edushift.local'));
      const authEmail = isCustomEmail ? email : `${username}@login.edushift.local`;
      const { data: duplicate } = await admin.from('profiles').select('id').eq('username', username).neq('id', userId).maybeSingle();
      if (duplicate) return json(res, 409, { error: 'Username sudah digunakan pengguna lain.' });

      if (isCustomEmail) {
        const { data: dupEmails } = await admin
          .from('profiles')
          .select('id, school_id, role')
          .ilike('email', authEmail)
          .neq('id', userId);

        for (const dupProf of dupEmails || []) {
          if (String(dupProf.role || '').toUpperCase().trim() === 'SUPER_ADMIN') {
            return json(res, 409, { error: 'Email tersebut sudah digunakan oleh akun Super Admin.' });
          }
          const { data: dupOwnedSchool } = await admin
            .from('schools')
            .select('id')
            .eq('owner_id', dupProf.id)
            .limit(1)
            .maybeSingle();

          if (dupProf.school_id || dupOwnedSchool) {
            return json(res, 409, { error: 'Email Google tersebut sudah digunakan oleh akun pengguna lain.' });
          }
          // Bersihkan profil orphan (tanpa ruang kerja) agar email dapat ditautkan ke pengguna ini
          try {
            await admin.from('profiles').delete().eq('id', dupProf.id);
            await admin.auth.admin.deleteUser(dupProf.id);
          } catch (_) {}
        }
      }

      const { data: target, error: targetErr } = await admin.from('profiles').select('school_id,teacher_id,name,username,email,role,student_id').eq('id', userId).single();
      if (targetErr || !target) return json(res, 404, { error: targetErr?.message || 'Profil pengguna tidak ditemukan.' });
      if (String(target.role || '').toUpperCase().trim() === 'SUPER_ADMIN') {
        return json(res, 403, { error: 'Akun Super Admin tidak dapat diubah melalui manajemen pengguna sekolah.' });
      }

      // Kebijakan Paket: Peran kunci (Wali Kelas / Guru Mapel / Admin Sekolah) tidak dapat diubah lagi setelah pendaftaran
      if (target.role && target.role !== role) {
        const keyRoles = ['WALI KELAS', 'GURU MAPEL', 'ADMIN'];
        if (keyRoles.includes(target.role) && (keyRoles.includes(role as string) || (role as string) === 'SUPER_ADMIN')) {
          return json(res, 400, {
            error: `Peran kunci pengguna (${target.role}) bersifat permanen dan tidak dapat diubah menjadi ${role} karena terikat pada aturan paket dan kapasitas ruang kerja.`,
          });
        }
      }

      let teacherId: string | null = target.teacher_id || null;
      let teacher: any = null;
      if (teacherId) {
        const { data: t } = await admin.from('teachers').select('id, nama, nip, tugas_utama').eq('id', teacherId).eq('school_id', target.school_id).maybeSingle();
        teacher = t;
      }
      if (role === 'GURU MAPEL' || role === 'WALI KELAS') {
        const desiredTugas = role === 'WALI KELAS' ? 'Wali Kelas' : 'Guru Mapel';
        if (teacherId) {
          await admin.from('teachers').update({ nama: name, nip: (username && !username.startsWith('guru_') && !username.startsWith('ks_')) ? username : null, tugas_utama: desiredTugas }).eq('id', teacherId).eq('school_id', target.school_id);
        } else {
          const normalizedNip = (username || '').trim();
          if (normalizedNip && normalizedNip !== '-') {
            const { data: existingTeacher } = await admin.from('teachers')
              .select('id,tugas_utama,nama,nip').eq('school_id', target?.school_id).eq('nip', normalizedNip).maybeSingle();
            teacher = existingTeacher;
          }
          if (!teacher && name) {
            const { data: existingByName } = await admin.from('teachers')
              .select('id,tugas_utama').eq('school_id', target?.school_id).ilike('nama', name.trim()).maybeSingle();
            teacher = existingByName;
          }
          if (teacher) {
            teacherId = teacher.id;
            await admin.from('teachers').update({ tugas_utama: desiredTugas }).eq('id', teacherId).eq('school_id', target.school_id);
          } else {
            const { data: insertedTeacher, error: teacherError } = await admin.from('teachers').insert({
              school_id: target?.school_id, nama: name, nip: (username && !username.startsWith('guru_') && !username.startsWith('ks_')) ? username : null, jenis_kelamin: 'L',
              tugas_utama: desiredTugas,
            }).select('id').single();
            if (teacherError || !insertedTeacher) return json(res, 400, { error: teacherError?.message || 'Gagal membuat data guru.' });
            teacher = insertedTeacher;
            teacherId = insertedTeacher.id;
          }
          const { error: teacherLinkError } = await admin.from('profiles').update({ teacher_id: teacherId }).eq('id', userId);
          if (teacherLinkError) return json(res, 400, { error: `Gagal menghubungkan akun ke data guru: ${teacherLinkError.message}` });
        }
      }

      if (teacherId && role === 'WALI KELAS') {
        const year = await getAcademicYear(target.school_id);
        const targetClassId = classIds[0] || null;
        try {
          await admin.rpc('assign_homeroom_teacher', {
            p_school_id: target.school_id,
            p_teacher_id: teacherId,
            p_class_id: targetClassId,
            p_academic_year: year,
            p_actor_user_id: caller.user.id
          });
        } catch (e: any) {
          console.warn('[admin-users] assign_homeroom_teacher update warning:', e?.message);
        }

        if (targetClassId) {
          // Tetapkan secara eksplisit pada tabel classes
          await admin.from('classes').update({
            wali_kelas_teacher_id: teacherId,
          }).eq('id', targetClassId).eq('school_id', target.school_id);

          // Cek total rombel yang diampu guru ini (maksimal 2 rombel)
          const { data: curClasses } = await admin
            .from('classes')
            .select('id')
            .eq('school_id', target.school_id)
            .eq('wali_kelas_teacher_id', teacherId);

          if (curClasses && curClasses.length > 2) {
            const others = curClasses.filter((c: any) => c.id !== targetClassId);
            const toRelease = others.slice(1);
            for (const r of toRelease) {
              await admin.from('classes').update({ wali_kelas_teacher_id: null }).eq('id', r.id).eq('school_id', target.school_id);
            }
          }
        }

        const { data: finalWaliClasses } = await admin
          .from('classes')
          .select('id')
          .eq('school_id', target.school_id)
          .eq('wali_kelas_teacher_id', teacherId);
        const finalWaliClassIds = (finalWaliClasses || []).map((c: any) => c.id);
        await admin.from('profiles').update({
          class_ids: finalWaliClassIds.length > 0 ? finalWaliClassIds : (targetClassId ? [targetClassId] : []),
          class_id: targetClassId || finalWaliClassIds[0] || null,
        }).eq('id', userId);
      }
      if (teacherId && role !== 'WALI KELAS' && target.role === 'WALI KELAS') {
        // Jika peran berubah dari Wali Kelas menjadi non-Wali Kelas, lepaskan kelas binaan
        await admin.from('classes').update({
          wali_kelas_teacher_id: null,
        }).eq('school_id', target.school_id).eq('wali_kelas_teacher_id', teacherId);
      }
      if (teacherId && role === 'GURU MAPEL' && classIds.length) {
        const year = await getAcademicYear(target.school_id);
        const { data: existingSubjects, error: existingSubjectsErr } = await admin.from('subject_teacher_assignments').select('subject_id').eq('school_id', target.school_id).eq('teacher_id', teacherId).eq('academic_year', year);
        const effectiveSubjectIds = subjectId ? [subjectId] : (!existingSubjectsErr && existingSubjects ? existingSubjects.map((x: any) => x.subject_id) : []);
        if (effectiveSubjectIds.length > 0) {
          for (const effectiveSubjectId of effectiveSubjectIds) {
            const { data: subjectRow } = await admin.from('subjects').select('id').eq('id', effectiveSubjectId).eq('school_id', target.school_id).maybeSingle();
            if (subjectRow) {
              await admin.rpc('replace_subject_assignment', {
                p_school_id: target.school_id,
                p_subject_id: effectiveSubjectId,
                p_teacher_id: teacherId,
                p_class_ids: classIds,
                p_academic_year: year,
                p_actor_user_id: caller.user.id
              });
            }
          }
        }
      }
      if (role !== 'GURU MAPEL' && role !== 'WALI KELAS') {
        const { error: unlinkTeacherErr } = await admin.from('profiles').update({ teacher_id: null }).eq('id', userId);
        if (unlinkTeacherErr) return json(res, 400, { error: unlinkTeacherErr.message });
        teacherId = null;
      }
      const effectiveClassIds = role === 'WALI KELAS'
        ? (classIds[0] ? [classIds[0]] : [])
        : (role === 'GURU MAPEL' || role === 'SISWA' ? classIds : []);
      const { error: profileUpdateErr } = await admin.from('profiles').update({
        name, username, email: authEmail, role, student_id: role === 'SISWA' ? studentId : null, teacher_id: teacherId,
        class_ids: effectiveClassIds,
      }).eq('id', userId);
      if (profileUpdateErr) return json(res, 400, { error: profileUpdateErr.message });

      if (teacherId && isCustomEmail) {
        try {
          await admin.from('teachers').update({ email: authEmail }).eq('id', teacherId).eq('school_id', target.school_id);
        } catch (_) {}
      }

      const updatedUserMeta = {
        name,
        username,
        role,
        school_id: target.school_id,
        ...(isCustomEmail ? { email_verified: true, is_google_auth: true } : {}),
      };

      let { error: authError } = await admin.auth.admin.updateUserById(userId, {
        email: authEmail,
        email_confirm: true,
        user_metadata: updatedUserMeta,
      });

      // Jika terjadi konflik karena user pernah mencoba klik "Lanjutkan dengan Google" sebelum emailnya didaftarkan (orphan auth user):
      if (authError && isCustomEmail) {
        try {
          const { data: listed } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const conflictAuthUser = (listed?.users || []).find(
            (u: any) => u.id !== userId && String(u.email || '').trim().toLowerCase() === authEmail
          );
          if (conflictAuthUser) {
            const { data: conflictProf } = await admin
              .from('profiles')
              .select('id, school_id, role')
              .eq('id', conflictAuthUser.id)
              .maybeSingle();
            const { data: conflictOwned } = await admin
              .from('schools')
              .select('id')
              .eq('owner_id', conflictAuthUser.id)
              .limit(1)
              .maybeSingle();

            const isConflictSuperAdmin = String(conflictProf?.role || '').toUpperCase().trim() === 'SUPER_ADMIN';
            if (!isConflictSuperAdmin && !conflictProf?.school_id && !conflictOwned) {
              // Hapus akun auth orphan yang belum memiliki ruang kerja, lalu tautkan email ke akun utama ini
              if (conflictProf) {
                await admin.from('profiles').delete().eq('id', conflictAuthUser.id);
              }
              await admin.auth.admin.deleteUser(conflictAuthUser.id);
              const retryAuth = await admin.auth.admin.updateUserById(userId, {
                email: authEmail,
                email_confirm: true,
                user_metadata: updatedUserMeta,
              });
              authError = retryAuth.error;
            }
          }
        } catch (reconcileErr: any) {
          console.warn('[admin-users] orphan auth user reconciliation warning:', reconcileErr?.message);
        }
      }

      if (authError) {
        // Jika konflik karena akun Google sudah aktif login (misal sesi OAuth berjalan), tetap simpan email di profiles
        // agar saat login dengan Google berikutnya, endpoint /api/onboarding otomatis menyatukan profil berdasarkan email.
        const errMsgLower = String(authError.message || '').toLowerCase();
        const isDuplicateAuthEmail =
          isCustomEmail &&
          (errMsgLower.includes('already') ||
            errMsgLower.includes('registered') ||
            errMsgLower.includes('exists') ||
            errMsgLower.includes('duplicate') ||
            errMsgLower.includes('unique'));

        if (!isDuplicateAuthEmail) {
          await admin.from('profiles').update({
            name: target.name, username: target.username, email: target.email, role: target.role,
            student_id: target.student_id, teacher_id: target.teacher_id
          }).eq('id', userId);
          return json(res, 400, { error: `Perubahan database berhasil dibatalkan karena sinkronisasi Auth gagal: ${authError.message}` });
        }
      }

      if (teacherId || role === 'WALI KELAS' || role === 'GURU MAPEL' || target.role === 'WALI KELAS' || target.role === 'GURU MAPEL') {
        try {
          const year = await getAcademicYear(target.school_id);
          await reconcileTeacherAssignments(admin, target.school_id, year);
        } catch (e: any) {
          console.warn('[admin-users] reconcileTeacherAssignments edit warning:', e?.message);
        }
      }

      return json(res, 200, { ok: true, teacherId });
    }

    if (action === 'password' || action === 'reset_admin_password') {
      const userId = body.userId || body.user_id;
      const password = String(body.password || '');
      if (!userId || password.length < PASSWORD_MIN) return json(res, 400, { error: `Password minimal ${PASSWORD_MIN} karakter.` });
      const { data: targetProf } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
      if (String(targetProf?.role || '').toUpperCase().trim() === 'SUPER_ADMIN') {
        return json(res, 403, { error: 'Password akun Super Admin tidak dapat diubah melalui menu ini.' });
      }
      if (!(await ensureSameSchool(userId))) return json(res, 403, { error: 'Akun tersebut bukan bagian dari sekolah Anda.' });
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json(res, 400, { error: error.message });
      await admin.from('profiles').update({ must_change_password: false }).eq('id', userId);
      return json(res, 200, { ok: true });
    }

    if (action === 'toggle_admin') {
      const userId = body.userId || body.user_id;
      const { data: targetProf } = await admin.from('profiles').select('role').eq('id', userId).maybeSingle();
      if (String(targetProf?.role || '').toUpperCase().trim() === 'SUPER_ADMIN') {
        return json(res, 403, { error: 'Status akun Super Admin tidak dapat diubah.' });
      }
      if (!userId || !(await ensureSameSchool(userId))) return json(res, 403, { error: 'Akun tidak dapat diubah.' });
      const { error } = await admin.from('profiles').update({ is_active: !!body.is_active }).eq('id', userId);
      if (error) return json(res, 400, { error: error.message });
      return json(res, 200, { ok: true });
    }

    if (action === 'delete') {
      const userId = body.userId || body.user_id;
      if (!userId) return json(res, 400, { error: 'ID akun pengguna wajib disertakan.' });
      if (userId === caller.user.id) return json(res, 400, { error: 'Akun yang sedang digunakan tidak dapat dihapus.' });
      if (!(await ensureSameSchool(userId))) return json(res, 403, { error: 'Akun tersebut bukan bagian dari sekolah Anda.' });

      // Cari profil target berdasarkan ID atau username
      let { data: target } = await admin.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (!target) {
        const { data: byUsername } = await admin.from('profiles').select('*').eq('username', String(userId).toLowerCase()).maybeSingle();
        target = byUsername;
      }

      const effectiveUserId = target?.id || userId;
      const targetSchoolId = target?.school_id || callerSchoolId;

      if (target) {
        if (String(target.role || '').toUpperCase().trim() === 'SUPER_ADMIN') {
          return json(res, 403, { error: 'Akun Super Admin tidak dapat dihapus.' });
        }
        if (target.role === 'ADMIN' && callerRole !== 'SUPER_ADMIN') {
          const { count } = await admin
            .from('profiles')
            .select('id', { count: 'exact', head: true })
            .eq('school_id', target.school_id || callerSchoolId)
            .eq('role', 'ADMIN')
            .eq('is_active', true);
          if ((count || 0) <= 1) {
            return json(res, 400, { error: 'Admin terakhir di sekolah tidak boleh dihapus.' });
          }
        }
      }

      // 1. Bersihkan penugasan kelas pengguna di user_class_assignments
      try {
        await admin.from('user_class_assignments').delete().eq('user_id', effectiveUserId);
      } catch (e: any) {
        console.warn('[admin-users] user_class_assignments delete warning:', e?.message);
      }

      // 2. Jika akun terhubung ke guru master atau data guru dengan NIP/Nama sama
      const teacherId = target?.teacher_id;
      if (teacherId) {
        try {
          await admin.from('classes').update({ wali_kelas_teacher_id: null }).eq('wali_kelas_teacher_id', teacherId);
          await admin.from('subject_teacher_assignments').delete().eq('teacher_id', teacherId);
          await admin.from('teacher_assignments').delete().eq('teacher_id', teacherId);
          await admin.from('teacher_class_assignments').delete().eq('teacher_id', teacherId);
          if (body.preserveMaster !== true) {
            await admin.from('teachers').delete().eq('id', teacherId);
          }
        } catch (e: any) {
          console.warn('[admin-users] teacher relations cleanup warning:', e?.message);
        }
      } else if (target?.username && targetSchoolId && body.preserveMaster !== true) {
        try {
          const { data: matchedTeachers } = await admin.from('teachers')
            .select('id')
            .eq('school_id', targetSchoolId)
            .or(`nip.eq.${target.username},nama.ilike.${target.name}`);
          for (const mt of matchedTeachers || []) {
            await admin.from('classes').update({ wali_kelas_teacher_id: null }).eq('wali_kelas_teacher_id', mt.id);
            await admin.from('subject_teacher_assignments').delete().eq('teacher_id', mt.id);
            await admin.from('teacher_assignments').delete().eq('teacher_id', mt.id);
            await admin.from('teacher_class_assignments').delete().eq('teacher_id', mt.id);
            await admin.from('teachers').delete().eq('id', mt.id);
          }
        } catch (_) {}
      }

      // 3. Jika akun terhubung ke siswa master
      if (target?.student_id && body.deleteStudentMaster === true) {
        try {
          await admin.from('attendance_records').delete().eq('student_id', target.student_id);
          await admin.from('students').delete().eq('id', target.student_id);
        } catch (_) {}
      }

      // 4. Netralkan foreign key pemilik sekolah dan audit logs
      try {
        await admin.from('schools').update({ owner_id: null }).eq('owner_id', effectiveUserId);
      } catch (_) {}
      try {
        await admin.from('audit_logs').update({ actor_id: null }).eq('actor_id', effectiveUserId);
      } catch (_) {}

      // 5. Lepaskan asosiasi teacher_id dan student_id pada profiles
      try {
        await admin.from('profiles').update({ teacher_id: null, student_id: null }).eq('id', effectiveUserId);
      } catch (_) {}

      // 6. Hapus baris dari tabel profiles
      const { error: delProfileError } = await admin.from('profiles').delete().eq('id', effectiveUserId);
      if (delProfileError) {
        console.error('[admin-users] Gagal menghapus profil pengguna:', delProfileError);
        return json(res, 400, { error: `Gagal menghapus profil dari database: ${delProfileError.message}` });
      }

      // 7. Hapus user dari Supabase Auth
      const { error: delAuthError } = await admin.auth.admin.deleteUser(effectiveUserId);
      if (delAuthError) {
        console.warn('[admin-users] Auth deleteUser warning:', delAuthError.message);
        if (!delAuthError.message.toLowerCase().includes('not found') && !target) {
          return json(res, 400, { error: delAuthError.message });
        }
      }

      // 8. Sinkronisasi ulang penugasan jika ada sekolah
      if (targetSchoolId) {
        try {
          const year = await getAcademicYear(targetSchoolId);
          await reconcileTeacherAssignments(admin, targetSchoolId, year);
        } catch (_) {}
      }

      // 9. Catat aktivitas ke audit_logs
      try {
        await admin.from('audit_logs').insert({
          actor_id: caller.user.id,
          actor_name: caller.user.user_metadata?.name || profile?.name || 'Admin',
          actor_role: callerRole,
          action: 'DELETE_USER',
          school_id: targetSchoolId || null,
          details: {
            userId: effectiveUserId,
            deleted_username: target?.username,
            deleted_name: target?.name,
            deleted_role: target?.role,
          },
        });
      } catch (auditErr: any) {
        console.warn('[admin-users] Audit log warning:', auditErr?.message);
      }

      return json(res, 200, { ok: true, success: true, message: `Akun pengguna ${target?.name || ''} berhasil dihapus permanen dari database.` });
    }

    if (action === 'import_teachers') {
      if (!['ADMIN', 'SUPER_ADMIN', 'KEPALA SEKOLAH'].includes(callerRole) && !isPersonalOwner) {
        return json(res, 403, { error: 'Hanya Admin atau Kepala Sekolah yang berwenang mengimpor data guru.' });
      }
      const targetSchoolId = schoolId || callerSchoolId;
      if (!targetSchoolId) {
        return json(res, 400, { error: 'ID sekolah wajib disertakan.' });
      }

      const items = Array.isArray(body.items) ? body.items : [];
      const replaceExisting = body.replaceExisting !== undefined ? Boolean(body.replaceExisting) : true;

      if (items.length === 0) {
        return json(res, 400, { error: 'Tidak ada data guru yang valid untuk diimpor.' });
      }

      // Ambil data guru yang saat ini ada di database sekolah
      const { data: existingTeachersData, error: fetchErr } = await admin
        .from('teachers')
        .select('*')
        .eq('school_id', targetSchoolId);

      if (fetchErr) {
        return json(res, 500, { error: `Gagal membaca data guru: ${fetchErr.message}` });
      }

      const existingTeachers = existingTeachersData || [];
      const usedExistingIds = new Set<string>();
      const toUpdate: any[] = [];
      const toInsert: any[] = [];

      for (const t of items) {
        const cleanName = String(t.nama || '').trim();
        if (!cleanName) continue;
        const cleanNip = t.nip && String(t.nip).trim() !== '-' ? String(t.nip).trim() : null;
        const rawTugas = String(t.tugasUtama || t.tugas_utama || 'Belum ditugaskan').trim();
        const gender = t.jenisKelamin === 'P' || t.jenis_kelamin === 'P' ? 'P' : 'L';

        // Pencocokan cerdas guru yang ada:
        // 1. Berdasarkan NIP jika ada
        // 2. Berdasarkan nama lengkap
        let matched: any = null;
        if (cleanNip) {
          matched = existingTeachers.find(
            (ex: any) => !usedExistingIds.has(ex.id) && ex.nip && String(ex.nip).trim() === cleanNip
          );
        }
        if (!matched) {
          matched = existingTeachers.find(
            (ex: any) => !usedExistingIds.has(ex.id) && String(ex.nama || '').trim().toLowerCase() === cleanName.toLowerCase()
          );
        }

        if (matched) {
          usedExistingIds.add(matched.id);
          toUpdate.push({
            id: matched.id,
            nama: cleanName,
            nip: cleanNip || matched.nip || null,
            jenis_kelamin: gender,
            tugas_utama: rawTugas,
          });
        } else {
          toInsert.push({
            school_id: targetSchoolId,
            nama: cleanName,
            nip: cleanNip,
            jenis_kelamin: gender,
            tugas_utama: rawTugas,
          });
        }
      }

      for (const upd of toUpdate) {
        await admin
          .from('teachers')
          .update({
            nama: upd.nama,
            nip: upd.nip,
            jenis_kelamin: upd.jenis_kelamin,
            tugas_utama: upd.tugas_utama,
          })
          .eq('id', upd.id)
          .eq('school_id', targetSchoolId);
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await admin.from('teachers').insert(toInsert);
        if (insErr) {
          return json(res, 500, { error: `Gagal menambahkan guru baru: ${insErr.message}` });
        }
      }

      // MODE SUMBER TUNGGAL (REPLACE ALL):
      // Hapus seluruh data guru lama yang TIDAK ada dalam file Excel terbaru
      let deletedCount = 0;
      if (replaceExisting) {
        const leftovers = existingTeachers.filter((t: any) => !usedExistingIds.has(t.id));
        deletedCount = leftovers.length;
        for (const l of leftovers) {
          try {
            // 1. Lepas penugasan wali kelas pada tabel classes
            await admin.from('classes').update({ wali_kelas_teacher_id: null }).eq('wali_kelas_teacher_id', l.id).eq('school_id', targetSchoolId);
            // 2. Bersihkan relasi penugasan guru
            await admin.from('subject_teacher_assignments').delete().eq('teacher_id', l.id).eq('school_id', targetSchoolId);
            await admin.from('teacher_assignments').delete().eq('teacher_id', l.id).eq('school_id', targetSchoolId);
            await admin.from('teacher_class_assignments').delete().eq('teacher_id', l.id).eq('school_id', targetSchoolId);
            // 3. Lepaskan tautan profile pengguna
            await admin.from('profiles').update({ teacher_id: null }).eq('teacher_id', l.id).eq('school_id', targetSchoolId);
            // 4. Hapus guru lama dari tabel teachers
            await admin.from('teachers').delete().eq('id', l.id).eq('school_id', targetSchoolId);
          } catch (delErr: any) {
            console.warn('[admin-users] Error deleting leftover teacher:', delErr?.message);
          }
        }
      }

      // Catat ke audit log
      try {
        await admin.from('audit_logs').insert({
          actor_id: caller.user.id,
          actor_name: caller.user.user_metadata?.name || profile?.name || 'Admin',
          actor_role: callerRole,
          action: 'IMPORT_TEACHERS',
          school_id: targetSchoolId,
          details: {
            total_imported: toUpdate.length + toInsert.length,
            deleted_old: deletedCount,
            replace_existing: replaceExisting,
          },
        });
      } catch (_) {}

      return json(res, 200, {
        ok: true,
        success: true,
        count: toUpdate.length + toInsert.length,
        deletedCount,
        message: `Berhasil mengimpor ${toUpdate.length + toInsert.length} data guru.${deletedCount > 0 ? ` Sebanyak ${deletedCount} data guru lama dihapus sesuai isi file terbaru.` : ''}`,
      });
    }

    if (action === 'delete_teacher') {
      if (!['ADMIN', 'SUPER_ADMIN', 'KEPALA SEKOLAH'].includes(callerRole)) {
        return json(res, 403, { error: 'Hanya Admin atau Kepala Sekolah yang berwenang menghapus data guru.' });
      }
      const teacherId = body.teacherId || body.teacher_id;
      if (!teacherId) return json(res, 400, { error: 'ID guru wajib disertakan.' });

      const targetSchoolId = schoolId || callerSchoolId;
      if (!targetSchoolId) return json(res, 400, { error: 'ID sekolah tidak valid.' });

      const { data: targetTeacher } = await admin.from('teachers')
        .select('*')
        .eq('id', teacherId)
        .eq('school_id', targetSchoolId)
        .maybeSingle();

      if (!targetTeacher) {
        return json(res, 404, { error: 'Data guru tidak ditemukan di database.' });
      }

      // 1. Lepaskan wali kelas di tabel classes
      try {
        await admin.from('classes').update({ wali_kelas_teacher_id: null }).eq('wali_kelas_teacher_id', teacherId).eq('school_id', targetSchoolId);
      } catch (e: any) {
        console.warn('[admin-users] classes wali_kelas unset warning:', e?.message);
      }

      // 2. Bersihkan penugasan guru di seluruh tabel relasi
      try {
        await admin.from('subject_teacher_assignments').delete().eq('teacher_id', teacherId).eq('school_id', targetSchoolId);
        await admin.from('teacher_assignments').delete().eq('teacher_id', teacherId).eq('school_id', targetSchoolId);
        await admin.from('teacher_class_assignments').delete().eq('teacher_id', teacherId).eq('school_id', targetSchoolId);
      } catch (e: any) {
        console.warn('[admin-users] teacher assignments cleanup warning:', e?.message);
      }

      // 3. Hapus akun pengguna (profiles + auth.users) yang terhubung dengan guru ini
      try {
        const { data: linkedProfiles } = await admin.from('profiles')
          .select('id, username, name')
          .eq('school_id', targetSchoolId)
          .or(`teacher_id.eq.${teacherId},username.eq.${targetTeacher.nip || '___none___'}`);

        for (const lp of linkedProfiles || []) {
          try {
            await admin.from('user_class_assignments').delete().eq('user_id', lp.id);
            await admin.from('profiles').delete().eq('id', lp.id);
            await admin.auth.admin.deleteUser(lp.id);
          } catch (lpErr: any) {
            console.warn(`[admin-users] Error purging linked user ${lp.username}:`, lpErr?.message);
          }
        }
      } catch (pErr: any) {
        console.warn('[admin-users] linked profiles cleanup warning:', pErr?.message);
      }

      // 4. Hapus data guru dari tabel teachers
      const { error: delTeacherError } = await admin.from('teachers')
        .delete()
        .eq('id', teacherId)
        .eq('school_id', targetSchoolId);

      if (delTeacherError) {
        console.error('[admin-users] Gagal menghapus guru:', delTeacherError);
        return json(res, 500, { error: `Gagal menghapus data guru dari database: ${delTeacherError.message}` });
      }

      // 5. Rekonsiliasi penugasan
      try {
        const year = await getAcademicYear(targetSchoolId);
        await reconcileTeacherAssignments(admin, targetSchoolId, year);
      } catch (_) {}

      // 6. Catat di audit log
      try {
        await admin.from('audit_logs').insert({
          actor_id: caller.user.id,
          actor_name: caller.user.user_metadata?.name || profile?.name || 'Admin',
          actor_role: callerRole,
          action: 'DELETE_TEACHER',
          school_id: targetSchoolId,
          details: {
            teacherId,
            teacherName: targetTeacher.nama,
            nip: targetTeacher.nip,
          },
        });
      } catch (_) {}

      return json(res, 200, {
        ok: true,
        success: true,
        message: `Data guru ${targetTeacher.nama} beserta akun login dan seluruh penugasan berhasil dihapus permanen dari database.`,
      });
    }

    if (action === 'save_student') {
      if (!['ADMIN', 'SUPER_ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL'].includes(callerRole) && !isPersonalOwner) {
        return json(res, 403, { error: 'Tidak berwenang menyimpan data siswa.' });
      }
      const targetSchoolId = schoolId || callerSchoolId || body.schoolId || body.school_id;
      if (!targetSchoolId) {
        return json(res, 400, { error: 'ID sekolah / ruang kerja wajib disertakan.' });
      }

      const studentId = body.studentId || body.id || null;
      const nama = String(body.nama || '').trim();
      if (!nama) {
        return json(res, 400, { error: 'Nama lengkap siswa wajib diisi.' });
      }

      let gender: 'L' | 'P' = String(body.gender || 'L').toUpperCase() === 'P' ? 'P' : 'L';

      // Pastikan class_id selalu valid (tidak pernah null)
      let classId = body.classId || body.class_id || null;
      if (!classId) {
        const { data: existingClass } = await admin
          .from('classes')
          .select('id')
          .eq('school_id', targetSchoolId)
          .limit(1)
          .maybeSingle();

        if (existingClass?.id) {
          classId = existingClass.id;
        } else {
          const { data: newCls } = await admin
            .from('classes')
            .insert({
              school_id: targetSchoolId,
              name: 'Kelas 1A',
              grade: 1,
              academic_year: await getAcademicYear(targetSchoolId),
            })
            .select('id')
            .maybeSingle();
          classId = newCls?.id || null;
        }
      }

      // Validasi batas maksimal 50 siswa per kelas (kebijakan sistem paket - Hard Block)
      if (classId) {
        let countQuery = admin
          .from('students')
          .select('id', { count: 'exact', head: true })
          .eq('class_id', classId);
        if (studentId) {
          countQuery = countQuery.neq('id', studentId);
        }
        const { count: studentCountInClass } = await countQuery;

        if ((studentCountInClass || 0) >= 50) {
          const { data: clsInfo } = await admin.from('classes').select('name').eq('id', classId).maybeSingle();
          const clsName = clsInfo?.name || 'kelas ini';
          return json(res, 400, {
            error: `Kapasitas ${clsName} maksimal 50 siswa. Sistem menolak input karena kuota rombel telah mencapai batas maksimal (50 siswa).`,
          });
        }
      }

      // Validasi batas total siswa sesuai paket
      if (!studentId && targetSchoolId) {
        const { data: sch } = await admin.from('schools').select('plan, max_students, workspace_type').eq('id', targetSchoolId).maybeSingle();
        const { count: totalStudents } = await admin.from('students').select('id', { count: 'exact', head: true }).eq('school_id', targetSchoolId);
        const isPersonal = sch?.workspace_type === 'personal';
        const normPlan = sch?.plan || 'guru_gratis';
        let maxAllowed = 1200;
        if (isPersonal) {
          if (normPlan === 'guru_pro') {
            maxAllowed = callerRole === 'GURU MAPEL' ? 300 : 100;
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

      // Pastikan NISN tidak pernah null (karena constraint not-null database)
      let nisn = String(body.nisn || '').trim();
      if (!nisn || nisn === '-') {
        nisn = '99' + Math.floor(10000000 + Math.random() * 90000000);
      }

      let studentRow: any = null;
      if (studentId) {
        const { data: updated, error: uErr } = await admin
          .from('students')
          .update({
            nama,
            gender,
            nisn,
            class_id: classId,
          })
          .eq('id', studentId)
          .eq('school_id', targetSchoolId)
          .select('*, classes:class_id(id,name)')
          .maybeSingle();

        if (uErr) {
          console.error('[admin-users] Error updating student:', uErr.message);
          return json(res, 500, { error: `Gagal memperbarui data siswa: ${uErr.message}` });
        }
        studentRow = updated;
      } else {
        const { data: inserted, error: iErr } = await admin
          .from('students')
          .insert({
            school_id: targetSchoolId,
            class_id: classId,
            nama,
            gender,
            nisn,
          })
          .select('*, classes:class_id(id,name)')
          .maybeSingle();

        if (iErr) {
          console.error('[admin-users] Error inserting student:', iErr.message);
          return json(res, 500, { error: `Gagal menambahkan siswa baru: ${iErr.message}` });
        }
        studentRow = inserted;
      }

      return json(res, 200, {
        ok: true,
        success: true,
        student: studentRow,
        message: `Data siswa ${nama} berhasil disimpan.`,
      });
    }

    if (action === 'import_students') {
      if (!['ADMIN', 'SUPER_ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL'].includes(callerRole) && !isPersonalOwner) {
        return json(res, 403, { error: 'Hanya Admin, Kepala Sekolah, atau Wali Kelas yang berwenang mengimpor data siswa.' });
      }
      if (!schoolId) {
        return json(res, 400, { error: 'ID sekolah tidak ditemukan.' });
      }

      const items = Array.isArray(body.items) ? body.items : [];
      const replaceExisting = Boolean(body.replaceExisting || body.replace_existing);
      const targetClassId = body.targetClassId || body.target_class_id || null;

      if (items.length === 0) {
        return json(res, 400, { error: 'Tidak ada data siswa yang dikirim.' });
      }

      // Ambil seluruh kelas sekolah untuk fallback jika ada item tanpa class_id
      const { data: schoolClasses } = await admin
        .from('classes')
        .select('id, name')
        .eq('school_id', schoolId);

      let defaultClassId = targetClassId || schoolClasses?.[0]?.id || null;
      if (!defaultClassId) {
        const { data: newCls } = await admin
          .from('classes')
          .insert({
            school_id: schoolId,
            name: 'Kelas 1',
            grade: 1,
            academic_year: await getAcademicYear(schoolId),
          })
          .select('id')
          .maybeSingle();
        defaultClassId = newCls?.id || null;
      }

      // Coba panggil import_students_atomic via service role jika tersedia di database
      // 1. Validasi kelas yang disentuh dalam batch impor (touched classes)
      const touchedClassIds = new Set<string>();
      if (targetClassId) touchedClassIds.add(targetClassId);
      items.forEach((it: any) => {
        const cid = it.class_id || it.classId;
        if (cid) touchedClassIds.add(cid);
      });

      // Tentukan targetClassId tunggal jika semua item menuju kelas yang sama
      const effectiveTargetClassId = targetClassId || (touchedClassIds.size === 1 ? Array.from(touchedClassIds)[0] : defaultClassId);

      // Smart in-place synchronization:
      // Selalu ambil seluruh data siswa sekolah untuk matching nama + nisn
      const { data: existingStudentsData, error: fetchErr } = await admin
        .from('students')
        .select('id, nisn, nama, class_id, gender')
        .eq('school_id', schoolId);

      if (fetchErr) {
        console.error('[admin-users] Error fetching existing students:', fetchErr.message);
        return json(res, 500, { error: `Gagal membaca data siswa: ${fetchErr.message}` });
      }

      const existingStudents = existingStudentsData || [];

      // Ambil ID siswa yang sudah terhubung dengan akun profiles
      const { data: linkedProfiles } = await admin
        .from('profiles')
        .select('student_id')
        .eq('school_id', schoolId)
        .not('student_id', 'is', null);
      const linkedStudentIds = new Set<string>((linkedProfiles || []).map((p: any) => String(p.student_id)));

      const usedExistingIds = new Set<string>();
      const toUpdate: Array<{ id: string; nama: string; nisn: string | null; gender: 'L' | 'P'; class_id: string | null }> = [];
      const toInsert: Array<{ school_id: string; nama: string; nisn: string; gender: 'L' | 'P'; class_id: string }> = [];

      for (const rawItem of items) {
        const itemNama = String(rawItem.nama || '').trim();
        let itemNisn = rawItem.nisn && String(rawItem.nisn).trim() !== '-' ? String(rawItem.nisn).trim() : null;
        if (!itemNisn) {
          itemNisn = '99' + Math.floor(10000000 + Math.random() * 90000000);
        }
        const itemGender: 'L' | 'P' = rawItem.gender === 'P' ? 'P' : 'L';
        let itemClassId = rawItem.classId || rawItem.class_id || effectiveTargetClassId || null;
        if (!itemClassId && rawItem.className) {
          const matchCls = (schoolClasses || []).find((c: any) => c.name.toLowerCase() === String(rawItem.className).trim().toLowerCase());
          if (matchCls) itemClassId = matchCls.id;
        }
        if (!itemClassId) {
          itemClassId = defaultClassId;
        }

        let matchedExisting: any = null;
        const cleanItemNama = itemNama.toLowerCase();
        const cleanItemNisn = itemNisn ? itemNisn.toLowerCase() : '';

        // Aturan presisi:
        // - Jika terdapat siswa dengan nama dan NISN yang sama, otomatis gantikan data tersebut (update)
        // - Jika hanya nama yang sama (NISN berbeda atau belum ada) atau siswa baru, sistem harus tetap menambahkan datanya (insert)
        if (cleanItemNama && cleanItemNisn) {
          const candidate = existingStudents.find((st: any) => {
            if (usedExistingIds.has(st.id)) return false;
            const stNama = String(st.nama || '').trim().toLowerCase();
            const stNisn = String(st.nisn || '').trim().toLowerCase();
            return stNama === cleanItemNama && stNisn === cleanItemNisn;
          });
          if (candidate) {
            matchedExisting = candidate;
          }
        }

        if (matchedExisting) {
          usedExistingIds.add(matchedExisting.id);
          toUpdate.push({
            id: matchedExisting.id,
            nama: itemNama,
            nisn: itemNisn,
            gender: itemGender,
            class_id: itemClassId,
          });
        } else {
          toInsert.push({
            school_id: schoolId,
            nama: itemNama,
            nisn: itemNisn,
            gender: itemGender,
            class_id: itemClassId,
          });
        }
      }

      // Validasi Hard Block: Pastikan tidak ada rombel yang melampaui batas maksimal 50 siswa
      const classIdCounts: Record<string, number> = {};
      (existingStudents || []).forEach((st: any) => {
        if (st.class_id) {
          classIdCounts[st.class_id] = (classIdCounts[st.class_id] || 0) + 1;
        }
      });
      toUpdate.forEach((upd) => {
        const orig = existingStudents.find((st: any) => st.id === upd.id);
        if (orig?.class_id && orig.class_id !== upd.class_id) {
          classIdCounts[orig.class_id] = Math.max(0, (classIdCounts[orig.class_id] || 1) - 1);
          if (upd.class_id) {
            classIdCounts[upd.class_id] = (classIdCounts[upd.class_id] || 0) + 1;
          }
        }
      });
      const addingPerClass: Record<string, number> = {};
      toInsert.forEach((ins) => {
        if (ins.class_id) {
          addingPerClass[ins.class_id] = (addingPerClass[ins.class_id] || 0) + 1;
        }
      });

      for (const cid of Object.keys(addingPerClass)) {
        const currentCount = classIdCounts[cid] || 0;
        const addCount = addingPerClass[cid] || 0;
        if (currentCount + addCount > 50) {
          const clsName = (schoolClasses || []).find((c: any) => c.id === cid)?.name || 'kelas ini';
          return json(res, 400, {
            error: `Impor dibatalkan: Rombel "${clsName}" akan melebihi batas kapasitas maksimal 50 siswa (saat ini: ${currentCount}, hendak ditambah: ${addCount}). Setiap rombel dibatasi maksimal 50 siswa.`,
          });
        }
      }

        // 1. Perbarui data siswa yang cocok di database (ID tidak berubah sehingga profiles aman)
        for (const upd of toUpdate) {
          await admin
            .from('students')
            .update({
              nama: upd.nama,
              nisn: upd.nisn,
              gender: upd.gender,
              class_id: upd.class_id,
            })
            .eq('id', upd.id)
            .eq('school_id', schoolId);
        }

        // 2. Tambahkan siswa baru dalam batch
        if (toInsert.length > 0) {
          const CHUNK_SIZE = 100;
          for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
            const chunk = toInsert.slice(i, i + CHUNK_SIZE);
            const { error: insErr } = await admin.from('students').insert(chunk);
            if (insErr) {
              console.error('[admin-users] Error inserting students batch:', insErr.message);
              return json(res, 500, { error: `Gagal menyimpan data siswa: ${insErr.message}` });
            }
          }
        }

        // MODE SUMBER TUNGGAL (REPLACE ALL):
        // Hapus seluruh siswa lama yang tidak terdapat dalam file Excel terbaru
        let deletedStudentCount = 0;
        if (replaceExisting) {
          const leftoverStudents = existingStudents.filter((st: any) => {
            if (usedExistingIds.has(st.id)) return false;
            if (targetClassId) {
              return st.class_id === targetClassId;
            }
            return true;
          });

          const leftoverIds = leftoverStudents.map((st: any) => st.id);
          deletedStudentCount = leftoverIds.length;

          if (leftoverIds.length > 0) {
            // 1. Bersihkan profiles & akun pengguna siswa yang tidak ada di file baru
            try {
              const { data: linkedProfiles } = await admin
                .from('profiles')
                .select('id')
                .eq('school_id', schoolId)
                .in('student_id', leftoverIds);

              for (const lp of linkedProfiles || []) {
                try {
                  await admin.from('user_class_assignments').delete().eq('user_id', lp.id);
                  await admin.from('profiles').delete().eq('id', lp.id);
                  await admin.auth.admin.deleteUser(lp.id);
                } catch (_) {}
              }
            } catch (_) {}

            // 2. Bersihkan catatan presensi dan izin siswa yang dihapus
            try {
              const CHUNK = 100;
              for (let i = 0; i < leftoverIds.length; i += CHUNK) {
                const slice = leftoverIds.slice(i, i + CHUNK);
                await admin.from('attendance_records').delete().in('student_id', slice).eq('school_id', schoolId);
                try {
                  await admin.from('leave_requests').delete().in('student_id', slice).eq('school_id', schoolId);
                } catch (_) {}
              }
            } catch (_) {}

            // 3. Lepas referensi student_id di profiles tersisa
            try {
              await admin.from('profiles').update({ student_id: null }).in('student_id', leftoverIds).eq('school_id', schoolId);
            } catch (_) {}

            // 4. Hapus baris siswa dari tabel students
            const CHUNK = 100;
            for (let i = 0; i < leftoverIds.length; i += CHUNK) {
              const slice = leftoverIds.slice(i, i + CHUNK);
              const { error: delErr } = await admin.from('students').delete().in('id', slice).eq('school_id', schoolId);
              if (delErr) {
                console.warn('[admin-users] Error deleting leftover students in replace mode:', delErr.message);
              }
            }
          }
        }

      // Auto-sinkronisasi relasi profil siswa (profiles.student_id) dengan data tabel students
      try {
        const { data: unlinkedProfiles } = await admin
          .from('profiles')
          .select('id, username, name')
          .eq('school_id', schoolId)
          .eq('role', 'SISWA')
          .is('student_id', null);

        if (unlinkedProfiles && unlinkedProfiles.length > 0) {
          const { data: allCurrentStudents } = await admin
            .from('students')
            .select('id, nisn, nama')
            .eq('school_id', schoolId);

          for (const p of unlinkedProfiles) {
            const matched = (allCurrentStudents || []).find(
              (st: any) =>
                (st.nisn && p.username && String(st.nisn).trim() === String(p.username).trim()) ||
                (st.nama && p.name && st.nama.trim().toLowerCase() === p.name.trim().toLowerCase())
            );
            if (matched) {
              await admin.from('profiles').update({ student_id: matched.id }).eq('id', p.id);
            }
          }
        }
      } catch (linkErr: any) {
        console.warn('[admin-users] Non-critical profile relink notice:', linkErr?.message);
      }

      // 4. Catat aktivitas ke audit_logs
      try {
        await admin.from('audit_logs').insert({
          actor_id: caller.user.id,
          actor_name: caller.user.user_metadata?.name || profile?.name || 'Admin',
          actor_role: callerRole,
          action: 'IMPORT_STUDENTS',
          school_id: schoolId,
          details: {
            count: items.length,
            replaceExisting,
            deletedCount: deletedStudentCount,
            targetClassId,
          },
        });
      } catch (_) {}

      return json(res, 200, {
        ok: true,
        success: true,
        count: items.length,
        deletedCount: deletedStudentCount,
        message: `Berhasil mengimpor ${items.length} data siswa.${deletedStudentCount > 0 ? ` Sebanyak ${deletedStudentCount} data siswa lama dihapus sesuai isi file terbaru.` : ''}`,
      });
    }

    if (action === 'delete_student') {
      if (!['ADMIN', 'SUPER_ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL'].includes(callerRole) && !isPersonalOwner) {
        return json(res, 403, { error: 'Tidak berwenang menghapus siswa.' });
      }
      const studentId = body.studentId || body.student_id;
      if (!studentId) return json(res, 400, { error: 'ID siswa wajib disertakan.' });
      const targetSchoolId = schoolId || callerSchoolId;

      // 1. Hapus akun pengguna yang tertaut ke siswa ini
      try {
        const { data: linkedProfiles } = await admin.from('profiles')
          .select('id, username')
          .eq('school_id', targetSchoolId)
          .eq('student_id', studentId);

        for (const lp of linkedProfiles || []) {
          try {
            await admin.from('user_class_assignments').delete().eq('user_id', lp.id);
            await admin.from('profiles').delete().eq('id', lp.id);
            await admin.auth.admin.deleteUser(lp.id);
          } catch (_) {}
        }
      } catch (_) {}

      // 2. Hapus catatan presensi siswa
      try {
        await admin.from('attendance_records').delete().eq('student_id', studentId).eq('school_id', targetSchoolId);
      } catch (e: any) {
        console.warn('[admin-users] attendance_records student cleanup warning:', e?.message);
      }

      // 3. Lepas rujukan student_id pada profiles yang tersisa
      try {
        await admin.from('profiles').update({ student_id: null }).eq('student_id', studentId);
      } catch (_) {}

      // 4. Hapus baris siswa dari tabel students
      const { error: delErr } = await admin.from('students').delete().eq('id', studentId).eq('school_id', targetSchoolId);
      if (delErr) {
        return json(res, 500, { error: `Gagal menghapus siswa dari database: ${delErr.message}` });
      }

      return json(res, 200, { ok: true, success: true, message: 'Data siswa berhasil dihapus permanen dari database.' });
    }

    if (action === 'delete_students_by_class') {
      if (!['ADMIN', 'SUPER_ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL'].includes(callerRole) && !isPersonalOwner) {
        return json(res, 403, { error: 'Tidak berwenang menghapus siswa kelas.' });
      }
      const classId = body.classId || body.class_id;
      if (!classId) return json(res, 400, { error: 'ID kelas wajib disertakan.' });
      const targetSchoolId = schoolId || callerSchoolId;

      const { data: targetStudents } = await admin
        .from('students')
        .select('id')
        .eq('class_id', classId)
        .eq('school_id', targetSchoolId);

      const sIds = (targetStudents || []).map((s: any) => s.id);
      if (sIds.length > 0) {
        // 1. Hapus akun pengguna terkait
        try {
          const { data: linkedProfiles } = await admin.from('profiles')
            .select('id')
            .eq('school_id', targetSchoolId)
            .in('student_id', sIds);

          for (const lp of linkedProfiles || []) {
            try {
              await admin.from('user_class_assignments').delete().eq('user_id', lp.id);
              await admin.from('profiles').delete().eq('id', lp.id);
              await admin.auth.admin.deleteUser(lp.id);
            } catch (_) {}
          }
        } catch (_) {}

        // 2. Hapus catatan presensi
        try {
          await admin.from('attendance_records').delete().in('student_id', sIds).eq('school_id', targetSchoolId);
        } catch (_) {}

        // 3. Lepas rujukan student_id pada profiles
        try {
          await admin.from('profiles').update({ student_id: null }).eq('school_id', targetSchoolId).in('student_id', sIds);
        } catch (_) {}

        // 4. Hapus data siswa
        const { error: delErr } = await admin.from('students').delete().eq('class_id', classId).eq('school_id', targetSchoolId);
        if (delErr) {
          return json(res, 500, { error: `Gagal menghapus siswa kelas dari database: ${delErr.message}` });
        }
      }

      return json(res, 200, { ok: true, success: true, message: 'Seluruh data siswa dalam kelas berhasil dihapus permanen.' });
    }

    if (action === 'delete_class') {
      if (!['ADMIN', 'SUPER_ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS'].includes(callerRole) && !isPersonalOwner) {
        return json(res, 403, { error: 'Tidak berwenang menghapus kelas.' });
      }
      const classId = body.classId || body.class_id;
      if (!classId) return json(res, 400, { error: 'ID kelas wajib disertakan.' });
      const targetSchoolId = schoolId || callerSchoolId;

      // 1. Lepas penugasan kelas pada siswa agar tidak ada foreign key violation
      await admin.from('students').update({ class_id: null }).eq('class_id', classId).eq('school_id', targetSchoolId);

      // 2. Bersihkan catatan presensi kelas
      try {
        await admin.from('attendance_records').delete().eq('class_id', classId).eq('school_id', targetSchoolId);
      } catch (_) {}

      // 3. Bersihkan penugasan kelas mapel, jadwal & user_class_assignments
      try {
        await admin.from('subject_schedule_days').delete().eq('class_id', classId);
        await admin.from('subject_class_assignments').delete().eq('class_id', classId).eq('school_id', targetSchoolId);
        await admin.from('user_class_assignments').delete().eq('class_id', classId);
        await admin.from('teacher_assignments').delete().eq('class_id', classId).eq('school_id', targetSchoolId);
        await admin.from('teacher_class_assignments').delete().eq('class_id', classId).eq('school_id', targetSchoolId);
      } catch (_) {}

      // 4. Hapus kelas
      const { error: delErr } = await admin.from('classes').delete().eq('id', classId).eq('school_id', targetSchoolId);
      if (delErr) {
        return json(res, 500, { error: `Gagal menghapus kelas dari database: ${delErr.message}` });
      }

      return json(res, 200, { ok: true, success: true, message: 'Kelas beserta seluruh relasi berhasil dihapus permanen.' });
    }

    if (action === 'import_classes') {
      if (!['ADMIN', 'SUPER_ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS'].includes(callerRole) && !isPersonalOwner) {
        return json(res, 403, { error: 'Tidak berwenang mengimpor kelas.' });
      }
      const items = Array.isArray(body.items) ? body.items : [];
      const replaceExisting = !!body.replaceExisting;
      const academicYear = body.academicYear || '2026/2027';

      const { data: existingClassesData } = await admin
        .from('classes')
        .select('id, name, grade, academic_year, wali_kelas_teacher_id')
        .eq('school_id', schoolId);
      const existingClasses = existingClassesData || [];

      const { data: teachersData } = await admin
        .from('teachers')
        .select('id, nama')
        .eq('school_id', schoolId);
      const teachersList = teachersData || [];

      const classByName = new Map<string, any>();
      for (const c of existingClasses) {
        classByName.set(String(c.name || '').trim().toLowerCase(), c);
      }

      const usedIds = new Set<string>();
      const toUpdate: any[] = [];
      const toInsert: any[] = [];

      for (const item of items) {
        let rawName = String(item.name || '').trim();
        let cleanWali = String(item.waliKelasNameInput || '').trim();

        // Deteksi jika terbalik (nama kelas terisi nama orang, dan wali terisi nama kelas)
        const isNameTeacher = teachersList.some((t: any) => String(t.nama || '').trim().toLowerCase() === rawName.toLowerCase()) ||
          /\b(s\.pd|m\.pd|s\.ag|s\.kom|s\.si|m\.si|s\.sos|drs|dra)\b/i.test(rawName);
        const isWaliClass = /^(kelas|rombel|\d+[a-z]?|[ivx]+[a-z]?)/i.test(cleanWali);

        if (isNameTeacher && isWaliClass) {
          const temp = rawName;
          rawName = cleanWali;
          cleanWali = temp;
        }

        if (!rawName) continue;
        const matchNum = rawName.match(/\d+/);
        const grade = item.grade || (matchNum ? parseInt(matchNum[0], 10) : 1);
        let waliId = item.wali_kelas_teacher_id || item.waliKelasTeacherId || null;
        if (!waliId && cleanWali) {
          const cleanWaliLower = cleanWali.toLowerCase();
          const match = teachersList.find((t: any) => String(t.nama || '').trim().toLowerCase() === cleanWaliLower);
          if (match) {
            waliId = match.id;
          } else if (cleanWali && !isWaliClass) {
            const { data: newTeacher } = await admin
              .from('teachers')
              .insert({
                school_id: schoolId,
                nama: cleanWali,
                tugas_utama: 'Wali Kelas',
                jenis_kelamin: 'L',
              })
              .select('id, nama')
              .single();
            if (newTeacher?.id) {
              waliId = newTeacher.id;
              teachersList.push(newTeacher);
            }
          }
        }

        const existing = classByName.get(rawName.toLowerCase());
        if (existing) {
          usedIds.add(existing.id);
          toUpdate.push({
            id: existing.id,
            name: rawName,
            grade,
            academic_year: item.academic_year || academicYear,
            wali_kelas_teacher_id: waliId,
          });
        } else {
          toInsert.push({
            school_id: schoolId,
            name: rawName,
            grade,
            academic_year: item.academic_year || academicYear,
            wali_kelas_teacher_id: waliId,
          });
        }
      }

      for (const upd of toUpdate) {
        await admin.from('classes').update({
          name: upd.name,
          grade: upd.grade,
          academic_year: upd.academic_year,
          wali_kelas_teacher_id: upd.wali_kelas_teacher_id,
        }).eq('id', upd.id).eq('school_id', schoolId);
      }

      if (toInsert.length > 0) {
        const { error: insErr } = await admin.from('classes').insert(toInsert);
        if (insErr) {
          return json(res, 500, { error: `Gagal menambahkan kelas: ${insErr.message}` });
        }
      }

      let deletedClassCount = 0;
      if (replaceExisting) {
        const leftovers = existingClasses.filter((c: any) => !usedIds.has(c.id));
        deletedClassCount = leftovers.length;
        for (const l of leftovers) {
          try {
            await admin.from('students').update({ class_id: null }).eq('class_id', l.id).eq('school_id', schoolId);
            await admin.from('subject_schedule_days').delete().eq('class_id', l.id);
            await admin.from('subject_class_assignments').delete().eq('class_id', l.id).eq('school_id', schoolId);
            await admin.from('user_class_assignments').delete().eq('class_id', l.id);
            await admin.from('teacher_assignments').delete().eq('class_id', l.id).eq('school_id', schoolId);
            await admin.from('teacher_class_assignments').delete().eq('class_id', l.id).eq('school_id', schoolId);
            await admin.from('attendance_records').delete().eq('class_id', l.id).eq('school_id', schoolId);
            await admin.from('classes').delete().eq('id', l.id).eq('school_id', schoolId);
          } catch (delErr: any) {
            console.warn('[admin-users] Error deleting leftover class in replace mode:', delErr?.message);
          }
        }
      }

      return json(res, 200, {
        ok: true,
        success: true,
        count: toUpdate.length + toInsert.length,
        deletedCount: deletedClassCount,
        message: `Berhasil mengimpor ${toUpdate.length + toInsert.length} data rombel kelas.${deletedClassCount > 0 ? ` Sebanyak ${deletedClassCount} rombel kelas lama dihapus sesuai isi file terbaru.` : ''}`,
      });
    }

    if (action === 'generate_all_accounts') {
      if (!['ADMIN', 'SUPER_ADMIN'].includes(callerRole) && !isPersonalOwner) {
        return json(res, 403, { error: 'Tidak berwenang mengenerate akun pengguna.' });
      }

      const resetExisting = !!body.resetExistingPasswords;
      const customPassword = body.customPassword ? String(body.customPassword).trim() : '';

      // Helper untuk password acak aman
      const createPassword = (): string => {
        if (customPassword && customPassword.length >= 6) return customPassword;
        const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
        const lowers = "abcdefghijkmnopqrstuvwxyz";
        const digits = "23456789";
        const chars = uppers + lowers + digits;
        let pwd = uppers[Math.floor(Math.random() * uppers.length)] +
                  lowers[Math.floor(Math.random() * lowers.length)] +
                  digits[Math.floor(Math.random() * digits.length)];
        for (let i = 3; i < 8; i++) {
          pwd += chars[Math.floor(Math.random() * chars.length)];
        }
        return pwd.split('').sort(() => 0.5 - Math.random()).join('');
      };

      // Helper sanitasi username: wajib diawali huruf/angka, 3-45 karakter, karakter valid
      const sanitizeCandidate = (raw: string, prefix: string): string => {
        let clean = (raw || '').toLowerCase().replace(/[^a-z0-9._-]/g, '');
        // Pastikan karakter pertama adalah alfabet atau angka
        clean = clean.replace(/^[^a-z0-9]+/, '');
        if (clean.length < 3) {
          clean = `${prefix}${clean || Math.floor(100 + Math.random() * 900)}`;
        }
        return clean.slice(0, 45);
      };

      // Ambil seluruh data master secara komprehensif
      const [
        teachersRes,
        classesRes,
        subjectsRes,
        subjectTeacherScopeRes,
        subjectClassScopeRes,
        studentsRes,
        schoolProfileRes,
        profilesRes,
      ] = await Promise.all([
        admin.from('teachers').select('*').eq('school_id', schoolId).order('nama'),
        admin.from('classes').select('*, wali:wali_kelas_teacher_id(id,nama,nip)').eq('school_id', schoolId).order('grade').order('name'),
        admin.from('subjects').select('*').eq('school_id', schoolId),
        admin.from('subject_teacher_assignments').select('subject_id,teacher_id,academic_year').eq('school_id', schoolId),
        admin.from('subject_class_assignments').select('subject_id,class_id,academic_year').eq('school_id', schoolId),
        admin.from('students').select('*, classes:class_id(id,name,grade,academic_year)').eq('school_id', schoolId).order('nama'),
        admin.from('school_profile').select('*').eq('school_id', schoolId).maybeSingle(),
        admin.from('profiles').select('*').eq('school_id', schoolId),
      ]);

      const teachersList = teachersRes.data || [];
      const classesList = classesRes.data || [];
      const subjectsList = subjectsRes.data || [];
      const studentsList = studentsRes.data || [];
      const profilesList = profilesRes.data || [];
      const schoolProfileData = schoolProfileRes.data || {};
      const activeAcademicYear = String(schoolProfileData.tahun_pelajaran || '2026/2027').trim() || '2026/2027';

      // Scope pemetaan guru mapel
      const teacherSubjectScope = new Map<string, string[]>();
      const subjectClassScope = new Map<string, string[]>();

      (subjectTeacherScopeRes.data || [])
        .filter((a: any) => !a.academic_year || a.academic_year === activeAcademicYear)
        .forEach((a: any) => {
          const ids = teacherSubjectScope.get(a.teacher_id) || [];
          if (!ids.includes(a.subject_id)) ids.push(a.subject_id);
          teacherSubjectScope.set(a.teacher_id, ids);
        });

      (subjectClassScopeRes.data || [])
        .filter((a: any) => !a.academic_year || a.academic_year === activeAcademicYear)
        .forEach((a: any) => {
          const ids = subjectClassScope.get(a.subject_id) || [];
          if (!ids.includes(a.class_id)) ids.push(a.class_id);
          subjectClassScope.set(a.subject_id, ids);
        });

      // Kumpulan username yang sudah digunakan di seluruh profiles
      const usedUsernames = new Set<string>();
      for (const p of profilesList) {
        if (p.username) usedUsernames.add(String(p.username).trim().toLowerCase());
      }

      // Helper untuk mendapatkan username unik anti-kolisi
      const getUniqueUsername = (candidate: string, currentUserId?: string): string => {
        let u = candidate.toLowerCase();
        if (currentUserId) {
          const existingProfile = profilesList.find((p: any) => p.id === currentUserId);
          if (existingProfile && existingProfile.username) {
            return String(existingProfile.username).trim().toLowerCase();
          }
        }
        let counter = 2;
        while (usedUsernames.has(u)) {
          u = `${candidate}${counter}`.toLowerCase();
          counter++;
        }
        usedUsernames.add(u);
        return u;
      };

      // Helper pembuat / pembaru akun Supabase Auth
      const ensureAuthUser = async (
        email: string,
        password: string,
        meta: { name: string; username: string; role: string }
      ): Promise<string> => {
        const { data: newAuth, error: newAuthErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { ...meta, school_id: schoolId },
        });

        if (newAuth?.user?.id) {
          return newAuth.user.id;
        }

        // Jika email sudah pernah terdaftar, cari user auth dan perbarui password
        if (newAuthErr && (newAuthErr.message.toLowerCase().includes('already') || newAuthErr.message.toLowerCase().includes('exists'))) {
          const { data: userList } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existingAuth = (userList?.users || []).find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
          if (existingAuth) {
            await admin.auth.admin.updateUserById(existingAuth.id, {
              password,
              user_metadata: { ...meta, school_id: schoolId },
            });
            return existingAuth.id;
          }
        }

        throw new Error(newAuthErr?.message || `Gagal membuat akun autentikasi untuk ${email}`);
      };

      const results: Array<{
        id?: string;
        name: string;
        username: string;
        password?: string;
        role: string;
        category: 'KEPALA SEKOLAH' | 'GURU' | 'SISWA';
        className?: string;
        status: 'CREATED' | 'UPDATED' | 'ACTIVE';
        error?: string;
      }> = [];

      // ==========================================
      // 1. GENERATE AKUN KEPALA SEKOLAH
      // ==========================================
      const ksName = String(schoolProfileData.nama_kepala_sekolah || '').trim();
      const ksNip = String(schoolProfileData.nip_kepala_sekolah || '').trim();
      if (ksName) {
        const existingKs = profilesList.find((p: any) => p.role === 'KEPALA SEKOLAH' || (ksNip && p.username === ksNip));
        const ksUsername = existingKs?.username
          ? String(existingKs.username).trim().toLowerCase()
          : getUniqueUsername(sanitizeCandidate(ksNip || ksName, 'ks'), existingKs?.id);
        const ksEmail = `${ksUsername}@login.edushift.local`;
        const ksPassword = createPassword();

        try {
          if (!existingKs) {
            const authId = await ensureAuthUser(ksEmail, ksPassword, { name: ksName, username: ksUsername, role: 'KEPALA SEKOLAH' });
            await admin.from('profiles').upsert({
              id: authId,
              school_id: schoolId,
              name: ksName,
              username: ksUsername,
              email: ksEmail,
              role: 'KEPALA SEKOLAH',
              is_active: true,
              must_change_password: false,
            });
            results.push({
              id: authId,
              name: ksName,
              username: ksUsername,
              password: ksPassword,
              role: 'KEPALA SEKOLAH',
              category: 'KEPALA SEKOLAH',
              status: 'CREATED',
            });
          } else if (resetExisting) {
            await admin.auth.admin.updateUserById(existingKs.id, { password: ksPassword });
            await admin.from('profiles').update({
              name: ksName,
              role: 'KEPALA SEKOLAH',
              is_active: true,
              must_change_password: false,
            }).eq('id', existingKs.id);
            results.push({
              id: existingKs.id,
              name: ksName,
              username: ksUsername,
              password: ksPassword,
              role: 'KEPALA SEKOLAH',
              category: 'KEPALA SEKOLAH',
              status: 'UPDATED',
            });
          } else {
            results.push({
              id: existingKs.id,
              name: ksName,
              username: ksUsername,
              role: 'KEPALA SEKOLAH',
              category: 'KEPALA SEKOLAH',
              status: 'ACTIVE',
            });
          }
        } catch (ksErr: any) {
          console.warn('[generate_all_accounts] KS error:', ksErr.message);
          results.push({
            name: ksName,
            username: ksUsername,
            role: 'KEPALA SEKOLAH',
            category: 'KEPALA SEKOLAH',
            status: 'ACTIVE',
            error: ksErr.message,
          });
        }
      }

      // ==========================================
      // 2. GENERATE SELURUH AKUN GURU
      // ==========================================
      for (const teacher of teachersList) {
        const teacherName = String(teacher.nama || '').trim();
        if (!teacherName) continue;

        // Cari profil guru yang sudah ada berdasarkan teacher_id, NIP, atau nama
        const existingTeacherProfile = profilesList.find((p: any) =>
          (p.teacher_id && p.teacher_id === teacher.id) ||
          (teacher.nip && teacher.nip !== '-' && p.username && String(p.username).trim().toLowerCase() === String(teacher.nip).trim().toLowerCase()) ||
          (p.name && String(p.name).trim().toLowerCase() === teacherName.toLowerCase() && ['WALI KELAS', 'GURU MAPEL', 'ADMIN'].includes(p.role))
        );

        // Cari assignment Wali Kelas
        const linkedHomeroom = classesList.find((c: any) =>
          c.wali_kelas_teacher_id === teacher.id ||
          (c.wali?.nama && String(c.wali.nama).trim().toLowerCase() === teacherName.toLowerCase())
        );

        // Cari assignment Guru Mapel
        const assignedSubjectIds = teacherSubjectScope.get(teacher.id) || [];
        const directSubjects = subjectsList.filter((s: any) =>
          s.teacher_id === teacher.id ||
          (s.teacher_name && String(s.teacher_name).trim().toLowerCase() === teacherName.toLowerCase())
        );
        const combinedSubjectIds = Array.from(new Set([...assignedSubjectIds, ...directSubjects.map((s: any) => s.id)]));
        const teacherSubjects = combinedSubjectIds
          .map((sid) => subjectsList.find((s: any) => s.id === sid))
          .filter(Boolean);

        const isWali = !!linkedHomeroom || teacher.tugas_utama === 'Wali Kelas';
        const isMapel = teacherSubjects.length > 0 || teacher.tugas_utama === 'Guru Mapel';
        let role = 'GURU MAPEL';
        if (isWali && !isMapel) role = 'WALI KELAS';
        else if (isMapel && !isWali) role = 'GURU MAPEL';
        else if (isWali && isMapel) role = teacher.tugas_utama === 'Wali Kelas' ? 'WALI KELAS' : 'GURU MAPEL';
        else role = teacher.tugas_utama === 'Wali Kelas' ? 'WALI KELAS' : 'GURU MAPEL';

        let classIds: string[] = [];
        let assignmentDesc = '';
        if (role === 'WALI KELAS') {
          if (linkedHomeroom) {
            classIds = [linkedHomeroom.id];
            assignmentDesc = `Wali Kelas ${linkedHomeroom.name}`;
          } else {
            assignmentDesc = 'Wali Kelas';
          }
        } else {
          const mapelNames = teacherSubjects.map((s: any) => s.name).join(', ') || teacher.tugas_utama || 'Guru Mapel';
          const targetClassIds = Array.from(new Set(
            teacherSubjects.flatMap((s: any) => {
              const fromScope = subjectClassScope.get(s.id) || [];
              const fromDirect = (s.target_class_ids || []) as string[];
              return [...fromScope, ...fromDirect];
            })
          ));
          classIds = targetClassIds;
          const targetClassNames = targetClassIds
            .map((cid) => classesList.find((c: any) => c.id === cid)?.name || '')
            .filter(Boolean);
          assignmentDesc = `${mapelNames}${targetClassNames.length > 0 ? ` (${targetClassNames.join(', ')})` : ''}`;
        }

        const teacherUsername = existingTeacherProfile?.username
          ? String(existingTeacherProfile.username).trim().toLowerCase()
          : getUniqueUsername(sanitizeCandidate(teacher.nip && teacher.nip !== '-' ? teacher.nip : teacherName, 'guru'), existingTeacherProfile?.id);
        const teacherEmail = `${teacherUsername}@login.edushift.local`;
        const teacherPassword = createPassword();

        try {
          if (!existingTeacherProfile) {
            const authId = await ensureAuthUser(teacherEmail, teacherPassword, { name: teacherName, username: teacherUsername, role });
            await admin.from('profiles').upsert({
              id: authId,
              school_id: schoolId,
              name: teacherName,
              username: teacherUsername,
              email: teacherEmail,
              role,
              teacher_id: teacher.id,
              is_active: true,
              must_change_password: false,
            });

            // Sinkronkan penugasan kelas
            if (classIds.length > 0) {
              await admin.from('user_class_assignments').delete().eq('user_id', authId);
              const assignRows = classIds.map((cid) => ({ user_id: authId, class_id: cid }));
              await admin.from('user_class_assignments').insert(assignRows);
            }

            if (role === 'WALI KELAS' && linkedHomeroom) {
              await admin.from('classes').update({ wali_kelas_teacher_id: teacher.id }).eq('id', linkedHomeroom.id);
            }

            results.push({
              id: authId,
              name: teacherName,
              username: teacherUsername,
              password: teacherPassword,
              role,
              category: 'GURU',
              className: assignmentDesc,
              status: 'CREATED',
            });
          } else if (resetExisting) {
            await admin.auth.admin.updateUserById(existingTeacherProfile.id, { password: teacherPassword });
            await admin.from('profiles').update({
              name: teacherName,
              role,
              teacher_id: teacher.id,
              is_active: true,
              must_change_password: false,
            }).eq('id', existingTeacherProfile.id);

            if (classIds.length > 0) {
              await admin.from('user_class_assignments').delete().eq('user_id', existingTeacherProfile.id);
              const assignRows = classIds.map((cid) => ({ user_id: existingTeacherProfile.id, class_id: cid }));
              await admin.from('user_class_assignments').insert(assignRows);
            }

            if (role === 'WALI KELAS' && linkedHomeroom) {
              await admin.from('classes').update({ wali_kelas_teacher_id: teacher.id }).eq('id', linkedHomeroom.id);
            }

            results.push({
              id: existingTeacherProfile.id,
              name: teacherName,
              username: teacherUsername,
              password: teacherPassword,
              role,
              category: 'GURU',
              className: assignmentDesc,
              status: 'UPDATED',
            });
          } else {
            // Pastikan kaitan teacher_id selalu tersambung
            if (!existingTeacherProfile.teacher_id) {
              await admin.from('profiles').update({ teacher_id: teacher.id }).eq('id', existingTeacherProfile.id);
            }
            results.push({
              id: existingTeacherProfile.id,
              name: teacherName,
              username: teacherUsername,
              role,
              category: 'GURU',
              className: assignmentDesc,
              status: 'ACTIVE',
            });
          }
        } catch (tErr: any) {
          console.warn('[generate_all_accounts] Teacher error:', teacherName, tErr.message);
          results.push({
            name: teacherName,
            username: teacherUsername,
            password: teacherPassword,
            role,
            category: 'GURU',
            className: assignmentDesc,
            status: 'ACTIVE',
            error: tErr.message,
          });
        }
      }

      // ==========================================
      // 3. GENERATE SELURUH AKUN SISWA
      // ==========================================
      for (const student of studentsList) {
        const studentName = String(student.nama || '').trim();
        if (!studentName) continue;

        const studentClass = classesList.find((c: any) => c.id === student.class_id);
        const studentClassName = studentClass?.name || student.class_name || '-';

        // Cari profil siswa yang sudah ada berdasarkan student_id atau NISN
        const existingStudentProfile = profilesList.find((p: any) =>
          p.role === 'SISWA' &&
          ((p.student_id && p.student_id === student.id) ||
           (student.nisn && student.nisn !== '-' && p.username && String(p.username).trim().toLowerCase() === String(student.nisn).trim().toLowerCase()))
        );

        const studentUsername = existingStudentProfile?.username
          ? String(existingStudentProfile.username).trim().toLowerCase()
          : getUniqueUsername(sanitizeCandidate(student.nisn && student.nisn !== '-' ? student.nisn : studentName, 'sis'), existingStudentProfile?.id);
        const studentEmail = `${studentUsername}@login.edushift.local`;
        const studentPassword = createPassword();

        try {
          if (!existingStudentProfile) {
            const authId = await ensureAuthUser(studentEmail, studentPassword, { name: studentName, username: studentUsername, role: 'SISWA' });
            await admin.from('profiles').upsert({
              id: authId,
              school_id: schoolId,
              name: studentName,
              username: studentUsername,
              email: studentEmail,
              role: 'SISWA',
              student_id: student.id,
              is_active: true,
              must_change_password: false,
            });

            results.push({
              id: authId,
              name: studentName,
              username: studentUsername,
              password: studentPassword,
              role: 'SISWA',
              category: 'SISWA',
              className: studentClassName,
              status: 'CREATED',
            });
          } else if (resetExisting) {
            await admin.auth.admin.updateUserById(existingStudentProfile.id, { password: studentPassword });
            await admin.from('profiles').update({
              name: studentName,
              role: 'SISWA',
              student_id: student.id,
              is_active: true,
              must_change_password: false,
            }).eq('id', existingStudentProfile.id);

            results.push({
              id: existingStudentProfile.id,
              name: studentName,
              username: studentUsername,
              password: studentPassword,
              role: 'SISWA',
              category: 'SISWA',
              className: studentClassName,
              status: 'UPDATED',
            });
          } else {
            // Pastikan kaitan student_id selalu tersambung
            if (!existingStudentProfile.student_id) {
              await admin.from('profiles').update({ student_id: student.id }).eq('id', existingStudentProfile.id);
            }
            results.push({
              id: existingStudentProfile.id,
              name: studentName,
              username: studentUsername,
              role: 'SISWA',
              category: 'SISWA',
              className: studentClassName,
              status: 'ACTIVE',
            });
          }
        } catch (sErr: any) {
          console.warn('[generate_all_accounts] Student error:', studentName, sErr.message);
          results.push({
            name: studentName,
            username: studentUsername,
            password: studentPassword,
            role: 'SISWA',
            category: 'SISWA',
            className: studentClassName,
            status: 'ACTIVE',
            error: sErr.message,
          });
        }
      }

      // Pastikan seluruh akun di sekolah ini tidak terkena onboarding ganti password
      try {
        await admin.from('profiles').update({ must_change_password: false }).eq('school_id', schoolId);
      } catch (_) {}

      return json(res, 200, {
        ok: true,
        success: true,
        total: results.length,
        results,
        message: `Berhasil memproses seluruh ${results.length} akun pengguna tanpa ada yang tertinggal.`,
      });
    }

    return json(res, 400, { error: 'Operasi akun tidak dikenali.' });
  } catch (error: any) {
    return json(res, 500, { error: error?.message || 'Terjadi kesalahan server.' });
  }
}
