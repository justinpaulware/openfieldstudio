ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'Webmap';
UPDATE public.comments SET source = 'Webmap' WHERE source IS NULL OR btrim(source) = '';
CREATE INDEX IF NOT EXISTS comments_project_source_idx ON public.comments (project_id, source);