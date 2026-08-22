UPDATE public.project_views pv
SET status = p.status, published_at = p.published_at
FROM public.projects p
WHERE pv.project_id = p.id
  AND pv.is_main
  AND (pv.status IS DISTINCT FROM p.status OR pv.published_at IS DISTINCT FROM p.published_at);

CREATE OR REPLACE FUNCTION public.sync_main_view_publish_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.project_views
     SET status = NEW.status,
         published_at = NEW.published_at
   WHERE project_id = NEW.id
     AND is_main
     AND (status IS DISTINCT FROM NEW.status OR published_at IS DISTINCT FROM NEW.published_at);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_sync_main_view_publish ON public.projects;
CREATE TRIGGER projects_sync_main_view_publish
AFTER UPDATE OF status, published_at ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.sync_main_view_publish_state();