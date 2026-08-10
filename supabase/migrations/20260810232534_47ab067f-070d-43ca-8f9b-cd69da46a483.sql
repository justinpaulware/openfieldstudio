CREATE TYPE public.comment_status AS ENUM ('pending', 'approved', 'hidden', 'rejected');

ALTER TABLE public.projects
  ADD COLUMN comments_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN comment_categories text[] NOT NULL DEFAULT ARRAY['General feedback','Question','Issue','Opportunity','Support','Concern','Idea']::text[];

CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  lng double precision NOT NULL,
  lat double precision NOT NULL,
  geometry jsonb NOT NULL DEFAULT '{}'::jsonb,
  body text NOT NULL,
  category text,
  author_name text,
  author_email text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  status public.comment_status NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX comments_project_status_idx ON public.comments (project_id, status, created_at DESC);

GRANT INSERT ON public.comments TO anon;
GRANT SELECT ON public.comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT ALL ON public.comments TO service_role;

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can comment on published maps with comments on"
ON public.comments FOR INSERT TO anon, authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = comments.project_id
    AND p.status = 'published'::project_status
    AND p.comments_enabled
));

CREATE POLICY "Approved comments on published maps are public"
ON public.comments FOR SELECT TO anon, authenticated
USING (
  status = 'approved'::comment_status
  AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = comments.project_id
      AND p.status = 'published'::project_status
      AND p.comments_enabled
  )
);

CREATE POLICY "Owners manage comments on their projects"
ON public.comments FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = comments.project_id AND p.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = comments.project_id AND p.owner_id = auth.uid()
));

CREATE OR REPLACE FUNCTION public.force_pending_comment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = NEW.project_id AND p.owner_id = auth.uid()
  ) THEN
    NEW.status = 'pending'::comment_status;
  END IF;
  NEW.geometry = jsonb_build_object(
    'type', 'Point',
    'coordinates', jsonb_build_array(NEW.lng, NEW.lat)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER comments_force_pending
BEFORE INSERT ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.force_pending_comment();

CREATE TRIGGER comments_set_updated_at
BEFORE UPDATE ON public.comments
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();