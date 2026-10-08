-- =============================================================================
-- Migrasi SQL untuk Memperbaiki Trigger updated_at pada PostgreSQL Supabase
-- Menangani Error: record "new" has no field "updated_at" (code 42703)
-- =============================================================================
-- Cara Menjalankan:
-- 1. Buka Supabase Dashboard (https://supabase.com/dashboard)
-- 2. Pilih Project Anda -> Masuk ke Menu "SQL Editor"
-- 3. Tempelkan seluruh isi skrip ini lalu klik "Run"
-- =============================================================================

-- 1. Tambahkan kolom updated_at pada tabel-tabel yang dipasangi trigger updated_at
ALTER TABLE IF EXISTS public.schools 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.system_config 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.payments 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE IF EXISTS public.effective_days 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Amankan fungsi trigger update_updated_at_column agar tidak pernah gagal
-- meskipun dipasang pada tabel lain di masa depan yang belum memiliki kolom updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        NEW.updated_at = NOW();
    EXCEPTION WHEN undefined_column THEN
        -- Lewati jika tabel tidak memiliki kolom updated_at
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    BEGIN
        NEW.updated_at = NOW();
    EXCEPTION WHEN undefined_column THEN
        -- Lewati jika tabel tidak memiliki kolom updated_at
    END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Beri tahu PostgREST untuk memuat ulang cache skema
NOTIFY pgrst, 'reload schema';
