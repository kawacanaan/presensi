-- =============================================================================
-- Migrasi SQL Kawacanaan SD: Fungsi Penugasan Guru & Rombel (Wali Kelas & Mapel)
-- Mengatasi Masalah: Could not find the function public.assign_homeroom_teacher(...) in the schema cache
-- =============================================================================
-- Panduan Eksekusi di Supabase:
-- 1. Buka Dashboard Supabase (https://supabase.com/dashboard)
-- 2. Pilih Project Anda -> Klik menu "SQL Editor" di bilah kiri
-- 3. Klik tombol "+ New query"
-- 4. Tempelkan (Paste) seluruh skrip SQL ini, lalu klik tombol "Run" (hijau)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PASTIKAN STRUKTUR TABEL & KOLOM PENDUKUNG TERSEDIA
-- -----------------------------------------------------------------------------

-- A. Kolom wali_kelas_teacher_id pada tabel classes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'wali_kelas_teacher_id'
  ) THEN
    ALTER TABLE public.classes ADD COLUMN wali_kelas_teacher_id UUID REFERENCES public.teachers(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'academic_year'
  ) THEN
    ALTER TABLE public.classes ADD COLUMN academic_year VARCHAR(50) DEFAULT '2026/2027';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'classes' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.classes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- B. Kolom pendukung pada tabel schools (workspace_type, is_personal, owner_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'schools' AND column_name = 'workspace_type'
  ) THEN
    ALTER TABLE public.schools ADD COLUMN workspace_type VARCHAR(50) DEFAULT 'school';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'schools' AND column_name = 'is_personal'
  ) THEN
    ALTER TABLE public.schools ADD COLUMN is_personal BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'schools' AND column_name = 'owner_id'
  ) THEN
    ALTER TABLE public.schools ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- C. Kolom class_ids dan class_id pada tabel profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'class_id'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'class_ids'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN class_ids UUID[] DEFAULT '{}'::UUID[];
  END IF;
END $$;

-- D. Tabel master penugasan terpadu (teacher_assignments)
CREATE TABLE IF NOT EXISTS public.teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL, -- 'WALI_KELAS' atau 'GURU_MAPEL'
  class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL,
  academic_year VARCHAR(50) DEFAULT '2026/2027',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pastikan kolom created_at & updated_at ada jika tabel sudah dibuat sebelumnya tanpa kolom tersebut
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'teacher_assignments' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.teacher_assignments ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'teacher_assignments' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.teacher_assignments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- E. Tabel penugasan guru mapel (subject_teacher_assignments)
CREATE TABLE IF NOT EXISTS public.subject_teacher_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  academic_year VARCHAR(50) DEFAULT '2026/2027',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_subject_teacher_year UNIQUE (school_id, subject_id, teacher_id, academic_year)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'subject_teacher_assignments' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.subject_teacher_assignments ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- F. Tabel pemetaan mapel ke rombel (subject_class_assignments)
CREATE TABLE IF NOT EXISTS public.subject_class_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  academic_year VARCHAR(50) DEFAULT '2026/2027',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_subject_class_year UNIQUE (school_id, subject_id, class_id, academic_year)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'subject_class_assignments' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.subject_class_assignments ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. FUNGSI STORED PROCEDURE: assign_homeroom_teacher
-- -----------------------------------------------------------------------------
-- Fungsi ini menetapkan seorang guru sebagai Wali Kelas untuk 1 rombel tertentu.
-- Menerapkan aturan: 1 Guru = 1 Rombel (dan 1 Rombel = 1 Wali Kelas) per tahun ajaran.
CREATE OR REPLACE FUNCTION public.assign_homeroom_teacher(
  p_school_id UUID,
  p_teacher_id UUID,
  p_class_id UUID DEFAULT NULL,
  p_academic_year TEXT DEFAULT '2026/2027',
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_year TEXT := COALESCE(NULLIF(TRIM(p_academic_year), ''), '2026/2027');
  v_class RECORD;
BEGIN
  -- Validasi Parameter
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'Parameter p_school_id wajib diisi.';
  END IF;
  IF p_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Parameter p_teacher_id wajib diisi.';
  END IF;

  -- 1. Lepaskan penugasan rombel lain jika guru ini sebelumnya menjadi wali kelas di rombel lain
  UPDATE public.classes
  SET wali_kelas_teacher_id = NULL,
      updated_at = NOW()
  WHERE school_id = p_school_id
    AND wali_kelas_teacher_id = p_teacher_id
    AND (p_class_id IS NULL OR id != p_class_id);

  -- 2. Bersihkan catatan peran WALI_KELAS sebelumnya pada tabel teacher_assignments
  DELETE FROM public.teacher_assignments
  WHERE school_id = p_school_id
    AND teacher_id = p_teacher_id
    AND role = 'WALI_KELAS';

  -- 3. Jika rombel tujuan ditentukan (assign / ganti rombel)
  IF p_class_id IS NOT NULL THEN
    -- Pastikan rombel terdaftar pada sekolah yang bersangkutan
    SELECT * INTO v_class
    FROM public.classes
    WHERE id = p_class_id AND school_id = p_school_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rombel dengan ID % tidak ditemukan pada sekolah ini.', p_class_id;
    END IF;

    -- Bersihkan wali kelas lama di rombel target dari tabel teacher_assignments
    DELETE FROM public.teacher_assignments
    WHERE school_id = p_school_id
      AND class_id = p_class_id
      AND role = 'WALI_KELAS';

    -- Pasang guru sebagai wali kelas di tabel classes
    UPDATE public.classes
    SET wali_kelas_teacher_id = p_teacher_id,
        updated_at = NOW()
    WHERE id = p_class_id
      AND school_id = p_school_id;

    -- Catat ke tabel terpadu teacher_assignments
    INSERT INTO public.teacher_assignments (
      school_id,
      teacher_id,
      role,
      class_id,
      subject_id,
      academic_year,
      is_active
    ) VALUES (
      p_school_id,
      p_teacher_id,
      'WALI_KELAS',
      p_class_id,
      NULL,
      v_effective_year,
      TRUE
    );

    -- Sinkronkan profiles yang terhubung dengan akun guru
    UPDATE public.profiles
    SET class_id = p_class_id,
        class_ids = ARRAY[p_class_id],
        updated_at = NOW()
    WHERE school_id = p_school_id
      AND (teacher_id = p_teacher_id OR (p_actor_user_id IS NOT NULL AND id = p_actor_user_id));
  ELSE
    -- Jika p_class_id IS NULL, lepaskan penugasan wali kelas
    UPDATE public.classes
    SET wali_kelas_teacher_id = NULL,
        updated_at = NOW()
    WHERE school_id = p_school_id
      AND wali_kelas_teacher_id = p_teacher_id;

    UPDATE public.profiles
    SET class_id = NULL,
        class_ids = '{}'::UUID[],
        updated_at = NOW()
    WHERE school_id = p_school_id
      AND (teacher_id = p_teacher_id OR (p_actor_user_id IS NOT NULL AND id = p_actor_user_id));
  END IF;

  -- 4. Perbarui tugas_utama pada tabel master teachers
  UPDATE public.teachers
  SET tugas_utama = 'Wali Kelas',
      updated_at = NOW()
  WHERE id = p_teacher_id
    AND school_id = p_school_id;

  -- 5. Catat log audit secara aman (jika tabel audit_logs ada)
  BEGIN
    INSERT INTO public.audit_logs (
      school_id,
      actor_id,
      action,
      details,
      created_at
    ) VALUES (
      p_school_id,
      p_actor_user_id,
      'ASSIGN_HOMEROOM_TEACHER',
      jsonb_build_object(
        'teacher_id', p_teacher_id,
        'class_id', p_class_id,
        'academic_year', v_effective_year
      ),
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    -- Abaikan jika tabel audit_logs tidak ada
  END;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Penugasan Wali Kelas berhasil diperbarui.',
    'school_id', p_school_id,
    'teacher_id', p_teacher_id,
    'class_id', p_class_id,
    'academic_year', v_effective_year
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. FUNGSI STORED PROCEDURE: replace_subject_assignment
-- -----------------------------------------------------------------------------
-- Fungsi ini menetapkan penugasan mata pelajaran untuk Guru Mapel ke satu atau beberapa rombel.
CREATE OR REPLACE FUNCTION public.replace_subject_assignment(
  p_school_id UUID,
  p_subject_id UUID,
  p_teacher_id UUID,
  p_class_ids UUID[],
  p_academic_year TEXT DEFAULT '2026/2027',
  p_actor_user_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_effective_year TEXT := COALESCE(NULLIF(TRIM(p_academic_year), ''), '2026/2027');
  v_cid UUID;
BEGIN
  IF p_school_id IS NULL OR p_subject_id IS NULL OR p_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Parameter p_school_id, p_subject_id, dan p_teacher_id wajib diisi.';
  END IF;

  -- 1. Bersihkan penugasan mata pelajaran guru ini untuk mapel tersebut pada tahun ajaran aktif
  DELETE FROM public.subject_teacher_assignments
  WHERE school_id = p_school_id
    AND subject_id = p_subject_id
    AND teacher_id = p_teacher_id
    AND academic_year = v_effective_year;

  -- 2. Daftarkan relasi guru <-> mapel
  INSERT INTO public.subject_teacher_assignments (
    school_id,
    subject_id,
    teacher_id,
    academic_year
  ) VALUES (
    p_school_id,
    p_subject_id,
    p_teacher_id,
    v_effective_year
  )
  ON CONFLICT (school_id, subject_id, teacher_id, academic_year) DO NOTHING;

  -- 3. Hapus teacher_assignments peran GURU_MAPEL untuk guru dan mapel ini
  DELETE FROM public.teacher_assignments
  WHERE school_id = p_school_id
    AND teacher_id = p_teacher_id
    AND subject_id = p_subject_id
    AND role = 'GURU_MAPEL'
    AND academic_year = v_effective_year;

  -- 4. Hubungkan kelas-kelas target yang diajar
  IF p_class_ids IS NOT NULL AND array_length(p_class_ids, 1) > 0 THEN
    FOREACH v_cid IN ARRAY p_class_ids LOOP
      -- Pastikan relasi mapel <-> kelas ada
      INSERT INTO public.subject_class_assignments (
        school_id,
        subject_id,
        class_id,
        academic_year
      ) VALUES (
        p_school_id,
        p_subject_id,
        v_cid,
        v_effective_year
      )
      ON CONFLICT (school_id, subject_id, class_id, academic_year) DO NOTHING;

      -- Masukkan ke tabel terpadu teacher_assignments
      INSERT INTO public.teacher_assignments (
        school_id,
        teacher_id,
        role,
        class_id,
        subject_id,
        academic_year,
        is_active
      ) VALUES (
        p_school_id,
        p_teacher_id,
        'GURU_MAPEL',
        v_cid,
        p_subject_id,
        v_effective_year,
        TRUE
      );
    END LOOP;
  END IF;

  -- 5. Perbarui tugas utama guru di tabel master teachers
  UPDATE public.teachers
  SET tugas_utama = 'Guru Mapel',
      updated_at = NOW()
  WHERE id = p_teacher_id
    AND school_id = p_school_id;

  -- 6. Sinkronkan daftar rombel di profiles
  UPDATE public.profiles
  SET class_ids = p_class_ids,
      updated_at = NOW()
  WHERE school_id = p_school_id
    AND (teacher_id = p_teacher_id OR (p_actor_user_id IS NOT NULL AND id = p_actor_user_id));

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Penugasan Guru Mapel berhasil diperbarui.',
    'school_id', p_school_id,
    'subject_id', p_subject_id,
    'teacher_id', p_teacher_id,
    'class_count', COALESCE(array_length(p_class_ids, 1), 0),
    'academic_year', v_effective_year
  );
END;
$$;


-- -----------------------------------------------------------------------------
-- 4. GRANT HAK AKSES EKSEKUSI PADA KEDUA FUNGSI
-- -----------------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.assign_homeroom_teacher(UUID, UUID, UUID, TEXT, UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.replace_subject_assignment(UUID, UUID, UUID, UUID[], TEXT, UUID) TO authenticated, service_role, anon;


-- -----------------------------------------------------------------------------
-- 5. ATURAN KEAMANAN ROW LEVEL SECURITY (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_teacher_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subject_class_assignments ENABLE ROW LEVEL SECURITY;

-- Policy untuk teacher_assignments
DROP POLICY IF EXISTS "Akses teacher_assignments per sekolah dan superadmin" ON public.teacher_assignments;
CREATE POLICY "Akses teacher_assignments per sekolah dan superadmin" ON public.teacher_assignments
FOR ALL
USING (
  -- Superadmin memiliki akses menyeluruh
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
  OR
  -- Pengguna dalam sekolah yang sama
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);

-- Policy untuk subject_teacher_assignments
DROP POLICY IF EXISTS "Akses subject_teacher_assignments per sekolah dan superadmin" ON public.subject_teacher_assignments;
CREATE POLICY "Akses subject_teacher_assignments per sekolah dan superadmin" ON public.subject_teacher_assignments
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
  OR
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);

-- Policy untuk subject_class_assignments
DROP POLICY IF EXISTS "Akses subject_class_assignments per sekolah dan superadmin" ON public.subject_class_assignments;
CREATE POLICY "Akses subject_class_assignments per sekolah dan superadmin" ON public.subject_class_assignments
FOR ALL
USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'SUPER_ADMIN')
  OR
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);

-- -----------------------------------------------------------------------------
-- 6. REFRESH SCHEMA CACHE POSTGREST
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
