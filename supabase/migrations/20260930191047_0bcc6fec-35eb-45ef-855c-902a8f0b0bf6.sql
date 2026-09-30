CREATE TABLE public.comment_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  body text NOT NULL,
  author_name text,
  is_team_reply boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'approved',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comment_replies_status_check CHECK (status IN ('approved','hidden')),
  CONSTRAINT comment_replies_body_check CHECK (char_length(body) BETWEEN 1 AND 1000)
);

CREATE INDEX comment_replies_comment_idx ON public.comment_replies (comment_id, created_at);
CREATE INDEX comment_replies_project_idx ON public.comment_replies (project_id);

GRANT SELECT, INSERT ON public.comment_replies TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_replies TO authenticated;
GRANT ALL ON public.comment_replies TO service_role;

ALTER TABLE public.comment_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Visible replies on published maps are public"
ON public.comment_replies FOR SELECT TO anon, authenticated
USING (
  status = 'approved'
  AND EXISTS (
    SELECT 1 FROM public.comments c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = comment_replies.comment_id
      AND c.status = 'approved'
      AND p.status = 'published'::project_status
      AND p.comments_enabled
  )
);

CREATE POLICY "Anyone can reply when replies are allowed"
ON public.comment_replies FOR INSERT TO anon, authenticated
WITH CHECK (
  is_team_reply = false
  AND EXISTS (
    SELECT 1 FROM public.comments c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = comment_replies.comment_id
      AND c.project_id = comment_replies.project_id
      AND c.status = 'approved'
      AND p.status = 'published'::project_status
      AND p.comments_enabled
      AND COALESCE((p.embed_config ->> 'allow_comment_replies')::boolean, false)
  )
);

CREATE POLICY "Owners manage replies on their projects"
ON public.comment_replies FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = comment_replies.project_id AND p.owner_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects p
  WHERE p.id = comment_replies.project_id AND p.owner_id = auth.uid()
));

CREATE TRIGGER comment_replies_set_updated_at
BEFORE UPDATE ON public.comment_replies
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();