import { createClient } from '@supabase/supabase-js';
import { sendAttendancePushToStudent } from './push-notification';

const json = (res: any, status: number, body: unknown) =>
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));

const ALLOWED_ROLES = ['ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL', 'SUPER_ADMIN'];

export default async function handler(req: any, res: any, env?: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Metode permintaan tidak diizinkan. Gunakan POST.' });

  const cfEnv = env || req?.env || {};
  const url = cfEnv.SUPABASE_URL || cfEnv.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceKey = cfEnv.SUPABASE_SERVICE_ROLE_KEY || cfEnv.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !serviceKey) {
    return json(res, 500, { error: 'Konfigurasi server SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum terpasang di Cloudflare Worker atau Vercel.' });
  }

  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return json(res, 401, { error: 'Sesi login tidak ditemukan.' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json(res, 401, { error: 'Sesi login tidak valid atau telah kedaluwarsa.' });

  const userId = authData.user.id;
  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id, role, school_id, teacher_id, student_id, name, username')
    .eq('id', userId)
    .maybeSingle();

  if (profileErr || !profile) {
    return json(res, 403, { error: 'Profil pengguna tidak ditemukan.' });
  }

  const body = req.body || {};
  const action = body.action || 'save_daily';
  const userRole = String(profile.role || '').toUpperCase().trim();
  const callerSchoolId = profile.school_id || null;

  // Verifikasi otorisasi sekolah secara ketat
  let isAuthorizedForSchool = userRole === 'SUPER_ADMIN';
  let targetSchoolId = callerSchoolId;

  if (userRole === 'SUPER_ADMIN') {
    targetSchoolId = body.schoolId || body.payload?.school_id || callerSchoolId;
    isAuthorizedForSchool = true;
  } else {
    // Pengguna non-SuperAdmin: jika request meminta sekolah lain, verifikasi kepemilikan sekolah
    const requestedSchoolId = body.schoolId || body.payload?.school_id || callerSchoolId;
    if (requestedSchoolId && requestedSchoolId !== callerSchoolId) {
      // Cek apakah caller adalah pemilik sah (owner_id) dari requestedSchoolId
      const { data: schCheck } = await admin
        .from('schools')
        .select('id, owner_id')
        .eq('id', requestedSchoolId)
        .maybeSingle();

      if (schCheck && schCheck.owner_id === userId) {
        targetSchoolId = requestedSchoolId;
        isAuthorizedForSchool = true;
      } else {
        return json(res, 403, {
          error: 'Akses ditolak: Anda tidak memiliki izin mengakses data sekolah ini. Setiap sekolah wajib menjaga kerahasiaan datanya masing-masing.',
        });
      }
    } else {
      targetSchoolId = callerSchoolId;
      isAuthorizedForSchool = Boolean(callerSchoolId);
    }
  }

  if (!targetSchoolId || !isAuthorizedForSchool) {
    return json(res, 403, {
      error: 'Akses ke data sekolah tidak diizinkan atau akun Anda belum terhubung dengan sekolah.',
    });
  }

  try {
    if (action === 'get_attendance') {
      let q = admin
        .from('attendance_records')
        .select('*')
        .eq('school_id', targetSchoolId)
        .order('date', { ascending: false })
        .limit(2500);

      if (body.date && typeof body.date === 'string') {
        q = q.eq('date', body.date.slice(0, 10));
      }
      if (userRole === 'SISWA') {
        let studentTargetId = profile.student_id;
        if (!studentTargetId) {
          const { data: matchedStu } = await admin
            .from('students')
            .select('id')
            .eq('school_id', targetSchoolId)
            .or(`nisn.eq.${profile.username},nama.ilike.${profile.name}`)
            .limit(1)
            .maybeSingle();
          if (matchedStu?.id) {
            studentTargetId = matchedStu.id;
            void admin.from('profiles').update({ student_id: matchedStu.id }).eq('id', userId);
          }
        }
        if (!studentTargetId) {
          return json(res, 200, { ok: true, records: [] });
        }
        q = q.eq('student_id', studentTargetId);
      }
      const { data, error } = await q;
      if (error) return json(res, 500, { error: error.message });
      return json(res, 200, { ok: true, records: data || [] });
    }

    if (action === 'save_daily') {
      if (!ALLOWED_ROLES.includes(userRole)) {
        return json(res, 403, { error: 'Role pengguna Anda tidak memiliki hak akses mencatat absensi.' });
      }

      const { date, type, subjectId, classId, targetStudentIds, payload } = body;
      if (!date) return json(res, 400, { error: 'Tanggal absensi wajib disertakan.' });

      // 1. Bersihkan record absensi lama untuk siswa target atau kelas target pada tanggal & moda tersebut
      // Jika targetStudentIds diberikan, bersihkan siswa-siswa tersebut.
      // Jika targetStudentIds kosong tapi classId ada, bersihkan seluruh kelas pada tanggal tersebut.
      let del = admin
        .from('attendance_records')
        .delete()
        .eq('date', date)
        .eq('type', type || 'DAILY');

      if (targetSchoolId) {
        del = del.or(`school_id.eq.${targetSchoolId},school_id.is.null`);
      }
      if (type === 'SUBJECT' && subjectId) {
        del = del.eq('subject_id', subjectId);
      }

      if (Array.isArray(targetStudentIds) && targetStudentIds.length > 0) {
        del = del.in('student_id', targetStudentIds);
      } else if (classId) {
        del = del.eq('class_id', classId);
      }

      const { error: delError } = await del;
      if (delError) {
        return json(res, 500, { error: `Gagal membersihkan data lama: ${delError.message}` });
      }

      // Jika classId disertakan dan payload kosong (artinya reset kelas), pastikan juga seluruh record rombel pada tanggal ini terhapus
      if (classId && (!Array.isArray(payload) || payload.length === 0)) {
        try {
          let classDel = admin
            .from('attendance_records')
            .delete()
            .eq('date', date)
            .eq('type', type || 'DAILY')
            .eq('class_id', classId);
          if (targetSchoolId) {
            classDel = classDel.or(`school_id.eq.${targetSchoolId},school_id.is.null`);
          }
          if (type === 'SUBJECT' && subjectId) {
            classDel = classDel.eq('subject_id', subjectId);
          }
          await classDel;
        } catch (_) {}
      }

      // 2. Simpan record absensi baru (hanya yang memiliki status presensi valid)
      if (Array.isArray(payload) && payload.length > 0) {
        const validPayload = payload.filter(
          (r: any) => Boolean(r && r.status && r.status !== '-' && (r.student_id || r.studentId))
        );

        const normalizedPayload = validPayload.map((r: any) => ({
          school_id: targetSchoolId || r.school_id || profile.school_id,
          date: r.date || date,
          student_id: r.student_id || r.studentId,
          class_id: r.class_id || r.classId || classId || null,
          type: r.type || type || 'DAILY',
          subject_id: r.subject_id || r.subjectId || (type === 'SUBJECT' ? subjectId : null),
          teacher_id: r.teacher_id || r.teacherId || profile.teacher_id || null,
          status: r.status,
          check_in_time: r.check_in_time || r.checkInTime || null,
          check_out_time: r.check_out_time || r.checkOutTime || null,
          notes: r.notes || null,
          updated_by: userId,
        }));

        if (normalizedPayload.length > 0) {
          // Coba upsert terlebih dahulu jika tabel memiliki unique constraint
          let saveSuccess = false;
          let lastInsertError: any = null;

          try {
            const { data: upserted, error: upsertErr } = await admin
              .from('attendance_records')
              .upsert(normalizedPayload, {
                onConflict: 'school_id,student_id,date,type,subject_id',
                ignoreDuplicates: false,
              })
              .select('id');

            if (!upsertErr) {
              saveSuccess = true;
              return json(res, 200, { ok: true, count: upserted?.length || normalizedPayload.length });
            } else {
              lastInsertError = upsertErr;
            }
          } catch (e: any) {
            lastInsertError = e;
          }

          // Jika upsert gagal (misal belum ada constraint unik di DB lama), lakukan insert langsung
          if (!saveSuccess) {
            const { data: inserted, error: insertError } = await admin
              .from('attendance_records')
              .insert(normalizedPayload)
              .select('id');

            if (insertError) {
              return json(res, 500, {
                error: `Gagal menyimpan data absensi: ${insertError.message || lastInsertError?.message}`,
              });
            }

            return json(res, 200, { ok: true, count: inserted?.length || normalizedPayload.length });
          }
        }
      }

      return json(res, 200, { ok: true, count: 0, message: 'Data absensi berhasil direset.' });
    }

    if (action === 'submit_student') {
      const { payload, existingId } = body;
      if (!payload || !payload.student_id || !payload.date) {
        return json(res, 400, { error: 'Payload absensi (student_id dan date) wajib disertakan.' });
      }

      let verifiedStudentId = profile.student_id;
      if (!verifiedStudentId && userRole === 'SISWA') {
        const { data: matchedStu } = await admin
          .from('students')
          .select('id')
          .eq('school_id', targetSchoolId)
          .or(`nisn.eq.${profile.username},nama.ilike.${profile.name}`)
          .limit(1)
          .maybeSingle();
        if (matchedStu?.id) {
          verifiedStudentId = matchedStu.id;
          void admin.from('profiles').update({ student_id: matchedStu.id }).eq('id', userId);
        }
      }

      if (userRole === 'SISWA' && verifiedStudentId && payload.student_id && payload.student_id !== verifiedStudentId) {
        return json(res, 403, { error: 'Anda hanya dapat mengirimkan presensi untuk akun Anda sendiri.' });
      }

      const isUuid = (val: unknown): val is string =>
        typeof val === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());

      const { data: studentRow } = await admin
        .from('students')
        .select('id, school_id, class_id, nama')
        .eq('id', payload.student_id)
        .maybeSingle();

      if (studentRow && studentRow.school_id && studentRow.school_id !== targetSchoolId) {
        return json(res, 403, { error: 'Siswa tidak terdaftar pada sekolah yang Anda tuju.' });
      }

      const resolvedSchoolId = targetSchoolId;

      const resolvedClassId =
        (isUuid(payload.class_id) ? payload.class_id : null) ||
        (isUuid(studentRow?.class_id) ? studentRow.class_id : null);

      let resolvedTeacherId = isUuid(payload.teacher_id) ? payload.teacher_id : null;
      if (!resolvedTeacherId && resolvedClassId) {
        const { data: classRow } = await admin
          .from('classes')
          .select('wali_kelas_teacher_id')
          .eq('id', resolvedClassId)
          .eq('school_id', targetSchoolId)
          .maybeSingle();
        if (isUuid(classRow?.wali_kelas_teacher_id)) {
          resolvedTeacherId = classRow.wali_kelas_teacher_id;
        }
      }
      if (!resolvedTeacherId && isUuid(profile.teacher_id)) {
        resolvedTeacherId = profile.teacher_id;
      }
      if (!resolvedTeacherId && resolvedSchoolId) {
        const { data: firstTeacher } = await admin
          .from('teachers')
          .select('id')
          .eq('school_id', resolvedSchoolId)
          .limit(1)
          .maybeSingle();
        if (isUuid(firstTeacher?.id)) {
          resolvedTeacherId = firstTeacher.id;
        }
      }

      const cleanDate = String(payload.date).slice(0, 10);

      let existingRow: any = null;
      if (isUuid(existingId)) {
        const { data: byId } = await admin
          .from('attendance_records')
          .select('*')
          .eq('id', existingId)
          .eq('school_id', targetSchoolId)
          .maybeSingle();
        if (byId && String(byId.date).slice(0, 10) === cleanDate) {
          existingRow = byId;
        }
      }
      if (!existingRow) {
        const { data: byDate } = await admin
          .from('attendance_records')
          .select('*')
          .eq('school_id', targetSchoolId)
          .eq('student_id', payload.student_id)
          .eq('date', cleanDate)
          .or('type.eq.DAILY,type.is.null')
          .limit(1)
          .maybeSingle();
        if (byDate) {
          existingRow = byDate;
        }
      }

      const normalizedPayload: Record<string, any> = {
        school_id: resolvedSchoolId,
        student_id: payload.student_id,
        class_id: resolvedClassId,
        date: cleanDate,
        type: 'DAILY',
        teacher_id: resolvedTeacherId,
        updated_by: isUuid(userId) ? userId : null,
      };

      if (payload.status) {
        normalizedPayload.status = payload.status;
      } else if (existingRow?.status) {
        normalizedPayload.status = existingRow.status;
      } else {
        normalizedPayload.status = 'Hadir';
      }

      if (payload.check_in_time !== undefined && payload.check_in_time !== null && payload.check_in_time !== '' && payload.check_in_time !== '-') {
        normalizedPayload.check_in_time = payload.check_in_time;
      } else if (existingRow?.check_in_time && existingRow.check_in_time !== '-') {
        normalizedPayload.check_in_time = existingRow.check_in_time;
      } else if (payload.check_out_time && payload.check_out_time !== '-') {
        normalizedPayload.check_in_time = '07:00';
      } else if (payload.check_in_time !== undefined) {
        normalizedPayload.check_in_time = payload.check_in_time;
      } else {
        normalizedPayload.check_in_time = '-';
      }

      if (payload.check_out_time !== undefined && payload.check_out_time !== null && payload.check_out_time !== '' && payload.check_out_time !== '-') {
        normalizedPayload.check_out_time = payload.check_out_time;
      } else if (existingRow?.check_out_time && existingRow.check_out_time !== '-') {
        normalizedPayload.check_out_time = existingRow.check_out_time;
      } else if (payload.check_out_time !== undefined) {
        normalizedPayload.check_out_time = payload.check_out_time;
      } else {
        normalizedPayload.check_out_time = '-';
      }

      if (payload.notes !== undefined) {
        normalizedPayload.notes = payload.notes;
      } else if (existingRow?.notes !== undefined) {
        normalizedPayload.notes = existingRow.notes;
      }

      const savedRecord = existingRow?.id
        ? await admin.from('attendance_records').update(normalizedPayload).eq('id', existingRow.id).select().single()
        : await admin.from('attendance_records').insert(normalizedPayload).select().single();

      if (savedRecord.error) return json(res, 500, { error: savedRecord.error.message });
      const record = savedRecord.data;

      // Pemicu otomatis Push Notification PWA ke HP Siswa & Orang Tua (Multi-Device)
      try {
        const isCheckOut = Boolean(
          (payload.check_out_time && payload.check_out_time !== '-' && payload.check_out_time !== '') ||
          (record.check_out_time && record.check_out_time !== '-' && record.check_out_time !== '')
        );
        const eventType = isCheckOut ? 'pulang' : 'masuk';
        const timeStr = isCheckOut
          ? (payload.check_out_time && payload.check_out_time !== '-' ? payload.check_out_time : record.check_out_time)
          : (payload.check_in_time && payload.check_in_time !== '-' ? payload.check_in_time : record.check_in_time);
        const studentName = studentRow?.nama || profile.name || 'Ananda';

        void sendAttendancePushToStudent({
          studentId: String(payload.student_id),
          studentName,
          eventType,
          timeStr,
          status: record.status,
          notes: record.notes,
        }).catch((pushErr) => {
          console.warn('[Push] Background dispatch failed:', pushErr);
        });
      } catch (err) {
        console.warn('[Push] Failed to trigger push notification:', err);
      }

      return json(res, 200, { ok: true, record });
    }

    // -------------------------------------------------------------
    // SURAT IZIN & SAKIT (LEAVE REQUESTS) WORKFLOW
    // -------------------------------------------------------------
    if (action === 'get_leave_requests') {
      let q = admin
        .from('leave_requests')
        .select('*')
        .eq('school_id', targetSchoolId)
        .order('submitted_at', { ascending: false });

      if (userRole === 'SISWA') {
        if (!profile.student_id) {
          return json(res, 200, { ok: true, requests: [] });
        }
        q = q.eq('student_id', profile.student_id);
      }
      const { data, error } = await q;
      if (error) return json(res, 500, { error: error.message });
      return json(res, 200, {
        ok: true,
        requests: (data || []).map((r: any) => ({
          id: r.id,
          schoolId: r.school_id,
          studentId: r.student_id,
          classId: r.class_id,
          studentName: r.student_name,
          nisn: r.nisn,
          className: r.class_name,
          requesterName: r.requester_name,
          requesterRole: r.requester_role,
          requesterPhone: r.requester_phone,
          leaveType: r.leave_type,
          subCategory: r.sub_category,
          startDate: r.start_date,
          endDate: r.end_date,
          reason: r.reason,
          attachmentUrl: r.attachment_url,
          attachmentName: r.attachment_name,
          status: r.status,
          submittedAt: r.submitted_at,
          reviewedBy: r.reviewed_by,
          reviewedAt: r.reviewed_at,
          reviewNotes: r.review_notes,
        })),
      });
    }

    if (action === 'submit_leave_request') {
      const { payload } = body;
      if (!payload) return json(res, 400, { error: 'Payload pengajuan izin wajib disertakan.' });

      let studentId = payload.student_id || payload.studentId;
      const schoolId = targetSchoolId; // Ketat: hanya simpan ke sekolah yang sah
      const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));

      // Jika role adalah SISWA, wajib hanya untuk akun siswa sendiri
      if (userRole === 'SISWA') {
        if (!profile.student_id) {
          return json(res, 403, { error: 'Akun siswa tidak terhubung dengan data siswa di sekolah ini.' });
        }
        studentId = profile.student_id;
      }

      // Validasi siswa di database harus terdaftar di schoolId ini (mencegah kebocoran lintas sekolah)
      let matchedStudent: any = null;
      if (studentId && isUUID(studentId)) {
        const { data: stu } = await admin
          .from('students')
          .select('id, school_id, class_id, nama, nisn')
          .eq('id', studentId)
          .eq('school_id', schoolId)
          .maybeSingle();
        if (stu) matchedStudent = stu;
      }

      if (!matchedStudent && payload.nisn) {
        const { data: stu } = await admin
          .from('students')
          .select('id, school_id, class_id, nama, nisn')
          .eq('nisn', payload.nisn)
          .eq('school_id', schoolId)
          .maybeSingle();
        if (stu) matchedStudent = stu;
      }

      if (!matchedStudent && (payload.student_name || payload.studentName)) {
        const sName = payload.student_name || payload.studentName;
        const { data: stu } = await admin
          .from('students')
          .select('id, school_id, class_id, nama, nisn')
          .ilike('nama', `%${sName}%`)
          .eq('school_id', schoolId)
          .maybeSingle();
        if (stu) matchedStudent = stu;
      }

      if (!matchedStudent) {
        return json(res, 404, {
          error: 'Siswa tidak ditemukan pada sekolah Anda. Pastikan nama atau NISN terdaftar di sekolah ini.',
        });
      }

      studentId = matchedStudent.id;
      const classId = (payload.class_id || payload.classId) && isUUID(payload.class_id || payload.classId)
        ? (payload.class_id || payload.classId)
        : (matchedStudent.class_id || null);

      const recordToInsert: any = {
        school_id: schoolId,
        student_id: studentId,
        class_id: classId,
        student_name: matchedStudent.nama || payload.student_name || payload.studentName || 'Siswa',
        nisn: matchedStudent.nisn || payload.nisn || null,
        class_name: payload.class_name || payload.className || null,
        requester_name: payload.requester_name || payload.requesterName || 'Orang Tua / Wali',
        requester_role: payload.requester_role || payload.requesterRole || 'Wali',
        requester_phone: payload.requester_phone || payload.requesterPhone || null,
        leave_type: String(payload.leave_type || payload.leaveType || 'sakit').toLowerCase(),
        sub_category: payload.sub_category || payload.subCategory || null,
        start_date: payload.start_date || payload.startDate || new Date().toISOString().slice(0, 10),
        end_date: payload.end_date || payload.endDate || payload.start_date || payload.startDate || new Date().toISOString().slice(0, 10),
        reason: payload.reason || '-',
        attachment_url: payload.attachment_url || payload.attachmentUrl || null,
        attachment_name: payload.attachment_name || payload.attachmentName || null,
        status: 'PENDING',
        submitted_at: new Date().toISOString(),
      };

      const { data, error } = await admin.from('leave_requests').insert(recordToInsert).select().single();
      if (error) {
        return json(res, 500, { error: `Gagal menyimpan permohonan izin: ${error.message}` });
      }

      return json(res, 200, {
        ok: true,
        request: {
          id: data.id,
          schoolId: data.school_id,
          studentId: data.student_id,
          classId: data.class_id,
          studentName: data.student_name,
          nisn: data.nisn,
          className: data.class_name,
          requesterName: data.requester_name,
          requesterRole: data.requester_role,
          requesterPhone: data.requester_phone,
          leaveType: data.leave_type,
          subCategory: data.sub_category,
          startDate: data.start_date,
          endDate: data.end_date,
          reason: data.reason,
          attachmentUrl: data.attachment_url,
          attachmentName: data.attachment_name,
          status: data.status,
          submittedAt: data.submitted_at,
          reviewedBy: data.reviewed_by,
          reviewedAt: data.reviewed_at,
          reviewNotes: data.review_notes,
        },
      });
    }

    if (action === 'update_leave_request_status') {
      if (!ALLOWED_ROLES.includes(userRole) || userRole === 'SISWA') {
        return json(res, 403, { error: 'Role pengguna Anda tidak memiliki hak verifikasi surat izin.' });
      }

      const { requestId, status, reviewNotes, reviewedBy } = body;
      if (!requestId || !status) return json(res, 400, { error: 'ID pengajuan dan status wajib disertakan.' });

      let updateQuery = admin
        .from('leave_requests')
        .update({
          status,
          reviewed_by: reviewedBy || profile.name || 'Wali Kelas',
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || (status === 'APPROVED' ? 'Disetujui oleh pihak sekolah/wali kelas' : 'Ditolak oleh pihak sekolah/wali kelas'),
        })
        .eq('id', requestId);

      if (targetSchoolId && userRole !== 'SUPER_ADMIN') {
        updateQuery = updateQuery.eq('school_id', targetSchoolId);
      }

      let { data: updatedReq, error: updateErr } = await updateQuery.select().maybeSingle();

      // Fallback jika tidak ditemukan dengan school_id target, coba update langsung berdasarkan id pengajuan
      if (!updatedReq && !updateErr && requestId) {
        const { data: fallbackReq } = await admin
          .from('leave_requests')
          .update({
            status,
            reviewed_by: reviewedBy || profile.name || 'Wali Kelas',
            reviewed_at: new Date().toISOString(),
            review_notes: reviewNotes || (status === 'APPROVED' ? 'Disetujui oleh pihak sekolah/wali kelas' : 'Ditolak oleh pihak sekolah/wali kelas'),
          })
          .eq('id', requestId)
          .select()
          .maybeSingle();
        if (fallbackReq) {
          updatedReq = fallbackReq;
        }
      }

      if (updateErr) {
        return json(res, 500, { error: updateErr.message });
      }

      // Jika disetujui (APPROVED), otomatis catat ke tabel attendance_records
      if (status === 'APPROVED' && updatedReq) {
        const attendanceStatus = updatedReq.leave_type === 'sakit' ? 'Sakit' : 'Izin';
        const dates: string[] = [];
        try {
          const [sy, sm, sd] = String(updatedReq.start_date).split('-').map(Number);
          const endStr = updatedReq.end_date || updatedReq.start_date;
          const [ey, em, ed] = String(endStr).split('-').map(Number);
          const cur = new Date(Date.UTC(sy, sm - 1, sd, 12, 0, 0));
          const end = new Date(Date.UTC(ey, em - 1, ed, 12, 0, 0));
          let count = 0;
          while (cur <= end && count < 60) {
            const y = cur.getUTCFullYear();
            const m = String(cur.getUTCMonth() + 1).padStart(2, '0');
            const d = String(cur.getUTCDate()).padStart(2, '0');
            dates.push(`${y}-${m}-${d}`);
            cur.setUTCDate(cur.getUTCDate() + 1);
            count++;
          }
        } catch (_) {
          dates.push(updatedReq.start_date);
        }
        if (dates.length === 0) dates.push(updatedReq.start_date);

        for (const d of dates) {
          try {
            const noteText = updatedReq.sub_category 
              ? `[${updatedReq.sub_category}] ${updatedReq.reason || ''}`
              : `Surat ${updatedReq.leave_type === 'sakit' ? 'Sakit' : 'Izin'} disetujui: ${updatedReq.reason || ''}`;

            const { data: existingRec } = await admin
              .from('attendance_records')
              .select('id')
              .eq('school_id', targetSchoolId)
              .eq('student_id', updatedReq.student_id)
              .eq('date', d)
              .eq('type', 'DAILY')
              .maybeSingle();

            const attData = {
              school_id: targetSchoolId,
              date: d,
              student_id: updatedReq.student_id,
              class_id: updatedReq.class_id,
              type: 'DAILY',
              status: attendanceStatus,
              notes: noteText,
              updated_by: userId,
            };

            if (existingRec?.id) {
              await admin
                .from('attendance_records')
                .update(attData)
                .eq('id', existingRec.id)
                .eq('school_id', targetSchoolId);
            } else {
              await admin.from('attendance_records').insert(attData);
            }
          } catch (attSaveErr: any) {
            console.warn('[update_leave_request_status] Error writing attendance record:', attSaveErr?.message);
          }
        }
      }

      return json(res, 200, {
        ok: true,
        request: {
          id: updatedReq.id,
          schoolId: updatedReq.school_id,
          studentId: updatedReq.student_id,
          classId: updatedReq.class_id,
          studentName: updatedReq.student_name,
          nisn: updatedReq.nisn,
          className: updatedReq.class_name,
          requesterName: updatedReq.requester_name,
          requesterRole: updatedReq.requester_role,
          requesterPhone: updatedReq.requester_phone,
          leaveType: updatedReq.leave_type,
          subCategory: updatedReq.sub_category,
          startDate: updatedReq.start_date,
          endDate: updatedReq.end_date,
          reason: updatedReq.reason,
          attachmentUrl: updatedReq.attachment_url,
          attachmentName: updatedReq.attachment_name,
          status: updatedReq.status,
          submittedAt: updatedReq.submitted_at,
          reviewedBy: updatedReq.reviewed_by,
          reviewedAt: updatedReq.reviewed_at,
          reviewNotes: updatedReq.review_notes,
        },
      });
    }

    if (action === 'cancel_leave_request') {
      const { requestId } = body;
      if (!requestId) return json(res, 400, { error: 'ID pengajuan wajib disertakan.' });

      let cancelQuery = admin
        .from('leave_requests')
        .update({
          status: 'CANCELLED',
          reviewed_at: new Date().toISOString(),
          review_notes: 'Dibatalkan oleh pengguna / pemohon',
        })
        .eq('id', requestId)
        .eq('school_id', targetSchoolId);

      if (userRole === 'SISWA') {
        if (!profile.student_id) {
          return json(res, 403, { error: 'Akun siswa tidak terhubung dengan data siswa yang sah.' });
        }
        cancelQuery = cancelQuery.eq('student_id', profile.student_id);
      }

      const { data: updatedReq, error: cancelErr } = await cancelQuery
        .select()
        .single();

      if (cancelErr) {
        return json(res, 500, { error: cancelErr.message });
      }

      return json(res, 200, {
        ok: true,
        request: {
          id: updatedReq.id,
          schoolId: updatedReq.school_id,
          studentId: updatedReq.student_id,
          classId: updatedReq.class_id,
          studentName: updatedReq.student_name,
          nisn: updatedReq.nisn,
          className: updatedReq.class_name,
          requesterName: updatedReq.requester_name,
          requesterRole: updatedReq.requester_role,
          requesterPhone: updatedReq.requester_phone,
          leaveType: updatedReq.leave_type,
          subCategory: updatedReq.sub_category,
          startDate: updatedReq.start_date,
          endDate: updatedReq.end_date,
          reason: updatedReq.reason,
          attachmentUrl: updatedReq.attachment_url,
          attachmentName: updatedReq.attachment_name,
          status: updatedReq.status,
          submittedAt: updatedReq.submitted_at,
          reviewedBy: updatedReq.reviewed_by,
          reviewedAt: updatedReq.reviewed_at,
          reviewNotes: updatedReq.review_notes,
        },
      });
    }

    return json(res, 400, { error: 'Aksi tidak dikenali.' });
  } catch (err: any) {
    return json(res, 500, { error: err?.message || 'Terjadi kesalahan pada server saat memproses absensi.' });
  }
}
