import { normalizePlan } from './packageSystem';

export type TenantLifecycleStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'GRACE_PERIOD' | 'SUSPENDED';

export interface TenantLifecycleInfo {
  status: TenantLifecycleStatus;
  label: string;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
  description: string;
  daysRemaining: number | null; // Sisa hari sebelum tanggal expired (positif = aktif, negatif = lewat)
  graceDaysRemaining: number; // Sisa hari dalam masa tenggang (0 - 7)
  isExpiringSoon: boolean;
  isGracePeriod: boolean;
  isSuspended: boolean;
  isActive: boolean;
  canAccessApp: boolean; // Akses masuk sistem diperbolehkan (ACTIVE, EXPIRING_SOON, GRACE_PERIOD)
  alertSeverity: 'none' | 'info' | 'warning' | 'danger' | 'critical';
  alertMilestone: string | null; // 'H-30' | 'H-14' | 'H-7' | 'H-3' | 'H-1' | 'TODAY' | 'GRACE' | 'EXPIRED' | null
}

export const EXPIRING_SOON_DAYS = 30; // Notifikasi peringatan dimulai dari H-30
export const CRITICAL_SOON_DAYS = 7;  // Peringatan kritis H-7
export const GRACE_PERIOD_DAYS = 7;   // Masa tenggang 7 hari setelah tanggal habis

/**
 * Menghitung tanggal kedaluwarsa otomatis berdasarkan tanggal mulai + durasi hari.
 */
export function calculateExpiryFromDuration(
  startDateStr: string | Date = new Date(),
  durationDays: number | null
): string | null {
  if (durationDays === null || durationDays <= 0) return null; // Tanpa batas / lifetime
  const start = new Date(startDateStr);
  if (isNaN(start.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + durationDays);
    return fallback.toISOString().slice(0, 10);
  }
  const expiry = new Date(start);
  expiry.setDate(expiry.getDate() + durationDays);
  return expiry.toISOString().slice(0, 10);
}

/**
 * Preset Durasi Standar Sistem
 */
export const DURATION_PRESETS = [
  { id: '30', label: '1 Bulan (30 Hari)', days: 30 },
  { id: '90', label: '3 Bulan (90 Hari)', days: 90 },
  { id: '180', label: '6 Bulan (180 Hari)', days: 180 },
  { id: '365', label: '1 Tahun (365 Hari)', days: 365 },
  { id: '730', label: '2 Tahun (730 Hari)', days: 730 },
  { id: 'unlimited', label: 'Tanpa Batas (Lifetime)', days: null },
] as const;

/**
 * Menghitung status siklus hidup langganan tenant sekolah secara otomatis (system-based):
 * ACTIVE → EXPIRING_SOON → GRACE_PERIOD → SUSPENDED
 */
export function getTenantLifecycleInfo(
  school: {
    status?: string | null;
    subscription_started_at?: string | null;
    subscriptionStartedAt?: string | null;
    subscription_expires_at?: string | null;
    subscriptionExpiresAt?: string | null;
  } | null | undefined
): TenantLifecycleInfo {
  if (!school) {
    return {
      status: 'ACTIVE',
      label: 'Aktif',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500',
      borderClass: 'border-emerald-200',
      description: 'Layanan operasional normal.',
      daysRemaining: null,
      graceDaysRemaining: 0,
      isExpiringSoon: false,
      isGracePeriod: false,
      isSuspended: false,
      isActive: true,
      canAccessApp: true,
      alertSeverity: 'none',
      alertMilestone: null,
    };
  }

  const rawStatus = (school.status || '').toLowerCase().trim();
  const expiresAtStr = school.subscription_expires_at || school.subscriptionExpiresAt || null;

  // Jika transaksi belum dibayar (pending payment)
  if (rawStatus === 'pending_payment' || rawStatus === 'pending') {
    return {
      status: 'SUSPENDED',
      label: 'Menunggu Pembayaran',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
      dotClass: 'bg-amber-500',
      borderClass: 'border-amber-300',
      description: 'Layanan belum aktif karena tagihan pendaftaran belum diselesaikan.',
      daysRemaining: 0,
      graceDaysRemaining: 0,
      isExpiringSoon: false,
      isGracePeriod: false,
      isSuspended: true,
      isActive: false,
      canAccessApp: false,
      alertSeverity: 'warning',
      alertMilestone: 'EXPIRED',
    };
  }

  // Jika manual suspended/inactive oleh Super Admin (Override Kasus Khusus)
  if (rawStatus === 'inactive' || rawStatus === 'suspended') {
    return {
      status: 'SUSPENDED',
      label: 'Ditangguhkan (SUSPENDED)',
      badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
      dotClass: 'bg-rose-500',
      borderClass: 'border-rose-300',
      description: 'Akses tenant dinonaktifkan oleh administrator platform.',
      daysRemaining: 0,
      graceDaysRemaining: 0,
      isExpiringSoon: false,
      isGracePeriod: false,
      isSuspended: true,
      isActive: false,
      canAccessApp: false,
      alertSeverity: 'critical',
      alertMilestone: 'EXPIRED',
    };
  }

  // Jika tanpa batas tanggal kedaluwarsa (Lifetime / Lisensi Khusus)
  if (!expiresAtStr) {
    return {
      status: 'ACTIVE',
      label: 'Aktif (Tanpa Batas)',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500',
      borderClass: 'border-emerald-200',
      description: 'Langganan aktif otomatis tanpa batas masa berlaku.',
      daysRemaining: null,
      graceDaysRemaining: 0,
      isExpiringSoon: false,
      isGracePeriod: false,
      isSuspended: false,
      isActive: true,
      canAccessApp: true,
      alertSeverity: 'none',
      alertMilestone: null,
    };
  }

  // Hitung selisih hari dari hari ini ke tanggal kedaluwarsa
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const expiry = new Date(expiresAtStr);
  expiry.setHours(0, 0, 0, 0);

  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  // TAHAP 1: ACTIVE NORMAL (Masa aktif > 30 hari)
  if (diffDays > EXPIRING_SOON_DAYS) {
    return {
      status: 'ACTIVE',
      label: 'Aktif Normal',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      dotClass: 'bg-emerald-500',
      borderClass: 'border-emerald-200',
      description: `Langganan aktif normal (${diffDays} hari tersisa).`,
      daysRemaining: diffDays,
      graceDaysRemaining: 0,
      isExpiringSoon: false,
      isGracePeriod: false,
      isSuspended: false,
      isActive: true,
      canAccessApp: true,
      alertSeverity: 'none',
      alertMilestone: null,
    };
  }

  // TAHAP 2: EXPIRING_SOON (Masa aktif tersisa 0 s/d 30 hari)
  if (diffDays >= 0 && diffDays <= EXPIRING_SOON_DAYS) {
    let milestone = 'H-30';
    let severity: 'info' | 'warning' | 'danger' = 'info';

    if (diffDays === 0) {
      milestone = 'HARI INI';
      severity = 'danger';
    } else if (diffDays === 1) {
      milestone = 'H-1';
      severity = 'danger';
    } else if (diffDays <= 3) {
      milestone = 'H-3';
      severity = 'danger';
    } else if (diffDays <= 7) {
      milestone = 'H-7';
      severity = 'warning';
    } else if (diffDays <= 14) {
      milestone = 'H-14';
      severity = 'info';
    }

    return {
      status: 'EXPIRING_SOON',
      label: diffDays <= 7 ? 'Segera Berakhir (Kritis)' : 'Segera Berakhir',
      badgeClass:
        diffDays <= 7
          ? 'bg-amber-50 text-amber-900 border-amber-300'
          : 'bg-amber-50/70 text-amber-800 border-amber-200',
      dotClass: diffDays <= 7 ? 'bg-amber-500 animate-pulse' : 'bg-amber-400',
      borderClass: 'border-amber-300',
      description:
        diffDays === 0
          ? 'Masa berlaku berakhir HARI INI. Segera lakukan perpanjangan lisensi.'
          : `Masa berlaku tersisa ${diffDays} hari lagi (${milestone}).`,
      daysRemaining: diffDays,
      graceDaysRemaining: GRACE_PERIOD_DAYS,
      isExpiringSoon: true,
      isGracePeriod: false,
      isSuspended: false,
      isActive: true,
      canAccessApp: true,
      alertSeverity: severity,
      alertMilestone: milestone,
    };
  }

  // Tanggal sudah terlewat (diffDays < 0)
  const daysPast = Math.abs(diffDays);
  const graceLeft = GRACE_PERIOD_DAYS - daysPast + 1;

  // TAHAP 3: GRACE_PERIOD (Masa tenggang 1 s/d 7 hari setelah tanggal expired)
  if (graceLeft > 0) {
    return {
      status: 'GRACE_PERIOD',
      label: 'Masa Tenggang (Grace Period)',
      badgeClass: 'bg-orange-50 text-orange-800 border-orange-300',
      dotClass: 'bg-orange-500 animate-pulse',
      borderClass: 'border-orange-300',
      description: `Masa langganan telah berakhir. Masih dalam masa tenggang toleransi sistem (sisa ${graceLeft} hari).`,
      daysRemaining: diffDays,
      graceDaysRemaining: graceLeft,
      isExpiringSoon: false,
      isGracePeriod: true,
      isSuspended: false,
      isActive: false,
      canAccessApp: true, // Masih diizinkan akses untuk operasional mendesak & perpanjangan
      alertSeverity: 'danger',
      alertMilestone: 'GRACE',
    };
  }

  // TAHAP 4: EXPIRED (Masa Paket Sekolah habis → guru_gratis / Paket Gratis aktif)
  return {
    status: 'SUSPENDED',
    label: 'Paket Berbayar Berakhir (Paket Gratis Aktif)',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    dotClass: 'bg-slate-500',
    borderClass: 'border-slate-300',
    description: `Masa Paket Sekolah telah berakhir (${daysPast} hari lalu). Ruang kerja tetap berjalan dengan fitur Paket Gratis (guru_gratis).`,
    daysRemaining: diffDays,
    graceDaysRemaining: 0,
    isExpiringSoon: false,
    isGracePeriod: false,
    isSuspended: false,
    isActive: true,
    canAccessApp: true, // Tidak memblokir total, tetap bisa presensi dengan batasan paket gratis
    alertSeverity: 'warning',
    alertMilestone: 'EXPIRED',
  };
}

/**
 * Mengecek apakah pengguna atau sekolahnya saat ini sedang aktif berlangganan Paket Sekolah (sekolah_pro).
 * Aturan Sistem:
 * - Pengguna di Paket Sekolah aktif (Admin & Seluruh Guru) TIDAK DIPERKENANKAN membeli Paket Guru.
 * - Jika masa aktif Paket Sekolah telah berakhir (Expired), sistem mengembalikan false (beralih ke Paket Gratis / guru_gratis),
 *   sehingga pengguna/guru diperbolehkan upgrade ke Paket Guru (guru_pro) atau memperpanjang Paket Sekolah (sekolah_pro).
 * - Workspace TIDAK berubah ketika paket habis.
 */
export function isUserInActiveSchoolPlan(
  user?: any,
  workspace?: any
): boolean {
  if (!user && !workspace) return false;

  const rawPlan =
    workspace?.plan ||
    workspace?.subscriptionPlan ||
    workspace?.subscription?.plan ||
    workspace?.schoolPlan ||
    user?.schoolPlan ||
    user?.school_plan ||
    user?.subscriptionPlan ||
    user?.subscription_plan ||
    '';

  const normalizedPlan = normalizePlan(rawPlan);
  if (normalizedPlan !== 'sekolah_pro') return false;

  const status = (
    workspace?.status ||
    workspace?.subscription?.status ||
    user?.schoolStatus ||
    user?.school_status ||
    user?.subscriptionStatus ||
    user?.subscription_status ||
    'active'
  ).toLowerCase().trim();

  // Hanya status 'active' yang dianggap aktif (menolak pending_payment, suspended, inactive, expired)
  if (status !== 'active') {
    return false;
  }

  const expiresAt =
    workspace?.subscriptionExpiresAt ||
    workspace?.subscription_expires_at ||
    workspace?.subscription?.expiresAt ||
    user?.schoolSubscriptionExpiresAt ||
    user?.school_subscription_expires_at ||
    user?.subscriptionExpiresAt ||
    user?.subscription_expires_at ||
    null;

  // Jika tanpa batas tanggal kedaluwarsa (Lifetime / Lisensi Permanen Super Admin)
  if (!expiresAt) {
    return true;
  }

  const expiryDate = new Date(expiresAt);
  if (isNaN(expiryDate.getTime())) {
    return true;
  }

  // Jika masa aktif sudah terlewat, status tidak lagi aktif
  return new Date() <= expiryDate;
}
