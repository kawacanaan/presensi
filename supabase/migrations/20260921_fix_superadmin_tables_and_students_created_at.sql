-- =============================================================================
-- Migrasi SQL Kawacanaan SD: Perbaikan Kolom Superadmin, Sekolah, Pengguna & Siswa
-- Mengatasi Masalah: "column students.created_at does not exist"
-- =============================================================================
-- Panduan Eksekusi di Supabase:
-- 1. Buka Dashboard Supabase (https://supabase.com/dashboard)
-- 2. Pilih Project Anda -> Klik menu "SQL Editor" di bilah kiri
-- 3. Klik tombol "+ New query"
-- 4. Tempelkan (Paste) seluruh skrip SQL di bawah ini, lalu klik "Run" (tombol hijau)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. PERBAIKAN UTAMA: Tambahkan kolom created_at, updated_at, status pada tabel STUDENTS
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  -- Pastikan tabel students ada
  CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID,
    class_id UUID,
    nama TEXT NOT NULL,
    nisn VARCHAR(50),
    gender VARCHAR(10) DEFAULT 'L',
    status VARCHAR(50) DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Tambahkan kolom created_at jika tabel sudah ada sebelumnya tanpa kolom ini
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.students ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Tambahkan kolom updated_at jika belum ada
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.students ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Tambahkan kolom status jika belum ada
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'students' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.students ADD COLUMN status VARCHAR(50) DEFAULT 'ACTIVE';
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- 2. KELENGKAPAN TABEL & KOLOM: SCHOOLS (SEKOLAH)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  npsn VARCHAR(20),
  code VARCHAR(50) UNIQUE,
  plan VARCHAR(50) DEFAULT 'free',
  status VARCHAR(50) DEFAULT 'active',
  subscription_started_at TIMESTAMPTZ DEFAULT NOW(),
  subscription_expires_at TIMESTAMPTZ,
  max_teachers INT DEFAULT 100,
  max_students INT DEFAULT 1000,
  max_classes INT DEFAULT 50,
  workspace_type VARCHAR(50) DEFAULT 'school',
  is_personal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pastikan semua kolom penting di tabel schools tersedia
DO $$
BEGIN
  ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS npsn VARCHAR(20);
  ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS code VARCHAR(50);
  ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS plan VARCHAR(50) DEFAULT 'free';
  ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'active';
  ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
  ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS max_teachers INT DEFAULT 100;
  ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS max_students INT DEFAULT 1000;
  ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS max_classes INT DEFAULT 50;
  ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS workspace_type VARCHAR(50) DEFAULT 'school';
  ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS is_personal BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
END $$;


-- -----------------------------------------------------------------------------
-- 3. KELENGKAPAN TABEL & KOLOM: PROFILES (PENGGUNA / AKUN)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  name TEXT,
  username VARCHAR(100),
  email VARCHAR(255),
  role VARCHAR(50),
  student_id UUID,
  teacher_id UUID,
  class_id UUID,
  nip VARCHAR(50),
  is_active BOOLEAN DEFAULT TRUE,
  must_change_password BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pastikan kolom penting di profiles tersedia
DO $$
BEGIN
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id UUID;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username VARCHAR(100);
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email VARCHAR(255);
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role VARCHAR(50);
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS student_id UUID;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS teacher_id UUID;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS class_id UUID;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nip VARCHAR(50);
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
END $$;


-- -----------------------------------------------------------------------------
-- 4. KELENGKAPAN TABEL: CLASSES (KELAS / ROMBEL)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  grade INT DEFAULT 1,
  academic_year VARCHAR(50) DEFAULT '2026/2027',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS school_id UUID;
  ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS name VARCHAR(100);
  ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS grade INT DEFAULT 1;
  ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS academic_year VARCHAR(50) DEFAULT '2026/2027';
  ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
END $$;


-- -----------------------------------------------------------------------------
-- 5. KELENGKAPAN TABEL: TEACHERS (GURU / PENDIDIK)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.teachers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  user_id UUID,
  nama TEXT NOT NULL,
  nip VARCHAR(50),
  jenis_kelamin VARCHAR(10) DEFAULT 'L',
  tugas_utama VARCHAR(50) DEFAULT 'Wali Kelas',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS school_id UUID;
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS user_id UUID;
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS nama TEXT;
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS nip VARCHAR(50);
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS jenis_kelamin VARCHAR(10);
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS tugas_utama VARCHAR(50);
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
END $$;


-- -----------------------------------------------------------------------------
-- 6. KELENGKAPAN TABEL: SCHOOL_PROFILE (PROFIL LEMBAGA)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.school_profile (
  school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  nama_sekolah TEXT,
  npsn VARCHAR(20),
  jenjang VARCHAR(50) DEFAULT 'SD',
  alamat TEXT,
  kelurahan VARCHAR(100),
  kecamatan VARCHAR(100),
  kabupaten_kota VARCHAR(100),
  provinsi VARCHAR(100),
  kode_pos VARCHAR(20),
  telepon VARCHAR(50),
  email VARCHAR(100),
  website VARCHAR(100),
  kepala_sekolah VARCHAR(150),
  nip_kepala_sekolah VARCHAR(50),
  tahun_pelajaran VARCHAR(50) DEFAULT '2026/2027',
  semester VARCHAR(20) DEFAULT '1',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- 7. KELENGKAPAN TABEL: PAYMENTS & INVOICES (KEUANGAN & LANGGANAN)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no VARCHAR(100) UNIQUE,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  plan_name VARCHAR(100),
  amount NUMERIC DEFAULT 0,
  unique_code INT DEFAULT 0,
  total_amount NUMERIC DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  payment_method VARCHAR(100),
  school_name VARCHAR(255),
  npsn VARCHAR(50),
  contact_name VARCHAR(150),
  contact_phone VARCHAR(50),
  email VARCHAR(150),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- 8. KELENGKAPAN TABEL: AUDIT_LOGS (CATATAN AKTIVITAS)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID,
  actor_id UUID,
  actor_name VARCHAR(150),
  actor_role VARCHAR(50),
  action VARCHAR(100) NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- 9. INDEKS KINERJA TINGGI UNTUK SUPERADMIN
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_students_school_id ON public.students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON public.students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_created_at ON public.students(created_at);
CREATE INDEX IF NOT EXISTS idx_students_nisn ON public.students(nisn);

CREATE INDEX IF NOT EXISTS idx_profiles_school_id ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

CREATE INDEX IF NOT EXISTS idx_schools_code ON public.schools(code);
CREATE INDEX IF NOT EXISTS idx_schools_status ON public.schools(status);

CREATE INDEX IF NOT EXISTS idx_payments_school_id ON public.payments(school_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

CREATE INDEX IF NOT EXISTS idx_audit_logs_school_id ON public.audit_logs(school_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);


-- -----------------------------------------------------------------------------
-- 10. REFRESH SCHEMA CACHE POSTGREST
-- -----------------------------------------------------------------------------
-- Ini memberitahukan API Supabase bahwa skema tabel telah diperbarui
NOTIFY pgrst, 'reload schema';
