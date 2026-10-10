import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';
import { getEnv } from './_env';

const json = (res: any, status: number, body: unknown) =>
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));

export function getVapidPublicKey(env?: any) {
  return (
    getEnv('VAPID_PUBLIC_KEY', env) ||
    'BNSuY-J6kJLXJMSV0FrVIEKWHRurVtBRDeXBsdEkgscj9xwoTi6Ffe_-ZzKwnkSsVSvhRJruvO8LVhXIAtu66_0'
  );
}

export function ensureVapidConfigured(env?: any) {
  const pub = getVapidPublicKey(env);
  const priv =
    getEnv('VAPID_PRIVATE_KEY', env) ||
    'fr-UyVgkzNyNR5xLmwmvWA2OrkOyEj4AcUbHR2J4QNc';
  const sub =
    getEnv('VAPID_SUBJECT', env) ||
    'mailto:notifikasi@kawacanaan.id';
  try {
    webpush.setVapidDetails(sub, pub, priv);
  } catch (err) {
    console.warn('[Push] Error initializing VAPID details:', err);
  }
}

// Initial setup
ensureVapidConfigured();

// In-memory fallback cache to ensure multi-device subscriptions work seamlessly
// even if the Supabase table migration hasn't been applied yet.
const fallbackSubscriptions = new Map<string, Array<{
  id: string;
  studentId: string;
  parentName: string;
  deviceName: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  createdAt: string;
}>>();

export default async function handler(req: any, res: any, env?: any) {
  const cfEnv = env || req?.env || {};
  ensureVapidConfigured(cfEnv);

  // GET: Public key or status check
  if (req.method === 'GET') {
    const action = req.query?.action || 'vapid_key';
    if (action === 'vapid_key') {
      return json(res, 200, {
        ok: true,
        publicKey: getVapidPublicKey(cfEnv),
      });
    }

    if (action === 'status') {
      const studentId = String(req.query?.studentId || '').trim();
      if (!studentId) {
        return json(res, 400, { error: 'studentId wajib disertakan' });
      }

      // Check DB and fallback
      const devices = await getSubscriptionsForStudent(studentId, cfEnv);
      return json(res, 200, {
        ok: true,
        subscribedCount: devices.length,
        devices: devices.map((d) => ({
          id: d.id,
          parentName: d.parentName || 'Orang Tua',
          deviceName: d.deviceName || 'Ponsel Terhubung',
          endpointSnippet: d.endpoint ? `...${d.endpoint.slice(-12)}` : '',
        })),
      });
    }
  }

  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Metode tidak diizinkan. Gunakan GET atau POST.' });
  }

  const body = req.body || {};
  const action = body.action || 'subscribe';

  // 1. SUBSCRIBE DEVICE (Multi-Device per Student)
  if (action === 'subscribe') {
    const { studentId, subscription, parentName, deviceName, schoolId } = body;
    if (!studentId || !subscription || !subscription.endpoint || !subscription.keys) {
      return json(res, 400, {
        error: 'Data subscription tidak lengkap (studentId, endpoint, dan keys wajib ada).',
      });
    }

    const endpoint = String(subscription.endpoint).trim();
    const p256dh = String(subscription.keys.p256dh || '').trim();
    const auth = String(subscription.keys.auth || '').trim();
    const cleanParentName = String(parentName || 'Orang Tua / Wali Murid').trim();
    const cleanDeviceName = String(deviceName || 'Ponsel Wali Murid').trim();

    const db = getAdminClient(cfEnv);
    let dbSuccess = false;

    if (db) {
      try {
        const { error } = await db.from('parent_push_subscriptions').upsert(
          {
            student_id: String(studentId).trim(),
            school_id: schoolId || null,
            parent_name: cleanParentName,
            device_name: cleanDeviceName,
            endpoint,
            p256dh,
            auth,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'endpoint' }
        );
        if (!error) {
          dbSuccess = true;
        }
      } catch (dbErr) {
        console.warn('[Push] DB upsert warning, using memory fallback:', dbErr);
      }
    }

    // Always update in-memory fallback
    const key = String(studentId).trim();
    const list = fallbackSubscriptions.get(key) || [];
    const filtered = list.filter((item) => item.endpoint !== endpoint);
    filtered.push({
      id: `sub_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      studentId: key,
      parentName: cleanParentName,
      deviceName: cleanDeviceName,
      endpoint,
      p256dh,
      auth,
      createdAt: new Date().toISOString(),
    });
    fallbackSubscriptions.set(key, filtered);

    return json(res, 200, {
      ok: true,
      message: `Perangkat "${cleanDeviceName}" berhasil didaftarkan untuk menerima notifikasi presensi.`,
      deviceCount: filtered.length,
      storage: dbSuccess ? 'database' : 'resilient_cache',
    });
  }

  // 2. UNSUBSCRIBE DEVICE
  if (action === 'unsubscribe') {
    const { endpoint, studentId } = body;
    if (!endpoint) {
      return json(res, 400, { error: 'endpoint wajib disertakan untuk pembatalan.' });
    }

    const db = getAdminClient(cfEnv);
    if (db) {
      try {
        await db.from('parent_push_subscriptions').delete().eq('endpoint', endpoint);
      } catch (_) {}
    }

    if (studentId) {
      const key = String(studentId).trim();
      const list = fallbackSubscriptions.get(key) || [];
      fallbackSubscriptions.set(
        key,
        list.filter((item) => item.endpoint !== endpoint)
      );
    }

    return json(res, 200, {
      ok: true,
      message: 'Langganan notifikasi pada perangkat ini telah dihentikan.',
    });
  }

  // 3. SEND ATTENDANCE NOTIFICATION (MASUK & PULANG)
  if (action === 'send_attendance') {
    const result = await sendAttendancePushToStudent(body, cfEnv);
    return json(res, result.ok ? 200 : 400, result);
  }

  // 4. SEND LEAVE REQUEST DECISION NOTIFICATION (IZIN & SAKIT)
  if (action === 'send_leave_decision') {
    const result = await sendLeaveDecisionPushToStudent(body, cfEnv);
    return json(res, result.ok ? 200 : 400, result);
  }

  return json(res, 400, { error: 'Aksi tidak dikenali.' });
}

export async function getNotificationConfig(env?: any) {
  const db = getAdminClient(env);
  let effectivePlatformLogo = '/lk.png';
  if (db) {
    try {
      const { data: st } = await db
        .from('platform_settings')
        .select('integrations')
        .eq('id', 1)
        .maybeSingle();
      const pLogo = st?.integrations?.platform_config?.app_logo_url;
      if (pLogo && typeof pLogo === 'string' && pLogo.trim()) {
        effectivePlatformLogo = pLogo.trim();
      }
      if (st?.integrations?.notification_config) {
        const nc = st.integrations.notification_config;
        const rawBadge = nc.badge_icon_url;
        return {
          ...nc,
          badge_icon_url: (rawBadge && rawBadge !== '/pwa-192.png') ? rawBadge : effectivePlatformLogo,
        };
      }
    } catch (_) {}
  }
  return {
    is_enabled: true,
    show_large_icon: false, // Default: Logo kanan dihapus sesuai permintaan pengguna
    large_icon_url: '',
    badge_icon_url: effectivePlatformLogo, // Logo sistem Kawacanaan resmi yang terhubung dengan Supabase
    app_title_prefix: 'Kawacanaan Presensi',
    notify_on_present: true,
    notify_on_late: true,
    notify_on_checkout: true,
    notify_on_leave: true,
    vibrate: true,
    require_interaction: true,
    template_present: 'Ananda {nama_siswa}{kelas} telah hadir di kelas tepat waktu pukul {jam} WIB.',
    template_late: 'Ananda {nama_siswa}{kelas} telah hadir di kelas pukul {jam} WIB (Status: Terlambat).',
    template_checkout: 'Ananda {nama_siswa}{kelas} telah selesai belajar dan keluar kelas pukul {jam} WIB.',
    template_leave_approved: 'Pengajuan {jenis_izin}{tanggal} untuk Ananda {nama_siswa} telah DISETUJUI oleh {penyetuju}.',
    template_leave_rejected: 'Pengajuan {jenis_izin}{tanggal} untuk Ananda {nama_siswa} DITOLAK oleh {penyetuju}.',
  };
}

/**
 * Fungsi internal server-side untuk mengirimkan notifikasi presensi langsung ke semua perangkat terdaftar
 * (Dapat dipanggil langsung oleh /api/attendance tanpa melalui network loopback)
 */
export async function sendAttendancePushToStudent(
  params: {
    studentId: string;
    studentName?: string;
    eventType: 'masuk' | 'pulang' | string;
    timeStr?: string;
    status?: string;
    notes?: string;
    className?: string;
  },
  env?: any
): Promise<{
  ok: boolean;
  sentCount: number;
  failedCount: number;
  totalDevices: number;
  eventType: string;
  message: string;
  errors?: any[];
}> {
  ensureVapidConfigured(env);

  const { studentId, studentName, eventType, timeStr, status, notes, className } = params;
  if (!studentId) {
    return {
      ok: false,
      sentCount: 0,
      failedCount: 0,
      totalDevices: 0,
      eventType: eventType || 'masuk',
      message: 'studentId wajib disertakan.',
    };
  }

  const notifConfig = await getNotificationConfig(env);
  if (notifConfig.is_enabled === false) {
    return {
      ok: true,
      sentCount: 0,
      failedCount: 0,
      totalDevices: 0,
      eventType: eventType || 'masuk',
      message: 'Notifikasi sistem dinonaktifkan oleh pengaturan Super Admin.',
    };
  }

  const type = eventType === 'pulang' ? 'pulang' : 'masuk';
  const sName = String(studentName || 'Ananda').trim();
  const time = String(
    timeStr ||
      new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  ).trim();
  const isLate =
    String(notes || '').toLowerCase().includes('terlambat') ||
    String(status || '').toLowerCase().includes('terlambat');

  if (type === 'masuk') {
    if (isLate && notifConfig.notify_on_late === false) {
      return { ok: true, sentCount: 0, failedCount: 0, totalDevices: 0, eventType: type, message: 'Notifikasi presensi terlambat dinonaktifkan.' };
    }
    if (!isLate && notifConfig.notify_on_present === false) {
      return { ok: true, sentCount: 0, failedCount: 0, totalDevices: 0, eventType: type, message: 'Notifikasi presensi tepat waktu dinonaktifkan.' };
    }
  } else if (type === 'pulang') {
    if (notifConfig.notify_on_checkout === false) {
      return { ok: true, sentCount: 0, failedCount: 0, totalDevices: 0, eventType: type, message: 'Notifikasi presensi pulang dinonaktifkan.' };
    }
  }

  let title = '';
  let bodyText = '';
  const classSuffix = className ? ` (${className})` : '';

  if (type === 'masuk') {
    title = `Presensi Masuk — ${sName} ✅`;
    const tmpl = isLate
      ? (notifConfig.template_late || 'Ananda {nama_siswa}{kelas} telah hadir di kelas pukul {jam} WIB (Status: Terlambat).')
      : (notifConfig.template_present || 'Ananda {nama_siswa}{kelas} telah hadir di kelas tepat waktu pukul {jam} WIB.');
    bodyText = tmpl
      .replace('{nama_siswa}', sName)
      .replace('{kelas}', classSuffix)
      .replace('{jam}', time);
  } else {
    title = `Presensi Pulang — ${sName} 🏠`;
    const tmpl = notifConfig.template_checkout || 'Ananda {nama_siswa}{kelas} telah selesai belajar dan keluar kelas pukul {jam} WIB.';
    bodyText = tmpl
      .replace('{nama_siswa}', sName)
      .replace('{kelas}', classSuffix)
      .replace('{jam}', time);
  }

  // Logo kanan: jika show_large_icon = false, kosongkan icon agar logo di sebelah kanan dihapus total
  const iconUrl = notifConfig.show_large_icon ? (notifConfig.large_icon_url || notifConfig.badge_icon_url || '/lk.png') : '';
  const badgeUrl = (notifConfig.badge_icon_url && notifConfig.badge_icon_url !== '/pwa-192.png') ? notifConfig.badge_icon_url : '/lk.png';

  const payload = JSON.stringify({
    title,
    body: bodyText,
    icon: iconUrl, // Empty string = tidak ada logo di sebelah kanan
    badge: badgeUrl, // Logo status bar kiri
    tag: `attendance-${studentId}-${type}`,
    url: '/',
    studentId,
    eventType: type,
    timestamp: Date.now(),
    requireInteraction: notifConfig.require_interaction !== false,
  });

  const devices = await getSubscriptionsForStudent(studentId, env);
  let successCount = 0;
  let failedCount = 0;
  const expiredEndpoints: string[] = [];
  const pushErrors: any[] = [];

  await Promise.all(
    devices.map(async (dev) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: dev.endpoint,
            keys: {
              p256dh: dev.p256dh,
              auth: dev.auth,
            },
          },
          payload
        );
        successCount++;
      } catch (sendErr: any) {
        failedCount++;
        pushErrors.push({
          endpoint: dev.endpoint ? `...${dev.endpoint.slice(-16)}` : '',
          statusCode: sendErr?.statusCode,
          message: sendErr?.message || String(sendErr),
        });
        // HTTP 404 or 410 means the subscription has expired or was removed by the browser
        if (sendErr?.statusCode === 410 || sendErr?.statusCode === 404) {
          expiredEndpoints.push(dev.endpoint);
        }
      }
    })
  );

  // Clean up expired devices
  if (expiredEndpoints.length > 0) {
    await removeExpiredEndpoints(studentId, expiredEndpoints, env);
  }

  return {
    ok: true,
    sentCount: successCount,
    failedCount,
    totalDevices: devices.length,
    eventType: type,
    message: `Notifikasi presensi ${type} berhasil dikirim ke ${successCount} perangkat.`,
    errors: pushErrors.length > 0 ? pushErrors : undefined,
  };
}

/**
 * Fungsi internal server-side untuk mengirimkan notifikasi keputusan izin sakit ke ponsel orang tua
 */
export async function sendLeaveDecisionPushToStudent(
  params: {
    studentId: string;
    studentName?: string;
    leaveType: 'sakit' | 'izin' | string;
    decision: 'APPROVED' | 'REJECTED' | string;
    datesText?: string;
    reviewerName?: string;
    notes?: string;
  },
  env?: any
): Promise<{
  ok: boolean;
  sentCount: number;
  failedCount: number;
  totalDevices: number;
  message: string;
  errors?: any[];
}> {
  ensureVapidConfigured(env);

  const { studentId, studentName, leaveType, decision, datesText, reviewerName, notes } = params;
  if (!studentId) {
    return {
      ok: false,
      sentCount: 0,
      failedCount: 0,
      totalDevices: 0,
      message: 'studentId wajib disertakan.',
    };
  }

  const notifConfig = await getNotificationConfig(env);
  if (notifConfig.is_enabled === false || notifConfig.notify_on_leave === false) {
    return {
      ok: true,
      sentCount: 0,
      failedCount: 0,
      totalDevices: 0,
      message: 'Notifikasi persetujuan izin/sakit dinonaktifkan oleh pengaturan Super Admin.',
    };
  }

  const sName = String(studentName || 'Ananda').trim();
  const typeLabel = leaveType === 'sakit' ? 'Sakit' : 'Izin';
  const isApproved = decision === 'APPROVED';

  const title = isApproved
    ? `Izin ${typeLabel} Disetujui — ${sName} ✅`
    : `Izin ${typeLabel} Ditolak — ${sName} ⚠️`;

  const dateInfo = datesText ? ` (${datesText})` : '';
  const reviewer = reviewerName || 'Wali Kelas';

  let bodyText = '';
  if (isApproved) {
    const tmpl = notifConfig.template_leave_approved || 'Pengajuan {jenis_izin}{tanggal} untuk Ananda {nama_siswa} telah DISETUJUI oleh {penyetuju}.';
    bodyText = tmpl
      .replace('{nama_siswa}', sName)
      .replace('{jenis_izin}', typeLabel)
      .replace('{tanggal}', dateInfo)
      .replace('{penyetuju}', reviewer);
  } else {
    const tmpl = notifConfig.template_leave_rejected || 'Pengajuan {jenis_izin}{tanggal} untuk Ananda {nama_siswa} DITOLAK oleh {penyetuju}.';
    bodyText = tmpl
      .replace('{nama_siswa}', sName)
      .replace('{jenis_izin}', typeLabel)
      .replace('{tanggal}', dateInfo)
      .replace('{penyetuju}', reviewer);
    if (notes) bodyText += ` Catatan: ${notes}`;
  }

  // Logo kanan: jika show_large_icon = false, kosongkan icon agar logo di sebelah kanan dihapus total
  const iconUrl = notifConfig.show_large_icon ? (notifConfig.large_icon_url || notifConfig.badge_icon_url || '/lk.png') : '';
  const badgeUrl = (notifConfig.badge_icon_url && notifConfig.badge_icon_url !== '/pwa-192.png') ? notifConfig.badge_icon_url : '/lk.png';

  const payload = JSON.stringify({
    title,
    body: bodyText,
    icon: iconUrl, // Empty string = tidak ada logo di sebelah kanan
    badge: badgeUrl, // Logo status bar kiri
    tag: `leave-decision-${studentId}-${Date.now()}`,
    url: '/',
    studentId,
    decision,
    timestamp: Date.now(),
    requireInteraction: notifConfig.require_interaction !== false,
  });

  const devices = await getSubscriptionsForStudent(studentId, env);
  let successCount = 0;
  let failedCount = 0;
  const expiredEndpoints: string[] = [];
  const pushErrors: any[] = [];

  await Promise.all(
    devices.map(async (dev) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: dev.endpoint,
            keys: {
              p256dh: dev.p256dh,
              auth: dev.auth,
            },
          },
          payload
        );
        successCount++;
      } catch (sendErr: any) {
        failedCount++;
        pushErrors.push({
          endpoint: dev.endpoint ? `...${dev.endpoint.slice(-16)}` : '',
          statusCode: sendErr?.statusCode,
          message: sendErr?.message || String(sendErr),
        });
        if (sendErr?.statusCode === 410 || sendErr?.statusCode === 404) {
          expiredEndpoints.push(dev.endpoint);
        }
      }
    })
  );

  if (expiredEndpoints.length > 0) {
    await removeExpiredEndpoints(studentId, expiredEndpoints, env);
  }

  return {
    ok: true,
    sentCount: successCount,
    failedCount,
    totalDevices: devices.length,
    message: `Notifikasi persetujuan izin berhasil dikirim ke ${successCount} perangkat.`,
    errors: pushErrors.length > 0 ? pushErrors : undefined,
  };
}

function getAdminClient(env?: any) {
  const url = getEnv('SUPABASE_URL', env) || getEnv('VITE_SUPABASE_URL', env);
  const serviceKey =
    getEnv('SUPABASE_SERVICE_ROLE_KEY', env) ||
    getEnv('SUPABASE_SECRET_KEY', env) ||
    getEnv('VITE_SUPABASE_ANON_KEY', env);
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getSubscriptionsForStudent(studentId: string, env?: any) {
  const key = String(studentId).trim();
  const db = getAdminClient(env);
  const results: Array<{
    id: string;
    studentId: string;
    parentName: string;
    deviceName: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    createdAt?: string;
  }> = [];

  const candidateIds = new Set<string>([key]);

  if (db) {
    try {
      // 1. Profil pengguna (id, student_id, username / NISN)
      try {
        const { data: prof } = await db
          .from('profiles')
          .select('id, student_id, username')
          .or(`id.eq.${key},student_id.eq.${key},username.eq.${key}`)
          .limit(5);
        if (Array.isArray(prof)) {
          prof.forEach((p) => {
            if (p.id) candidateIds.add(p.id);
            if (p.student_id) candidateIds.add(p.student_id);
            if (p.username) candidateIds.add(p.username);
          });
        }
      } catch (_) {}

      // 2. Data siswa (id, nisn)
      try {
        const { data: stu } = await db
          .from('students')
          .select('id, nisn')
          .or(`id.eq.${key},nisn.eq.${key}`)
          .limit(5);
        if (Array.isArray(stu)) {
          stu.forEach((s) => {
            if (s.id) candidateIds.add(s.id);
            if (s.nisn) candidateIds.add(s.nisn);
          });
        }
      } catch (_) {}

      const { data, error } = await db
        .from('parent_push_subscriptions')
        .select('*')
        .in('student_id', Array.from(candidateIds));
      if (!error && Array.isArray(data)) {
        data.forEach((row: any) => {
          results.push({
            id: row.id,
            studentId: row.student_id,
            parentName: row.parent_name || 'Orang Tua',
            deviceName: row.device_name || 'Ponsel Wali Murid',
            endpoint: row.endpoint,
            p256dh: row.p256dh,
            auth: row.auth,
            createdAt: row.created_at,
          });
        });
      }
    } catch (_) {}
  }

  // Merge with memory fallback for all candidate IDs, avoiding duplicate endpoints
  for (const cid of candidateIds) {
    const fallbackList = fallbackSubscriptions.get(cid) || [];
    fallbackList.forEach((mem) => {
      if (!results.some((r) => r.endpoint === mem.endpoint)) {
        results.push(mem);
      }
    });
  }

  return results;
}

async function removeExpiredEndpoints(studentId: string, expiredEndpoints: string[], env?: any) {
  const db = getAdminClient(env);
  if (db) {
    try {
      await db
        .from('parent_push_subscriptions')
        .delete()
        .in('endpoint', expiredEndpoints);
    } catch (_) {}
  }

  const key = String(studentId).trim();
  const list = fallbackSubscriptions.get(key) || [];
  fallbackSubscriptions.set(
    key,
    list.filter((item) => !expiredEndpoints.includes(item.endpoint))
  );
}
