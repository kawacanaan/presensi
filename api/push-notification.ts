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
  // GET: Public key or status check
  if (req.method === 'GET') {
    const action = req.query?.action || 'vapid_key';
    if (action === 'vapid_key') {
      ensureVapidConfigured(cfEnv);
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
      const devices = await getSubscriptionsForStudent(studentId);
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

    const db = getAdminClient();
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

    const db = getAdminClient();
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
    const result = await sendAttendancePushToStudent(body);
    return json(res, result.ok ? 200 : 400, result);
  }

  return json(res, 400, { error: 'Aksi tidak dikenali.' });
}

/**
 * Fungsi internal server-side untuk mengirimkan notifikasi presensi langsung ke semua perangkat terdaftar
 * (Dapat dipanggil langsung oleh /api/attendance tanpa melalui network loopback)
 */
export async function sendAttendancePushToStudent(params: {
  studentId: string;
  studentName?: string;
  eventType: 'masuk' | 'pulang' | string;
  timeStr?: string;
  status?: string;
  notes?: string;
  className?: string;
}): Promise<{
  ok: boolean;
  sentCount: number;
  failedCount: number;
  totalDevices: number;
  eventType: string;
  message: string;
}> {
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

  const type = eventType === 'pulang' ? 'pulang' : 'masuk';
  const sName = String(studentName || 'Ananda').trim();
  const time = String(
    timeStr ||
      new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  ).trim();
  const isLate =
    String(notes || '').toLowerCase().includes('terlambat') ||
    String(status || '').toLowerCase().includes('terlambat');

  let title = '';
  let bodyText = '';
  const classSuffix = className ? ` (${className})` : '';

  if (type === 'masuk') {
    title = `Presensi Masuk — ${sName} ✅`;
    bodyText = isLate
      ? `Ananda ${sName}${classSuffix} telah hadir di kelas pukul ${time} WIB (Status: Terlambat).`
      : `Ananda ${sName}${classSuffix} telah hadir di kelas tepat waktu pukul ${time} WIB.`;
  } else {
    title = `Presensi Pulang — ${sName} 🏠`;
    bodyText = `Ananda ${sName}${classSuffix} telah selesai belajar dan keluar kelas pukul ${time} WIB.`;
  }

  const payload = JSON.stringify({
    title,
    body: bodyText,
    icon: '/pwa-192.png',
    badge: '/favicon.png',
    tag: `attendance-${studentId}-${type}`,
    url: '/',
    studentId,
    eventType: type,
    timestamp: Date.now(),
  });

  const devices = await getSubscriptionsForStudent(studentId);
  let successCount = 0;
  let failedCount = 0;
  const expiredEndpoints: string[] = [];

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
        // HTTP 404 or 410 means the subscription has expired or was removed by the browser
        if (sendErr?.statusCode === 410 || sendErr?.statusCode === 404) {
          expiredEndpoints.push(dev.endpoint);
        }
      }
    })
  );

  // Clean up expired devices
  if (expiredEndpoints.length > 0) {
    await removeExpiredEndpoints(studentId, expiredEndpoints);
  }

  return {
    ok: true,
    sentCount: successCount,
    failedCount,
    totalDevices: devices.length,
    eventType: type,
    message: `Notifikasi presensi ${type} berhasil dikirim ke ${successCount} perangkat.`,
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

async function getSubscriptionsForStudent(studentId: string) {
  const key = String(studentId).trim();
  const db = getAdminClient();
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

  if (db) {
    try {
      const { data, error } = await db
        .from('parent_push_subscriptions')
        .select('*')
        .eq('student_id', key);
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

  // Merge with memory fallback, avoiding duplicate endpoints
  const fallbackList = fallbackSubscriptions.get(key) || [];
  fallbackList.forEach((mem) => {
    if (!results.some((r) => r.endpoint === mem.endpoint)) {
      results.push(mem);
    }
  });

  return results;
}

async function removeExpiredEndpoints(studentId: string, expiredEndpoints: string[]) {
  const db = getAdminClient();
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
