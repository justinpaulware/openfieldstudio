ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS comments_allow_shapes boolean NOT NULL DEFAULT false;