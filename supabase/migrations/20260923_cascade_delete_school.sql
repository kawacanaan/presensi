-- =============================================================================
-- Migrasi SQL Kawacanaan: Cascade Delete Sekolah & Seluruh Data Terkait Instansi
-- Memastikan saat Super Admin menghapus sekolah, seluruh data instansi terhapus:
-- - Akun Pengguna (profiles & auth.users)
-- - Rekapitulasi Presensi & Pengajuan Izin
-- - Riwayat Transaksi & Pembayaran (payments / invoices)
-- - Rombel Kelas & Penugasan (classes, user_class_assignments, teacher_assignments)
-- - Guru, Mata Pelajaran & Siswa
-- - Undangan & Kode Akses
-- - Konfigurasi Sekolah, Profil & Kalender Akademik
-- - Berkas & Catatan Log
-- =============================================================================

-- 1. Perbarui Constraint Foreign Key Agar Mendukung ON DELETE CASCADE
DO $$
BEGIN
  -- Classes -> Schools
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'classes_school_id_fkey' AND table_name = 'classes'
  ) THEN
    ALTER TABLE public.classes DROP CONSTRAINT classes_school_id_fkey;
    ALTER TABLE public.classes ADD CONSTRAINT classes_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
  END IF;

  -- Teachers -> Schools
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'teachers_school_id_fkey' AND table_name = 'teachers'
  ) THEN
    ALTER TABLE public.teachers DROP CONSTRAINT teachers_school_id_fkey;
    ALTER TABLE public.teachers ADD CONSTRAINT teachers_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
  END IF;

  -- Students -> Schools
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'students_school_id_fkey' AND table_name = 'students'
  ) THEN
    ALTER TABLE public.students DROP CONSTRAINT students_school_id_fkey;
    ALTER TABLE public.students ADD CONSTRAINT students_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
  END IF;

  -- Payments -> Schools (Ubah dari SET NULL menjadi CASCADE)
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'payments_school_id_fkey' AND table_name = 'payments'
  ) THEN
    ALTER TABLE public.payments DROP CONSTRAINT payments_school_id_fkey;
    ALTER TABLE public.payments ADD CONSTRAINT payments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
  END IF;

  -- School Profile -> Schools
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'school_profile_school_id_fkey' AND table_name = 'school_profile'
  ) THEN
    ALTER TABLE public.school_profile DROP CONSTRAINT school_profile_school_id_fkey;
    ALTER TABLE public.school_profile ADD CONSTRAINT school_profile_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 2. Fungsi Stored Procedure PostgreSQL untuk Eksekusi Atomic Cascade Delete Sekolah
CREATE OR REPLACE FUNCTION public.delete_school_cascade(
  p_school_id UUID,
  p_caller_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school RECORD;
  v_user_ids UUID[];
  v_teacher_user_ids UUID[];
  v_all_target_users UUID[];
  v_deleted_users_count INT := 0;
  v_deleted_classes_count INT := 0;
  v_deleted_students_count INT := 0;
  v_deleted_attendance_count INT := 0;
  v_deleted_payments_count INT := 0;
BEGIN
  -- 1. Validasi keberadaan sekolah
  SELECT * INTO v_school FROM public.schools WHERE id = p_school_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sekolah atau Ruang Kerja dengan ID % tidak ditemukan.', p_school_id;
  END IF;

  -- 2. Kumpulkan ID pengguna yang berafiliasi dengan sekolah ini (kecuali Super Admin dan pemanggil)
  SELECT COALESCE(array_agg(id), ARRAY[]::UUID[]) INTO v_user_ids
  FROM public.profiles
  WHERE school_id = p_school_id
    AND role != 'SUPER_ADMIN'
    AND (p_caller_user_id IS NULL OR id != p_caller_user_id);

  -- Kumpulkan juga user_id dari tabel teachers jika ada akun tertaut
  SELECT COALESCE(array_agg(user_id), ARRAY[]::UUID[]) INTO v_teacher_user_ids
  FROM public.teachers
  WHERE school_id = p_school_id
    AND user_id IS NOT NULL
    AND (p_caller_user_id IS NULL OR user_id != p_caller_user_id);

  -- Gabungkan dan deduplikasi ID pengguna
  SELECT COALESCE(array_agg(DISTINCT uid), ARRAY[]::UUID[]) INTO v_all_target_users
  FROM unnest(v_user_ids || v_teacher_user_ids) AS uid
  WHERE uid IS NOT NULL;

  v_deleted_users_count := cardinality(v_all_target_users);

  -- 3. Lepaskan foreign key pembatas sebelum pembersihan agar tidak memicu error konstrain
  -- A. Lepaskan owner_id pada schools
  UPDATE public.schools SET owner_id = NULL WHERE id = p_school_id;

  -- B. Lepaskan wali_kelas_teacher_id pada classes
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'wali_kelas_teacher_id') THEN
    UPDATE public.classes SET wali_kelas_teacher_id = NULL WHERE school_id = p_school_id;
  END IF;

  -- C. Lepaskan referensi class_id, teacher_id, student_id pada profiles
  UPDATE public.profiles
  SET class_id = NULL, teacher_id = NULL, student_id = NULL
  WHERE school_id = p_school_id OR id = ANY(v_all_target_users);

  -- 4. Hapus Riwayat Transaksi & Pembayaran (payments)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    WITH del_p AS (
      DELETE FROM public.payments
      WHERE school_id = p_school_id
         OR (v_school.npsn IS NOT NULL AND TRIM(v_school.npsn) != '' AND npsn = v_school.npsn)
      RETURNING id
    )
    SELECT count(*) INTO v_deleted_payments_count FROM del_p;
  END IF;

  -- 5. Hapus Rekapitulasi Presensi & Permohonan Izin
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_records') THEN
    WITH del_att AS (
      DELETE FROM public.attendance_records
      WHERE school_id = p_school_id
         OR student_id IN (SELECT id FROM public.students WHERE school_id = p_school_id)
         OR class_id IN (SELECT id FROM public.classes WHERE school_id = p_school_id)
      RETURNING id
    )
    SELECT count(*) INTO v_deleted_attendance_count FROM del_att;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leave_requests') THEN
    DELETE FROM public.leave_requests
    WHERE school_id = p_school_id
       OR student_id IN (SELECT id FROM public.students WHERE school_id = p_school_id);
  END IF;

  -- 6. Hapus Penugasan Guru, Mapel, dan Kelas
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_class_assignments') THEN
    DELETE FROM public.user_class_assignments
    WHERE school_id = p_school_id
       OR class_id IN (SELECT id FROM public.classes WHERE school_id = p_school_id)
       OR user_id = ANY(v_all_target_users);
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teacher_assignments') THEN
    DELETE FROM public.teacher_assignments WHERE school_id = p_school_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teacher_class_assignments') THEN
    DELETE FROM public.teacher_class_assignments WHERE school_id = p_school_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teacher_class_assignments_legacy_archive') THEN
    DELETE FROM public.teacher_class_assignments_legacy_archive WHERE school_id = p_school_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subject_schedule_days') THEN
    DELETE FROM public.subject_schedule_days WHERE school_id = p_school_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subject_class_assignments') THEN
    DELETE FROM public.subject_class_assignments WHERE school_id = p_school_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subject_teacher_assignments') THEN
    DELETE FROM public.subject_teacher_assignments WHERE school_id = p_school_id;
  END IF;

  -- 7. Hapus Undangan & Kode Pendaftaran (jika tabel ada)
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invitations') THEN
    DELETE FROM public.invitations WHERE school_id = p_school_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'school_invitations') THEN
    DELETE FROM public.school_invitations WHERE school_id = p_school_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teacher_invitations') THEN
    DELETE FROM public.teacher_invitations WHERE school_id = p_school_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'class_invitations') THEN
    DELETE FROM public.class_invitations WHERE school_id = p_school_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_invitations') THEN
    DELETE FROM public.student_invitations WHERE school_id = p_school_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'join_requests') THEN
    DELETE FROM public.join_requests WHERE school_id = p_school_id;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'registration_codes') THEN
    DELETE FROM public.registration_codes WHERE school_id = p_school_id;
  END IF;

  -- 8. Hapus Master Data Siswa, Kelas, Guru, Mapel
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'students') THEN
    WITH del_s AS (
      DELETE FROM public.students WHERE school_id = p_school_id RETURNING id
    )
    SELECT count(*) INTO v_deleted_students_count FROM del_s;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'classes') THEN
    WITH del_c AS (
      DELETE FROM public.classes WHERE school_id = p_school_id RETURNING id
    )
    SELECT count(*) INTO v_deleted_classes_count FROM del_c;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subjects') THEN
    DELETE FROM public.subjects WHERE school_id = p_school_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teachers') THEN
    DELETE FROM public.teachers WHERE school_id = p_school_id;
  END IF;

  -- 9. Hapus Konfigurasi Sekolah, Kalender Akademik & Profil
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_config') THEN
    DELETE FROM public.system_config WHERE school_id = p_school_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'school_profile') THEN
    DELETE FROM public.school_profile WHERE school_id = p_school_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'effective_days') THEN
    DELETE FROM public.effective_days WHERE school_id = p_school_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'academic_events') THEN
    DELETE FROM public.academic_events WHERE school_id = p_school_id;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    DELETE FROM public.audit_logs WHERE school_id = p_school_id;
  END IF;

  -- 10. Hapus Profil Pengguna Sekolah (kecuali Super Admin)
  DELETE FROM public.profiles
  WHERE (school_id = p_school_id OR id = ANY(v_all_target_users))
    AND role != 'SUPER_ADMIN'
    AND (p_caller_user_id IS NULL OR id != p_caller_user_id);

  -- Lepaskan kaitan school_id pada akun Super Admin jika ada yang tercatat
  UPDATE public.profiles
  SET school_id = NULL
  WHERE school_id = p_school_id AND role = 'SUPER_ADMIN';

  -- 11. Hapus Baris Sekolah dari Tabel schools
  DELETE FROM public.schools WHERE id = p_school_id;

  RETURN jsonb_build_object(
    'ok', true,
    'school_id', p_school_id,
    'school_name', v_school.name,
    'deleted_auth_user_ids', v_all_target_users,
    'deleted_users_count', v_deleted_users_count,
    'deleted_classes_count', v_deleted_classes_count,
    'deleted_students_count', v_deleted_students_count,
    'deleted_attendance_count', v_deleted_attendance_count,
    'deleted_payments_count', v_deleted_payments_count,
    'message', 'Cascade delete basis data berhasil diselesaikan.'
  );
END;
$$;

-- 3. Muat Ulang Skema PostgREST
NOTIFY pgrst, 'reload schema';
