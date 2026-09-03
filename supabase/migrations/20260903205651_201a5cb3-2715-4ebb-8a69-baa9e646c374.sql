ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS geometry_type text NOT NULL DEFAULT 'Point';

UPDATE public.comments
   SET geometry_type = COALESCE(NULLIF(geometry->>'type', ''), 'Point');

CREATE OR REPLACE FUNCTION public.force_pending_comment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  is_owner boolean;
  needs_review boolean;
  incoming_type text;
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

  incoming_type := NULLIF(NEW.geometry->>'type', '');

  IF incoming_type IS NULL OR incoming_type = 'Point' THEN
    NEW.geometry = jsonb_build_object(
      'type', 'Point',
      'coordinates', jsonb_build_array(NEW.lng, NEW.lat)
    );
    NEW.geometry_type = 'Point';
  ELSE
    NEW.geometry_type = incoming_type;
  END IF;

  RETURN NEW;
END;
$function$;