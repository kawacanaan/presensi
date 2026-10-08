-- ==============================================================================
-- Migration: Create platform_settings table and secure with Row Level Security (RLS)
-- Purpose: Safely store platform configurations, branding, and integrations.
-- Protect sensitive keys (Midtrans Server Key, WhatsApp tokens) from public direct access.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.platform_settings (
  id integer PRIMARY KEY DEFAULT 1,
  integrations jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Ensure the singleton record exists
INSERT INTO public.platform_settings (id, integrations)
VALUES (1, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Remove older policies if any
DROP POLICY IF EXISTS "Superadmin authenticated read platform_settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Superadmin authenticated update platform_settings" ON public.platform_settings;
DROP POLICY IF EXISTS "Deny direct public modification on platform_settings" ON public.platform_settings;

-- Allow authenticated SUPER_ADMIN users to read and update
CREATE POLICY "Superadmin authenticated read platform_settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'SUPER_ADMIN'
  )
);

CREATE POLICY "Superadmin authenticated update platform_settings"
ON public.platform_settings
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'SUPER_ADMIN'
  )
);

-- Note: All public brand reads (app_name, app_logo_url) are routed through
-- the secure backend endpoint /api/superadmin (get_public_brand) using the
-- service role key, which filters and prevents leaking secret tokens.
