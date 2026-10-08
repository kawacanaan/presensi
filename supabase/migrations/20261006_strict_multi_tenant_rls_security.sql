-- =============================================================================
-- Migrasi SQL Supabase: Pengamanan Ketat Multi-Tenant & Pencegahan Kebocoran Lintas Sekolah
-- Menjamin isolasi penuh data siswa, surat sakit/izin (leave_requests), dan absensi
-- =============================================================================
-- Panduan Eksekusi di Supabase Dashboard:
-- 1. Buka Supabase Dashboard (https://supabase.com/dashboard) -> Pilih Project Anda
-- 2. Klik menu "SQL Editor" di bilah kiri -> Klik "+ New query"
-- 3. Tempelkan seluruh skrip di bawah ini, lalu klik tombol "Run" (hijau)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PASTIKAN TABEL LEAVE_REQUESTS TERSEDIA DENGAN STRUKTUR LENGKAP & INDEKS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  student_name TEXT NOT NULL,
  nisn VARCHAR(50),
  class_name VARCHAR(100),
  requester_name VARCHAR(150) NOT NULL DEFAULT 'Orang Tua / Wali',
  requester_role VARCHAR(50) DEFAULT 'Wali',
  requester_phone VARCHAR(50),
  leave_type VARCHAR(20) NOT NULL DEFAULT 'sakit',
  sub_category VARCHAR(100),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL DEFAULT '-',
  attachment_url TEXT,
  attachment_name TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indeks performa & partisi tenant
CREATE INDEX IF NOT EXISTS idx_leave_requests_school_id ON public.leave_requests(school_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_student_id ON public.leave_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_class_id ON public.leave_requests(class_id);
CREATE INDEX IF NOT EXISTS idx_leave_requests_status ON public.leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_dates ON public.leave_requests(school_id, start_date, end_date);

-- Indeks performa untuk attendance_records jika belum ada
CREATE INDEX IF NOT EXISTS idx_attendance_records_school_id ON public.attendance_records(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_student_id ON public.attendance_records(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_records_date ON public.attendance_records(school_id, date);

-- -----------------------------------------------------------------------------
-- 2. FUNGSI HELPER KEAMANAN (SECURITY DEFINER & STABLE)
-- -----------------------------------------------------------------------------
-- Mengambil school_id dari akun pengguna yang sedang login
CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Mengambil role pengguna yang sedang login
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Memeriksa apakah pengguna adalah SUPER_ADMIN
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'SUPER_ADMIN'
  );
$$;

-- Mengambil student_id dari pengguna jika login sebagai SISWA
CREATE OR REPLACE FUNCTION public.get_auth_student_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT student_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_school_id() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_role() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_student_id() TO authenticated, anon;

-- -----------------------------------------------------------------------------
-- 3. AKTIFKAN ROW LEVEL SECURITY (RLS) PADA SEMUA TABEL OPERASIONAL
-- -----------------------------------------------------------------------------
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subjects') THEN
    ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subject_teacher_assignments') THEN
    ALTER TABLE public.subject_teacher_assignments ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subject_class_assignments') THEN
    ALTER TABLE public.subject_class_assignments ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'subject_schedule_days') THEN
    ALTER TABLE public.subject_schedule_days ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'teacher_assignments') THEN
    ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'academic_events') THEN
    ALTER TABLE public.academic_events ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'effective_days') THEN
    ALTER TABLE public.effective_days ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'audit_logs') THEN
    ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 4. KEBIJAKAN RLS UNTUK TABEL: LEAVE_REQUESTS (SURAT IZIN & SAKIT)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "leave_requests_superadmin_all" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_school_select" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_school_insert" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_school_update" ON public.leave_requests;
DROP POLICY IF EXISTS "leave_requests_school_delete" ON public.leave_requests;

-- Super Admin: Akses penuh
CREATE POLICY "leave_requests_superadmin_all"
ON public.leave_requests
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- SELECT: Guru/Admin hanya melihat sekolah sendiri, Siswa hanya melihat miliknya di sekolah sendiri
CREATE POLICY "leave_requests_school_select"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND (
      public.get_auth_role() != 'SISWA'
      OR student_id = public.get_auth_student_id()
    )
  )
);

-- INSERT: Siswa/Orang tua atau Guru/Admin hanya dapat mengajukan untuk sekolah sendiri
CREATE POLICY "leave_requests_school_insert"
ON public.leave_requests
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND (
      public.get_auth_role() != 'SISWA'
      OR student_id = public.get_auth_student_id()
    )
  )
);

-- UPDATE: Guru/Admin sekolah memverifikasi (APPROVED/REJECTED), atau Siswa membatalkan miliknya
CREATE POLICY "leave_requests_school_update"
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND (
      public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL')
      OR (public.get_auth_role() = 'SISWA' AND student_id = public.get_auth_student_id())
    )
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND (
      public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL')
      OR (public.get_auth_role() = 'SISWA' AND student_id = public.get_auth_student_id())
    )
  )
);

-- DELETE: Hanya Admin sekolah atau Super Admin
CREATE POLICY "leave_requests_school_delete"
ON public.leave_requests
FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH')
  )
);

-- -----------------------------------------------------------------------------
-- 5. KEBIJAKAN RLS UNTUK TABEL: ATTENDANCE_RECORDS (REKAP PRESENSI)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "attendance_records_superadmin_all" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_school_select" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_school_insert" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_school_update" ON public.attendance_records;
DROP POLICY IF EXISTS "attendance_records_school_delete" ON public.attendance_records;

CREATE POLICY "attendance_records_superadmin_all"
ON public.attendance_records
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "attendance_records_school_select"
ON public.attendance_records
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND (
      public.get_auth_role() != 'SISWA'
      OR student_id = public.get_auth_student_id()
    )
  )
);

CREATE POLICY "attendance_records_school_insert"
ON public.attendance_records
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND (
      public.get_auth_role() != 'SISWA'
      OR student_id = public.get_auth_student_id()
    )
  )
);

CREATE POLICY "attendance_records_school_update"
ON public.attendance_records
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND (
      public.get_auth_role() != 'SISWA'
      OR student_id = public.get_auth_student_id()
    )
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND (
      public.get_auth_role() != 'SISWA'
      OR student_id = public.get_auth_student_id()
    )
  )
);

CREATE POLICY "attendance_records_school_delete"
ON public.attendance_records
FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS', 'GURU MAPEL')
  )
);

-- -----------------------------------------------------------------------------
-- 6. KEBIJAKAN RLS UNTUK TABEL: STUDENTS (DATA SISWA)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "students_superadmin_all" ON public.students;
DROP POLICY IF EXISTS "students_school_select" ON public.students;
DROP POLICY IF EXISTS "students_school_insert" ON public.students;
DROP POLICY IF EXISTS "students_school_update" ON public.students;
DROP POLICY IF EXISTS "students_school_delete" ON public.students;

CREATE POLICY "students_superadmin_all"
ON public.students
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "students_school_select"
ON public.students
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR school_id = public.get_auth_school_id()
);

CREATE POLICY "students_school_insert"
ON public.students
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS')
  )
);

CREATE POLICY "students_school_update"
ON public.students
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS')
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH', 'WALI KELAS')
  )
);

CREATE POLICY "students_school_delete"
ON public.students
FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH')
  )
);

-- -----------------------------------------------------------------------------
-- 7. KEBIJAKAN RLS UNTUK TABEL: TEACHERS (GURU) & CLASSES (ROMBEL)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "teachers_superadmin_all" ON public.teachers;
DROP POLICY IF EXISTS "teachers_school_select" ON public.teachers;
DROP POLICY IF EXISTS "teachers_school_modify" ON public.teachers;

CREATE POLICY "teachers_superadmin_all"
ON public.teachers
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "teachers_school_select"
ON public.teachers
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR school_id = public.get_auth_school_id()
);

CREATE POLICY "teachers_school_modify"
ON public.teachers
FOR ALL
TO authenticated
USING (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH')
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH')
  )
);

DROP POLICY IF EXISTS "classes_superadmin_all" ON public.classes;
DROP POLICY IF EXISTS "classes_school_select" ON public.classes;
DROP POLICY IF EXISTS "classes_school_modify" ON public.classes;

CREATE POLICY "classes_superadmin_all"
ON public.classes
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "classes_school_select"
ON public.classes
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR school_id = public.get_auth_school_id()
);

CREATE POLICY "classes_school_modify"
ON public.classes
FOR ALL
TO authenticated
USING (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH')
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH')
  )
);

-- -----------------------------------------------------------------------------
-- 8. KEBIJAKAN RLS UNTUK TABEL: PROFILES (PENGGUNA)
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_superadmin_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_self_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_school_admin_manage" ON public.profiles;

CREATE POLICY "profiles_superadmin_all"
ON public.profiles
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

-- Pengguna dapat melihat profil di sekolahnya sendiri atau profil dirinya
CREATE POLICY "profiles_self_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR id = auth.uid()
  OR (school_id IS NOT NULL AND school_id = public.get_auth_school_id())
);

-- Pengguna dapat memperbarui profil miliknya sendiri
CREATE POLICY "profiles_self_update"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Admin sekolah dapat mengelola profil dalam sekolah yang sama
CREATE POLICY "profiles_school_admin_manage"
ON public.profiles
FOR ALL
TO authenticated
USING (
  school_id IS NOT NULL
  AND school_id = public.get_auth_school_id()
  AND public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH')
)
WITH CHECK (
  school_id IS NOT NULL
  AND school_id = public.get_auth_school_id()
  AND public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH')
);

-- -----------------------------------------------------------------------------
-- 9. KEBIJAKAN RLS UNTUK TABEL: SCHOOL_PROFILE & SCHOOLS
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "schools_superadmin_all" ON public.schools;
DROP POLICY IF EXISTS "schools_member_select" ON public.schools;
DROP POLICY IF EXISTS "schools_owner_update" ON public.schools;

CREATE POLICY "schools_superadmin_all"
ON public.schools
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "schools_member_select"
ON public.schools
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR id = public.get_auth_school_id()
  OR owner_id = auth.uid()
);

CREATE POLICY "schools_owner_update"
ON public.schools
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR owner_id = auth.uid()
)
WITH CHECK (
  public.is_super_admin()
  OR owner_id = auth.uid()
);

DROP POLICY IF EXISTS "school_profile_superadmin_all" ON public.school_profile;
DROP POLICY IF EXISTS "school_profile_member_select" ON public.school_profile;
DROP POLICY IF EXISTS "school_profile_admin_modify" ON public.school_profile;

CREATE POLICY "school_profile_superadmin_all"
ON public.school_profile
FOR ALL
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());

CREATE POLICY "school_profile_member_select"
ON public.school_profile
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR school_id = public.get_auth_school_id()
);

CREATE POLICY "school_profile_admin_modify"
ON public.school_profile
FOR ALL
TO authenticated
USING (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH')
  )
)
WITH CHECK (
  public.is_super_admin()
  OR (
    school_id = public.get_auth_school_id()
    AND public.get_auth_role() IN ('ADMIN', 'KEPALA SEKOLAH')
  )
);

-- -----------------------------------------------------------------------------
-- 10. REFRESH SCHEMA POSTGREST CACHE
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
