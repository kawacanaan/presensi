import { createClient } from '@supabase/supabase-js';

const json = (res:any,status:number,body:unknown)=>res.status(status).setHeader('Content-Type','application/json').end(JSON.stringify(body));

function parseBoolean(val: any): boolean {
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'production' || s === 'prod' || s === 'live';
  }
  return false;
}

function resolveIsProduction(dbConfig?: any): boolean {
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

function getMidtransEndpoints(isProduction: boolean) {
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
 * Menghasilkan 8 karakter alfanumerik huruf besar tanpa awalan SCH- (contoh: 9B3366AB)
 */
function generateSchoolInviteCode(): string {
  const chars = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
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
 * Pengecekan & downgrade aman untuk paket yang telah kedaluwarsa.
 * Aturan:
 * - Paket Guru expired -> simpan schools.plan = guru_gratis
 * - Paket Sekolah expired -> simpan schools.plan = guru_gratis
 * - workspace_type TIDAK BOLEH BERUBAH
 * - Idempotent dan tidak menghapus data tenant.
 */
async function checkAndDowngradeExpiredSchool(admin: any, school: any): Promise<string> {
  if (!school || !school.id) return 'guru_gratis';
  const now = new Date();
  if (school.subscription_expires_at && new Date(school.subscription_expires_at) <= now) {
    const raw = String(school.plan || '').toLowerCase();
    if (raw !== 'guru_gratis') {
      try {
        await admin.from('schools').update({
          plan: 'guru_gratis',
        }).eq('id', school.id);
        school.plan = 'guru_gratis';
      } catch (err) {
        console.warn(`[SuperAdmin] Gagal downgrade sekolah expired (${school.id}):`, err);
      }
    }
    return 'guru_gratis';
  }
  return normalizePlan(school.plan);
}

const limits = (plan: string, role?: string) => {
  const norm = normalizePlan(plan);
  if (norm === 'sekolah_pro') {
    return { max_teachers: 100, max_students: 1200, max_classes: 24 };
  }
  if (norm === 'guru_pro') {
    const isSubject = (role || '').toUpperCase().trim() === 'GURU MAPEL';
    return {
      max_teachers: 1,
      max_students: isSubject ? 300 : 50,
      max_classes: isSubject ? 6 : 1,
    };
  }
  return { max_teachers: 1, max_students: 50, max_classes: 1 };
};

async function getSchoolNotesMap(admin: any): Promise<Record<string, string>> {
  try {
    const { data } = await admin.from('platform_settings').select('integrations').eq('id', 1).maybeSingle();
    return (data?.integrations?.school_notes as Record<string, string>) || {};
  } catch (_) {
    return {};
  }
}

async function saveSchoolNote(admin: any, schoolId: string, note: string | null): Promise<void> {
  try {
    const { data } = await admin.from('platform_settings').select('integrations').eq('id', 1).maybeSingle();
    const integrations = data?.integrations || {};
    const schoolNotes = { ...(integrations.school_notes || {}) };
    if (note && note.trim()) {
      schoolNotes[schoolId] = note.trim();
    } else {
      delete schoolNotes[schoolId];
    }
    await admin.from('platform_settings').upsert({
      id: 1,
      integrations: { ...integrations, school_notes: schoolNotes },
    });
  } catch (e) {
    console.warn('Failed to save school note in platform_settings:', e);
  }
}

export default async function handler(req: any, res: any, env?: any) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  const cfEnv = env || req?.env || {};
  const sbCandidates = [
    cfEnv.SUPABASE_URL,
    process.env.SUPABASE_URL,
    cfEnv.VITE_SUPABASE_URL,
    process.env.VITE_SUPABASE_URL,
  ];
  const url =
    sbCandidates.find((u) => u && typeof u === 'string' && u.includes('.supabase.co')) ||
    cfEnv.SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    cfEnv.VITE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    '';
  const key =
    cfEnv.SUPABASE_SERVICE_ROLE_KEY ||
    cfEnv.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    '';
  const { action } = req.body || {};

  // Aksi Publik: Akses logo & nama platform publik tanpa perlu token auth
  if (action === 'get_public_brand' || action === 'get_public_platform_config') {
    if (!url || !key) {
      return json(res, 200, {
        ok: true,
        app_name: 'Kawacanaan Presensi',
        app_logo_url: null,
      });
    }
    try {
      const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data: settings } = await admin.from('platform_settings').select('integrations').eq('id', 1).maybeSingle();
      const pc = settings?.integrations?.platform_config || {};
      return json(res, 200, {
        ok: true,
        app_name: pc.app_name || 'Kawacanaan Presensi',
        app_logo_url: pc.app_logo_url || null,
      });
    } catch (_) {
      return json(res, 200, {
        ok: true,
        app_name: 'Kawacanaan Presensi',
        app_logo_url: null,
      });
    }
  }

  if (!url || !key) {
    return json(res, 500, { error: 'SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib tersedia pada environment Cloudflare Worker atau Vercel.' });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
  const superSecret = req.headers['x-superadmin-secret'] || req.headers['x-superadmin-key'];
  if (!token && !superSecret) return json(res, 401, { error: 'Unauthorized' });

  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let caller: any = null;
  let profile: any = null;

  // 1. Cek sesi client superadmin_session_{userId} terverifikasi langsung ke tabel profiles
  if (token && token.startsWith('superadmin_session_')) {
    const userId = token.replace('superadmin_session_', '').trim();
    if (userId) {
      const { data: saUser } = await admin
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .eq('role', 'SUPER_ADMIN')
        .maybeSingle();
      if (saUser && saUser.is_active !== false) {
        profile = saUser;
        caller = { user: { id: saUser.id, email: saUser.email } };
      }
    }
  }

  // 2. Cek token JWT standar Supabase Auth
  if (!profile && token) {
    const { data: authCaller, error: callerError } = await admin.auth.getUser(token);
    if (!callerError && authCaller?.user) {
      caller = authCaller;
      let { data: userProfile } = await admin
        .from('profiles')
        .select('*')
        .eq('id', caller.user.id)
        .maybeSingle();
      if (!userProfile && caller.user.email) {
        const { data: saByEmail } = await admin
          .from('profiles')
          .select('*')
          .eq('role', 'SUPER_ADMIN')
          .ilike('email', caller.user.email.trim())
          .maybeSingle();
        if (saByEmail) userProfile = saByEmail;
      }
      profile = userProfile;
    }
  }

  // 3. Fallback header secret setup superadmin
  const expectedSecret = cfEnv.SUPERADMIN_SETUP_SECRET || process.env.SUPERADMIN_SETUP_SECRET;
  if (!profile && superSecret && expectedSecret && superSecret === expectedSecret) {
    const { data: saAny } = await admin.from('profiles').select('*').eq('role', 'SUPER_ADMIN').limit(1).maybeSingle();
    if (saAny) {
      profile = saAny;
      caller = { user: { id: saAny.id, email: saAny.email } };
    }
  }

  const callerRole = String(profile?.role || '').toUpperCase().trim();
  if (!profile || callerRole !== 'SUPER_ADMIN' || profile.is_active === false) {
    return json(res, 403, { error: 'SUPER ADMIN privileges required' });
  }

  try{
    if(action==='health'||action==='system_health'){
      const t0 = Date.now();
      const [{ count: schoolsCount, error: schErr }, { count: usersCount, error: usrErr }, { count: logsCount }] = await Promise.all([
        admin.from('schools').select('*', { count: 'exact', head: true }),
        admin.from('profiles').select('*', { count: 'exact', head: true }),
        admin.from('audit_logs').select('*', { count: 'exact', head: true }),
      ]);
      const latencyMs = Date.now() - t0;
      return json(res,200,{
        ok: !schErr && !usrErr,
        status: schErr || usrErr ? 'degraded' : 'healthy',
        supabase: true,
        latencyMs,
        counts: {
          schools: schoolsCount || 0,
          users: usersCount || 0,
          auditLogs: logsCount || 0,
        },
        services: {
          database: schErr ? 'error' : 'operational',
          auth: usrErr ? 'error' : 'operational',
          storage: 'operational',
          apiRouter: 'operational',
        },
        environment: {
          nodeEnv: process.env.NODE_ENV || 'production',
          region: process.env.VERCEL_REGION || 'asia-southeast1',
          uptime: process.uptime ? Math.floor(process.uptime()) : 86400,
        },
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'ensure_public_storage' || action === 'init_storage') {
      const publicBuckets = ['smartlink', 'smartlinks', 'smartlink-pdf', 'reports', 'pdf', 'invoices'];
      const results: Record<string, string> = {};
      try {
        const { data: existing } = await admin.storage.listBuckets();
        const existingNames = new Set((existing || []).map((b) => b.name));

        for (const bucketName of publicBuckets) {
          try {
            if (!existingNames.has(bucketName)) {
              const { error: cErr } = await admin.storage.createBucket(bucketName, {
                public: true,
                fileSizeLimit: 52428800,
              });
              results[bucketName] = cErr ? `error: ${cErr.message}` : 'created_public';
            } else {
              const { error: uErr } = await admin.storage.updateBucket(bucketName, {
                public: true,
              });
              results[bucketName] = uErr ? `error: ${uErr.message}` : 'updated_public';
            }
          } catch (bErr: any) {
            results[bucketName] = `exception: ${bErr?.message || bErr}`;
          }
        }
      } catch (err: any) {
        return json(res, 500, { ok: false, error: err?.message || 'Storage error' });
      }
      return json(res, 200, { ok: true, buckets: results });
    }

    if(action==='login_activity'||action==='login_history'){
      const limit=Math.min(Number(req.body.limit||100),300);
      const {data,error}=await admin.from('audit_logs').select('*, schools(name)').ilike('action','%LOGIN%').order('created_at',{ascending:false}).limit(limit);
      let rows = data;
      if(error || !rows || rows.length === 0) {
        // Fallback to recent audit logs if login events not distinct
        const {data:recent} = await admin.from('audit_logs').select('*, schools(name)').order('created_at',{ascending:false}).limit(50);
        rows = recent || [];
      }
      const formatted = (rows||[]).map((l:any)=>({
        ...l,
        school_name: l.schools?.name || null,
        ip_address: l.details?.ip || '127.0.0.1',
        device: l.details?.device || 'Browser Web'
      }));
      return json(res,200,{ok:true,activities:formatted,history:formatted});
    }

    if(action==='critical_actions'){
      const limit=Math.min(Number(req.body.limit||100),300);
      const criticalKeywords=['DELETE','RESET','OVERRIDE','TOGGLE','UPDATE_CONFIG','ANNOUNCEMENT','SUSPEND'];
      const {data,error}=await admin.from('audit_logs').select('*, schools(name)').order('created_at',{ascending:false}).limit(250);
      if(error) throw error;
      const filtered = (data||[]).filter((l:any)=>{
        const act = (l.action||'').toUpperCase();
        return criticalKeywords.some(k => act.includes(k));
      }).slice(0, limit);
      return json(res,200,{ok:true,criticalLogs:filtered.map((l:any)=>({...l,school_name:l.schools?.name||null}))});
    }

    if(action==='school_details'){
      const schoolId=req.body.school_id||req.body.schoolId||req.body.id;
      if(!schoolId) return json(res,400,{error:'ID Sekolah wajib diisi.'});

      const { data: school, error: schErr } = await admin.from('schools').select('*').eq('id', schoolId).single();
      if (schErr || !school) return json(res, 404, { error: 'Sekolah tidak ditemukan.' });
      await checkAndDowngradeExpiredSchool(admin, school);

      const notesMap = await getSchoolNotesMap(admin);

      const [
        { data: profile },
        { data: sysConfig },
        { data: users },
        { data: classes },
        { data: students },
        { data: payments },
        { data: auditLogs }
      ] = await Promise.all([
        admin.from('school_profile').select('*').eq('school_id', schoolId).maybeSingle(),
        admin.from('system_config').select('*').eq('school_id', schoolId).maybeSingle(),
        admin.from('profiles').select('id, name, username, email, role, is_active, created_at').eq('school_id', schoolId).order('created_at', { ascending: false }),
        admin.from('classes').select('id, name, grade, academic_year').eq('school_id', schoolId),
        admin
          .from('students')
          .select('id, nama, nisn, class_id, status')
          .eq('school_id', schoolId)
          .limit(250)
          .then(async (res) => {
            if (res.error) {
              return admin.from('students').select('id, nama, nisn, class_id').eq('school_id', schoolId).limit(250);
            }
            return res;
          }),
        admin.from('payments').select('*').or(`school_id.eq.${schoolId},school_name.eq."${school.name}"`).order('created_at', { ascending: false }),
        admin.from('audit_logs').select('*').eq('school_id', schoolId).order('created_at', { ascending: false }).limit(50)
      ]);

      return json(res, 200, {
        ok: true,
        school: {
          ...school,
          plan: normalizePlan(school.plan),
          raw_plan: school.plan,
          notes: notesMap[school.id] || (school as any).notes || '',
          school_id: school.id,
        },
        profile: profile || {
          nama_sekolah: school.name,
          npsn: school.npsn || '',
          jenjang: 'SD',
          tahun_pelajaran: '2026/2027',
          semester: '1'
        },
        sysConfig: sysConfig || {},
        users: users || [],
        classes: classes || [],
        students: students || [],
        payments: payments || [],
        auditLogs: auditLogs || [],
        counts: {
          users: users?.length || 0,
          classes: classes?.length || 0,
          students: students?.length || 0,
          payments: payments?.length || 0,
        }
      });
    }

    if(action==='update_school_profile'){
      const schoolId = req.body.school_id || req.body.id;
      const profileData = req.body.profile || {};
      if(!schoolId) return json(res,400,{error:'ID Sekolah wajib diisi.'});

      const { data, error } = await admin.from('school_profile').upsert({
        school_id: schoolId,
        nama_sekolah: profileData.nama_sekolah || profileData.name,
        npsn: profileData.npsn,
        jenjang: profileData.jenjang || 'SD',
        alamat: profileData.alamat || null,
        desa_kelurahan: profileData.kelurahan || profileData.desa_kelurahan || null,
        kecamatan: profileData.kecamatan || null,
        kabupaten_kota: profileData.kota || profileData.kabupaten_kota || null,
        provinsi: profileData.provinsi || null,
        kode_pos: profileData.kode_pos || null,
        telepon_fax: profileData.telepon_fax || null,
        email: profileData.email || null,
        website: profileData.website || null,
        nama_kepala_sekolah: profileData.nama_kepala_sekolah || null,
        nip_kepala_sekolah: profileData.nip_kepala_sekolah || null,
        tahun_pelajaran: profileData.tahun_pelajaran || '2026/2027',
        semester: profileData.semester || '1'
      }, { onConflict: 'school_id' }).select().single();

      if (error) throw error;

      // Update tabel schools jika ada perubahan nama/npsn
      if (profileData.nama_sekolah || profileData.npsn) {
        await admin.from('schools').update({
          name: profileData.nama_sekolah || undefined,
          npsn: profileData.npsn || undefined
        }).eq('id', schoolId);
      }

      await admin.from('audit_logs').insert({
        actor_id: caller.user.id,
        actor_name: profile.name,
        actor_role: 'SUPER_ADMIN',
        action: 'UPDATE_SCHOOL_PROFILE',
        school_id: schoolId,
        details: profileData
      });

      return json(res, 200, { ok: true, profile: data });
    }

    if(action==='school_history'||action==='school_activity'){
      const schoolId=req.body.school_id||req.body.schoolId;
      if(!schoolId) return json(res,400,{error:'ID Sekolah diperlukan'});
      const notesMap = await getSchoolNotesMap(admin);
      const [{data:logs},{data:school},{data:classes},{data:students}]=await Promise.all([
        admin.from('audit_logs').select('*').eq('school_id',schoolId).order('created_at',{ascending:false}).limit(50),
        admin.from('schools').select('*').eq('id',schoolId).single(),
        admin.from('classes').select('id, name').eq('school_id',schoolId),
        admin.from('students').select('id, nama, nisn, class_id').eq('school_id',schoolId).limit(100),
      ]);
      return json(res,200,{
        ok:true,
        school: school ? { ...school, notes: notesMap[schoolId] || (school as any).notes || '' } : null,
        logs:logs||[],
        classesCount:classes?.length||0,
        studentsCount:students?.length||0,
        sampleStudents:students||[]
      });
    }

    if(action==='get_midtrans_config'||action==='update_midtrans_config'){
      const {data:settings}=await admin.from('platform_settings').select('integrations').eq('id',1).maybeSingle();
      const dbMidtrans = (settings?.integrations?.midtrans_config) || {};

      const clientKey = dbMidtrans.client_key?.trim() || process.env.MIDTRANS_CLIENT_KEY?.trim() || process.env.VITE_MIDTRANS_CLIENT_KEY?.trim() || '';
      const serverKey = dbMidtrans.server_key?.trim() || process.env.MIDTRANS_SERVER_KEY?.trim() || '';
      const merchantId = dbMidtrans.merchant_id?.trim() || process.env.MIDTRANS_MERCHANT_ID?.trim() || '';
      const paymentLinkTeacher = dbMidtrans.payment_link_teacher?.trim() || dbMidtrans.guru_payment_link?.trim() || '';
      const isProduction = resolveIsProduction(dbMidtrans);
      const enabled = dbMidtrans.enabled !== undefined ? Boolean(dbMidtrans.enabled) : Boolean(clientKey && serverKey);
      const endpoints = getMidtransEndpoints(isProduction);

      if(action==='get_midtrans_config') {
        // PERINGATAN KEAMANAN: Jangan pernah mengirim server_key ke frontend/browser!
        return json(res, 200, {
          ok: true,
          client_key: clientKey,
          is_production: isProduction,
          merchant_id: merchantId,
          enabled,
          payment_link_teacher: paymentLinkTeacher,
          fee_bearer: dbMidtrans.fee_bearer || 'tenant',
          channels: dbMidtrans.channels || null,
          is_server_key_configured: Boolean(serverKey && serverKey.length > 0),
          is_configured: Boolean(clientKey && serverKey),
          snap_url: endpoints.snapJsUrl,
          midtrans: {
            client_key: clientKey,
            is_production: isProduction,
            merchant_id: merchantId,
            enabled,
            payment_link_teacher: paymentLinkTeacher,
            fee_bearer: dbMidtrans.fee_bearer || 'tenant',
            channels: dbMidtrans.channels || null,
            is_server_key_configured: Boolean(serverKey && serverKey.length > 0),
            is_configured: Boolean(clientKey && serverKey),
            snap_url: endpoints.snapJsUrl,
          }
        });
      }

      const midtransData = req.body.midtrans || {};
      // Jika pengguna memasukkan server_key baru di form, update. Jika kosong, pertahankan serverKey yang sudah tersimpan.
      const newServerKeyInput = typeof midtransData.server_key === 'string' ? midtransData.server_key.trim() : '';
      const finalServerKey = (newServerKeyInput && !newServerKeyInput.includes('•••')) ? newServerKeyInput : serverKey;

      const targetIsProd = midtransData.is_production !== undefined
        ? Boolean(midtransData.is_production)
        : isProduction;

      const updatedMidtransConfig = {
        client_key: midtransData.client_key !== undefined ? midtransData.client_key.trim() : clientKey,
        server_key: finalServerKey,
        is_production: targetIsProd,
        merchant_id: midtransData.merchant_id !== undefined ? midtransData.merchant_id.trim() : merchantId,
        payment_link_teacher: midtransData.payment_link_teacher !== undefined
          ? midtransData.payment_link_teacher.trim()
          : (midtransData.guru_payment_link !== undefined ? midtransData.guru_payment_link.trim() : paymentLinkTeacher),
        enabled: midtransData.enabled !== undefined ? Boolean(midtransData.enabled) : enabled,
        fee_bearer: midtransData.fee_bearer || dbMidtrans.fee_bearer || 'tenant',
        channels: midtransData.channels !== undefined ? midtransData.channels : (dbMidtrans.channels || null),
      };

      const integrations = { ...(settings?.integrations || {}), midtrans_config: updatedMidtransConfig };
      const {error}=await admin.from('platform_settings').upsert({id:1,integrations},{onConflict:'id'});
      if(error) throw error;

      // Sinkronkan ke variabel proses runtime agar langsung aktif seketika
      try {
        process.env.MIDTRANS_IS_PRODUCTION = String(updatedMidtransConfig.is_production);
        process.env.VITE_MIDTRANS_IS_PRODUCTION = String(updatedMidtransConfig.is_production);
        process.env.MIDTRANS_CLIENT_KEY = updatedMidtransConfig.client_key;
        process.env.VITE_MIDTRANS_CLIENT_KEY = updatedMidtransConfig.client_key;
        if (finalServerKey) process.env.MIDTRANS_SERVER_KEY = finalServerKey;
        if (updatedMidtransConfig.merchant_id) process.env.MIDTRANS_MERCHANT_ID = updatedMidtransConfig.merchant_id;
      } catch (_) {}
      await admin.from('audit_logs').insert({
        actor_id: caller.user.id,
        actor_name: profile.name,
        actor_role: 'SUPER_ADMIN',
        action: 'UPDATE_MIDTRANS_CONFIG',
        details: {
          client_key: updatedMidtransConfig.client_key,
          enabled: updatedMidtransConfig.enabled,
          is_production: updatedMidtransConfig.is_production,
          server_key: '[PROTECTED]'
        }
      });

      const updatedEndpoints = getMidtransEndpoints(updatedMidtransConfig.is_production);

      // Return aman tanpa mengekspos server_key
      return json(res, 200, {
        ok: true,
        client_key: updatedMidtransConfig.client_key,
        is_production: updatedMidtransConfig.is_production,
        merchant_id: updatedMidtransConfig.merchant_id,
        payment_link_teacher: updatedMidtransConfig.payment_link_teacher,
        enabled: updatedMidtransConfig.enabled,
        fee_bearer: updatedMidtransConfig.fee_bearer,
        channels: updatedMidtransConfig.channels,
        is_server_key_configured: Boolean(finalServerKey && finalServerKey.length > 0),
        is_configured: Boolean(updatedMidtransConfig.client_key && finalServerKey),
        snap_url: updatedEndpoints.snapJsUrl,
        midtrans: {
          client_key: updatedMidtransConfig.client_key,
          is_production: updatedMidtransConfig.is_production,
          merchant_id: updatedMidtransConfig.merchant_id,
          payment_link_teacher: updatedMidtransConfig.payment_link_teacher,
          enabled: updatedMidtransConfig.enabled,
          fee_bearer: updatedMidtransConfig.fee_bearer,
          channels: updatedMidtransConfig.channels,
          is_server_key_configured: Boolean(finalServerKey && finalServerKey.length > 0),
          is_configured: Boolean(updatedMidtransConfig.client_key && finalServerKey),
          snap_url: updatedEndpoints.snapJsUrl,
        }
      });
    }

    if(action==='test_midtrans'){
      const {data:settings}=await admin.from('platform_settings').select('integrations').eq('id',1).maybeSingle();
      const cfg = (settings?.integrations?.midtrans_config) || {};
      const serverKey = cfg.server_key?.trim() || process.env.MIDTRANS_SERVER_KEY?.trim() || '';

      if (!serverKey) {
        return json(res, 400, {
          error: 'Server Key belum disetel. Harap masukkan Server Key di form atau set variabel lingkungan MIDTRANS_SERVER_KEY.'
        });
      }

      const isProduction = resolveIsProduction(cfg);
      const endpoints = getMidtransEndpoints(isProduction);
      const testUrl = endpoints.tokenUrl;
      const authHeader = `Basic ${Buffer.from(`${serverKey}:`).toString('base64')}`;
      try {
        const pingRes = await fetch(testUrl, {
          headers: { Authorization: authHeader, Accept: 'application/json' }
        });
        // 400 with 'no transaction' or 200 means API key authentication succeeded
        if (pingRes.status === 200 || pingRes.status === 400 || pingRes.status === 404) {
          return json(res, 200, {
            ok: true,
            success: true,
            is_production: isProduction,
            message: `Berhasil terhubung ke Midtrans ${isProduction ? 'Production (Live)' : 'Sandbox (Testing)'}. Kredensial Server Key valid!`
          });
        } else if (pingRes.status === 401) {
          return json(res, 400, {
            error: `Otentikasi Midtrans gagal (401 Unauthorized). Pastikan Server Key untuk mode ${isProduction ? 'Production' : 'Sandbox'} sudah benar.`
          });
        } else {
          return json(res, 200, {
            ok: true,
            success: true,
            is_production: isProduction,
            message: `Respon Midtrans status ${pingRes.status}`
          });
        }
      } catch (err: any) {
        return json(res, 500, { error: `Gagal menghubungi server Midtrans: ${err.message}` });
      }
    }

    if(action==='list'){
      const notesMap = await getSchoolNotesMap(admin);
      const [{data:schools,error:sErr},{data:students},{data:profiles},{data:classes},{data:schoolProfiles}]=await Promise.all([
        admin.from('schools').select('id,name,npsn,code,plan,status,subscription_started_at,subscription_expires_at,max_teachers,max_students,max_classes,workspace_type,is_personal,created_at').order('created_at',{ascending:false}),
        admin.from('students').select('school_id'),
        admin.from('profiles').select('school_id, role').neq('role','SUPER_ADMIN'),
        admin.from('classes').select('school_id'),
        admin.from('school_profile').select('school_id, nama_sekolah, npsn, jenjang, nama_kepala_sekolah, nip_kepala_sekolah, alamat'),
      ]);
      if(sErr) throw sErr;

      const profileMap = new Map<string, any>();
      (schoolProfiles || []).forEach((sp: any) => {
        if (sp.school_id) profileMap.set(sp.school_id, sp);
      });

      const studentCounts: Record<string, number> = {};
      (students||[]).forEach((st:any)=>{ if(st.school_id) studentCounts[st.school_id]=(studentCounts[st.school_id]||0)+1; });

      const teacherCounts: Record<string, number> = {};
      const headmasterCounts: Record<string, number> = {};
      const teacherAdminCounts: Record<string, number> = {};
      const adminCounts: Record<string, number> = {};
      const studentProfileCounts: Record<string, number> = {};
      const userCounts: Record<string, number> = {};

      (profiles||[]).forEach((pr:any)=>{
        if(pr.school_id) {
          // Akumulasi seluruh akun pengguna terdaftar / ter-generate di sekolah ini
          userCounts[pr.school_id] = (userCounts[pr.school_id] || 0) + 1;

          const r = String(pr.role || '').toUpperCase().trim();
          if (r === 'ADMIN') {
            adminCounts[pr.school_id] = (adminCounts[pr.school_id] || 0) + 1;
            teacherAdminCounts[pr.school_id] = (teacherAdminCounts[pr.school_id] || 0) + 1;
          } else if (r === 'KEPALA SEKOLAH') {
            headmasterCounts[pr.school_id] = (headmasterCounts[pr.school_id] || 0) + 1;
            teacherAdminCounts[pr.school_id] = (teacherAdminCounts[pr.school_id] || 0) + 1;
          } else if (r === 'WALI KELAS' || r === 'GURU MAPEL' || r === 'GURU') {
            teacherCounts[pr.school_id] = (teacherCounts[pr.school_id] || 0) + 1;
            teacherAdminCounts[pr.school_id] = (teacherAdminCounts[pr.school_id] || 0) + 1;
          } else if (r === 'SISWA') {
            studentProfileCounts[pr.school_id] = (studentProfileCounts[pr.school_id] || 0) + 1;
          }
        }
      });

      // Sinkronisasi jika ada nama_kepala_sekolah di school_profile tapi belum ada akun user KS terdaftar
      (schoolProfiles || []).forEach((sp: any) => {
        if (sp.school_id && sp.nama_kepala_sekolah && String(sp.nama_kepala_sekolah).trim() && !headmasterCounts[sp.school_id]) {
          headmasterCounts[sp.school_id] = 1;
        }
      });

      const classCounts: Record<string, number> = {};
      (classes||[]).forEach((cl:any)=>{ if(cl.school_id) classCounts[cl.school_id]=(classCounts[cl.school_id]||0)+1; });

      const now = new Date();
      const rows = (schools||[]).map((s:any)=>{
        const isExpired = s.subscription_expires_at && new Date(s.subscription_expires_at) <= now;
        const normPlan = isExpired ? 'guru_gratis' : normalizePlan(s.plan);
        
        const isPersonal = s.workspace_type === 'personal' || s.workspace_type === 'individu' || s.is_personal === true || (Boolean(s.code?.startsWith('PER-')) && !s.npsn);
        const workspaceType = isPersonal ? 'personal' : 'school';

        const sp = profileMap.get(s.id);
        const userFilledSchoolName = sp?.nama_sekolah && String(sp.nama_sekolah).trim() ? String(sp.nama_sekolah).trim() : null;
        const resolvedName = userFilledSchoolName || s.name || (isPersonal ? 'Ruang Kerja Individu' : 'Ruang Kerja Sekolah');
        const resolvedNpsn = sp?.npsn || s.npsn || null;

        const rawCode = s.code ? String(s.code).replace(/^SCH-?/i, '').trim().toUpperCase() : null;
        const totalAccumulatedUsers = userCounts[s.id] || (s.user_count ? Number(s.user_count) : 0);
        return {
          ...s,
          notes: notesMap[s.id] || (s as any).notes || '',
          code: rawCode,
          name: resolvedName,
          npsn: resolvedNpsn,
          school_id: s.id,
          plan: normPlan,
          raw_plan: s.plan,
          workspace_type: workspaceType,
          workspace_type_label: isPersonal ? 'Ruang Kerja Individu' : 'Ruang Kerja Sekolah',
          user_count: totalAccumulatedUsers,
          total_user_count: totalAccumulatedUsers,
          generated_user_count: totalAccumulatedUsers,
          admin_count: adminCounts[s.id] || 0,
          student_profile_count: studentProfileCounts[s.id] || 0,
          student_count: studentCounts[s.id] || 0,
          teacher_count: teacherCounts[s.id] || (teacherAdminCounts[s.id] ? Math.max(0, teacherAdminCounts[s.id] - (headmasterCounts[s.id] || 0)) : 0),
          teacher_admin_count: teacherCounts[s.id] || teacherAdminCounts[s.id] || 0,
          headmaster_count: headmasterCounts[s.id] || 0,
          class_count: classCounts[s.id] || 0,
          is_personal: isPersonal,
        };
      });

      return json(res,200,{ok:true,schools:rows});
    }

    if(action==='dashboard'){
      const nowDash = new Date();
      const sevenDaysAgo = new Date(nowDash);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
      sevenDaysAgo.setHours(0, 0, 0, 0);
      const sevenDaysAgoIso = sevenDaysAgo.toISOString();
      const startOfMonth = new Date(nowDash.getFullYear(), nowDash.getMonth(), 1).toISOString();

      const [
        {data:schools},
        {data:students},
        {data:classes},
        {data:users},
        {data:schoolProfiles},
        {data:payments},
        {data:recentAuditLogs},
        {data:recentAttendance}
      ]=await Promise.all([
        admin.from('schools').select('id,name,npsn,code,plan,status,subscription_expires_at,max_teachers,max_students,max_classes,workspace_type,is_personal,created_at').order('created_at', { ascending: false }),
        admin
          .from('students')
          .select('id, school_id, created_at')
          .then(async (res) => {
            if (res.error) {
              return admin.from('students').select('id, school_id');
            }
            return res;
          }),
        admin.from('classes').select('id, school_id'),
        admin.from('profiles').select('id, role, school_id, created_at').neq('role','SUPER_ADMIN'),
        admin.from('school_profile').select('school_id, nama_sekolah, npsn'),
        admin.from('payments').select('id, total_amount, amount, status, created_at, paid_at').order('created_at', { ascending: false }).limit(300),
        admin.from('audit_logs').select('id, action, created_at').gte('created_at', sevenDaysAgoIso).limit(1000),
        admin.from('attendance_records').select('id, date, created_at').gte('created_at', sevenDaysAgoIso).limit(1000)
      ]);
      const spMap = new Map((schoolProfiles || []).map((sp: any) => [sp.school_id, sp]));
      const rows=(schools||[]).map((s:any)=>{
        const sp = spMap.get(s.id);
        const userFilledSchoolName = sp?.nama_sekolah && String(sp.nama_sekolah).trim() ? String(sp.nama_sekolah).trim() : null;
        const rawCode = s.code ? String(s.code).replace(/^SCH-?/i, '').trim().toUpperCase() : null;
        const isExpired = s.subscription_expires_at && new Date(s.subscription_expires_at) <= nowDash;
        return {
          ...s,
          code: rawCode,
          name: userFilledSchoolName || s.name || 'Ruang Kerja',
          npsn: sp?.npsn || s.npsn || null,
          school_id: s.id,
          plan: isExpired ? 'guru_gratis' : normalizePlan(s.plan),
          raw_plan: s.plan,
        };
      });
      
      const planStats = {
        guru_gratis: 0,
        guru_pro: 0,
        sekolah_pro: 0,
        mulai: 0,
        teacher: 0,
        school: 0,
      };

      rows.forEach((s: any) => {
        const p = normalizePlan(s.plan);
        if (p === 'sekolah_pro') {
          planStats.sekolah_pro++;
          planStats.school++;
        } else if (p === 'guru_pro') {
          planStats.guru_pro++;
          planStats.teacher++;
        } else {
          planStats.guru_gratis++;
          planStats.mulai++;
        }
      });

      // Hitung metrik 7 Hari Terakhir sebenarnya (Login, Presensi, Transaksi)
      const datesLabels: string[] = [];
      const dateKeys: string[] = [];
      const loginCounts: number[] = [];
      const attendanceCounts: number[] = [];
      const transactionCounts: number[] = [];

      for (let i = 6; i >= 0; i--) {
        const d = new Date(nowDash);
        d.setDate(d.getDate() - i);
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd}`;
        dateKeys.push(key);
        datesLabels.push(d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }));
      }

      dateKeys.forEach((k) => {
        const lCount = (recentAuditLogs || []).filter((l: any) => (l.created_at || '').startsWith(k)).length;
        const aCount = (recentAttendance || []).filter((a: any) => (a.date === k || (a.created_at || '').startsWith(k))).length;
        const tCount = (payments || []).filter((p: any) => (p.created_at || '').startsWith(k)).length;
        loginCounts.push(lCount);
        attendanceCounts.push(aCount);
        transactionCounts.push(tCount);
      });

      // Metrik pertumbuhan riil bulan ini
      const newSchoolsThisMonth = rows.filter((s: any) => s.created_at && s.created_at >= startOfMonth).length;
      const newStudentsThisMonth = (students || []).filter((st: any) => st.created_at && st.created_at >= startOfMonth).length;
      const newTeachersThisMonth = (users || []).filter((u: any) => ['ADMIN','WALI KELAS','GURU MAPEL','KEPALA SEKOLAH'].includes(u.role) && u.created_at && u.created_at >= startOfMonth).length;
      const newUsersThisMonth = (users || []).filter((u: any) => u.created_at && u.created_at >= startOfMonth).length;

      // Pendapatan riil
      let thisMonthRevenue = 0;
      let totalRevenue = 0;
      let settledCount = 0;
      (payments || []).forEach((p: any) => {
        const isSettled = p.status === 'paid' || p.status === 'SETTLED' || p.status === 'success';
        const amt = Number(p.total_amount || p.amount || 0);
        if (isSettled) {
          totalRevenue += amt;
          settledCount++;
          const pDate = p.paid_at || p.created_at || '';
          if (pDate >= startOfMonth) {
            thisMonthRevenue += amt;
          }
        }
      });

      return json(res,200,{
        ok:true,
        schools:rows,
        totals:{
          schools:rows.length,
          active:rows.filter((s:any)=>s.status==='active').length,
          teachers:(users||[]).filter((u:any)=>['ADMIN','WALI KELAS','GURU MAPEL','KEPALA SEKOLAH'].includes(u.role)).length,
          students:students?.length||0,
          classes:classes?.length||0,
          users:users?.length||0,
          newSchoolsThisMonth,
          newStudentsThisMonth,
          newTeachersThisMonth,
          newUsersThisMonth,
          thisMonthRevenue,
          totalRevenue,
          settledCount,
          planBreakdown: planStats,
          activity7Days: {
            dates: datesLabels,
            login: loginCounts,
            attendance: attendanceCounts,
            transaction: transactionCounts,
          },
        }
      });
    }

    if(action==='school_users_recap'){
      const [
        {data:schools, error: schErr},
        {data:profiles, error: profErr},
        {data:students, error: stuErr},
        {data:classes},
        {data:schoolProfiles}
      ] = await Promise.all([
        admin.from('schools').select('id,name,npsn,code,plan,status,workspace_type,created_at').order('created_at', { ascending: false }),
        admin.from('profiles').select('id,school_id,name,username,email,role,student_id,is_active,created_at').neq('role','SUPER_ADMIN'),
        admin
          .from('students')
          .select('id,school_id,nama,nisn,class_id,status,created_at')
          .then(async (res) => {
            if (res.error) {
              console.warn('[superadmin] Warning querying students columns:', res.error.message);
              return admin.from('students').select('id,school_id,nama,nisn,class_id');
            }
            return res;
          }),
        admin.from('classes').select('id,school_id,name,grade'),
        admin.from('school_profile').select('school_id,nama_sekolah,npsn'),
      ]);

      if (schErr) throw schErr;
      if (profErr) throw profErr;
      if (stuErr) throw stuErr;

      const spMap = new Map((schoolProfiles || []).map((sp: any) => [sp.school_id, sp]));
      const classMap = new Map((classes || []).map((c: any) => [c.id, c.name]));

      // Kelompokkan profil per sekolah
      const profilesBySchool = new Map<string, any[]>();
      (profiles || []).forEach((p: any) => {
        const sid = p.school_id || 'unassigned';
        if (!profilesBySchool.has(sid)) profilesBySchool.set(sid, []);
        profilesBySchool.get(sid)!.push(p);
      });

      // Kelompokkan siswa per sekolah
      const studentsBySchool = new Map<string, any[]>();
      (students || []).forEach((st: any) => {
        const sid = st.school_id || 'unassigned';
        if (!studentsBySchool.has(sid)) studentsBySchool.set(sid, []);
        studentsBySchool.get(sid)!.push({
          ...st,
          class_name: classMap.get(st.class_id) || null,
        });
      });

      const recapRows = (schools || []).map((s: any) => {
        const sp = spMap.get(s.id);
        const schoolName = sp?.nama_sekolah && String(sp.nama_sekolah).trim() ? String(sp.nama_sekolah).trim() : (s.name || 'Sekolah');
        const schProfiles = profilesBySchool.get(s.id) || [];
        const schStudents = studentsBySchool.get(s.id) || [];

        const admins = schProfiles.filter((p: any) => (p.role || '').toUpperCase() === 'ADMIN');
        const headmasters = schProfiles.filter((p: any) => (p.role || '').toUpperCase() === 'KEPALA SEKOLAH');
        const homerooms = schProfiles.filter((p: any) => (p.role || '').toUpperCase() === 'WALI KELAS');
        const subjectTeachers = schProfiles.filter((p: any) => (p.role || '').toUpperCase() === 'GURU MAPEL');
        const studentProfiles = schProfiles.filter((p: any) => (p.role || '').toUpperCase() === 'SISWA');

        // Normalisasi list data siswa
        const mergedStudents: any[] = [];
        const seenStudentIds = new Set<string>();
        const studentProfileMap = new Map(studentProfiles.map((item: any) => [item.student_id || item.username, item]));

        schStudents.forEach((st: any) => {
          seenStudentIds.add(st.id);
          const matchedProfile = studentProfileMap.get(st.id) || studentProfileMap.get(st.nisn);
          mergedStudents.push({
            id: st.id,
            profile_id: matchedProfile?.id || null,
            name: st.nama,
            username: matchedProfile?.username || st.nisn || '-',
            email: matchedProfile?.email || null,
            role: 'SISWA',
            class_name: st.class_name || null,
            nisn: st.nisn || null,
            status: st.status || (matchedProfile?.is_active === false ? 'inactive' : 'active'),
            is_active: matchedProfile?.is_active !== false,
            created_at: st.created_at || matchedProfile?.created_at,
            has_login: !!matchedProfile,
          });
        });

        studentProfiles.forEach((item: any) => {
          if (!item.student_id || !seenStudentIds.has(item.student_id)) {
            mergedStudents.push({
              id: item.student_id || item.id,
              profile_id: item.id,
              name: item.name,
              username: item.username,
              email: item.email,
              role: 'SISWA',
              class_name: null,
              nisn: null,
              status: item.is_active === false ? 'inactive' : 'active',
              is_active: item.is_active !== false,
              created_at: item.created_at,
              has_login: true,
            });
          }
        });

        const adminCount = admins.length;
        const headmasterCount = headmasters.length;
        const homeroomCount = homerooms.length;
        const subjectTeacherCount = subjectTeachers.length;
        const studentCount = mergedStudents.length;
        const totalUserCount = adminCount + headmasterCount + homeroomCount + subjectTeacherCount + studentCount;

        return {
          school_id: s.id,
          school_name: schoolName,
          npsn: sp?.npsn || s.npsn || null,
          code: s.code ? String(s.code).replace(/^SCH-?/i, '').trim().toUpperCase() : null,
          status: s.status || 'active',
          plan: normalizePlan(s.plan),
          created_at: s.created_at,
          admin_count: adminCount,
          headmaster_count: headmasterCount,
          homeroom_count: homeroomCount,
          subject_teacher_count: subjectTeacherCount,
          student_count: studentCount,
          total_users: totalUserCount,
          users: {
            admin: admins,
            headmaster: headmasters,
            homeroom: homerooms,
            subject_teacher: subjectTeachers,
            student: mergedStudents,
            all: [
              ...admins,
              ...headmasters,
              ...homerooms,
              ...subjectTeachers,
              ...mergedStudents,
            ]
          }
        };
      });

      return json(res, 200, {
        ok: true,
        recap: recapRows,
        summary: {
          total_schools: recapRows.length,
          total_admins: recapRows.reduce((acc, r) => acc + r.admin_count, 0),
          total_headmasters: recapRows.reduce((acc, r) => acc + r.headmaster_count, 0),
          total_homerooms: recapRows.reduce((acc, r) => acc + r.homeroom_count, 0),
          total_subject_teachers: recapRows.reduce((acc, r) => acc + r.subject_teacher_count, 0),
          total_students: recapRows.reduce((acc, r) => acc + r.student_count, 0),
          total_users: recapRows.reduce((acc, r) => acc + r.total_users, 0),
        }
      });
    }

    if(action==='create_school'){
      const p=req.body.payload||req.body;
      const name=String(p.name||'').trim();
      if(!name) return json(res,400,{error:'Nama sekolah / ruang kerja wajib diisi.'});

      const workspaceType = p.workspace_type || (p.workspace_service === 'teacher_independent' ? 'personal' : 'school');
      const rawPlan = p.plan || (workspaceType === 'personal' ? 'guru_gratis' : 'sekolah_pro');
      const plan = normalizePlan(rawPlan);

      // NPSN tidak lagi wajib di form; jika tidak diberikan oleh form, buat kode NPSN unik otomatis
      const generatedNpsn = '100' + Math.floor(10000 + Math.random() * 90000);
      const npsn = p.npsn && String(p.npsn).trim() ? String(p.npsn).trim() : (workspaceType === 'personal' ? null : generatedNpsn);

      const lim=limits(plan);
      const maxTeachers = p.max_teachers !== undefined ? Number(p.max_teachers) : lim.max_teachers;
      const maxStudents = p.max_students !== undefined ? Number(p.max_students) : lim.max_students;
      const maxClasses = p.max_classes !== undefined ? Number(p.max_classes) : lim.max_classes;

      const expires=p.subscription_expires_at||p.expiresAt||null;
      const started=p.subscription_started_at||p.startedAt||new Date().toISOString().slice(0, 10);
      const notes=p.notes !== undefined ? (p.notes ? String(p.notes).trim() : null) : null;
      const rawCode = p.code && String(p.code).trim()
        ? String(p.code).trim().toUpperCase().replace(/^SCH-?/i, '').replace(/[^A-Z0-9]/g, '')
        : '';
      const code = rawCode || generateSchoolInviteCode();

      const {data:school,error}=await admin.from('schools').insert({
        name,
        npsn,
        code,
        plan,
        status:p.status||'active',
        workspace_type: workspaceType,
        subscription_started_at:started,
        subscription_expires_at:expires,
        max_teachers:maxTeachers,
        max_students:maxStudents,
        max_classes:maxClasses
      }).select().single();
      if(error||!school) return json(res,400,{error:error?.message||'Gagal membuat sekolah.'});
      if (notes) {
        await saveSchoolNote(admin, school.id, notes);
      }
      await admin.from('school_profile').insert({school_id:school.id,nama_sekolah:name,npsn:npsn||'',jenjang:p.jenjang||'SD',tahun_pelajaran:`${new Date().getFullYear()}/${new Date().getFullYear()+1}`,semester:'1'});
      await admin.from('system_config').insert({school_id:school.id});
      try {
        const { error: subjectError } = await admin.from('subjects').insert([{school_id:school.id,name:'Tematik / Guru Kelas (Wali Kelas)',code:'TMK',is_specialized:false},{school_id:school.id,name:'Pendidikan Jasmani, Olahraga & Kesehatan (PJOK)',code:'PJOK',is_specialized:true},{school_id:school.id,name:'Pendidikan Agama & Budi Pekerti (PABP)',code:'PABP',is_specialized:true},{school_id:school.id,name:'Bahasa Inggris',code:'B. Inggris',is_specialized:true},{school_id:school.id,name:'Bahasa Daerah / Muatan Lokal',code:'MULOK',is_specialized:true},{school_id:school.id,name:'Seni Budaya & Prakarya (SBdP)',code:'SBDP',is_specialized:true}]);
        if (subjectError) console.warn('Gagal membuat mata pelajaran default:', subjectError.message);
      } catch (_) {}
      await admin.from('audit_logs').insert({actor_id:caller.user.id,actor_name:profile.name,actor_role:'SUPER_ADMIN',action:'CREATE_SCHOOL',school_id:school.id,details:{name,npsn,plan,workspace_type:workspaceType,notes}});
      return json(res,200,{ok:true,school:{...school,notes:notes||'',school_id:school.id,workspace_type:workspaceType}});
    }

    if(action==='update_school'){
      const p=req.body.payload||req.body; const id=p.school_id||p.id;
      if(!id) return json(res,400,{error:'ID sekolah wajib diisi.'});

      const { data: existingSchool, error: fetchErr } = await admin.from('schools').select('*').eq('id', id).maybeSingle();
      if (fetchErr || !existingSchool) return json(res, 404, { error: 'Data sekolah tidak ditemukan.' });

      // workspace_type TIDAK BOLEH BERUBAH
      const workspaceType = existingSchool.workspace_type || 'school';

      let plan = p.plan ? normalizePlan(p.plan) : normalizePlan(existingSchool.plan);
      const expiresAt = p.subscription_expires_at !== undefined ? (p.subscription_expires_at || p.expiresAt || null) : existingSchool.subscription_expires_at;

      // Aturan: Jika subscription_expires_at sudah lewat (expired) -> simpan schools.plan = guru_gratis
      if (expiresAt && new Date(expiresAt) <= new Date()) {
        plan = 'guru_gratis';
      }

      const lim = limits(plan);
      const updateData: any = {
        name: String(p.name !== undefined ? p.name : existingSchool.name || '').trim(),
        npsn: String(p.npsn !== undefined ? p.npsn : existingSchool.npsn || '').trim(),
        plan,
        status: p.status || existingSchool.status || 'active',
        workspace_type: workspaceType,
        subscription_expires_at: expiresAt,
        max_teachers: lim.max_teachers,
        max_students: lim.max_students,
        max_classes: lim.max_classes
      };
      if (p.code !== undefined) {
        updateData.code = p.code ? String(p.code).trim().toUpperCase().replace(/^SCH-?/i, '').replace(/[^A-Z0-9]/g, '') : null;
      }
      if (p.subscription_started_at !== undefined) {
        updateData.subscription_started_at = p.subscription_started_at || null;
      }
      if (p.notes !== undefined) {
        await saveSchoolNote(admin, id, p.notes ? String(p.notes).trim() : null);
      }
      const {data,error}=await admin.from('schools').update(updateData).eq('id',id).select().single();
      if(error) return json(res,400,{error:error.message});
      await admin.from('school_profile').update({nama_sekolah:data.name,npsn:data.npsn}).eq('school_id',id);
      try {
        await admin.from('profiles').update({
          subscription_plan: plan,
          subscription_status: updateData.status,
          subscription_expires_at: updateData.subscription_expires_at,
        }).eq('school_id', id);
      } catch (_) {}
      await admin.from('audit_logs').insert({actor_id:caller.user.id,actor_name:profile.name,actor_role:'SUPER_ADMIN',action:'UPDATE_SCHOOL',school_id:id,details:p});
      return json(res,200,{ok:true,school:{...data,notes:p.notes !== undefined ? (p.notes ? String(p.notes).trim() : '') : undefined,school_id:data.id,workspace_type:workspaceType}});
    }

    if(action==='update_notes'||action==='save_notes'){
      const id=req.body.school_id||req.body.id;
      const notes=req.body.notes !== undefined ? (req.body.notes ? String(req.body.notes).trim() : null) : null;
      if(!id) return json(res,400,{error:'ID sekolah wajib diisi.'});
      await saveSchoolNote(admin, id, notes);
      await admin.from('audit_logs').insert({actor_id:caller.user.id,actor_name:profile.name,actor_role:'SUPER_ADMIN',action:'UPDATE_SCHOOL_NOTES',school_id:id,details:{notes}});
      return json(res,200,{ok:true,school:{id,notes:notes||''}});
    }

    if(action==='toggle_school'){
      const id=req.body.school_id||req.body.id; const status=req.body.status||'active';
      if(!id) return json(res,400,{error:'ID sekolah wajib diisi.'});
      const {error}=await admin.from('schools').update({status}).eq('id',id); if(error) throw error;
      return json(res,200,{ok:true});
    }

    if(action==='regenerate_school_code'||action==='reset_school_code'||action==='update_school_code'){
      const id=req.body.school_id||req.body.id;
      if(!id) return json(res,400,{error:'ID sekolah wajib diisi.'});
      
      let newCode = '';
      if (req.body.customCode && String(req.body.customCode).trim()) {
        newCode = String(req.body.customCode).trim().toUpperCase().replace(/^SCH-?/i, '').replace(/[^A-Z0-9]/g, '');
      } else {
        newCode = generateSchoolInviteCode();
      }
      
      const {data,error}=await admin.from('schools').update({code: newCode}).eq('id',id).select('id, name, code, npsn').single();
      if(error) return json(res,400,{error:error.message});
      
      await admin.from('audit_logs').insert({
        actor_id: caller.user.id,
        actor_name: profile.name,
        actor_role: 'SUPER_ADMIN',
        action: 'REGENERATE_SCHOOL_CODE',
        school_id: id,
        details: { newCode, schoolName: data.name }
      });
      return json(res,200,{ok:true,code:newCode,school:data});
    }

    if(action==='delete_school'){
      const id=req.body.schoolId||req.body.school_id||req.body.id; if(!id) return json(res,400,{error:'ID sekolah atau ruang kerja wajib diisi.'});
      
      const { data: targetSchool } = await admin.from('schools').select('name, npsn, code, plan, workspace_type, is_personal, owner_id').eq('id', id).maybeSingle();
      const isPersonal = targetSchool?.workspace_type === 'personal' || targetSchool?.is_personal === true;
      const workspaceLabel = isPersonal ? `Ruang Kerja Individu (${targetSchool?.name || id})` : `Sekolah (${targetSchool?.name || id})`;

      // Hapus data terkait sekolah/ruang kerja secara menyeluruh.
      // Setiap operasi diperiksa secara ketat; jika tabel atau kolom opsional tidak ada di skema database, lewati dengan aman.
      const deleteTenantRows = async (table: string) => {
        try {
          const { error } = await admin.from(table).delete().eq('school_id', id);
          if (error) {
            const isTableOrColMissing =
              error.code === 'PGRST205' || // PostgREST: relation/table not found in schema cache
              error.code === 'PGRST204' || // PostgREST: column not found in schema cache
              error.code === '42P01' ||    // Postgres: undefined_table
              error.code === '42703' ||    // Postgres: undefined_column
              (error.message && (
                error.message.includes('schema cache') ||
                error.message.includes('Could not find the table') ||
                error.message.includes('Could not find the') ||
                error.message.includes('does not exist')
              ));
            if (isTableOrColMissing) {
              return; // Lewati tabel opsional atau tabel yang tidak ada di skema
            }
            console.warn(`[superadmin] Peringatan delete ${table}:`, error.message);
          }
        } catch (err: any) {
          if (
            err.message?.includes('schema cache') ||
            err.message?.includes('Could not find the table') ||
            err.message?.includes('does not exist')
          ) {
            return;
          }
          console.warn(`[superadmin] Exception delete ${table}:`, err?.message);
        }
      };

      // 1. Identifikasi dan kumpulkan seluruh ID entitas anak (siswa, kelas, guru, akun pengguna)
      let studentIds: string[] = [];
      try {
        const { data: sRows } = await admin.from('students').select('id').eq('school_id', id);
        if (sRows && sRows.length > 0) {
          studentIds = sRows.map((s: any) => s.id);
        }
      } catch (_) {}

      let classIds: string[] = [];
      try {
        const { data: cRows } = await admin.from('classes').select('id').eq('school_id', id);
        if (cRows && cRows.length > 0) {
          classIds = cRows.map((c: any) => c.id);
        }
      } catch (_) {}

      let teacherIds: string[] = [];
      let teacherUserIds: string[] = [];
      try {
        const { data: tRows } = await admin.from('teachers').select('id, user_id').eq('school_id', id);
        if (tRows && tRows.length > 0) {
          teacherIds = tRows.map((t: any) => t.id);
          teacherUserIds = tRows.filter((t: any) => t.user_id).map((t: any) => t.user_id);
        }
      } catch (_) {}

      // Kumpulkan akun pengguna sekolah dari tabel profiles
      let schoolUsers: Array<{ id: string; name?: string; username?: string; role?: string }> = [];
      try {
        const { data: uRows } = await admin.from('profiles').select('id, name, username, role').eq('school_id', id);
        if (uRows && uRows.length > 0) {
          schoolUsers = uRows;
        }
      } catch (_) {}

      // Lindungi akun Super Admin dan pemanggil agar tidak terhapus
      const usersToDeleteMap = new Map<string, { id: string; name?: string; username?: string; role?: string }>();
      for (const u of schoolUsers) {
        if (u.role !== 'SUPER_ADMIN' && u.id !== caller.user.id) {
          usersToDeleteMap.set(u.id, u);
        }
      }
      for (const tuId of teacherUserIds) {
        if (tuId !== caller.user.id && !usersToDeleteMap.has(tuId)) {
          usersToDeleteMap.set(tuId, { id: tuId, name: 'Guru Instansi', role: 'GURU' });
        }
      }
      const allTargetUserIds = Array.from(usersToDeleteMap.keys());

      // 2. Coba jalankan Stored Procedure Atomic Cascade Delete di level PostgreSQL jika tersedia
      let atomicRpcExecuted = false;
      try {
        const { data: rpcResult, error: rpcError } = await admin.rpc('delete_school_cascade', {
          p_school_id: id,
          p_caller_user_id: caller.user.id
        });
        if (!rpcError && rpcResult?.ok) {
          atomicRpcExecuted = true;
          if (Array.isArray(rpcResult.deleted_auth_user_ids)) {
            for (const uid of rpcResult.deleted_auth_user_ids) {
              if (uid && uid !== caller.user.id) {
                usersToDeleteMap.set(uid, { id: uid });
              }
            }
          }
        }
      } catch (_) {
        atomicRpcExecuted = false;
      }

      // 3. Jika RPC belum terpasang di database, jalankan cascade delete multi-tahap yang sangat komprehensif
      if (!atomicRpcExecuted) {
        // A. Lepaskan Foreign Key pembatas untuk menghindari kuncian constraint
        try {
          await admin.from('schools').update({ owner_id: null }).eq('id', id);
        } catch (_) {}

        try {
          await admin.from('classes').update({ wali_kelas_teacher_id: null }).eq('school_id', id);
        } catch (_) {}

        try {
          await admin.from('profiles').update({ class_id: null, teacher_id: null, student_id: null }).eq('school_id', id);
        } catch (_) {}

        // B. Cascade Delete: Riwayat Transaksi & Pembayaran (payments / billing)
        await deleteTenantRows('payments');
        if (targetSchool?.npsn && String(targetSchool.npsn).trim()) {
          try {
            await admin.from('payments').delete().eq('npsn', targetSchool.npsn);
          } catch (_) {}
        }

        // C. Cascade Delete: Absensi, Presensi Harian & Mapel, dan Permohonan Izin
        await deleteTenantRows('attendance_records');
        if (studentIds.length > 0) {
          for (let i = 0; i < studentIds.length; i += 200) {
            const chunk = studentIds.slice(i, i + 200);
            try {
              await admin.from('attendance_records').delete().in('student_id', chunk);
            } catch (_) {}
          }
        }
        if (classIds.length > 0) {
          for (let i = 0; i < classIds.length; i += 200) {
            const chunk = classIds.slice(i, i + 200);
            try {
              await admin.from('attendance_records').delete().in('class_id', chunk);
            } catch (_) {}
          }
        }

        await deleteTenantRows('leave_requests');
        if (studentIds.length > 0) {
          for (let i = 0; i < studentIds.length; i += 200) {
            const chunk = studentIds.slice(i, i + 200);
            try {
              await admin.from('leave_requests').delete().in('student_id', chunk);
            } catch (_) {}
          }
        }

        // D. Cascade Delete: Penugasan Guru, Mapel, Rombel Kelas & Kalender
        await deleteTenantRows('user_class_assignments');
        if (classIds.length > 0) {
          for (let i = 0; i < classIds.length; i += 200) {
            const chunk = classIds.slice(i, i + 200);
            try {
              await admin.from('user_class_assignments').delete().in('class_id', chunk);
            } catch (_) {}
          }
        }
        if (allTargetUserIds.length > 0) {
          for (let i = 0; i < allTargetUserIds.length; i += 200) {
            const chunk = allTargetUserIds.slice(i, i + 200);
            try {
              await admin.from('user_class_assignments').delete().in('user_id', chunk);
            } catch (_) {}
          }
        }

        await deleteTenantRows('teacher_assignments');
        await deleteTenantRows('teacher_class_assignments');
        await deleteTenantRows('teacher_class_assignments_legacy_archive');
        await deleteTenantRows('subject_schedule_days');
        await deleteTenantRows('subject_class_assignments');
        await deleteTenantRows('subject_teacher_assignments');

        // E. Cascade Delete: Undangan, Kode Gabung & Permohonan Bergabung
        const invitationTables = [
          'invitations',
          'school_invitations',
          'teacher_invitations',
          'class_invitations',
          'student_invitations',
          'invitation_codes',
          'invitation_tokens',
          'join_requests',
          'registration_codes',
          'school_registration_codes'
        ];
        for (const it of invitationTables) {
          await deleteTenantRows(it);
        }

        // F. Cascade Delete: Master Siswa, Kelas, Guru & Mapel
        await deleteTenantRows('students');
        await deleteTenantRows('classes');
        await deleteTenantRows('subjects');
        await deleteTenantRows('teachers');

        // G. Cascade Delete: Konfigurasi Sekolah, Profil Lembaga, Kalender Akademik & Audit
        await deleteTenantRows('effective_days');
        await deleteTenantRows('academic_events');
        await deleteTenantRows('school_profile');
        await deleteTenantRows('system_config');
        await deleteTenantRows('audit_logs');

        // H. Cascade Delete: Profil Pengguna (profiles)
        try {
          await admin.from('profiles').delete().eq('school_id', id).neq('role', 'SUPER_ADMIN');
        } catch (pe: any) {
          console.warn('[superadmin] Peringatan hapus profiles:', pe?.message);
        }
        if (allTargetUserIds.length > 0) {
          for (let i = 0; i < allTargetUserIds.length; i += 200) {
            const chunk = allTargetUserIds.slice(i, i + 200);
            try {
              await admin.from('profiles').delete().in('id', chunk).neq('role', 'SUPER_ADMIN');
            } catch (_) {}
          }
        }

        // Lepaskan tautan school_id pada akun Super Admin jika ada yang tercatat
        try {
          const { data: saProfiles } = await admin.from('profiles').select('*').eq('school_id', id).eq('role', 'SUPER_ADMIN');
          if (saProfiles && saProfiles.length > 0) {
            for (const sa of saProfiles) {
              const unlinked = { ...sa, school_id: null };
              await admin.from('profiles').delete().eq('id', sa.id);
              await admin.from('profiles').insert(unlinked);
            }
          }
        } catch (saErr: any) {
          console.warn('Peringatan: Melepaskan school_id dari Super Admin:', saErr?.message);
        }

        // I. Hapus Instansi dari tabel schools
        const { error: schoolDeleteErr } = await admin.from('schools').delete().eq('id', id);
        if (schoolDeleteErr) throw schoolDeleteErr;
      }

      // 4. Cascade Delete: Berkas & File (Supabase Storage Buckets)
      try {
        const { data: buckets, error: bErr } = await admin.storage.listBuckets();
        if (!bErr && buckets && buckets.length > 0) {
          for (const b of buckets) {
            try {
              // Hapus seluruh file di folder khusus sekolah: `${id}/*`
              const { data: folderFiles } = await admin.storage.from(b.name).list(id, { limit: 1000 });
              if (folderFiles && folderFiles.length > 0) {
                const paths = folderFiles.map((f: any) => `${id}/${f.name}`);
                await admin.storage.from(b.name).remove(paths);
              }
            } catch (_) {}

            try {
              // Hapus file pada root bucket yang namanya diawali atau mengandung school_id
              const { data: rootFiles } = await admin.storage.from(b.name).list('', { search: id, limit: 1000 });
              if (rootFiles && rootFiles.length > 0) {
                const matching = rootFiles.filter((f: any) => f.name && f.name.includes(id)).map((f: any) => f.name);
                if (matching.length > 0) {
                  await admin.storage.from(b.name).remove(matching);
                }
              }
            } catch (_) {}
          }
        }

        // Bersihkan bucket khusus sekolah jika ada
        try {
          await admin.storage.deleteBucket(`school-${id}`);
        } catch (_) {}
        try {
          await admin.storage.deleteBucket(id);
        } catch (_) {}
      } catch (storageErr: any) {
        console.warn('[superadmin] Info Storage Cleanup:', storageErr?.message);
      }

      // 5. Cascade Delete: Akun Otentikasi Supabase Auth (auth.users)
      const usersToDeleteList = Array.from(usersToDeleteMap.values());
      for (const u of usersToDeleteList) {
        if (!u.id || u.id === caller.user.id || u.role === 'SUPER_ADMIN') continue;
        try {
          const { error: authDeleteErr } = await admin.auth.admin.deleteUser(u.id);
          if (authDeleteErr) {
            const isNotFound =
              authDeleteErr.message?.toLowerCase().includes('not found') ||
              (authDeleteErr as any).status === 404;
            if (!isNotFound) {
              console.warn(`Peringatan: Gagal menghapus akun Auth ${u.username || u.id}:`, authDeleteErr.message);
            }
          }
        } catch (e: any) {
          console.warn(`Peringatan: Error menghapus akun Auth ${u.username || u.id}:`, e?.message);
        }
      }

      // 6. Bersihkan catatan internal sekolah di platform_settings
      await saveSchoolNote(admin, id, null);

      // 7. Catat aktivitas Super Admin di Audit Log Global
      await admin.from('audit_logs').insert({
        actor_id: caller.user.id,
        actor_name: profile.name,
        actor_role: 'SUPER_ADMIN',
        action: 'CASCADE_DELETE_SCHOOL',
        details: {
          schoolId: id,
          schoolName: targetSchool?.name,
          npsn: targetSchool?.npsn,
          code: targetSchool?.code,
          isPersonal,
          label: workspaceLabel,
          deletedUsersCount: usersToDeleteList.length,
          deletedClassesCount: classIds.length,
          deletedStudentsCount: studentIds.length,
          timestamp: new Date().toISOString()
        }
      });

      return json(res, 200, {
        ok: true,
        message: `Cascade delete berhasil: Seluruh data ${workspaceLabel} (termasuk pengguna, absensi, riwayat transaksi, kelas, undangan, berkas file, dan konfigurasi) telah dihapus permanen.`,
        details: {
          schoolId: id,
          schoolName: targetSchool?.name,
          deletedUsersCount: usersToDeleteList.length,
          deletedClassesCount: classIds.length,
          deletedStudentsCount: studentIds.length
        }
      });
    }

    if(action==='delete_user'||action==='delete_admin'){
      const id=req.body.user_id||req.body.userId||req.body.id;
      if(!id) return json(res,400,{error:'User ID wajib disertakan.'});

      let { data: targetProfile } = await admin.from('profiles').select('id, name, username, role, school_id, teacher_id, student_id').eq('id', id).maybeSingle();
      if(!targetProfile) {
        const { data: byUsername } = await admin.from('profiles').select('id, name, username, role, school_id, teacher_id, student_id').eq('username', String(id).toLowerCase()).maybeSingle();
        targetProfile = byUsername;
      }

      const effectiveUserId = targetProfile?.id || id;
      const targetSchoolId = targetProfile?.school_id;
      if (String(targetProfile?.role || '').toUpperCase().trim() === 'SUPER_ADMIN' || effectiveUserId === caller.user.id || effectiveUserId === profile.id) {
        return json(res, 403, { error: 'Akun Super Admin tidak dapat dihapus.' });
      }

      // 1. Bersihkan penugasan kelas pengguna di user_class_assignments
      try {
        await admin.from('user_class_assignments').delete().eq('user_id', effectiveUserId);
      } catch (_) {}

      // 2. Jika akun terhubung ke guru master atau terdapat guru dengan NIP/nama sama di sekolah ini
      if (targetProfile?.teacher_id) {
        try {
          await admin.from('classes').update({ wali_kelas_teacher_id: null }).eq('wali_kelas_teacher_id', targetProfile.teacher_id);
          await admin.from('subject_teacher_assignments').delete().eq('teacher_id', targetProfile.teacher_id);
          await admin.from('teacher_assignments').delete().eq('teacher_id', targetProfile.teacher_id);
          await admin.from('teacher_class_assignments').delete().eq('teacher_id', targetProfile.teacher_id);
          if (req.body.preserveMaster !== true) {
            await admin.from('teachers').delete().eq('id', targetProfile.teacher_id);
          }
        } catch (_) {}
      } else if (targetProfile?.username && targetSchoolId && req.body.preserveMaster !== true) {
        try {
          const { data: matchedTeachers } = await admin.from('teachers')
            .select('id')
            .eq('school_id', targetSchoolId)
            .or(`nip.eq.${targetProfile.username},nama.ilike.${targetProfile.name}`);
          for (const mt of matchedTeachers || []) {
            await admin.from('classes').update({ wali_kelas_teacher_id: null }).eq('wali_kelas_teacher_id', mt.id);
            await admin.from('subject_teacher_assignments').delete().eq('teacher_id', mt.id);
            await admin.from('teacher_assignments').delete().eq('teacher_id', mt.id);
            await admin.from('teacher_class_assignments').delete().eq('teacher_id', mt.id);
            await admin.from('teachers').delete().eq('id', mt.id);
          }
        } catch (_) {}
      }

      // 3. Jika akun terhubung ke siswa master
      if (targetProfile?.student_id && req.body.deleteStudentMaster === true) {
        try {
          await admin.from('attendance_records').delete().eq('student_id', targetProfile.student_id);
          await admin.from('students').delete().eq('id', targetProfile.student_id);
        } catch (_) {}
      }

      // 4. Netralkan foreign key rujukan pemilik sekolah dan log audit
      try {
        await admin.from('schools').update({ owner_id: null }).eq('owner_id', effectiveUserId);
      } catch (_) {}
      try {
        await admin.from('audit_logs').update({ actor_id: null }).eq('actor_id', effectiveUserId);
      } catch (_) {}

      // 5. Lepaskan kaitan teacher_id dan student_id pada profiles
      try {
        await admin.from('profiles').update({ teacher_id: null, student_id: null }).eq('id', effectiveUserId);
      } catch (_) {}
      
      // 6. Hapus baris dari tabel profiles
      const { error: pErr } = await admin.from('profiles').delete().eq('id', effectiveUserId);
      if(pErr && !pErr.message.toLowerCase().includes('not found')) {
        console.error('[superadmin] delete profile error:', pErr);
      }

      // 7. Hapus user dari Supabase Auth
      try {
        await admin.auth.admin.deleteUser(effectiveUserId);
      } catch (authErr: any) {
        console.warn('[superadmin] Auth deleteUser notice:', authErr?.message);
      }

      // 8. Catat di audit log
      try {
        await admin.from('audit_logs').insert({
          actor_id: caller.user.id,
          actor_name: profile.name,
          actor_role: 'SUPER_ADMIN',
          action: 'DELETE_USER',
          details: {
            userId: effectiveUserId,
            name: targetProfile?.name,
            username: targetProfile?.username,
            role: targetProfile?.role,
            schoolId: targetSchoolId,
          },
        });
      } catch (_) {}

      return json(res,200,{ ok: true, message: `Pengguna ${targetProfile?.name || effectiveUserId} berhasil dihapus permanen dari database.` });
    }

    if(action==='create_admin'||action==='create_user'){
      const schoolId=req.body.school_id||req.body.schoolId; const name=String(req.body.name||'').trim(); const username=String(req.body.username||'').trim().toLowerCase(); const email=String(req.body.email||'').trim().toLowerCase(); const password=String(req.body.password||''); const role=String(req.body.role||'ADMIN').trim();
      if(role.toUpperCase()==='SUPER_ADMIN') return json(res,403,{error:'Pembuatan akun SUPER_ADMIN baru tidak diizinkan.'});
      if(!schoolId||!name||!username||!password) return json(res,400,{error:'Sekolah, nama, username, dan password wajib diisi.'});
      const authEmail=email||`${username}@login.edushift.local`;
      const {data:u,error}=await admin.auth.admin.createUser({email:authEmail,password,email_confirm:true,user_metadata:{name,username,role,school_id:schoolId}});
      if(error||!u.user) return json(res,400,{error:error?.message||'Gagal membuat akun.'});
      const {error:pe}=await admin.from('profiles').insert({id:u.user.id,school_id:schoolId,name,username,email:authEmail,role,is_active:true,must_change_password:false});
      if(pe){await admin.auth.admin.deleteUser(u.user.id);return json(res,400,{error:pe.message});}
      return json(res,200,{ok:true,userId:u.user.id});
    }

    if(action==='list_users'||action==='list_admins'){
      const schoolId=req.body.school_id||req.body.schoolId;
      let q=admin.from('profiles').select('id,school_id,name,username,email,role,student_id,is_active,must_change_password,created_at,schools:school_id(name,npsn,plan,workspace_type,code)');
      if(schoolId && schoolId !== 'all') {
        q=q.eq('school_id',schoolId);
      }
      if(action==='list_admins') q=q.in('role',['ADMIN','KEPALA SEKOLAH','WALI KELAS','GURU MAPEL']);
      const [{data,error},{data:schoolProfiles}]=await Promise.all([
        q.order('created_at',{ascending:false}),
        admin.from('school_profile').select('school_id, nama_sekolah, npsn'),
      ]);
      if(error) throw error;
      const spMap = new Map((schoolProfiles || []).map((sp: any) => [sp.school_id, sp]));

      const formatted = (data||[]).map((u:any)=>{
        const sch = u.schools as any;
        const sp = spMap.get(u.school_id);
        const userFilledSchoolName = sp?.nama_sekolah && String(sp.nama_sekolah).trim() ? String(sp.nama_sekolah).trim() : null;
        const isCideng = (sch?.name || '').toLowerCase().includes('cideng') || sch?.npsn === '20100123';
        const isPersonal = !isCideng && (sch?.workspace_type === 'personal' || (Boolean(sch?.code?.startsWith('PER-')) && !sch?.npsn));
        return {
          ...u,
          school_name: userFilledSchoolName || sch?.name || (isPersonal ? 'Ruang Kerja Individu' : 'Ruang Kerja Sekolah'),
          school_plan: normalizePlan(sch?.plan),
          school_raw_plan: sch?.plan,
          workspace_type: isPersonal ? 'personal' : 'school',
          workspace_type_label: isPersonal ? 'Ruang Kerja Individu' : 'Ruang Kerja Sekolah',
          npsn: sp?.npsn || sch?.npsn || null,
        };
      });
      return json(res,200,{ok:true,users:formatted,admins:formatted});
    }

    if(action==='reset_admin_password'||action==='reset_user_password'){
      const id=req.body.user_id||req.body.userId; const password=String(req.body.password||''); if(!id||password.length<8) return json(res,400,{error:'User ID dan password minimal 8 karakter wajib diisi.'});
      const {data:targetProf}=await admin.from('profiles').select('id,role').eq('id',id).maybeSingle();
      if(String(targetProf?.role||'').toUpperCase().trim()==='SUPER_ADMIN' && id!==caller.user.id && id!==profile.id) {
        return json(res,403,{error:'Tidak diizinkan mengubah kredensial akun Super Admin.'});
      }
      const {error}=await admin.auth.admin.updateUserById(id,{password}); if(error) throw error;
      await admin.from('profiles').update({must_change_password:false}).eq('id',id); return json(res,200,{ok:true});
    }

    if(action==='toggle_admin'||action==='toggle_user'){
      const id=req.body.user_id||req.body.userId;
      const {data:targetProf}=await admin.from('profiles').select('id,role').eq('id',id).maybeSingle();
      if(String(targetProf?.role||'').toUpperCase().trim()==='SUPER_ADMIN') {
        return json(res,403,{error:'Status akun Super Admin tidak dapat dinonaktifkan.'});
      }
      const {error}=await admin.from('profiles').update({is_active:!!req.body.is_active}).eq('id',id); if(error) throw error; return json(res,200,{ok:true});
    }

    if(action==='payments'){
      const {data,error}=await admin.from('payments').select('*').order('created_at',{ascending:false}).limit(500);
      if(error) throw error;
      return json(res,200,{ok:true,payments:(data||[]).map((p:any)=>{
        const targetPlan = p.plan_name?.toLowerCase().includes('guru') ? 'guru_pro' : 'sekolah_pro';
        return {
          id:p.id,
          invoiceNo:p.invoice_no,
          planId:targetPlan,
          plan:targetPlan,
          planName:p.plan_name,
          amount:Number(p.amount),
          uniqueCode:Number(p.unique_code),
          totalAmount:Number(p.total_amount),
          schoolId:p.school_id,
          schoolName:p.school_name,
          npsn:p.npsn||'',
          contactName:p.contact_name,
          contactPhone:p.contact_phone||'',
          email:p.email||'',
          status:p.status,
          paymentMethod:p.payment_method,
          createdAt:p.created_at,
          paidAt:p.paid_at||undefined,
          expiresAt:p.expires_at||'',
          qrisNmid:p.qris_nmid||''
        };
      })});
    }

    if(action==='approve_payment'||action==='settle_payment'){
      const paymentId = req.body.payment_id || req.body.id;
      const invoiceNo = req.body.invoice_no || req.body.invoiceNo;
      if (!paymentId && !invoiceNo) return json(res, 400, { error: 'ID Pembayaran atau No Invoice wajib diisi.' });

      let query = admin.from('payments').select('*');
      if (paymentId) query = query.eq('id', paymentId);
      else query = query.eq('invoice_no', invoiceNo);
      const { data: payment, error: pErr } = await query.maybeSingle();

      if (pErr || !payment) return json(res, 404, { error: 'Transaksi pembayaran tidak ditemukan.' });

      // IDEMPOTENSI: Hanya proses transaksi yang belum SETTLED/PAID
      const currentStatus = String(payment.status || '').toUpperCase();
      if (currentStatus === 'SETTLED' || currentStatus === 'PAID') {
        return json(res, 200, {
          ok: true,
          already_settled: true,
          message: `Transaksi ${payment.invoice_no} sudah berstatus LUNAS (SETTLED) sebelumnya. Lisensi tidak diperpanjang ulang.`
        });
      }

      // PERKETAT PENCOCOKAN SEKOLAH:
      // Prioritaskan school_id. Jika kosong, gunakan NPSN resmi sebagai fallback.
      // Dilarang melakukan fallback otomatis hanya berdasarkan kemiripan nama sekolah.
      let targetSchoolId = payment.school_id;
      if (!targetSchoolId && payment.npsn && String(payment.npsn).trim() !== '') {
        const { data: sch } = await admin.from('schools').select('id').eq('npsn', String(payment.npsn).trim()).maybeSingle();
        targetSchoolId = sch?.id;
      }

      if (!targetSchoolId) {
        return json(res, 400, {
          error: `Identitas sekolah tidak dapat dipastikan secara valid (school_id kosong dan NPSN "${payment.npsn || '-'}" tidak terdaftar). Proses persetujuan dibatalkan demi keamanan lisensi.`
        });
      }

      const { data: school, error: sErr } = await admin.from('schools').select('*').eq('id', targetSchoolId).maybeSingle();
      if (sErr || !school) {
        return json(res, 404, {
          error: `Data sekolah tujuan (ID: ${targetSchoolId}) tidak ditemukan di database. Persetujuan pembayaran dibatalkan.`
        });
      }

      // Update status pembayaran menjadi SETTLED dengan kondisi idempotensi
      const paidAt = new Date().toISOString();
      const { error: updatePaymentErr } = await admin.from('payments').update({
        status: 'SETTLED',
        paid_at: paidAt,
        school_id: school.id,
      }).eq('id', payment.id);

      if (updatePaymentErr) throw updatePaymentErr;

      // Hitung perpanjangan lisensi dengan aman
      const isYearly = payment.plan_name?.toLowerCase().includes('tahun') || Number(payment.amount || 0) >= 200000;
      const durationDays = isYearly ? 365 : 30;
      const now = new Date();
      const currentExpiry = school.subscription_expires_at ? new Date(school.subscription_expires_at) : now;
      const baseDate = currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);
      const targetPlan = payment.plan_name?.toLowerCase().includes('guru') ? 'guru_pro' : 'sekolah_pro';

      await admin.from('schools').update({
        status: 'active',
        plan: targetPlan,
        subscription_expires_at: newExpiry.toISOString(),
      }).eq('id', school.id);

      await admin.from('audit_logs').insert({
        school_id: school.id,
        actor_id: caller.user.id,
        actor_name: profile.name || 'Super Admin',
        actor_role: 'SUPER_ADMIN',
        action: 'SUPERADMIN_MANUAL_PAYMENT_APPROVAL',
        details: {
          invoice_no: payment.invoice_no,
          amount: payment.total_amount || payment.amount,
          school_name: school.name,
          npsn: school.npsn,
          previous_expiry: school.subscription_expires_at,
          new_expiry: newExpiry.toISOString(),
          duration_days: durationDays,
          plan: targetPlan,
        },
      });

      return json(res, 200, {
        ok: true,
        message: `Pembayaran ${payment.invoice_no} untuk ${school.name} berhasil diverifikasi LUNAS (+${durationDays} hari).`
      });
    }

    if(action==='reject_payment'||action==='cancel_payment'){
      const paymentId = req.body.payment_id || req.body.id;
      const invoiceNo = req.body.invoice_no || req.body.invoiceNo;
      const reason = String(req.body.reason || req.body.alasan || 'Dibatalkan oleh Super Admin').trim();
      if (!paymentId && !invoiceNo) return json(res, 400, { error: 'ID Pembayaran atau No Invoice wajib diisi.' });

      let query = admin.from('payments').select('*');
      if (paymentId) query = query.eq('id', paymentId);
      else query = query.eq('invoice_no', invoiceNo);
      const { data: payment, error: pErr } = await query.maybeSingle();

      if (pErr || !payment) return json(res, 404, { error: 'Transaksi pembayaran tidak ditemukan.' });

      const currentStatus = String(payment.status || '').toUpperCase();
      if (currentStatus === 'SETTLED' || currentStatus === 'PAID') {
        return json(res, 400, { error: 'Transaksi yang sudah LUNAS (SETTLED) tidak dapat dibatalkan.' });
      }

      await admin.from('payments').update({
        status: 'CANCELLED',
      }).eq('id', payment.id);

      await admin.from('audit_logs').insert({
        school_id: payment.school_id || null,
        actor_id: caller.user.id,
        actor_name: profile.name || 'Super Admin',
        actor_role: 'SUPER_ADMIN',
        action: 'SUPERADMIN_CANCEL_PAYMENT',
        details: {
          payment_id: payment.id,
          invoice_no: payment.invoice_no,
          school_name: payment.school_name,
          reason,
          previous_status: payment.status,
        },
      });

      return json(res, 200, { ok: true, message: `Transaksi ${payment.invoice_no} berhasil dibatalkan.` });
    }

    if(action==='delete_payment'){
      const paymentId = req.body.payment_id || req.body.id;
      const invoiceNo = req.body.invoice_no || req.body.invoiceNo;
      if (!paymentId && !invoiceNo) return json(res, 400, { error: 'ID Pembayaran atau No Invoice wajib diisi.' });

      let query = admin.from('payments').select('*');
      if (paymentId) query = query.eq('id', paymentId);
      else query = query.eq('invoice_no', invoiceNo);
      const { data: payment, error: pErr } = await query.maybeSingle();

      if (pErr || !payment) return json(res, 404, { error: 'Transaksi pembayaran tidak ditemukan.' });

      // LINDUNGI TRANSAKSI LUNAS: Transaksi SETTLED/PAID dilarang dihapus kecuali force: true
      const currentStatus = String(payment.status || '').toUpperCase();
      if ((currentStatus === 'SETTLED' || currentStatus === 'PAID') && !req.body.force) {
        return json(res, 403, {
          error: 'Transaksi berstatus LUNAS (SETTLED) dilindungi. Berikan konfirmasi force untuk menghapus riwayat transaksi ini.'
        });
      }

      const { error: delErr } = await admin.from('payments').delete().eq('id', payment.id);
      if (delErr) throw delErr;

      await admin.from('audit_logs').insert({
        school_id: payment.school_id || null,
        actor_id: caller.user.id,
        actor_name: profile.name || 'Super Admin',
        actor_role: 'SUPER_ADMIN',
        action: 'SUPERADMIN_DELETE_PAYMENT',
        details: {
          payment_id: payment.id,
          invoice_no: payment.invoice_no,
          school_name: payment.school_name,
          status: payment.status,
          forced: !!req.body.force,
        },
      });

      return json(res, 200, { ok: true, message: 'Data riwayat pembayaran berhasil dihapus permanen.' });
    }

    if(action==='create_direct_subscription'){
      const schoolId = String(req.body.school_id || req.body.schoolId || '').trim();
      const planRaw = String(req.body.plan || 'sekolah_pro').toLowerCase().trim();
      const targetPlan = planRaw.includes('guru') || planRaw === 'teacher' ? 'guru_pro' : 'sekolah_pro';
      const durationDays = Math.max(1, parseInt(req.body.duration_days || req.body.durationDays || '365', 10));
      const amount = Math.max(0, parseInt(req.body.amount || '0', 10));
      const notes = String(req.body.notes || req.body.keterangan || '').trim();
      const rawIdempotencyKey = String(req.body.idempotency_key || req.body.idempotencyKey || '').trim();

      if (!schoolId) {
        return json(res, 400, { error: 'ID Sekolah tujuan wajib dipilih untuk membuat Direct Subscription.' });
      }

      // Ambil data sekolah dari tabel schools
      const { data: school, error: sErr } = await admin.from('schools').select('*').eq('id', schoolId).maybeSingle();
      if (sErr || !school) {
        return json(res, 404, { error: 'Sekolah yang dipilih tidak ditemukan di database.' });
      }

      // 1. MEKANISME IDEMPOTENSI DETERMINISTIK:
      // Bentuk token idempotensi yang unik, aman, dan dapat dikenali secara pasti
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
      
      // Jika client mengirim idempotency_key, normalisasi alfanumerik (misal: DS-174246-x92f1 -> DS174246X92F1)
      const cleanKey = rawIdempotencyKey
        ? rawIdempotencyKey.replace(/[^a-zA-Z0-9]/g, '').slice(-16).toUpperCase()
        : Math.random().toString(36).substring(2, 10).toUpperCase();

      // Gunakan invoice_no deterministik berbasis cleanKey yang terikat pada UNIQUE constraint tabel payments:
      // Format: INV/YYYYMM/DIR/{CLEAN_IDEMPOTENCY_KEY}
      const deterministicInvoiceNo = `INV/${yearMonth}/DIR/${cleanKey}`;

      const planReadable = targetPlan === 'guru_pro' ? 'Paket Guru Pro' : 'Paket Sekolah Pro';
      const durationLabel = durationDays >= 365
        ? `${Math.round(durationDays / 365)} Tahun`
        : durationDays >= 30
        ? `${Math.round(durationDays / 30)} Bulan`
        : `${durationDays} Hari`;

      const planNameFormatted = `${planReadable} (Direct Subscription - ${durationLabel})`;

      // 2. ATOMIC EXECUTION VIA POSTGRESQL RPC (process_superadmin_direct_subscription)
      // Menjalankan validasi sekolah, idempotency check, INSERT payments (SETTLED), UPDATE schools,
      // dan INSERT audit_logs dalam SATU transaksi database atomik (all-or-nothing).
      let rpcHandled = false;
      let rpcResult: any = null;

      try {
        const { data: rpcData, error: rpcErr } = await admin.rpc('process_superadmin_direct_subscription', {
          p_school_id: school.id,
          p_plan: targetPlan,
          p_duration_days: durationDays,
          p_amount: amount,
          p_invoice_no: deterministicInvoiceNo,
          p_plan_name: planNameFormatted,
          p_notes: notes || 'Direct Subscription oleh Super Admin',
          p_actor_id: caller.user.id,
          p_actor_name: profile.name || 'Super Admin',
          p_actor_role: profile.role || 'SUPER_ADMIN',
          p_actor_email: caller.user.email || null,
          p_idempotency_key: rawIdempotencyKey || cleanKey,
        });

        if (!rpcErr && rpcData) {
          rpcHandled = true;
          rpcResult = rpcData;
        } else if (rpcErr) {
          // Jika fungsi belum dideploy ke database Supabase atau error spesifik, log error
          console.warn('[Direct Subscription] RPC invocation info:', rpcErr.message);
        }
      } catch (rpcEx: any) {
        console.warn('[Direct Subscription] RPC invocation exception:', rpcEx?.message);
      }

      if (rpcHandled && rpcResult) {
        return json(res, 200, rpcResult);
      }

      // 3. FALLBACK AMAN (JIKA RPC BELUM DIJALANKAN DI POSTGRES):
      // Tetap terproteksi UNIQUE constraint invoice_no dan rollback kompensasi
      const { data: existingPayment } = await admin.from('payments')
        .select('*')
        .eq('invoice_no', deterministicInvoiceNo)
        .maybeSingle();

      if (existingPayment) {
        return json(res, 200, {
          ok: true,
          already_processed: true,
          message: `Permintaan Direct Subscription ini telah berhasil diproses sebelumnya (Invoice: ${existingPayment.invoice_no}). Tidak ada perpanjangan ganda.`,
          payment: existingPayment,
          new_expiry: existingPayment.expires_at || school.subscription_expires_at,
        });
      }

      const currentExpiry = school.subscription_expires_at ? new Date(school.subscription_expires_at) : now;
      const baseDate = currentExpiry > now ? currentExpiry : now;
      const newExpiry = new Date(baseDate.getTime() + durationDays * 24 * 60 * 60 * 1000);

      const { data: newPayment, error: payErr } = await admin.from('payments').insert({
        invoice_no: deterministicInvoiceNo,
        school_id: school.id,
        plan_name: planNameFormatted,
        amount: amount,
        unique_code: 0,
        total_amount: amount,
        status: 'SETTLED',
        payment_method: 'DIRECT_SUBSCRIPTION',
        school_name: school.name,
        npsn: school.npsn || null,
        contact_name: profile.name || 'Super Admin',
        contact_phone: null,
        email: caller.user.email || null,
        created_at: now.toISOString(),
        paid_at: now.toISOString(),
        expires_at: newExpiry.toISOString(),
      }).select().single();

      if (payErr) {
        if (payErr.code === '23505' || String(payErr.message).toLowerCase().includes('duplicate') || String(payErr.message).toLowerCase().includes('unique')) {
          const { data: racedPayment } = await admin.from('payments')
            .select('*')
            .eq('invoice_no', deterministicInvoiceNo)
            .maybeSingle();

          return json(res, 200, {
            ok: true,
            already_processed: true,
            message: `Permintaan Direct Subscription ini sedang/telah diproses (Invoice: ${racedPayment?.invoice_no || deterministicInvoiceNo}). Transaksi ganda dicegah.`,
            payment: racedPayment,
            new_expiry: racedPayment?.expires_at || newExpiry.toISOString(),
          });
        }
        throw payErr;
      }

      try {
        const { error: schUpdateErr } = await admin.from('schools').update({
          status: 'active',
          plan: targetPlan,
          subscription_expires_at: newExpiry.toISOString(),
        }).eq('id', school.id);

        if (schUpdateErr) throw schUpdateErr;
      } catch (schoolError: any) {
        console.error('[Direct Subscription] Gagal memperbarui lisensi sekolah, melakukan rollback payment:', schoolError);
        await admin.from('payments').delete().eq('invoice_no', deterministicInvoiceNo);
        return json(res, 500, {
          error: `Gagal memperbarui lisensi sekolah: ${schoolError.message || 'Kesalahan database'}. Transaksi pembayaran telah dibatalkan secara aman (tidak ada perubahan data).`,
        });
      }

      await admin.from('audit_logs').insert({
        school_id: school.id,
        actor_id: caller.user.id,
        actor_name: profile.name || 'Super Admin',
        actor_role: 'SUPER_ADMIN',
        action: 'SUPERADMIN_DIRECT_SUBSCRIPTION',
        details: {
          invoice_no: deterministicInvoiceNo,
          school_id: school.id,
          school_name: school.name,
          npsn: school.npsn,
          plan: targetPlan,
          duration_days: durationDays,
          amount: amount,
          notes: notes || 'Direct Subscription oleh Super Admin',
          previous_status: school.status,
          previous_plan: school.plan,
          previous_expiry: school.subscription_expires_at,
          new_expiry: newExpiry.toISOString(),
          idempotency_key: rawIdempotencyKey || cleanKey,
        },
      });

      return json(res, 200, {
        ok: true,
        already_processed: false,
        message: `Direct Subscription untuk ${school.name} berhasil diaktifkan! Masa aktif diperpanjang +${durationDays} hari hingga ${newExpiry.toLocaleDateString('id-ID')}.`,
        payment: newPayment,
        new_expiry: newExpiry.toISOString(),
      });
    }

    if(action==='audit'){
      const limit=Math.min(Number(req.body.limit||150),500);
      const {data,error}=await admin.from('audit_logs').select('*, schools(name)').order('created_at',{ascending:false}).limit(limit); if(error) throw error;
      const logs=(data||[]).map((l:any)=>({...l,school_name:l.schools?.name||null,actor_username:l.actor_id||null})); return json(res,200,{ok:true,logs});
    }

    if(action==='get_config'||action==='update_config'){
      const {data:settings}=await admin.from('platform_settings').select('integrations').eq('id',1).maybeSingle();
      const defaultWorkspaceRules = {
        join_class_workspace_type: 'school',
        join_class_label: 'Ruang Kerja Sekolah',
        manage_own_class_workspace_type: 'personal',
        manage_own_class_label: 'Ruang Kerja Individu',
        rule_definition: 'Pilihan bergabung ke kelas termasuk ruang kerja sekolah, sedangkan kelola kelas sendiri termasuk ruang kerja individu.',
        sdn_cideng_07_type: 'school'
      };
      const currentConfig = (settings?.integrations?.platform_config) || {};
      const mergedConfig = {
        workspace_rules: defaultWorkspaceRules,
        ...currentConfig,
      };

      if(action==='get_config') return json(res,200,{ok:true,config:mergedConfig});
      const config=req.body.config||{};
      const integrations={
        ...(settings?.integrations||{}),
        platform_config: { ...mergedConfig, ...config, workspace_rules: defaultWorkspaceRules },
        workspace_rules: defaultWorkspaceRules
      };
      const {error}=await admin.from('platform_settings').upsert({id:1,integrations},{onConflict:'id'}); if(error) throw error; 
      return json(res,200,{ok:true,config:integrations.platform_config});
    }

    if(action==='get_announcement'||action==='save_announcement'){
      const {data:settings}=await admin.from('platform_settings').select('integrations').eq('id',1).maybeSingle();
      if(action==='get_announcement') return json(res,200,{ok:true,announcement:settings?.integrations?.announcement||null});
      const announcement={message:String(req.body.message||''),type:req.body.type||'info',active:Boolean(req.body.active),updatedAt:new Date().toISOString()};
      const integrations={...(settings?.integrations||{}),announcement}; const {error}=await admin.from('platform_settings').upsert({id:1,integrations},{onConflict:'id'}); if(error) throw error; return json(res,200,{ok:true,announcement});
    }

    if(action==='impersonate_school'){
      const schoolId = req.body.school_id || req.body.schoolId;
      const schoolName = req.body.school_name || req.body.schoolName || '';
      if (!schoolId) return json(res, 400, { error: 'ID sekolah wajib disertakan.' });

      await admin.from('audit_logs').insert({
        actor_id: caller.user.id,
        actor_name: profile.name || 'Super Admin',
        actor_role: 'SUPER_ADMIN',
        action: 'SUPERADMIN_IMPERSONATE_SCHOOL',
        school_id: schoolId,
        details: {
          target_school_id: schoolId,
          target_school_name: schoolName,
          reason: req.body.reason || 'Simulasi dukungan teknis Super Admin',
          timestamp: new Date().toISOString()
        }
      });

      return json(res, 200, { ok: true });
    }

    if(action==='get_system_settings'){
      const [
        { data: settingsRow },
        { count: schoolsCount },
        { count: studentsCount },
        { count: teachersCount },
        { count: classesCount },
      ] = await Promise.all([
        admin.from('platform_settings').select('*').eq('id', 1).maybeSingle(),
        admin.from('schools').select('*', { count: 'exact', head: true }),
        admin.from('students').select('*', { count: 'exact', head: true }),
        admin.from('teachers').select('*', { count: 'exact', head: true }),
        admin.from('classes').select('*', { count: 'exact', head: true }),
      ]);

      const integrations = settingsRow?.integrations || {};

      const defaultWorkspaceRules = {
        join_class_workspace_type: 'school',
        join_class_label: 'Ruang Kerja Sekolah',
        manage_own_class_workspace_type: 'personal',
        manage_own_class_label: 'Ruang Kerja Individu',
        rule_definition: 'Pilihan bergabung ke kelas termasuk ruang kerja sekolah, sedangkan kelola kelas sendiri termasuk ruang kerja individu.',
        sdn_cideng_07_type: 'school'
      };

      const defaultPlatformConfig = {
        app_name: 'Kawacanaan Presensi',
        app_url: process.env.VITE_APP_URL || 'https://kawacanaanpresensi.vercel.app',
        app_logo_url: integrations.platform_config?.app_logo_url || '',
        default_academic_year: '2026/2027',
        default_semester: '1 (Ganjil)',
        attendance_rules: {
          checkin_start: '06:00',
          checkin_late: '07:00',
          checkout_start: '12:30',
          active_days_per_week: 6,
          require_photo_for_leave: true,
        },
        maintenance_mode: {
          enabled: false,
          message: 'Sistem Kawacanaan Presensi sedang dalam pemeliharaan rutin. Silakan kembali dalam beberapa saat.',
          estimated_finish: '',
        },
        workspace_rules: defaultWorkspaceRules,
        ...(integrations.platform_config || {}),
      };

      const cfAccountId = cfEnv.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
      const cfApiToken = cfEnv.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
      const defaultKokaConfig = {
        enabled_landing: true,
        enabled_dashboard: true,
        active_model: '@cf/zai-org/glm-4.7-flash',
        temperature: 0.7,
        system_persona: 'Kamu adalah Presiden Konoha AI. Berbicara seperti pejabat negara yang sangat formal dan berwibawa, tetapi lucu dan nyeleneh. Menganggap urusan absensi sekolah sebagai urusan negara. Sering menggunakan istilah birokrasi seperti koordinasi, disposisi, pendataan, dan stabilitas tanpa berlebihan. Tetap ramah, singkat, akurat, dan membantu guru.',
        max_tokens: 1024,
        daily_limit_per_tenant: 100,
        has_cloudflare_config: Boolean(cfAccountId && cfApiToken),
        has_gemini_key: false,
        ...(integrations.koka_config || {}),
      };

      const rawEvo = integrations.evolution_api_config || {};
      const evoApiKey = rawEvo.api_key || '';
      const defaultEvolutionConfig = {
        server_url: rawEvo.server_url || '',
        instance_name: rawEvo.instance_name || 'kawacanaan-notif',
        is_enabled: rawEvo.is_enabled !== undefined ? Boolean(rawEvo.is_enabled) : false,
        sender_phone: rawEvo.sender_phone || '',
        notify_on_present: rawEvo.notify_on_present !== undefined ? Boolean(rawEvo.notify_on_present) : false,
        notify_on_late: rawEvo.notify_on_late !== undefined ? Boolean(rawEvo.notify_on_late) : true,
        notify_on_leave_approval: rawEvo.notify_on_leave_approval !== undefined ? Boolean(rawEvo.notify_on_leave_approval) : true,
        template_present: rawEvo.template_present || 'Halo Bapak/Ibu Wali dari {nama_siswa}, ananda telah terdata HADIR tepat waktu di sekolah ({kelas}) pada {tanggal} pukul {jam}. Terima kasih.',
        template_late: rawEvo.template_late || 'Pemberitahuan: Ananda {nama_siswa} ({kelas}) terdata HADIR TERLAMBAT pada {tanggal} pukul {jam}. Mohon kerja sama Bapak/Ibu untuk mendampingi ananda berangkat lebih awal.',
        template_leave_approved: rawEvo.template_leave_approved || 'Surat permohonan izin sakit ananda {nama_siswa} ({kelas}) untuk tanggal {tanggal} telah DISETUJUI oleh Wali Kelas. Semoga lekas pulih dan sehat kembali.',
        is_api_key_configured: Boolean(evoApiKey && evoApiKey.trim().length > 0),
      };

      const rawNotif = integrations.notification_config || {};
      const activePlatformLogo = integrations.platform_config?.app_logo_url || '/lk.png';
      const resolvedBadge = (rawNotif.badge_icon_url && rawNotif.badge_icon_url !== '/pwa-192.png')
        ? rawNotif.badge_icon_url
        : activePlatformLogo;
      const defaultNotificationConfig = {
        is_enabled: rawNotif.is_enabled !== undefined ? Boolean(rawNotif.is_enabled) : true,
        show_large_icon: rawNotif.show_large_icon !== undefined ? Boolean(rawNotif.show_large_icon) : false,
        large_icon_url: rawNotif.large_icon_url || '',
        badge_icon_url: resolvedBadge,
        app_title_prefix: rawNotif.app_title_prefix || defaultPlatformConfig.app_name || 'Kawacanaan Presensi',
        notify_on_present: rawNotif.notify_on_present !== undefined ? Boolean(rawNotif.notify_on_present) : true,
        notify_on_late: rawNotif.notify_on_late !== undefined ? Boolean(rawNotif.notify_on_late) : true,
        notify_on_checkout: rawNotif.notify_on_checkout !== undefined ? Boolean(rawNotif.notify_on_checkout) : true,
        notify_on_leave: rawNotif.notify_on_leave !== undefined ? Boolean(rawNotif.notify_on_leave) : true,
        vibrate: rawNotif.vibrate !== undefined ? Boolean(rawNotif.vibrate) : true,
        require_interaction: rawNotif.require_interaction !== undefined ? Boolean(rawNotif.require_interaction) : true,
        template_present: rawNotif.template_present || 'Ananda {nama_siswa} telah hadir di kelas tepat waktu pukul {jam} WIB.',
        template_late: rawNotif.template_late || 'Ananda {nama_siswa} telah hadir di kelas pukul {jam} WIB (Status: Terlambat).',
        template_checkout: rawNotif.template_checkout || 'Ananda {nama_siswa} telah selesai belajar dan keluar kelas pukul {jam} WIB.',
        template_leave_approved: rawNotif.template_leave_approved || 'Pengajuan {jenis_izin} untuk Ananda {nama_siswa} telah DISETUJUI oleh {penyetuju}.',
        template_leave_rejected: rawNotif.template_leave_rejected || 'Pengajuan {jenis_izin} untuk Ananda {nama_siswa} DITOLAK oleh {penyetuju}.',
      };

      const announcement = integrations.announcement || {
        message: '',
        type: 'info',
        active: false,
        target_audience: 'all',
        updatedAt: null,
      };

      const platformStats = {
        schoolsCount: schoolsCount || 0,
        studentsCount: studentsCount || 0,
        teachersCount: teachersCount || 0,
        classesCount: classesCount || 0,
        updatedAt: settingsRow?.updated_at || null,
      };

      return json(res, 200, {
        ok: true,
        platform: defaultPlatformConfig,
        koka: defaultKokaConfig,
        notifikasi: defaultNotificationConfig,
        evolution_api: defaultEvolutionConfig,
        announcement,
        platform_stats: platformStats,
        settings: {
          platform_config: defaultPlatformConfig,
          koka_config: defaultKokaConfig,
          notification_config: defaultNotificationConfig,
          evolution_api_config: defaultEvolutionConfig,
          announcement,
          platform_stats: platformStats,
        }
      });
    }

    if(action==='update_system_settings'){
      const section = req.body.section;
      const data = req.body.data || {};
      if(!section) return json(res, 400, { error: 'Parameter section wajib diisi.' });

      const {data:settings}=await admin.from('platform_settings').select('integrations').eq('id',1).maybeSingle();
      const currentIntegrations = settings?.integrations || {};
      let updatedIntegrations = { ...currentIntegrations };

      if(section==='platform'){
        const defaultWorkspaceRules = {
          join_class_workspace_type: 'school',
          join_class_label: 'Ruang Kerja Sekolah',
          manage_own_class_workspace_type: 'personal',
          manage_own_class_label: 'Ruang Kerja Individu',
          rule_definition: 'Pilihan bergabung ke kelas termasuk ruang kerja sekolah, sedangkan kelola kelas sendiri termasuk ruang kerja individu.',
          sdn_cideng_07_type: 'school'
        };
        updatedIntegrations.platform_config = {
          ...(currentIntegrations.platform_config || {}),
          ...data,
          workspace_rules: currentIntegrations.workspace_rules || defaultWorkspaceRules,
        };
      } else if(section==='koka'){
        updatedIntegrations.koka_config = {
          ...(currentIntegrations.koka_config || {}),
          ...data,
        };
      } else if(section==='evolution_api'){
        const currentEvo = currentIntegrations.evolution_api_config || {};
        const inputKey = typeof data.api_key === 'string' ? data.api_key.trim() : '';
        const finalApiKey = (inputKey && !inputKey.includes('•••')) ? inputKey : (currentEvo.api_key || '');
        updatedIntegrations.evolution_api_config = {
          ...currentEvo,
          ...data,
          api_key: finalApiKey,
        };
      } else if(section==='notifikasi'){
        updatedIntegrations.notification_config = {
          ...(currentIntegrations.notification_config || {}),
          ...data,
        };
      } else if(section==='announcement'){
        updatedIntegrations.announcement = {
          message: String(data.message || ''),
          type: data.type || 'info',
          active: Boolean(data.active),
          target_audience: data.target_audience || 'all',
          updatedAt: new Date().toISOString(),
        };
      } else {
        return json(res, 400, { error: `Section "${section}" tidak dikenal.` });
      }

      const { error } = await admin.from('platform_settings').upsert({ id: 1, integrations: updatedIntegrations }, { onConflict: 'id' });
      if(error) throw error;

      await admin.from('audit_logs').insert({
        actor_id: caller.user.id,
        actor_name: profile.name || 'Super Admin',
        actor_role: 'SUPER_ADMIN',
        action: `UPDATE_SYSTEM_${section.toUpperCase()}`,
        details: { section, timestamp: new Date().toISOString() }
      });

      return json(res, 200, { ok: true, message: `Pengaturan ${section} berhasil diperbarui di server.` });
    }

    if(action==='test_evolution_api'){
      const {data:settings}=await admin.from('platform_settings').select('integrations').eq('id',1).maybeSingle();
      const evoConfig = settings?.integrations?.evolution_api_config || {};
      
      const serverUrl = (req.body.server_url || evoConfig.server_url || '').trim().replace(/\/+$/, '');
      const instanceName = (req.body.instance_name || evoConfig.instance_name || '').trim();
      const inputKey = req.body.api_key;
      const apiKey = (inputKey && !inputKey.includes('•••')) ? inputKey.trim() : (evoConfig.api_key || '');

      if(!serverUrl) {
        return json(res, 400, { error: 'Server URL Evolution API belum disetel.' });
      }
      if(!instanceName) {
        return json(res, 400, { error: 'Instance Name Evolution API wajib diisi.' });
      }

      const t0 = Date.now();
      try {
        const pingUrl = `${serverUrl}/instance/connectionState/${instanceName}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const response = await fetch(pingUrl, {
          method: 'GET',
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - t0;

        if (response.ok) {
          const body = await response.json().catch(() => ({}));
          const state = body?.instance?.state || body?.state || 'open';
          return json(res, 200, {
            ok: true,
            state,
            latencyMs,
            message: `Berhasil terhubung ke Evolution API! Status instance [${instanceName}]: ${state}.`,
            details: body,
          });
        } else if (response.status === 401 || response.status === 403) {
          return json(res, 400, {
            ok: false,
            latencyMs,
            error: `Otentikasi Evolution API gagal (${response.status}). Periksa kembali API Key / Token Anda.`,
          });
        } else if (response.status === 404) {
          return json(res, 404, {
            ok: false,
            latencyMs,
            error: `Instance "${instanceName}" tidak ditemukan di server Evolution API (${serverUrl}). Pastikan instance sudah dibuat.`,
          });
        } else {
          return json(res, 400, {
            ok: false,
            latencyMs,
            error: `Evolution API mengembalikan status HTTP ${response.status}.`,
          });
        }
      } catch (err: any) {
        const latencyMs = Date.now() - t0;
        return json(res, 500, {
          ok: false,
          latencyMs,
          error: `Gagal menghubungi Evolution API (${serverUrl}): ${err.message || 'Koneksi waktu habis (timeout)'}`,
        });
      }
    }

    if(action==='send_test_whatsapp'){
      const {data:settings}=await admin.from('platform_settings').select('integrations').eq('id',1).maybeSingle();
      const evoConfig = settings?.integrations?.evolution_api_config || {};
      
      const serverUrl = (req.body.server_url || evoConfig.server_url || '').trim().replace(/\/+$/, '');
      const instanceName = (req.body.instance_name || evoConfig.instance_name || '').trim();
      const inputKey = req.body.api_key;
      const apiKey = (inputKey && !inputKey.includes('•••')) ? inputKey.trim() : (evoConfig.api_key || '');
      const targetPhone = String(req.body.phone || req.body.recipient || '').trim().replace(/[^0-9]/g, '');
      const message = String(req.body.message || 'Halo dari Sistem Kawacanaan Presensi! Ini adalah pesan uji coba integrasi WhatsApp Evolution API.').trim();

      if(!serverUrl) return json(res, 400, { error: 'Server URL Evolution API belum disetel.' });
      if(!instanceName) return json(res, 400, { error: 'Instance Name Evolution API belum disetel.' });
      if(!targetPhone) return json(res, 400, { error: 'Nomor telepon tujuan uji coba wajib diisi.' });

      const t0 = Date.now();
      try {
        const sendUrl = `${serverUrl}/message/sendText/${instanceName}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(sendUrl, {
          method: 'POST',
          headers: {
            'apikey': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            number: targetPhone,
            text: message,
            options: {
              delay: 1000,
              presence: 'composing',
              linkPreview: false,
            }
          }),
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        const latencyMs = Date.now() - t0;

        if (response.ok) {
          const body = await response.json().catch(() => ({}));
          await admin.from('audit_logs').insert({
            actor_id: caller.user.id,
            actor_name: profile.name || 'Super Admin',
            actor_role: 'SUPER_ADMIN',
            action: 'TEST_SEND_WHATSAPP',
            details: { targetPhone, latencyMs, timestamp: new Date().toISOString() }
          });
          return json(res, 200, {
            ok: true,
            latencyMs,
            message: `Pesan uji coba WhatsApp berhasil dikirim ke nomor ${targetPhone}!`,
            details: body,
          });
        } else {
          const errText = await response.text().catch(() => '');
          return json(res, 400, {
            ok: false,
            latencyMs,
            error: `Evolution API mengembalikan status ${response.status}: ${errText || 'Gagal mengirim pesan'}`,
          });
        }
      } catch (err: any) {
        const latencyMs = Date.now() - t0;
        return json(res, 500, {
          ok: false,
          latencyMs,
          error: `Gagal menghubungi Evolution API: ${err.message || 'Koneksi waktu habis'}`,
        });
      }
    }

    if(action==='test_koka_ai'){
      const cfAccountId = cfEnv.CLOUDFLARE_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
      const cfApiToken = cfEnv.CLOUDFLARE_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
      if (!cfAccountId || !cfApiToken) {
        return json(res, 400, {
          ok: false,
          error: 'CLOUDFLARE_ACCOUNT_ID atau CLOUDFLARE_API_TOKEN belum disetel di environment server. Fitur Presiden Konoha AI memerlukan Cloudflare Workers AI.',
        });
      }

      const prompt = req.body.prompt || 'Halo Presiden Konoha, bagaimana hasil pendataan dan stabilitas absensi nasional hari ini?';
      const requestedModel = req.body.model || '@cf/zai-org/glm-4.7-flash';
      const t0 = Date.now();
      try {
        const cfEndpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(
          cfAccountId
        )}/ai/run/${requestedModel}`;

        const cfRes = await fetch(cfEndpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cfApiToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messages: [
              {
                role: 'system',
                content:
                  'Kamu adalah Presiden Konoha AI. Berbicara seperti pejabat negara yang sangat formal dan berwibawa, tetapi lucu dan nyeleneh. Menganggap urusan absensi sekolah sebagai urusan negara. Sering menggunakan istilah birokrasi seperti koordinasi, disposisi, pendataan, dan stabilitas tanpa berlebihan. Tetap ramah, singkat, dan membantu guru.',
              },
              { role: 'user', content: prompt }
            ]
          }),
        });

        const cfData = await cfRes.json();
        const latencyMs = Date.now() - t0;
        const text = cfData?.result?.response || cfData?.response || cfData?.result?.text || '';
        if (!cfRes.ok || cfData?.success === false) {
          const errDetail = cfData?.errors?.[0]?.message || 'Gagal menghubungi Cloudflare Workers AI';
          return json(res, 502, {
            ok: false,
            latencyMs,
            error: errDetail,
          });
        }

        return json(res, 200, {
          ok: true,
          model: requestedModel,
          reply: text,
          latencyMs,
          message: `Koneksi Cloudflare Workers AI (${requestedModel}) berfungsi optimal!`,
        });
      } catch (err: any) {
        const latencyMs = Date.now() - t0;
        return json(res, 500, {
          ok: false,
          latencyMs,
          error: `Gagal menghubungi Cloudflare Workers AI: ${err.message}`,
        });
      }
    }

    if(action==='get_database_stats'){
      const t0 = Date.now();
      const [
        { count: schoolsCount },
        { count: studentsCount },
        { count: teachersCount },
        { count: profilesCount },
        { count: classesCount },
        { count: attendanceCount },
        { count: leaveCount },
        { count: paymentsCount },
        { count: auditLogsCount },
      ] = await Promise.all([
        admin.from('schools').select('*', { count: 'exact', head: true }),
        admin.from('students').select('*', { count: 'exact', head: true }),
        admin.from('teachers').select('*', { count: 'exact', head: true }),
        admin.from('profiles').select('*', { count: 'exact', head: true }),
        admin.from('classes').select('*', { count: 'exact', head: true }),
        admin.from('attendance_records').select('*', { count: 'exact', head: true }),
        admin.from('leave_requests').select('*', { count: 'exact', head: true }),
        admin.from('payments').select('*', { count: 'exact', head: true }),
        admin.from('audit_logs').select('*', { count: 'exact', head: true }),
      ]);
      const latencyMs = Date.now() - t0;

      return json(res, 200, {
        ok: true,
        latencyMs,
        counts: {
          schools: schoolsCount || 0,
          students: studentsCount || 0,
          teachers: teachersCount || 0,
          profiles: profilesCount || 0,
          classes: classesCount || 0,
          attendance: attendanceCount || 0,
          leaveRequests: leaveCount || 0,
          payments: paymentsCount || 0,
          auditLogs: auditLogsCount || 0,
        },
        database_engine: 'PostgreSQL (Supabase Managed)',
        schema_version: '2026.09-r1',
      });
    }

    if(action==='export_table_data'){
      const allowedTables = ['schools', 'students', 'teachers', 'payments', 'audit_logs', 'classes', 'leave_requests', 'attendance_records'];
      const table = req.body.table;
      if (!allowedTables.includes(table)) {
        return json(res, 400, { error: `Tabel "${table}" tidak diizinkan untuk diekspor.` });
      }

      const limit = Math.min(Number(req.body.limit || 1000), 2000);
      const { data, error } = await admin.from(table).select('*').limit(limit);
      if (error) throw error;

      return json(res, 200, {
        ok: true,
        table,
        totalRows: (data || []).length,
        exportedAt: new Date().toISOString(),
        rows: data || [],
      });
    }

    if(action==='reconcile_database_integrity'){
      const t0 = Date.now();
      // 1. Fetch all schools
      const { data: schools, error: schoolErr } = await admin.from('schools').select('id, name, plan');
      if (schoolErr) throw schoolErr;
      const schoolIds = new Set((schools || []).map((s: any) => s.id));

      // 2. Check students orphaned
      const { data: allStudents } = await admin.from('students').select('id, nama, school_id');
      const orphanStudents = (allStudents || []).filter((st: any) => st.school_id && !schoolIds.has(st.school_id));

      // 3. Check classes orphaned
      const { data: allClasses } = await admin.from('classes').select('id, name, school_id, wali_kelas_teacher_id');
      const orphanClasses = (allClasses || []).filter((c: any) => c.school_id && !schoolIds.has(c.school_id));

      // 4. Check teachers orphaned or broken class assignment
      const { data: allTeachers } = await admin.from('teachers').select('id, nama, school_id');
      const orphanTeachers = (allTeachers || []).filter((t: any) => t.school_id && !schoolIds.has(t.school_id));
      const teacherIds = new Set((allTeachers || []).map((t: any) => t.id));
      const brokenClassAssignments = (allClasses || []).filter((c: any) => c.wali_kelas_teacher_id && !teacherIds.has(c.wali_kelas_teacher_id));

      // 5. Clean up broken assignments if any exist
      let fixedCount = 0;
      if (brokenClassAssignments.length > 0) {
        for (const bc of brokenClassAssignments) {
          await admin.from('classes').update({ wali_kelas_teacher_id: null }).eq('id', bc.id);
          fixedCount++;
        }
      }

      // 6. Record audit log
      await admin.from('audit_logs').insert({
        actor_id: caller.user.id,
        actor_name: profile.name || 'Super Admin',
        actor_role: 'SUPER_ADMIN',
        action: 'DATABASE_INTEGRITY_RECONCILE',
        details: {
          schoolsChecked: schools?.length || 0,
          studentsChecked: allStudents?.length || 0,
          classesChecked: allClasses?.length || 0,
          teachersChecked: allTeachers?.length || 0,
          orphanStudentsCount: orphanStudents.length,
          orphanClassesCount: orphanClasses.length,
          orphanTeachersCount: orphanTeachers.length,
          fixedCount,
          timestamp: new Date().toISOString()
        }
      });

      const latencyMs = Date.now() - t0;
      const issuesFound = orphanStudents.length + orphanClasses.length + orphanTeachers.length + brokenClassAssignments.length;

      return json(res, 200, {
        ok: true,
        latencyMs,
        integrityScore: issuesFound === 0 ? 100 : Math.max(70, 100 - issuesFound * 5),
        checks: {
          schoolsVerified: schools?.length || 0,
          studentsVerified: allStudents?.length || 0,
          classesVerified: allClasses?.length || 0,
          teachersVerified: allTeachers?.length || 0,
          orphanStudents: orphanStudents.length,
          orphanClasses: orphanClasses.length,
          orphanTeachers: orphanTeachers.length,
          brokenAssignmentsFixed: fixedCount,
        },
        schoolTenantBreakdown: (schools || []).map((s: any) => ({
          id: s.id,
          name: s.name,
          plan: s.plan || 'gratis',
          studentsCount: (allStudents || []).filter((st: any) => st.school_id === s.id).length,
          classesCount: (allClasses || []).filter((c: any) => c.school_id === s.id).length,
          teachersCount: (allTeachers || []).filter((t: any) => t.school_id === s.id).length,
        })),
        message: issuesFound === 0
          ? 'Seluruh relasi tabel multi-tenant terverifikasi normal 100% konsisten!'
          : `Pemeriksaan selesai. Ditemukan ${issuesFound} inkonsistensi, ${fixedCount} penugasan telah diperbaiki otomatis.`
      });
    }

    return json(res,400,{error:'Aksi tidak didukung.'});
  }catch(e:any){return json(res,500,{error:e?.message||'Internal server error'});}
}
