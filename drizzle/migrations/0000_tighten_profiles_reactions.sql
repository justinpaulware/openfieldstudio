DROP POLICY IF EXISTS "Anyone can change their own reaction" ON public.comment_reactions;
CREATE POLICY "Anyone can change their own reaction"
  ON public.comment_reactions FOR UPDATE
  TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.comments c
    JOIN public.projects p ON p.id = c.project_id
    WHERE c.id = comment_reactions.comment_id
      AND c.status = 'approved' AND p.status = 'published' AND p.comments_enabled
  ))
  WITH CHECK (
    vote IN (-1, 1)
    AND EXISTS (
      SELECT 1 FROM public.comments c
      JOIN public.projects p ON p.id = c.project_id
      WHERE c.id = comment_reactions.comment_id
        AND c.status = 'approved' AND p.status = 'published' AND p.comments_enabled
    )
  );

DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);
CREATE POLICY "Profiles of published map owners are viewable"
  ON public.profiles FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.owner_id = profiles.id AND p.status = 'published'));

CREATE OR REPLACE FUNCTION public.is_username_available(_username text, _self uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(username) = lower(_username)
      AND (_self IS NULL OR id <> _self)
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_username_available(text, uuid) TO anon, authenticated;