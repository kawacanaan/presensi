import { createClient } from '@supabase/supabase-js';
import * as crypto from 'crypto';

const json = (res: any, status: number, body: unknown) =>
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));

// Midtrans Configuration Types
interface MidtransConfig {
  client_key: string;
  server_key: string;
  is_production: boolean;
  merchant_id?: string;
  enabled: boolean;
}

/**
 * Normalisasi paket sistem (Canonical):
 * - Paket baru hanya: 'guru_gratis' | 'guru_pro' | 'sekolah_pro'
 * - Legacy compatibility (baca):
 *     free / mulai -> guru_gratis
 *     teacher / guru -> guru_pro
 *     school / sekolah -> sekolah_pro
 */
export function normalizePlan(rawPlan?: string | null): 'guru_gratis' | 'guru_pro' | 'sekolah_pro' {
  const p = String(rawPlan || '').toLowerCase().trim();
  if (p === 'sekolah_pro' || p === 'school' || p === 'sekolah' || p === 'sekolah_uji_coba' || p === 'pro' || p === 'enterprise') {
    return 'sekolah_pro';
  }
  if (p === 'guru_pro' || p === 'teacher' || p === 'guru' || p === 'guru_uji_coba') {
    return 'guru_pro';
  }
  return 'guru_gratis';
}

/**
 * Menghitung durasi aktif lisensi Paket Guru (dalam bulan) berdasarkan nominal pembayaran riil:
 * - Pembayaran Rp1 sampai Rp5.000: 1 bulan
 * - Pembayaran Rp5.001 sampai Rp10.000: 2 bulan
 * - Pembayaran Rp10.001 sampai Rp15.000: 3 bulan
 * - Pembayaran Rp15.001 sampai Rp20.000: 4 bulan
 * - Pembayaran Rp20.001 sampai Rp25.000: 5 bulan
 * - Pembayaran Rp25.001 sampai Rp30.000: 6 bulan
 * - Pembayaran Rp30.001 sampai Rp35.000: 7 bulan
 * - Pembayaran Rp35.001 sampai Rp40.000: 8 bulan
 * - Pembayaran Rp40.001 sampai Rp45.000: 9 bulan
 * - Pembayaran Rp45.001 sampai Rp50.000: 10 bulan
 * - Pembayaran Rp50.001 sampai Rp55.000: 11 bulan
 * - Pembayaran Rp55.001 atau lebih: 12 bulan (1 tahun maksimal)
 * - Nominal <= 0 atau < 1: 0 bulan (tidak aktif)
 */
export function calculateTeacherLicenseMonths(amount: number): number {
  const cleanAmount = Number(amount) || 0;
  if (cleanAmount < 1) return 0;
  if (cleanAmount <= 5000) return 1;
  if (cleanAmount <= 10000) return 2;
  if (cleanAmount <= 15000) return 3;
  if (cleanAmount <= 20000) return 4;
  if (cleanAmount <= 25000) return 5;
  if (cleanAmount <= 30000) return 6;
  if (cleanAmount <= 35000) return 7;
  if (cleanAmount <= 40000) return 8;
  if (cleanAmount <= 45000) return 9;
  if (cleanAmount <= 50000) return 10;
  if (cleanAmount <= 55000) return 11;
  return 12; // Rp55.001 ke atas dibatasi maksimal 12 bulan (1 tahun)
}

/**
 * Menghitung tanggal kedaluwarsa baru secara konsisten:
 * Untuk Paket Guru:
 * - Jika pengguna paket gratis mengaktifkan paket guru, durasi lisensi dihitung mulai dari tanggal aktivasi pembayaran yang berhasil (now).
 * - Jika pengguna sudah memiliki paket guru yang masih aktif, durasi ditambahkan dari tanggal kedaluwarsa saat ini.
 * - Durasi maksimal lisensi yang diberikan untuk satu transaksi pembayaran adalah 12 bulan.
 */
export function calculateNewExpiry(
  targetPlan: 'guru_pro' | 'sekolah_pro',
  grossAmount: number,
  currentExpiryStr: string | null | undefined,
  currentPlanStr: string | null | undefined
): { durationMonths: number; durationDays: number; newExpiry: Date | null } {
  const now = new Date();
  if (targetPlan === 'sekolah_pro') {
    const isYearly = grossAmount >= 200000;
    const durationDays = isYearly ? 365 : 30;
    const currentExpiry = currentExpiryStr ? new Date(currentExpiryStr) : now;
    const baseDate = (!isNaN(currentExpiry.getTime()) && currentExpiry > now) ? currentExpiry : now;
    const newExpiry = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
    return { durationMonths: isYearly ? 12 : 1, durationDays, newExpiry };
  }

  // targetPlan === 'guru_pro'
  const months = calculateTeacherLicenseMonths(grossAmount);
  if (months <= 0) {
    return { durationMonths: 0, durationDays: 0, newExpiry: null };
  }

  const isAlreadyActivePro = normalizePlan(currentPlanStr) === 'guru_pro';
  let baseDate = now;
  if (isAlreadyActivePro && currentExpiryStr) {
    const curExp = new Date(currentExpiryStr);
    if (!isNaN(curExp.getTime()) && curExp > now) {
      baseDate = curExp;
    }
  }

  const newExpiry = new Date(baseDate);
  newExpiry.setMonth(newExpiry.getMonth() + months);
  return { durationMonths: months, durationDays: months * 30, newExpiry };
}

/**
 * Pengecekan & downgrade aman untuk paket yang telah kedaluwarsa.
 * Aturan:
 * - Paket Guru expired -> simpan schools.plan = guru_gratis
 * - Paket Sekolah expired -> simpan schools.plan = guru_gratis
 * - workspace_type TIDAK BOLEH BERUBAH
 * - Idempotent dan tidak menghapus data tenant.
 */
async function checkAndDowngradeExpiredSchool(db: any, school: any): Promise<string> {
  if (!school || !school.id) return 'guru_gratis';
  const now = new Date();
  if (school.subscription_expires_at && new Date(school.subscription_expires_at) <= now) {
    const raw = String(school.plan || '').toLowerCase();
    if (raw !== 'guru_gratis') {
      try {
        await db.from('schools').update({
          plan: 'guru_gratis',
        }).eq('id', school.id);
        school.plan = 'guru_gratis';
      } catch (err) {
        console.warn(`[Midtrans] Gagal downgrade sekolah expired (${school.id}):`, err);
      }
    }
    return 'guru_gratis';
  }
  return normalizePlan(school.plan);
}

/**
 * Helper untuk parsing boolean dari string environment variable
 */
export function parseBoolean(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'production' || s === 'prod' || s === 'live';
  }
  return false;
}

/**
 * Menentukan apakah Midtrans berjalan di lingkungan Production atau Sandbox.
 * Sumber kebenaran:
 * 1. Environment Variable MIDTRANS_IS_PRODUCTION (atau MIDTRANS_ENVIRONMENT / MIDTRANS_ENV / VITE_MIDTRANS_IS_PRODUCTION)
 * 2. Konfigurasi database platform_settings.integrations.midtrans_config.is_production
 * 3. Default aman: false (Sandbox)
 */
export function resolveIsProduction(dbConfig?: any): boolean {
  // 1. Konfigurasi tersimpan di platform_settings Supabase adalah sumber kebenaran utama
  if (dbConfig?.is_production !== undefined) {
    return parseBoolean(dbConfig.is_production);
  }

  // 2. Variabel lingkungan sebagai fallback jika database belum dikonfigurasi
  const envVal = process.env.MIDTRANS_IS_PRODUCTION;
  if (envVal !== undefined && envVal !== '') {
    return parseBoolean(envVal);
  }

  const envMode = process.env.MIDTRANS_ENVIRONMENT || process.env.MIDTRANS_ENV;
  if (envMode !== undefined && envMode !== '') {
    return parseBoolean(envMode);
  }

  const viteEnv = process.env.VITE_MIDTRANS_IS_PRODUCTION;
  if (viteEnv !== undefined && viteEnv !== '') {
    return parseBoolean(viteEnv);
  }

  return false;
}

/**
 * Mendapatkan endpoint URL Midtrans sesuai dengan mode environment.
 * URL Snap JS, Snap Transactions API, Status Inquiry API, dan Core API Token ping.
 */
export function getMidtransEndpoints(isProduction: boolean) {
  return {
    snapJsUrl: isProduction
      ? 'https://app.midtrans.com/snap/snap.js'
      : 'https://app.sandbox.midtrans.com/snap/snap.js',
    snapTransactionsUrl: isProduction
      ? 'https://app.midtrans.com/snap/v1/transactions'
      : 'https://app.sandbox.midtrans.com/snap/v1/transactions',
    statusUrl: (orderId: string) =>
      isProduction
        ? `https://api.midtrans.com/v2/${encodeURIComponent(orderId)}/status`
        : `https://api.sandbox.midtrans.com/v2/${encodeURIComponent(orderId)}/status`,
    tokenUrl: isProduction
      ? 'https://api.midtrans.com/v2/token'
      : 'https://api.sandbox.midtrans.com/v2/token',
  };
}

/**
 * Mengambil konfigurasi Midtrans dari database platform_settings atau environment variables.
 * ATURAN KETAT:
 * - Jangan pernah ada nilai default/fallback palsu atau hardcoded keys.
 * - Server Key hanya disimpan dan digunakan di backend/server-side.
 * - Mode Production vs Sandbox ditentukan secara dinamis via environment variable atau konfigurasi database.
 */
async function getMidtransConfig(db: any): Promise<MidtransConfig> {
  let dbConfig: any = null;
  if (db) {
    try {
      const { data } = await db.from('platform_settings').select('integrations').eq('id', 1).single();
      dbConfig = data?.integrations?.midtrans_config;
    } catch (_) {}
  }

  const isProd = resolveIsProduction(dbConfig);

  // Nilai diambil murni dari DB (Supabase platform_settings) sebagai kebenaran utama, fallback ke Environment Variable
  const clientKey =
    dbConfig?.client_key?.trim() ||
    process.env.MIDTRANS_CLIENT_KEY?.trim() ||
    process.env.VITE_MIDTRANS_CLIENT_KEY?.trim() ||
    '';

  const serverKey =
    dbConfig?.server_key?.trim() ||
    process.env.MIDTRANS_SERVER_KEY?.trim() ||
    '';

  const merchantId =
    dbConfig?.merchant_id?.trim() ||
    process.env.MIDTRANS_MERCHANT_ID?.trim() ||
    '';

  const enabled =
    dbConfig?.enabled !== undefined
      ? Boolean(dbConfig.enabled)
      : Boolean(clientKey && serverKey);

  return {
    client_key: clientKey,
    server_key: serverKey,
    is_production: isProd,
    merchant_id: merchantId,
    enabled,
  };
}

export default async function handler(req: any, res: any, env?: any) {
  // Allow POST and GET
  if (req.method !== 'POST' && req.method !== 'GET') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const cfEnv = env || req?.env || {};
  const url = cfEnv.SUPABASE_URL || cfEnv.VITE_SUPABASE_URL || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = cfEnv.SUPABASE_SERVICE_ROLE_KEY || cfEnv.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';

  const b = req.body || {};
  const q = req.query || {};
  const action = b.action || q.action || '';

  // --------------------------------------------------------------------------
  // 1. GET PUBLIC CLIENT CONFIG (Client Key & Environment Mode)
  // Aman dipanggil frontend karena Server Key TIDAK dibagikan.
  // --------------------------------------------------------------------------
  if (
    action === 'get_client_config' ||
    action === 'config' ||
    (req.method === 'GET' &&
      !b.order_id &&
      !q.order_id &&
      action !== 'check_pricing' &&
      action !== 'check_status' &&
      action !== 'get_invoice')
  ) {
    let clientKey =
      cfEnv.MIDTRANS_CLIENT_KEY?.trim() ||
      cfEnv.VITE_MIDTRANS_CLIENT_KEY?.trim() ||
      process.env.MIDTRANS_CLIENT_KEY?.trim() ||
      process.env.VITE_MIDTRANS_CLIENT_KEY?.trim() ||
      '';
    let serverKey = cfEnv.MIDTRANS_SERVER_KEY?.trim() || process.env.MIDTRANS_SERVER_KEY?.trim() || '';
    let isProd = resolveIsProduction();
    let isConfigured = Boolean(clientKey && serverKey);
    let enabled = isConfigured;

    if (url && key) {
      try {
        const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
        const midtrans = await getMidtransConfig(db);
        clientKey = midtrans.client_key || clientKey;
        serverKey = midtrans.server_key || serverKey;
        isProd = midtrans.is_production;
        isConfigured = Boolean(clientKey && serverKey);
        enabled = midtrans.enabled && isConfigured;
      } catch (_) {}
    }

    const endpoints = getMidtransEndpoints(isProd);

    return json(res, 200, {
      ok: true,
      client_key: clientKey,
      is_production: isProd,
      enabled,
      is_configured: isConfigured,
      snap_url: endpoints.snapJsUrl,
    });
  }

  if (!url || !key) {
    return json(res, 500, { error: 'Supabase server configuration is missing.' });
  }

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const midtrans = await getMidtransConfig(db);

  // --------------------------------------------------------------------------
  // 1.1 CHECK PRICING & ELIGIBILITY (First-time vs Renewal)
  // --------------------------------------------------------------------------
  if (action === 'check_pricing') {
    const rawPlan = b.plan_id || q.plan_id || 'sekolah_pro';
    const plan_id = normalizePlan(rawPlan);
    const school_id = b.school_id || q.school_id || null;
    const npsn = b.npsn || q.npsn || null;

    if (school_id) {
      const { data: sch } = await db
        .from('schools')
        .select('id, plan, subscription_expires_at')
        .eq('id', school_id)
        .maybeSingle();
      if (sch) {
        await checkAndDowngradeExpiredSchool(db, sch);
      }
    }

    let packagesConfig: any = null;
    try {
      const { data } = await db.from('platform_settings').select('integrations').eq('id', 1).single();
      packagesConfig = data?.integrations?.platform_config?.packages_config;
    } catch (_) {}

    if (plan_id === 'guru_gratis') {
      return json(res, 200, {
        ok: true,
        plan_id: 'guru_gratis',
        monthly_amount: 0,
        yearly_amount: 0,
        yearly_regular_amount: 0,
        yearly_first_time_amount: 0,
        is_first_time: true,
        discount_amount: 0,
        note: 'Paket Guru Gratis: Rp0 (Fitur dasar presensi dan kelas binaan tanpa kedaluwarsa)',
      });
    }

    const isSchool = plan_id === 'sekolah_pro';

    if (isSchool) {
      const schConfig = packagesConfig?.sekolah_pro;
      const monthly = schConfig?.hargaBulanan ?? schConfig?.harga ?? 25000;
      const yearlyRegular = schConfig?.hargaTahunan ?? 300000;
      const yearlyFirstTime = schConfig?.hargaTahunanPerdana ?? 250000;

      let isFirstTime = true;
      if (school_id) {
        const { data: pastPayments } = await db
          .from('payments')
          .select('id')
          .eq('school_id', school_id)
          .in('status', ['SETTLED', 'SUCCESS', 'settlement', 'capture'])
          .limit(1);
        if (pastPayments && pastPayments.length > 0) isFirstTime = false;
      }
      if (isFirstTime && npsn) {
        const { data: pastNpsnPayments } = await db
          .from('payments')
          .select('id')
          .eq('npsn', npsn)
          .in('status', ['SETTLED', 'SUCCESS', 'settlement', 'capture'])
          .limit(1);
        if (pastNpsnPayments && pastNpsnPayments.length > 0) isFirstTime = false;
      }
      if (isFirstTime && school_id) {
        const { data: sch } = await db
          .from('schools')
          .select('id, plan, subscription_expires_at')
          .eq('id', school_id)
          .maybeSingle();
        if (sch && sch.subscription_expires_at) isFirstTime = false;
      }

      const yearlyEffective = isFirstTime ? yearlyFirstTime : yearlyRegular;

      return json(res, 200, {
        ok: true,
        plan_id: 'sekolah_pro',
        monthly_amount: monthly,
        yearly_amount: yearlyEffective,
        yearly_regular_amount: yearlyRegular,
        yearly_first_time_amount: yearlyFirstTime,
        is_first_time: isFirstTime,
        discount_amount: isFirstTime ? (yearlyRegular - yearlyFirstTime) : 0,
        note: isFirstTime ? 'Promo Perdana: Hemat 2 Bulan (Rp50.000)' : 'Tarif Perpanjangan Tahunan Resmi',
      });
    } else {
      const teachConfig = packagesConfig?.guru_pro;
      const basePrice = teachConfig?.harga ?? 5000;

      return json(res, 200, {
        ok: true,
        plan_id: 'guru_pro',
        base_amount: basePrice,
        note: 'Paket Guru: Aktivasi lisensi berdasarkan nominal pembayaran Midtrans bertingkat (1 s.d. 12 bulan)',
      });
    }
  }

  // --------------------------------------------------------------------------
  // 2. MIDTRANS WEBHOOK NOTIFICATION HANDLER
  // Dipanggil otomatis oleh Midtrans saat ada perubahan status pembayaran.
  // --------------------------------------------------------------------------
  const isWebhookNotification = Boolean(
    b.order_id && b.status_code && b.signature_key && (b.transaction_status || b.status_message)
  );

  if (isWebhookNotification || action === 'webhook') {
    const {
      order_id,
      status_code,
      gross_amount,
      signature_key,
      transaction_status,
      payment_type,
      fraud_status,
    } = b;

    if (!order_id || !signature_key) {
      return json(res, 400, { error: 'Invalid notification payload' });
    }

    if (!midtrans.server_key) {
      console.error('[Midtrans Webhook] Server Key belum dikonfigurasi di server');
      return json(res, 500, { error: 'Midtrans Server Key belum dikonfigurasi di server.' });
    }

    // Verifikasi Signature SHA512
    const inputSig = `${order_id}${status_code}${gross_amount}${midtrans.server_key}`;
    const expectedSig = crypto.createHash('sha512').update(inputSig).digest('hex');

    if (signature_key !== expectedSig) {
      console.warn(`[Midtrans Webhook] Invalid signature for order: ${order_id}`);
      return json(res, 403, { error: 'Signature verification failed' });
    }

    console.log(`[Midtrans Webhook] Received status ${transaction_status} for ${order_id}`);

    // Tentukan apakah pembayaran berhasil
    const isSuccess =
      transaction_status === 'settlement' ||
      (transaction_status === 'capture' && fraud_status === 'accept');

    const isFailed =
      transaction_status === 'cancel' ||
      transaction_status === 'deny' ||
      transaction_status === 'expire';

    const dbStatus = isSuccess ? 'SETTLED' : isFailed ? 'EXPIRED' : 'PENDING';

    // Cari transaksi di tabel payments
    const { data: existingPayment } = await db
      .from('payments')
      .select('*')
      .eq('invoice_no', order_id)
      .single();

    if (existingPayment) {
      // 1. Guard Idempotensi: Jika transaksi ini sudah berstatus SETTLED, jangan tambahkan lisensi berulang kali
      const isAlreadySettled =
        existingPayment.status === 'SETTLED' ||
        existingPayment.status === 'settlement' ||
        existingPayment.status === 'capture';

      if (isAlreadySettled && isSuccess) {
        console.log(`[Midtrans Webhook] Transaksi ${order_id} sudah lunas (SETTLED) sebelumnya. Mengabaikan eksekusi duplikat.`);
        return json(res, 200, { ok: true, message: 'Transaksi telah diproses sebelumnya.' });
      }

      const verifiedGross = Number(gross_amount || existingPayment.amount || 0);

      // Update status pembayaran
      await db
        .from('payments')
        .update({
          status: dbStatus,
          payment_method: payment_type || 'MIDTRANS',
          paid_at: isSuccess ? new Date().toISOString() : existingPayment.paid_at,
          total_amount: verifiedGross > 0 ? verifiedGross : existingPayment.total_amount,
        })
        .eq('invoice_no', order_id);

      // Jika berhasil, perpanjang masa aktif langganan sekolah / guru
      if (isSuccess && existingPayment.school_id) {
        // Jika nominal pembayaran Rp0 atau kurang dari Rp1, sistem tidak memberikan aktivasi lisensi.
        if (verifiedGross < 1) {
          console.warn(`[Midtrans Webhook] Nominal pembayaran Rp0 atau kurang dari Rp1 (${verifiedGross}). Lisensi tidak diaktifkan.`);
          return json(res, 200, { ok: true, message: 'Nominal kurang dari Rp1. Lisensi tidak diaktifkan.' });
        }

        const { data: school } = await db
          .from('schools')
          .select('*')
          .eq('id', existingPayment.school_id)
          .single();

        if (school) {
          const targetPlan = existingPayment.plan_name?.toLowerCase().includes('guru') || existingPayment.invoice_no?.includes('GRU')
            ? 'guru_pro'
            : 'sekolah_pro';

          const { durationMonths, durationDays, newExpiry } = calculateNewExpiry(
            targetPlan,
            verifiedGross,
            school.subscription_expires_at,
            school.plan
          );

          if (!newExpiry) {
            console.warn(`[Midtrans Webhook] Durasi lisensi 0 bulan untuk order ${order_id}. Lisensi tidak diperpanjang.`);
            return json(res, 200, { ok: true, message: 'Durasi lisensi 0 bulan.' });
          }

          const updatePayload: any = {
            status: 'active',
            plan: targetPlan,
            subscription_expires_at: newExpiry.toISOString(),
          };
          if (targetPlan === 'sekolah_pro') {
            updatePayload.max_teachers = 100;
            updatePayload.max_students = 1200;
            updatePayload.max_classes = 24;
          } else if (targetPlan === 'guru_pro') {
            const { data: userProf } = await db
              .from('profiles')
              .select('role')
              .eq('school_id', school.id)
              .maybeSingle();
            const isSubject = (userProf?.role || '').toUpperCase().trim() === 'GURU MAPEL';
            updatePayload.max_teachers = 1;
            updatePayload.max_students = isSubject ? 300 : 50;
            updatePayload.max_classes = isSubject ? 6 : 1;
          }

          await db
            .from('schools')
            .update(updatePayload)
            .eq('id', school.id);

          // Update juga profil pengguna guru yang bernaung di bawah school_id ini
          try {
            await db
              .from('profiles')
              .update({
                subscription_plan: targetPlan,
                subscription_status: 'active',
                subscription_expires_at: newExpiry.toISOString(),
              })
              .eq('school_id', school.id);
          } catch (_) {}

          // Catat audit log
          await db.from('audit_logs').insert({
            school_id: school.id,
            actor_name: 'Midtrans Payment Gateway',
            actor_role: 'SYSTEM',
            action: 'MIDTRANS_PAYMENT_SETTLED',
            details: {
              order_id,
              gross_amount: verifiedGross,
              duration_months: durationMonths,
              duration_days: durationDays,
              payment_type,
              previous_expiry: school.subscription_expires_at,
              new_expiry: newExpiry.toISOString(),
            },
          });
        }
      }
    }

    return json(res, 200, { ok: true, message: 'Notification processed successfully' });
  }

  // --------------------------------------------------------------------------
  // 3. CREATE SNAP TRANSACTION
  // --------------------------------------------------------------------------
  if (action === 'create_transaction') {
    const {
      billing_cycle = 'monthly',
      school_id,
      school_name,
      npsn,
      contact_name,
      contact_phone,
      email,
    } = b;

    // Normalisasi paket yang dibeli (hanya guru_pro atau sekolah_pro untuk transaksi berbayar)
    const plan_id = normalizePlan(b.plan_id || 'guru_pro');

    // Ambil harga dari konfigurasi paket di database jika ada
    let packagesConfig: any = null;
    try {
      const { data } = await db.from('platform_settings').select('integrations').eq('id', 1).single();
      packagesConfig = data?.integrations?.platform_config?.packages_config;
    } catch (_) {}

    const isSchool = plan_id === 'sekolah_pro';
    const isYearly = billing_cycle === 'yearly';

    // ------------------------------------------------------------------------
    // VALIDASI TIER & SUBSCRIPTION HIERARCHY:
    // Pengguna yang sekolahnya sedang aktif berlangganan Paket Sekolah Pro TIDAK BOLEH
    // membeli Paket Guru Pro (karena seluruh guru & admin sudah tercakup lisensi sekolah).
    // Jika masa aktif Paket Sekolah telah berakhir (expired), sistem otomatis melakukan downgrade
    // aman dan idempotent ke guru_gratis (tanpa mengubah workspace_type), sehingga pengguna
    // diperkenankan untuk membeli Paket Guru Pro atau memperpanjang Paket Sekolah Pro.
    // ------------------------------------------------------------------------
    if (!isSchool) {
      let activeSchoolPro = false;
      let existingSchoolName = '';
      const currentTime = new Date();

      // 1. Cek berdasarkan school_id jika dikirim di request
      if (school_id) {
        const { data: sch } = await db
          .from('schools')
          .select('id, name, plan, status, subscription_expires_at, workspace_type')
          .eq('id', school_id)
          .maybeSingle();

        if (sch) {
          const effectivePlan = await checkAndDowngradeExpiredSchool(db, sch);
          const isProPlan = effectivePlan === 'sekolah_pro';
          const isNotSuspended = sch.status !== 'suspended' && sch.status !== 'inactive';
          const isNotExpired = !sch.subscription_expires_at || new Date(sch.subscription_expires_at) > currentTime;

          if (isProPlan && isNotSuspended && isNotExpired) {
            activeSchoolPro = true;
            existingSchoolName = sch.name || 'sekolah Anda';
          }
        }
      }

      // 2. Cek juga berdasarkan user_id jika dikirim di request
      if (!activeSchoolPro && b.user_id) {
        const { data: prof } = await db
          .from('profiles')
          .select('id, school_id, subscription_plan, subscription_expires_at, subscription_status')
          .eq('id', b.user_id)
          .maybeSingle();

        if (prof?.school_id) {
          const { data: sch } = await db
            .from('schools')
            .select('id, name, plan, status, subscription_expires_at, workspace_type')
            .eq('id', prof.school_id)
            .maybeSingle();

          if (sch) {
            const effectivePlan = await checkAndDowngradeExpiredSchool(db, sch);
            const isProPlan = effectivePlan === 'sekolah_pro';
            const isNotSuspended = sch.status !== 'suspended' && sch.status !== 'inactive';
            const isNotExpired = !sch.subscription_expires_at || new Date(sch.subscription_expires_at) > currentTime;

            if (isProPlan && isNotSuspended && isNotExpired) {
              activeSchoolPro = true;
              existingSchoolName = sch.name || 'sekolah Anda';
            }
          }
        } else if (prof) {
          const profPlan = normalizePlan(prof.subscription_plan);
          const isProPlan = profPlan === 'sekolah_pro';
          const isNotSuspended = prof.subscription_status !== 'suspended' && prof.subscription_status !== 'inactive';
          const isNotExpired = !prof.subscription_expires_at || new Date(prof.subscription_expires_at) > currentTime;

          if (isProPlan && isNotSuspended && isNotExpired) {
            activeSchoolPro = true;
            existingSchoolName = 'sekolah Anda';
          }
        }
      }

      if (activeSchoolPro) {
        return json(res, 400, {
          ok: false,
          error: `Sekolah Anda (${existingSchoolName}) telah aktif berlangganan Paket Sekolah Pro. Seluruh fitur Guru Pro sudah aktif otomatis untuk semua guru dan staf sekolah. Anda tidak diperkenankan membeli Paket Guru.`,
        });
      }
    }

    let isFirstTimeSchoolPurchase = true;

    if (isSchool && isYearly) {
      // 1. Cek tabel payments untuk riwayat pembayaran lunas/sukses pada sekolah ini
      if (school_id) {
        const { data: pastPayments } = await db
          .from('payments')
          .select('id, status')
          .eq('school_id', school_id)
          .in('status', ['SETTLED', 'SUCCESS', 'settlement', 'capture'])
          .limit(1);

        if (pastPayments && pastPayments.length > 0) {
          isFirstTimeSchoolPurchase = false;
        }
      }

      // 2. Cek berdasarkan NPSN jika tersedia
      if (isFirstTimeSchoolPurchase && npsn) {
        const { data: pastNpsnPayments } = await db
          .from('payments')
          .select('id, status')
          .eq('npsn', npsn)
          .in('status', ['SETTLED', 'SUCCESS', 'settlement', 'capture'])
          .limit(1);

        if (pastNpsnPayments && pastNpsnPayments.length > 0) {
          isFirstTimeSchoolPurchase = false;
        }
      }

      // 3. Cek apakah sekolah sudah pernah memiliki masa aktif sebelumnya
      if (isFirstTimeSchoolPurchase && school_id) {
        const { data: sch } = await db
          .from('schools')
          .select('id, plan, subscription_expires_at')
          .eq('id', school_id)
          .maybeSingle();

        if (sch && sch.subscription_expires_at) {
          isFirstTimeSchoolPurchase = false;
        }
      }
    }

    let amount = 0;
    let planTitle = '';

    if (isSchool) {
      const schConfig = packagesConfig?.sekolah_pro;
      if (isYearly) {
        const firstTimePrice = schConfig?.hargaTahunanPerdana ?? 250000;
        const renewalPrice = schConfig?.hargaTahunan ?? 300000;
        amount = isFirstTimeSchoolPurchase ? firstTimePrice : renewalPrice;
        planTitle = isFirstTimeSchoolPurchase
          ? 'Paket Sekolah Pro 1 Tahun (Promo Perdana)'
          : 'Paket Sekolah Pro 1 Tahun (Perpanjangan Tahunan)';
      } else {
        amount = schConfig?.hargaBulanan ?? schConfig?.harga ?? 25000;
        planTitle = 'Paket Sekolah Pro (1 Bulan)';
      }
    } else {
      const customAmount = Number(b.amount || b.gross_amount);
      const teachConfig = packagesConfig?.guru_pro;
      const baseDefaultAmount = Number(teachConfig?.harga) || 5000;
      amount = (customAmount && customAmount >= 1) ? customAmount : baseDefaultAmount;
      planTitle = 'Dukungan Pengembangan Paket Guru';
    }

    // Buat Order ID Unik
    const cleanPrefix = isSchool ? 'SCH' : 'GRU';
    const timeStamp = Math.floor(Date.now() / 1000);
    const randomSuffix = Math.floor(Math.random() * 899 + 100);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const finalAmount = amount;
    const orderId = `KWC-${cleanPrefix}-${timeStamp}-${randomSuffix}`;

    // Jika Midtrans belum dikonfigurasi kuncinya oleh Superadmin
    if (!midtrans.server_key || !midtrans.client_key || !midtrans.enabled) {
      await db.from('payments').upsert(
        {
          invoice_no: orderId,
          school_id: school_id || null,
          plan_name: planTitle,
          amount: amount,
          unique_code: 0,
          total_amount: finalAmount,
          status: 'PENDING',
          payment_method: 'MIDTRANS',
          school_name: school_name || 'Sekolah Dasar',
          npsn: npsn || null,
          contact_name: contact_name || 'Wali Kelas / Guru',
          contact_phone: contact_phone || null,
          email: email || null,
          created_at: now.toISOString(),
          expires_at: expiresAt,
        },
        { onConflict: 'invoice_no' }
      );

      const endpoints = getMidtransEndpoints(midtrans.is_production);

      return json(res, 200, {
        ok: true,
        order_id: orderId,
        snap_token: null,
        token: null,
        redirect_url: null,
        amount: finalAmount,
        plan_title: planTitle,
        client_key: midtrans.client_key || '',
        is_production: midtrans.is_production,
        snap_url: endpoints.snapJsUrl,
        is_simulation: true,
        notice: 'Kredensial Midtrans belum diset di Super Admin. Tagihan berhasil dibuat dan dapat diverifikasi langsung oleh Super Admin.',
      });
    }

    const endpoints = getMidtransEndpoints(midtrans.is_production);
    const snapEndpoint = endpoints.snapTransactionsUrl;

    const authHeader = `Basic ${Buffer.from(`${midtrans.server_key}:`).toString('base64')}`;

    const snapPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: finalAmount,
      },
      customer_details: {
        first_name: (contact_name || 'Pelanggan Kawacanaan').slice(0, 50),
        email: email || 'billing@kawacanaan.id',
        phone: contact_phone || '081234567890',
      },
      item_details: [
        {
          id: `${plan_id}_${billing_cycle}`,
          price: finalAmount,
          quantity: 1,
          name: planTitle.slice(0, 50),
        },
      ],
      expiry: {
        unit: 'minute',
        duration: 60 * 24, // 24 jam batas pembayaran
      },
    };

    try {
      const snapRes = await fetch(snapEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: authHeader,
        },
        body: JSON.stringify(snapPayload),
      });

      const snapData = await snapRes.json();

      if (!snapRes.ok || !snapData.token) {
        console.error('[Midtrans Snap Error]', snapData);
        return json(res, snapRes.status || 400, {
          error: snapData.error_messages?.join(', ') || 'Gagal membuat sesi pembayaran Midtrans Snap.',
          details: snapData,
        });
      }

      // Catat transaksi awal di tabel payments
      await db.from('payments').upsert(
        {
          invoice_no: orderId,
          school_id: school_id || null,
          plan_name: planTitle,
          amount: amount,
          unique_code: 0,
          total_amount: finalAmount,
          status: 'PENDING',
          payment_method: 'MIDTRANS',
          school_name: school_name || 'Sekolah Dasar',
          npsn: npsn || null,
          contact_name: contact_name || 'Wali Kelas / Guru',
          contact_phone: contact_phone || null,
          email: email || null,
          created_at: now.toISOString(),
          expires_at: expiresAt,
        },
        { onConflict: 'invoice_no' }
      );

      return json(res, 200, {
        ok: true,
        order_id: orderId,
        snap_token: snapData.token,
        token: snapData.token,
        redirect_url: snapData.redirect_url,
        amount: finalAmount,
        original_amount: amount,
        discount_amount: 0,
        plan_title: planTitle,
        client_key: midtrans.client_key,
        is_production: midtrans.is_production,
        snap_url: endpoints.snapJsUrl,
      });
    } catch (err: any) {
      console.error('[Midtrans Request Failed]', err);
      return json(res, 500, {
        error: `Koneksi ke Midtrans gagal: ${err?.message || 'Network error'}`,
      });
    }
  }

  // --------------------------------------------------------------------------
  // 4. CHECK TRANSACTION STATUS (Manual Inquiry via Midtrans Core API)
  // --------------------------------------------------------------------------
  if (action === 'check_status') {
    const orderId = b.order_id || q.order_id;
    if (!orderId) {
      return json(res, 400, { error: 'order_id wajib diisi' });
    }

    // Periksa status lokal di database terlebih dahulu
    const { data: localPayment } = await db
      .from('payments')
      .select('*')
      .eq('invoice_no', orderId)
      .maybeSingle();

    if (localPayment && localPayment.status === 'SETTLED') {
      let latestExpiry: string | null = null;
      if (localPayment.school_id) {
        const { data: sch } = await db
          .from('schools')
          .select('subscription_expires_at')
          .eq('id', localPayment.school_id)
          .maybeSingle();
        latestExpiry = sch?.subscription_expires_at || null;
      }
      return json(res, 200, {
        ok: true,
        status: 'settlement',
        is_settled: true,
        payment: localPayment,
        gross_amount: localPayment.total_amount || localPayment.amount,
        expires_at: latestExpiry,
        message: 'Transaksi sudah LUNAS terverifikasi di sistem.',
      });
    }

    if (!midtrans.server_key) {
      return json(res, 200, {
        ok: true,
        status: localPayment?.status || 'PENDING',
        is_settled: localPayment?.status === 'SETTLED',
        payment: localPayment,
        notice: 'Midtrans Server Key belum diatur di server.',
      });
    }

    const endpoints = getMidtransEndpoints(midtrans.is_production);
    const checkUrl = endpoints.statusUrl(orderId);

    const authHeader = `Basic ${Buffer.from(`${midtrans.server_key}:`).toString('base64')}`;

    try {
      const response = await fetch(checkUrl, {
        headers: {
          Accept: 'application/json',
          Authorization: authHeader,
        },
      });
      const data = await response.json();

      if (!response.ok) {
        return json(res, response.status, { error: data.status_message || 'Gagal cek status' });
      }

      const isSuccess =
        data.transaction_status === 'settlement' ||
        (data.transaction_status === 'capture' && data.fraud_status === 'accept');

      if (isSuccess) {
        const { data: existingPayment } = await db
          .from('payments')
          .select('*')
          .eq('invoice_no', orderId)
          .single();

        await db
          .from('payments')
          .update({
            status: 'SETTLED',
            paid_at: new Date().toISOString(),
            payment_method: data.payment_type || 'MIDTRANS',
          })
          .eq('invoice_no', orderId);

        if (existingPayment && existingPayment.status !== 'SETTLED' && existingPayment.school_id) {
          const verifiedGross = Number(data.gross_amount || existingPayment.amount || 0);
          const { data: school } = await db
            .from('schools')
            .select('*')
            .eq('id', existingPayment.school_id)
            .single();

          if (school && verifiedGross >= 1) {
            const targetPlan = existingPayment.plan_name?.toLowerCase().includes('guru') || existingPayment.invoice_no?.includes('GRU')
              ? 'guru_pro'
              : 'sekolah_pro';

            const { durationMonths, durationDays, newExpiry } = calculateNewExpiry(
              targetPlan,
              verifiedGross,
              school.subscription_expires_at,
              school.plan
            );

            if (newExpiry) {
              const updatePayload: any = {
                status: 'active',
                plan: targetPlan,
                subscription_expires_at: newExpiry.toISOString(),
              };
              if (targetPlan === 'sekolah_pro') {
                updatePayload.max_teachers = 100;
                updatePayload.max_students = 1200;
                updatePayload.max_classes = 24;
              } else if (targetPlan === 'guru_pro') {
                const { data: userProf } = await db
                  .from('profiles')
                  .select('role')
                  .eq('school_id', school.id)
                  .maybeSingle();
                const isSubject = (userProf?.role || '').toUpperCase().trim() === 'GURU MAPEL';
                updatePayload.max_teachers = 1;
                updatePayload.max_students = isSubject ? 300 : 50;
                updatePayload.max_classes = isSubject ? 6 : 1;
              }

              await db
                .from('schools')
                .update(updatePayload)
                .eq('id', school.id);

              try {
                await db
                  .from('profiles')
                  .update({
                    subscription_plan: targetPlan,
                    subscription_status: 'active',
                    subscription_expires_at: newExpiry.toISOString(),
                  })
                  .eq('school_id', school.id);
              } catch (_) {}

              await db.from('audit_logs').insert({
                school_id: school.id,
                actor_name: 'Midtrans Status Check',
                actor_role: 'SYSTEM',
                action: 'MIDTRANS_STATUS_CHECK_SETTLED',
                details: {
                  order_id: orderId,
                  gross_amount: verifiedGross,
                  duration_months: durationMonths,
                  duration_days: durationDays,
                  previous_expiry: school.subscription_expires_at,
                  new_expiry: newExpiry.toISOString(),
                },
              });
            }
          }
        }
      }

      let checkedExpiry: string | null = null;
      if (localPayment?.school_id) {
        const { data: sch } = await db
          .from('schools')
          .select('subscription_expires_at')
          .eq('id', localPayment.school_id)
          .maybeSingle();
        checkedExpiry = sch?.subscription_expires_at || null;
      }

      return json(res, 200, {
        ok: true,
        status: data.transaction_status,
        payment_type: data.payment_type,
        gross_amount: data.gross_amount,
        is_settled: isSuccess,
        expires_at: checkedExpiry,
      });
    } catch (err: any) {
      return json(res, 500, { error: err.message });
    }
  }

  // --------------------------------------------------------------------------
  // 5. SIMULATE SETTLEMENT (Khusus Pengujian Internal Super Admin - Sandbox Only)
  // --------------------------------------------------------------------------
  if (action === 'simulate_settlement') {
    // 1. Blokir mutlak di mode produksi Midtrans
    if (midtrans.is_production) {
      return json(res, 403, { error: 'Simulasi pembayaran dinonaktifkan pada mode Midtrans Production demi keamanan.' });
    }

    // 2. Wajib otorisasi role SUPER_ADMIN (mencegah bypass publik)
    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (!token) {
      return json(res, 401, { error: 'Otorisasi diperlukan. Simulasi pembayaran hanya dapat dilakukan oleh Super Admin.' });
    }

    const { data: callerUser, error: authErr } = await db.auth.getUser(token);
    if (authErr || !callerUser?.user) {
      return json(res, 401, { error: 'Sesi autentikasi tidak valid atau telah berakhir.' });
    }

    const { data: callerProfile } = await db
      .from('profiles')
      .select('role, name, email')
      .eq('id', callerUser.user.id)
      .maybeSingle();

    if (callerProfile?.role !== 'SUPER_ADMIN') {
      return json(res, 403, { error: 'Hanya akun dengan peran SUPER_ADMIN yang berwenang menjalankan simulasi transaksi.' });
    }

    const orderId = b.order_id || q.order_id;
    if (!orderId) return json(res, 400, { error: 'order_id wajib diisi' });

    const { data: existingPayment } = await db
      .from('payments')
      .select('*')
      .eq('invoice_no', orderId)
      .maybeSingle();

    if (!existingPayment) return json(res, 404, { error: 'Transaksi pembayaran tidak ditemukan.' });

    const paidAt = new Date().toISOString();
    await db
      .from('payments')
      .update({
        status: 'SETTLED',
        paid_at: paidAt,
        payment_method: 'MIDTRANS_SANDBOX',
      })
      .eq('invoice_no', orderId);

    let targetSchoolId = existingPayment.school_id;
    if (!targetSchoolId && existingPayment.school_name) {
      const { data: foundSchool } = await db
        .from('schools')
        .select('id')
        .eq('name', existingPayment.school_name)
        .maybeSingle();
      if (foundSchool?.id) {
        targetSchoolId = foundSchool.id;
        await db.from('payments').update({ school_id: targetSchoolId }).eq('invoice_no', orderId);
      }
    }

    if (targetSchoolId) {
      const { data: school } = await db
        .from('schools')
        .select('*')
        .eq('id', targetSchoolId)
        .maybeSingle();

      const verifiedGross = Number(existingPayment.amount || existingPayment.total_amount || 0);

      if (school && verifiedGross >= 1) {
        const targetPlan = existingPayment.plan_name?.toLowerCase().includes('guru') || existingPayment.invoice_no?.includes('GRU')
          ? 'guru_pro'
          : 'sekolah_pro';

        const { durationMonths, durationDays, newExpiry } = calculateNewExpiry(
          targetPlan,
          verifiedGross,
          school.subscription_expires_at,
          school.plan
        );

        if (newExpiry) {
          const updatePayload: any = {
            status: 'active',
            plan: targetPlan,
            subscription_expires_at: newExpiry.toISOString(),
          };
          if (targetPlan === 'sekolah_pro') {
            updatePayload.max_teachers = 100;
            updatePayload.max_students = 1200;
            updatePayload.max_classes = 24;
          } else if (targetPlan === 'guru_pro') {
            const { data: userProf } = await db
              .from('profiles')
              .select('role')
              .eq('school_id', targetSchoolId)
              .maybeSingle();
            const isSubject = (userProf?.role || '').toUpperCase().trim() === 'GURU MAPEL';
            updatePayload.max_teachers = 1;
            updatePayload.max_students = isSubject ? 300 : 50;
            updatePayload.max_classes = isSubject ? 6 : 1;
          }

          await db
            .from('schools')
            .update(updatePayload)
            .eq('id', targetSchoolId);

          try {
            await db
              .from('profiles')
              .update({
                subscription_plan: targetPlan,
                subscription_status: 'active',
                subscription_expires_at: newExpiry.toISOString(),
              })
              .eq('school_id', targetSchoolId);
          } catch (_) {}

          // Catat audit log
          try {
            await db.from('audit_logs').insert({
              school_id: targetSchoolId,
              actor_name: `SuperAdmin (${callerProfile?.name || callerUser.user.email || 'Admin'})`,
              actor_role: 'SUPER_ADMIN',
              action: 'MIDTRANS_SIMULATED_SETTLEMENT',
              details: {
                order_id: orderId,
                gross_amount: verifiedGross,
                duration_months: durationMonths,
                duration_days: durationDays,
                previous_expiry: school.subscription_expires_at,
                new_expiry: newExpiry.toISOString(),
              },
            });
          } catch (_) {}
        }
      }
    }

    return json(res, 200, {
      ok: true,
      status: 'settlement',
      is_settled: true,
      message: 'Simulasi pembayaran Midtrans berhasil diselesaikan (SETTLED) oleh Super Admin.',
    });
  }

  // --------------------------------------------------------------------------
  // 6. GET INVOICE DETAILS FOR SMART LINK PDF (Public / Admin Verification)
  // --------------------------------------------------------------------------
  if (action === 'get_invoice') {
    const orderId = (b.order_id || q.order_id || b.invoice_no || q.invoice_no || '').trim();
    if (!orderId) {
      return json(res, 400, { error: 'Nomor invoice atau order_id wajib disertakan.' });
    }

    try {
      let query = db.from('payments').select('*');
      if (orderId.includes('-')) {
        query = query.eq('invoice_no', orderId);
      } else {
        query = query.or(`invoice_no.eq.${orderId},id.eq.${orderId}`);
      }

      const { data: payment, error: pErr } = await query.maybeSingle();

      if (pErr) {
        console.error('[Get Invoice DB Error]', pErr);
      }

      let schoolData: any = null;
      if (payment?.school_id) {
        const { data: sch } = await db
          .from('schools')
          .select('id, name, npsn, address, city, province, pic_name, pic_phone')
          .eq('id', payment.school_id)
          .maybeSingle();
        schoolData = sch;
      }

      if (payment) {
        return json(res, 200, {
          ok: true,
          invoice: {
            id: payment.id,
            invoiceNumber: payment.invoice_no,
            orderId: payment.invoice_no,
            schoolName: payment.school_name || schoolData?.name || 'Satuan Pendidikan',
            npsn: payment.npsn || schoolData?.npsn || '-',
            schoolAddress: schoolData?.address ? `${schoolData.address}${schoolData.city ? ', ' + schoolData.city : ''}` : 'Indonesia',
            customerName: payment.contact_name || schoolData?.pic_name || 'Penanggung Jawab',
            customerPhone: payment.contact_phone || schoolData?.pic_phone || '-',
            customerEmail: payment.email || 'sekolah@kawacanaan.sch.id',
            planName: payment.plan_name || 'Paket Kawacanaan Presensi',
            amount: Number(payment.amount || payment.total_amount || 0),
            totalAmount: Number(payment.total_amount || payment.amount || 0),
            uniqueCode: Number(payment.unique_code || 0),
            status: payment.status,
            paymentMethod: payment.payment_method || 'Midtrans Payment Gateway (QRIS / VA)',
            createdAt: payment.created_at,
            paidAt: payment.paid_at,
            expiresAt: payment.expires_at,
          },
        });
      }

      // Jika data tidak ditemukan di DB (misal invoice demo atau nomor acak),
      // tetap kembalikan struktur yang rapi agar smart link tidak crash
      return json(res, 200, {
        ok: true,
        invoice: {
          invoiceNumber: orderId,
          orderId: orderId,
          schoolName: 'Satuan Pendidikan',
          npsn: '-',
          schoolAddress: 'Indonesia',
          customerName: 'Bapak/Ibu Pendidik',
          customerPhone: '-',
          customerEmail: 'sekolah@kawacanaan.sch.id',
          planName: orderId.includes('SCH') ? 'Paket Sekolah KawaCanaan Presensi' : 'Paket Guru KawaCanaan Presensi',
          amount: orderId.includes('SCH') ? 250000 : 60000,
          totalAmount: orderId.includes('SCH') ? 250000 : 60000,
          uniqueCode: 0,
          status: 'SETTLED',
          paymentMethod: 'QRIS',
          createdAt: new Date().toISOString(),
          paidAt: new Date().toISOString(),
        },
      });
    } catch (err: any) {
      return json(res, 500, { error: err.message });
    }
  }

  return json(res, 400, { error: 'Aksi Midtrans tidak dikenali.' });
}
