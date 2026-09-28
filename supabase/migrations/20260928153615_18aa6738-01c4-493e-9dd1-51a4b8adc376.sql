CREATE TABLE public.comment_reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  visitor_id text NOT NULL,
  vote smallint NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT comment_reactions_vote_check CHECK (vote IN (-1, 1)),
  CONSTRAINT comment_reactions_unique UNIQUE (comment_id, visitor_id)
);

CREATE INDEX comment_reactions_comment_idx ON public.comment_reactions (comment_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_reactions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.comment_reactions TO authenticated;
GRANT ALL ON public.comment_reactions TO service_role;

ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions on public comments are viewable"
  ON public.comment_reactions FOR SELECT
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.comments c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = comment_reactions.comment_id
      AND c.status = 'approved'
      AND p.status = 'published'
      AND p.comments_enabled
  ));

CREATE POLICY "Anyone can react to comments on published maps"
  ON public.comment_reactions FOR INSERT
  TO anon, authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.comments c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = comment_reactions.comment_id
      AND c.status = 'approved'
      AND p.status = 'published'
      AND p.comments_enabled
  ));

CREATE POLICY "Anyone can change their own reaction"
  ON public.comment_reactions FOR UPDATE
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.comments c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = comment_reactions.comment_id
      AND c.status = 'approved'
      AND p.status = 'published'
      AND p.comments_enabled
  ))
  WITH CHECK (true);

CREATE POLICY "Owners manage reactions on their projects"
  ON public.comment_reactions FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.comments c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = comment_reactions.comment_id
      AND p.owner_id = auth.uid()
  ));

CREATE TRIGGER comment_reactions_set_updated_at
  BEFORE UPDATE ON public.comment_reactions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();