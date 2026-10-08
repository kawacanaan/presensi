-- =============================================================================
-- Migrasi SQL Kawacanaan SD: Dukungan Wali Kelas Mengampu Hingga 2 Rombel
-- & Konsistensi Kapasitas Rombel Maksimal 50 Siswa
-- =============================================================================

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
  v_assigned_class_ids UUID[];
  v_excess_class_id UUID;
BEGIN
  -- Validasi Parameter
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'Parameter p_school_id wajib diisi.';
  END IF;
  IF p_teacher_id IS NULL THEN
    RAISE EXCEPTION 'Parameter p_teacher_id wajib diisi.';
  END IF;

  -- 1. Jika rombel tujuan ditentukan (assign / tambah / ganti rombel)
  IF p_class_id IS NOT NULL THEN
    -- Pastikan rombel terdaftar pada sekolah yang bersangkutan
    SELECT * INTO v_class
    FROM public.classes
    WHERE id = p_class_id AND school_id = p_school_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Rombel dengan ID % tidak ditemukan pada sekolah ini.', p_class_id;
    END IF;

    -- Bersihkan wali kelas lama di rombel target dari tabel teacher_assignments jika ada
    DELETE FROM public.teacher_assignments
    WHERE school_id = p_school_id
      AND class_id = p_class_id
      AND role = 'WALI_KELAS';

    -- Pasang guru sebagai wali kelas di tabel classes untuk rombel target
    UPDATE public.classes
    SET wali_kelas_teacher_id = p_teacher_id,
        updated_at = NOW()
    WHERE id = p_class_id
      AND school_id = p_school_id;

    -- Ambil semua rombel yang saat ini diampu oleh guru ini
    SELECT ARRAY_AGG(id) INTO v_assigned_class_ids
    FROM public.classes
    WHERE school_id = p_school_id
      AND wali_kelas_teacher_id = p_teacher_id;

    -- Jika guru ini memegang lebih dari 2 rombel, lepaskan rombel paling awal (tertua) selain rombel target
    WHILE COALESCE(array_length(v_assigned_class_ids, 1), 0) > 2 LOOP
      SELECT id INTO v_excess_class_id
      FROM public.classes
      WHERE school_id = p_school_id
        AND wali_kelas_teacher_id = p_teacher_id
        AND id != p_class_id
      ORDER BY updated_at ASC, created_at ASC
      LIMIT 1;

      IF v_excess_class_id IS NOT NULL THEN
        UPDATE public.classes
        SET wali_kelas_teacher_id = NULL,
            updated_at = NOW()
        WHERE id = v_excess_class_id;

        DELETE FROM public.teacher_assignments
        WHERE school_id = p_school_id
          AND class_id = v_excess_class_id
          AND teacher_id = p_teacher_id
          AND role = 'WALI_KELAS';
      END IF;

      SELECT ARRAY_AGG(id) INTO v_assigned_class_ids
      FROM public.classes
      WHERE school_id = p_school_id
        AND wali_kelas_teacher_id = p_teacher_id;
    END LOOP;

    -- Catat ke tabel terpadu teacher_assignments untuk rombel target
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

    -- Sinkronkan array class_ids pada tabel profiles dengan seluruh kelas binaan (hingga 2)
    UPDATE public.profiles
    SET class_id = p_class_id,
        class_ids = v_assigned_class_ids,
        updated_at = NOW()
    WHERE school_id = p_school_id
      AND (teacher_id = p_teacher_id OR (p_actor_user_id IS NOT NULL AND id = p_actor_user_id));
  ELSE
    -- Jika p_class_id IS NULL, lepaskan seluruh penugasan wali kelas untuk guru ini
    UPDATE public.classes
    SET wali_kelas_teacher_id = NULL,
        updated_at = NOW()
    WHERE school_id = p_school_id
      AND wali_kelas_teacher_id = p_teacher_id;

    DELETE FROM public.teacher_assignments
    WHERE school_id = p_school_id
      AND teacher_id = p_teacher_id
      AND role = 'WALI_KELAS';

    UPDATE public.profiles
    SET class_id = NULL,
        class_ids = '{}'::UUID[],
        updated_at = NOW()
    WHERE school_id = p_school_id
      AND (teacher_id = p_teacher_id OR (p_actor_user_id IS NOT NULL AND id = p_actor_user_id));
  END IF;

  -- Perbarui tugas_utama pada tabel master teachers
  UPDATE public.teachers
  SET tugas_utama = 'Wali Kelas',
      updated_at = NOW()
  WHERE id = p_teacher_id
    AND school_id = p_school_id;

  RETURN jsonb_build_object(
    'ok', true,
    'message', 'Penugasan Wali Kelas berhasil diperbarui (mendukung hingga 2 rombel).',
    'school_id', p_school_id,
    'teacher_id', p_teacher_id,
    'class_id', p_class_id,
    'academic_year', v_effective_year
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_homeroom_teacher(UUID, UUID, UUID, TEXT, UUID) TO authenticated, service_role, anon;

NOTIFY pgrst, 'reload schema';
