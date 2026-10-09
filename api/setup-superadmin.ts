import { createClient } from '@supabase/supabase-js';
import { getEnv, getSupabaseConfig } from './_env';

const json = (res: any, status: number, body: unknown) =>
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));

export default async function handler(req: any, res: any, env?: any) {
  const cfEnv = env || req?.env || {};
  const { url, serviceKey } = getSupabaseConfig(cfEnv, req);

  if (!url || !serviceKey) {
    return json(res, 500, {
      ok: false,
      error: 'Konfigurasi server SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum terpasang di environment Cloudflare Worker.',
    });
  }

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // GET: Cek status apakah Super Admin sudah terdaftar di sistem
  if (req.method === 'GET') {
    try {
      const { count } = await admin
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'SUPER_ADMIN')
        .eq('is_active', true);

      return json(res, 200, {
        ok: true,
        hasSuperAdmin: (count || 0) > 0,
        configured: Boolean((count || 0) > 0),
      });
    } catch (err: any) {
      return json(res, 200, {
        ok: true,
        hasSuperAdmin: false,
        error: err?.message,
      });
    }
  }

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'Metode permintaan tidak diizinkan. Gunakan POST.' });
  }

  const expectedSecret = getEnv('SUPERADMIN_SETUP_SECRET', cfEnv, req);
  const providedSecret =
    req.headers['x-superadmin-secret'] ||
    req.headers['x-superadmin-key'] ||
    req.body?.secret ||
    req.body?.setupSecret ||
    req.body?.setup_secret ||
    '';

  // Jika SUPERADMIN_SETUP_SECRET belum disetel, jangan izinkan setup terbuka tanpa proteksi
  if (!expectedSecret) {
    return json(res, 500, {
      ok: false,
      error: 'Variabel rahasia SUPERADMIN_SETUP_SECRET belum disetel di Cloudflare Dashboard / Worker Secrets.',
    });
  }

  if (String(providedSecret).trim() !== String(expectedSecret).trim()) {
    return json(res, 401, {
      ok: false,
      error: 'Kunci otorisasi setup superadmin (SUPERADMIN_SETUP_SECRET) tidak valid.',
    });
  }

  const { email, password, name, username } = req.body || {};
  if (!email || !password) {
    return json(res, 400, {
      ok: false,
      error: 'Email dan password wajib diisi untuk mengonfigurasi Super Admin.',
    });
  }

  const cleanEmail = String(email).trim().toLowerCase();
  const cleanName = String(name || 'Super Admin Platform').trim();
  const cleanUsername = String(username || cleanEmail.split('@')[0] || 'superadmin').trim().toLowerCase();

  try {
    // 1. Cek apakah user auth sudah ada berdasarkan email
    let authUserId: string | null = null;
    const { data: userList } = await admin.auth.admin.listUsers();
    const existingAuth = (userList?.users || []).find((u) => u.email?.toLowerCase() === cleanEmail);

    if (existingAuth) {
      authUserId = existingAuth.id;
      // Update password & metadata
      await admin.auth.admin.updateUserById(authUserId, {
        password: String(password),
        email_confirm: true,
        user_metadata: {
          ...existingAuth.user_metadata,
          role: 'SUPER_ADMIN',
          name: cleanName,
        },
      });
    } else {
      // Buat user baru
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email: cleanEmail,
        password: String(password),
        email_confirm: true,
        user_metadata: {
          role: 'SUPER_ADMIN',
          name: cleanName,
        },
      });

      if (createErr || !newUser.user) {
        return json(res, 400, {
          ok: false,
          error: createErr?.message || 'Gagal membuat user autentikasi Super Admin.',
        });
      }
      authUserId = newUser.user.id;
    }

    // 2. Upsert ke tabel profiles
    const { error: profileErr } = await admin.from('profiles').upsert(
      {
        id: authUserId,
        email: cleanEmail,
        name: cleanName,
        username: cleanUsername,
        role: 'SUPER_ADMIN',
        is_active: true,
        school_id: null,
        teacher_id: null,
        student_id: null,
        must_change_password: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    );

    if (profileErr) {
      return json(res, 500, {
        ok: false,
        error: `Gagal memperbarui profil Super Admin: ${profileErr.message}`,
      });
    }

    // 3. Catat ke audit log jika tabel audit_logs tersedia
    try {
      await admin.from('audit_logs').insert({
        actor_id: authUserId,
        actor_email: cleanEmail,
        action: 'SETUP_SUPERADMIN',
        target_type: 'SYSTEM',
        details: { setup_via: 'cloudflare_worker_api', timestamp: new Date().toISOString() },
      });
    } catch (_) {}

    return json(res, 200, {
      ok: true,
      message: 'Akun Super Admin berhasil dikonfigurasi dan diaktifkan.',
      user: {
        id: authUserId,
        email: cleanEmail,
        name: cleanName,
        role: 'SUPER_ADMIN',
      },
    });
  } catch (err: any) {
    return json(res, 500, {
      ok: false,
      error: err?.message || 'Terjadi kesalahan saat memproses setup Super Admin.',
    });
  }
}
