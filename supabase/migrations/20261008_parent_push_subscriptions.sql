-- Migration: Tabel parent_push_subscriptions untuk multi-device Web Push Notification Orang Tua
CREATE TABLE IF NOT EXISTS public.parent_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL,
  parent_name TEXT DEFAULT 'Orang Tua / Wali Murid',
  device_name TEXT DEFAULT 'Ponsel Wali Murid',
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index untuk pencarian cepat berdasarkan student_id
CREATE INDEX IF NOT EXISTS idx_parent_push_subscriptions_student_id ON public.parent_push_subscriptions(student_id);

-- RLS Enable
ALTER TABLE public.parent_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Policy: Publik / Siswa / Ortu dapat mendaftarkan push subscription
CREATE POLICY "Allow public insert and update on parent_push_subscriptions"
  ON public.parent_push_subscriptions
  FOR ALL
  USING (true)
  WITH CHECK (true);
