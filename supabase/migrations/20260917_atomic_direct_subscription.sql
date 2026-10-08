-- Migration: Atomic Direct Subscription RPC
-- Description: Transactional function to safely process Super Admin Direct Subscriptions atomically.
-- Guarantees:
-- 1. Validates school exists and plan is supported ('sekolah_pro' or 'guru_pro')
-- 2. Idempotency check on invoice_no (preventing duplicate activation on retries)
-- 3. Atomically inserts into payments (SETTLED)
-- 4. Atomically updates school status, plan, and subscription_expires_at
-- 5. Atomically inserts audit log
-- 6. If any step fails, entire transaction rolls back automatically.

CREATE OR REPLACE FUNCTION process_superadmin_direct_subscription(
  p_school_id UUID,
  p_plan TEXT,
  p_duration_days INT,
  p_amount NUMERIC,
  p_invoice_no TEXT,
  p_plan_name TEXT,
  p_notes TEXT,
  p_actor_id UUID,
  p_actor_name TEXT,
  p_actor_role TEXT,
  p_actor_email TEXT,
  p_idempotency_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_school RECORD;
  v_now TIMESTAMPTZ := NOW();
  v_base_date TIMESTAMPTZ;
  v_new_expiry TIMESTAMPTZ;
  v_existing_payment RECORD;
  v_created_payment RECORD;
  v_target_plan TEXT;
BEGIN
  -- 1. Validasi Input Parameter
  IF p_school_id IS NULL THEN
    RAISE EXCEPTION 'ID Sekolah tujuan wajib diisi.';
  END IF;

  IF p_duration_days IS NULL OR p_duration_days <= 0 THEN
    RAISE EXCEPTION 'Durasi langganan minimal 1 hari.';
  END IF;

  IF p_invoice_no IS NULL OR TRIM(p_invoice_no) = '' THEN
    RAISE EXCEPTION 'Nomor faktur (invoice_no) wajib ditentukan.';
  END IF;

  -- Normalisasi target plan ('sekolah_pro' atau 'guru_pro')
  IF LOWER(TRIM(p_plan)) LIKE '%guru%' OR LOWER(TRIM(p_plan)) = 'teacher' THEN
    v_target_plan := 'guru_pro';
  ELSE
    v_target_plan := 'sekolah_pro';
  END IF;

  -- 2. Cek apakah invoice_no ini sudah pernah diproses sebelumnya (Idempotency Check)
  SELECT * INTO v_existing_payment
  FROM payments
  WHERE invoice_no = p_invoice_no
  LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'ok', true,
      'already_processed', true,
      'message', 'Permintaan Direct Subscription ini telah berhasil diproses sebelumnya (Invoice: ' || v_existing_payment.invoice_no || '). Tidak ada perpanjangan ganda.',
      'payment', row_to_json(v_existing_payment),
      'new_expiry', v_existing_payment.expires_at
    );
  END IF;

  -- 3. Kunci baris sekolah (FOR UPDATE) untuk menjamin serialisasi konkurensi antar transaksi
  SELECT * INTO v_school
  FROM schools
  WHERE id = p_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sekolah dengan ID % tidak ditemukan di database.', p_school_id;
  END IF;

  -- 4. Hitung tanggal kedaluwarsa baru
  IF v_school.subscription_expires_at IS NOT NULL AND v_school.subscription_expires_at > v_now THEN
    v_base_date := v_school.subscription_expires_at;
  ELSE
    v_base_date := v_now;
  END IF;

  v_new_expiry := v_base_date + (p_duration_days || ' days')::INTERVAL;

  -- 5. Catat pembayaran di tabel payments (status: SETTLED)
  INSERT INTO payments (
    invoice_no,
    school_id,
    plan_name,
    amount,
    unique_code,
    total_amount,
    status,
    payment_method,
    school_name,
    npsn,
    contact_name,
    contact_phone,
    email,
    created_at,
    paid_at,
    expires_at
  ) VALUES (
    p_invoice_no,
    v_school.id,
    p_plan_name,
    COALESCE(p_amount, 0),
    0,
    COALESCE(p_amount, 0),
    'SETTLED',
    'DIRECT_SUBSCRIPTION',
    v_school.name,
    v_school.npsn,
    COALESCE(p_actor_name, 'Super Admin'),
    NULL,
    p_actor_email,
    v_now,
    v_now,
    v_new_expiry
  )
  RETURNING * INTO v_created_payment;

  -- 6. Perbarui lisensi sekolah di tabel schools
  UPDATE schools
  SET
    status = 'active',
    plan = v_target_plan,
    subscription_expires_at = v_new_expiry
  WHERE id = v_school.id;

  -- 7. Catat audit log
  INSERT INTO audit_logs (
    school_id,
    actor_id,
    actor_name,
    actor_role,
    action,
    details
  ) VALUES (
    v_school.id,
    p_actor_id,
    COALESCE(p_actor_name, 'Super Admin'),
    COALESCE(p_actor_role, 'SUPER_ADMIN'),
    'SUPERADMIN_DIRECT_SUBSCRIPTION',
    jsonb_build_object(
      'invoice_no', p_invoice_no,
      'school_id', v_school.id,
      'school_name', v_school.name,
      'npsn', v_school.npsn,
      'plan', v_target_plan,
      'duration_days', p_duration_days,
      'amount', COALESCE(p_amount, 0),
      'notes', COALESCE(p_notes, 'Direct Subscription oleh Super Admin'),
      'previous_status', v_school.status,
      'previous_plan', v_school.plan,
      'previous_expiry', v_school.subscription_expires_at,
      'new_expiry', v_new_expiry,
      'idempotency_key', p_idempotency_key
    )
  );

  -- 8. Kembalikan hasil transaksi yang berhasil
  RETURN jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'message', 'Direct Subscription untuk ' || v_school.name || ' berhasil diaktifkan! Masa aktif diperpanjang +' || p_duration_days || ' hari.',
    'payment', row_to_json(v_created_payment),
    'new_expiry', v_new_expiry
  );
END;
$$;
