ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS author text,
  ADD COLUMN IF NOT EXISTS credits text,
  ADD COLUMN IF NOT EXISTS data_sources text,
  ADD COLUMN IF NOT EXISTS embed_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

UPDATE public.projects SET published_at = updated_at WHERE status = 'published' AND published_at IS NULL;