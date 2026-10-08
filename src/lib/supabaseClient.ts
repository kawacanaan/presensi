import { supabase, usernameToEmail } from './supabase';

export { supabase };

export const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY) as string | undefined;
  return Boolean(url && key && !url.includes('your-project-id') && !url.includes('placeholder') && key !== 'your-anon-key' && key !== 'placeholder-anon-key');
};

export const signInWithEmail = async (identifier: string, password: string) => {
  const value = identifier.trim().toLowerCase();
  if (value.includes('@')) {
    const direct = await supabase.auth.signInWithPassword({ email: value, password });
    if (!direct.error) return direct;
    try {
      const resolved = await fetch('/api/resolve-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: value }),
      });
      const body = await resolved.json();
      if (resolved.ok && body.email && body.email !== value) {
        const fallback = await supabase.auth.signInWithPassword({ email: body.email, password });
        if (!fallback.error) return fallback;
      }
    } catch (_) {}
    return direct;
  }
  const first = await supabase.auth.signInWithPassword({ email: usernameToEmail(value), password });
  if (!first.error) return first;
  try {
    const resolved = await fetch('/api/resolve-login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username:value}) });
    const body = await resolved.json();
    if (resolved.ok && body.email && body.email !== usernameToEmail(value)) return supabase.auth.signInWithPassword({ email: body.email, password });
  } catch (_) {}
  return first;
};

export const appOrigin = () => {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin.replace(/\/$/, '');
  }
  const configured = import.meta.env.VITE_APP_URL as string | undefined;
  return configured?.replace(/\/$/, '') || undefined;
};

export const getAuthRedirectUrl = () => {
  const origin = appOrigin();
  if (!origin) return undefined;
  // Gunakan origin bersih agar cocok dengan whitelist Supabase Redirect URLs
  return `${origin}/`;
};

export const extractTokensFromUrl = (
  urlStringOrHash: string
): { accessToken: string; refreshToken: string } | null => {
  try {
    let clean = urlStringOrHash.trim();
    if (!clean) return null;

    // Jika user menempelkan full URL atau hash
    if (clean.includes('#')) {
      clean = clean.split('#')[1];
    } else if (clean.includes('?')) {
      clean = clean.split('?')[1];
    }

    const params = new URLSearchParams(clean);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (accessToken) {
      return {
        accessToken,
        refreshToken: refreshToken || accessToken,
      };
    }

    // Jika user menempelkan raw JWT token
    if (clean.startsWith('eyJ') && clean.length > 50) {
      return {
        accessToken: clean,
        refreshToken: clean,
      };
    }

    return null;
  } catch (_) {
    return null;
  }
};

export const setSessionFromTokenOrUrl = async (tokenOrUrl: string) => {
  const tokens = extractTokensFromUrl(tokenOrUrl);
  if (!tokens || !tokens.accessToken) {
    throw new Error('Token atau URL tidak valid. Pastikan Anda menyalin seluruh URL yang memuat access_token=');
  }

  const { data, error } = await supabase.auth.setSession({
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
  });

  if (error) throw error;
  return data;
};

export interface GoogleSignInOptions {
  skipBrowserRedirect?: boolean;
}

export const signInWithGoogle = async (options?: GoogleSignInOptions) => {
  try {
    const nowStr = String(Date.now());
    sessionStorage.setItem('kawacanaan_oauth_pending', 'true');
    sessionStorage.setItem('kawacanaan_oauth_time', nowStr);
    sessionStorage.setItem('kawacanaan_hide_landing', 'true');
    localStorage.setItem('kawacanaan_oauth_pending', 'true');
    localStorage.setItem('kawacanaan_oauth_time', nowStr);
    localStorage.setItem('kawacanaan_user_has_logged_in', 'true');
    localStorage.setItem('kawacanaan_hide_landing', 'true');
  } catch (_) {}
  const redirectUrl = getAuthRedirectUrl();
  const res = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      skipBrowserRedirect: options?.skipBrowserRedirect ?? false,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  if (!options?.skipBrowserRedirect && res.data?.url && typeof window !== 'undefined') {
    window.location.assign(res.data.url);
  }

  return res;
};

export const resetPassword = (email: string) =>
  supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: appOrigin() ? `${appOrigin()}/reset-password` : undefined,
  });


