// Utility untuk mengelola PWA Service Worker & Web Push Notification Orang Tua
export interface PushDeviceStatus {
  isSupported: boolean;
  permission: NotificationPermission | 'unsupported';
  isSubscribed: boolean;
  activeEndpointSnippet?: string;
  connectedDevicesCount: number;
}

const FALLBACK_VAPID_PUBLIC_KEY =
  'BNSuY-J6kJLXJMSV0FrVIEKWHRurVtBRDeXBsdEkgscj9xwoTi6Ffe_-ZzKwnkSsVSvhRJruvO8LVhXIAtu66_0';

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function detectDeviceName(): string {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return 'Ponsel Orang Tua';
  const ua = navigator.userAgent;
  let os = 'Ponsel';
  if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iPhone';
  else if (/mac/i.test(ua)) os = 'Mac';
  else if (/windows/i.test(ua)) os = 'Windows PC';

  let browser = 'Browser';
  if (/chrome|crios/i.test(ua) && !/edge|opr/i.test(ua)) browser = 'Chrome';
  else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/edge|edg/i.test(ua)) browser = 'Edge';

  return `Ponsel (${os} - ${browser})`;
}

/**
 * Mendaftarkan Service Worker PWA
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    return reg;
  } catch (err) {
    console.warn('[SW] PWA Service worker registration error:', err);
    return null;
  }
}

/**
 * Mendapatkan Public Key VAPID dari server
 */
export async function getVapidPublicKey(): Promise<string> {
  try {
    const res = await fetch('/api/push-notification?action=vapid_key');
    const data = await res.json();
    if (res.ok && data.publicKey) {
      return data.publicKey;
    }
  } catch (_) {}
  return FALLBACK_VAPID_PUBLIC_KEY;
}

/**
 * Mengecek status langganan notifikasi pada perangkat ini untuk siswa tertentu
 */
export async function getDevicePushStatus(studentId?: string): Promise<PushDeviceStatus> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return {
      isSupported: false,
      permission: 'unsupported',
      isSubscribed: false,
      connectedDevicesCount: 0,
    };
  }

  const permission = Notification.permission;
  let isSubscribed = false;
  let activeEndpointSnippet = '';

  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg && 'pushManager' in reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        isSubscribed = true;
        activeEndpointSnippet = sub.endpoint ? `...${sub.endpoint.slice(-8)}` : '';
      }
    }
  } catch (_) {}

  let connectedDevicesCount = isSubscribed ? 1 : 0;
  if (studentId) {
    try {
      const res = await fetch(`/api/push-notification?action=status&studentId=${encodeURIComponent(studentId)}`);
      const data = await res.json();
      if (res.ok && typeof data.subscribedCount === 'number') {
        connectedDevicesCount = data.subscribedCount;
      }
    } catch (_) {}
  }

  return {
    isSupported: true,
    permission,
    isSubscribed,
    activeEndpointSnippet,
    connectedDevicesCount,
  };
}

/**
 * Mendaftarkan perangkat orang tua (Multi-Device per anak: Ayah, Ibu, Wali)
 */
export async function subscribeParentDevice({
  studentId,
  parentName,
  deviceName,
  schoolId,
}: {
  studentId: string;
  parentName: string;
  deviceName?: string;
  schoolId?: string;
}): Promise<{ success: boolean; message: string; deviceCount?: number }> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return {
      success: false,
      message: 'Perangkat atau browser ini tidak mendukung Web Push Notification.',
    };
  }

  // 1. Minta izin notifikasi browser
  let perm = Notification.permission;
  if (perm !== 'granted') {
    perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      return {
        success: false,
        message: 'Izin notifikasi ditolak oleh browser. Mohon izinkan notifikasi pada pengaturan browser ponsel Anda.',
      };
    }
  }

  // 2. Dapatkan registration service worker
  let reg = await navigator.serviceWorker.getRegistration();
  if (!reg) {
    reg = await registerServiceWorker();
  }
  if (!reg) {
    return {
      success: false,
      message: 'Gagal mengaktifkan Service Worker pada browser ponsel Anda.',
    };
  }

  // 3. Ambil VAPID Public Key dan buat langganan
  const vapidKey = await getVapidPublicKey();
  const convertedKey = urlBase64ToUint8Array(vapidKey);

  let subscription: PushSubscription | null = null;
  try {
    subscription = await reg.pushManager.getSubscription();
    if (!subscription) {
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertedKey,
      });
    }
  } catch (subErr: any) {
    console.error('[Push] Push manager subscribe failed:', subErr);
    return {
      success: false,
      message: `Gagal membuat Push Subscription: ${subErr?.message || 'Error browser'}. Jika menggunakan iPhone, pastikan sudah menambahkan web ke Layar Utama (Add to Home Screen).`,
    };
  }

  if (!subscription) {
    return {
      success: false,
      message: 'Subscription data tidak valid.',
    };
  }

  // 4. Kirim ke backend API untuk disimpan (Multi-device: Ayah, Ibu, dll)
  const finalDeviceName = deviceName || detectDeviceName();
  try {
    const res = await fetch('/api/push-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'subscribe',
        studentId,
        parentName,
        deviceName: finalDeviceName,
        schoolId,
        subscription: subscription.toJSON(),
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      try {
        localStorage.setItem(`kawacanaan_push_sub_${studentId}`, 'true');
        localStorage.setItem(`kawacanaan_push_parent_name_${studentId}`, parentName);
      } catch (_) {}

      // Tampilkan notifikasi konfirmasi langsung di perangkat
      try {
        reg.showNotification('Notifikasi Presensi Aktif', {
          body: `Ponsel ${parentName} siap menerima waktu masuk dan keluar kelas Ananda.`,
          icon: '/pwa-192.png',
          badge: '/favicon.png',
        });
      } catch (_) {}

      return {
        success: true,
        message: body.message || 'Perangkat berhasil terhubung!',
        deviceCount: body.deviceCount || 1,
      };
    } else {
      return {
        success: false,
        message: body.error || 'Gagal menyimpan langganan notifikasi ke server.',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Gagal menghubungi server: ${err?.message || 'Koneksi terputus'}`,
    };
  }
}

/**
 * Membatalkan langganan notifikasi di perangkat ini
 */
export async function unsubscribeParentDevice(studentId: string): Promise<{ success: boolean; message: string }> {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        await fetch('/api/push-notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'unsubscribe',
            endpoint,
            studentId,
          }),
        }).catch(() => {});
      }
    }
    try {
      localStorage.removeItem(`kawacanaan_push_sub_${studentId}`);
    } catch (_) {}

    return {
      success: true,
      message: 'Notifikasi pada perangkat ini telah dinonaktifkan.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Gagal menonaktifkan notifikasi.',
    };
  }
}

/**
 * Memicu pengiriman Web Push Notification otomatis saat presensi masuk / pulang dicatat
 */
export async function triggerAttendancePushNotification({
  studentId,
  studentName,
  eventType,
  timeStr,
  status,
  notes,
}: {
  studentId: string;
  studentName: string;
  eventType: 'masuk' | 'pulang';
  timeStr: string;
  status?: string;
  notes?: string;
}): Promise<void> {
  if (!studentId) return;

  try {
    await fetch('/api/push-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_attendance',
        studentId,
        studentName,
        eventType,
        timeStr,
        status: status || 'Hadir',
        notes: notes || '',
      }),
    });
  } catch (err) {
    console.warn('[Push] Gagal memicu push notification:', err);
  }
}

/**
 * Memicu Web Push Notification keputusan persetujuan izin/sakit ke HP Orang Tua
 */
export async function triggerLeaveDecisionPushNotification({
  studentId,
  studentName,
  leaveType,
  decision,
  datesText,
  reviewerName,
  notes,
}: {
  studentId: string;
  studentName: string;
  leaveType: 'sakit' | 'izin' | string;
  decision: 'APPROVED' | 'REJECTED';
  datesText?: string;
  reviewerName?: string;
  notes?: string;
}): Promise<void> {
  if (!studentId) return;

  try {
    await fetch('/api/push-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'send_leave_decision',
        studentId,
        studentName,
        leaveType,
        decision,
        datesText,
        reviewerName,
        notes,
      }),
    });
  } catch (err) {
    console.warn('[Push] Gagal memicu notifikasi keputusan izin:', err);
  }
}
