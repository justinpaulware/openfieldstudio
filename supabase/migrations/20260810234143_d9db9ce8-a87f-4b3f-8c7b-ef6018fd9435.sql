ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS comments_require_approval boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.force_pending_comment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  is_owner boolean;
  needs_review boolean;
BEGIN
  SELECT (p.owner_id = auth.uid()), p.comments_require_approval
    INTO is_owner, needs_review
  FROM public.projects p
  WHERE p.id = NEW.project_id;

  IF NOT COALESCE(is_owner, false) THEN
    NEW.status = CASE WHEN COALESCE(needs_review, false)
      THEN 'pending'::comment_status
      ELSE 'approved'::comment_status
    END;
  END IF;

  NEW.geometry = jsonb_build_object(
    'type', 'Point',
    'coordinates', jsonb_build_array(NEW.lng, NEW.lat)
  );
  RETURN NEW;
END;
$function$;

UPDATE public.comments SET status = 'approved'::comment_status WHERE status = 'pending'::comment_status;