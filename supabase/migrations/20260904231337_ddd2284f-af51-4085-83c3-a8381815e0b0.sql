ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS view_nav_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS default_view_id uuid REFERENCES public.project_views(id) ON DELETE SET NULL;

ALTER TABLE public.project_views
  ADD COLUMN IF NOT EXISTS show_view_nav boolean NOT NULL DEFAULT true;