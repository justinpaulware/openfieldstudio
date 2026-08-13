ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_username_format
  CHECK (
    username IS NULL OR (
      username = lower(username)
      AND username ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'
      AND username NOT IN (
        'projects','project','settings','setting','auth','login','logout','signup','sign-up',
        'maps','map','api','admin','administrator','openfield','open-field','reset-password',
        'password','account','accounts','user','users','profile','profiles','dashboard','new',
        'help','support','about','pricing','terms','privacy','blog','docs','static','assets',
        'public','embed','comments','published','me','root','www'
      )
    )
  );

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS published_slug text;

UPDATE public.projects SET published_slug = slug WHERE published_slug IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS projects_owner_published_slug_key
  ON public.projects (owner_id, published_slug);

ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_slug_key;
DROP INDEX IF EXISTS public.projects_slug_key;

CREATE UNIQUE INDEX IF NOT EXISTS projects_owner_slug_key
  ON public.projects (owner_id, slug);

ALTER TABLE public.layers
  ADD COLUMN IF NOT EXISTS filter_config jsonb NOT NULL DEFAULT '{}'::jsonb;