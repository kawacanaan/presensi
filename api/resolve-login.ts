import { createClient } from '@supabase/supabase-js';

const json = (res: any, status: number, body: unknown) =>
  res.status(status).setHeader('Content-Type', 'application/json').end(JSON.stringify(body));

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || '';
  if (!url || !key) return json(res, 500, { error: 'SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib tersedia.' });

  const identifier = String(req.body?.identifier || req.body?.username || req.body?.email || '').trim().toLowerCase();
  if (!identifier) return json(res, 400, { error: 'Identifier wajib diisi.' });

  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1. Jika input 'superadmin', cari akun SUPER_ADMIN aktif dari tabel profiles
  if (identifier === 'superadmin') {
    const { data: superAdmin } = await db
      .from('profiles')
      .select('id, email')
      .eq('role', 'SUPER_ADMIN')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (superAdmin?.email) {
      return json(res, 200, { ok: true, email: superAdmin.email });
    }
    if (superAdmin?.id) {
      const { data: authData } = await db.auth.admin.getUserById(superAdmin.id);
      if (authData?.user?.email) {
        return json(res, 200, { ok: true, email: authData.user.email });
      }
    }
    return json(res, 404, { ok: false, error: 'Akun Super Admin tidak ditemukan.' });
  }

  // 2. Cari berdasarkan username terlebih dahulu di tabel profiles
  const { data: userByUsername } = await db
    .from('profiles')
    .select('email, username')
    .ilike('username', identifier)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  if (userByUsername?.email) {
    return json(res, 200, { ok: true, email: userByUsername.email });
  }

  // 3. Jika input berformat email, cari juga berdasarkan kolom email di profiles
  if (identifier.includes('@')) {
    const { data: userByEmail } = await db
      .from('profiles')
      .select('email, username')
      .ilike('email', identifier)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    if (userByEmail?.email) {
      return json(res, 200, { ok: true, email: userByEmail.email });
    }
  }

  return json(res, 404, { ok: false, error: 'Akun tidak ditemukan.' });
}
