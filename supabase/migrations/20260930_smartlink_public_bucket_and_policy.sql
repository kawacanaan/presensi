-- ==============================================================================
-- Migration: Ensure Supabase Storage Buckets for Smartlink PDF are Public
-- Purpose: Allow public Smartlink PDF and report documents to be accessed and
-- downloaded directly without requiring authentication or login.
-- Ensures Row Level Security (RLS) is explicitly configured to permit open
-- public read and access on all Smartlink document buckets.
-- ==============================================================================

-- 1. Pastikan ekstensi dan skema storage tersedia
CREATE SCHEMA IF NOT EXISTS storage;

-- 2. Daftarkan / perbarui bucket publik dokumen Smartlink
-- Memastikan bucket 'smartlink', 'smartlinks', 'smartlink-pdf', 'reports', 'pdf', 'invoices' berstatus public = true
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('smartlink', 'smartlink', true, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/octet-stream']),
  ('smartlinks', 'smartlinks', true, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/octet-stream']),
  ('smartlink-pdf', 'smartlink-pdf', true, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/octet-stream']),
  ('reports', 'reports', true, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/octet-stream']),
  ('pdf', 'pdf', true, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/octet-stream']),
  ('invoices', 'invoices', true, 52428800, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'application/octet-stream'])
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Perbarui semua bucket yang ada agar dipastikan publik
UPDATE storage.buckets
SET public = true
WHERE id IN ('smartlink', 'smartlinks', 'smartlink-pdf', 'reports', 'pdf', 'invoices');

-- 3. Konfigurasi Kebijakan Keamanan (RLS) untuk Objek di Bucket Publik Smartlink
-- Hapus policy lama jika ada untuk mencegah konflik
DROP POLICY IF EXISTS "Public Read Smartlink Bucket" ON storage.objects;
DROP POLICY IF EXISTS "Public Access on Smartlink Objects" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read smartlink" ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert smartlink" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update smartlink" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete smartlink" ON storage.objects;
DROP POLICY IF EXISTS "Public select on public buckets" ON storage.objects;

-- Policy 1: Akses Baca Publik Terbuka Tanpa Login untuk Bucket Dokumen Smartlink
-- Memastikan pengguna publik (orang tua, siswa, pengawas via tautan WhatsApp) dapat mengunduh & membuka PDF tanpa otentikasi
CREATE POLICY "Public Read Smartlink Bucket"
ON storage.objects
FOR SELECT
TO public
USING (
  bucket_id IN ('smartlink', 'smartlinks', 'smartlink-pdf', 'reports', 'pdf', 'invoices')
  OR (SELECT b.public FROM storage.buckets b WHERE b.id = storage.objects.bucket_id) = true
);

-- Policy 2: Izinkan Penyimpanan Dokumen Smartlink Publik
CREATE POLICY "Allow public insert smartlink"
ON storage.objects
FOR INSERT
TO public
WITH CHECK (
  bucket_id IN ('smartlink', 'smartlinks', 'smartlink-pdf', 'reports', 'pdf', 'invoices')
  OR (SELECT b.public FROM storage.buckets b WHERE b.id = storage.objects.bucket_id) = true
);

-- Policy 3: Izinkan Pembaruan Dokumen Smartlink Publik
CREATE POLICY "Allow public update smartlink"
ON storage.objects
FOR UPDATE
TO public
USING (
  bucket_id IN ('smartlink', 'smartlinks', 'smartlink-pdf', 'reports', 'pdf', 'invoices')
  OR (SELECT b.public FROM storage.buckets b WHERE b.id = storage.objects.bucket_id) = true
);
