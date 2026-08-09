ALTER TABLE public.projects
  ADD COLUMN scale_units text NOT NULL DEFAULT 'imperial';

ALTER TABLE public.projects
  ADD CONSTRAINT projects_scale_units_check CHECK (scale_units IN ('imperial','metric'));