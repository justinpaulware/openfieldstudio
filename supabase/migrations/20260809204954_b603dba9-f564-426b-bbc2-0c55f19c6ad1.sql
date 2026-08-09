CREATE TABLE public.layer_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.layer_folders(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'New folder',
  sort_order integer NOT NULL DEFAULT 0,
  collapsed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.layer_folders TO authenticated;
GRANT SELECT ON public.layer_folders TO anon;
GRANT ALL ON public.layer_folders TO service_role;

ALTER TABLE public.layer_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage folders in their projects"
ON public.layer_folders FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = layer_folders.project_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = layer_folders.project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Anyone can view folders of published projects"
ON public.layer_folders FOR SELECT TO anon, authenticated
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = layer_folders.project_id AND p.status = 'published'::project_status));

CREATE TRIGGER update_layer_folders_updated_at
BEFORE UPDATE ON public.layer_folders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX layer_folders_project_id_idx ON public.layer_folders(project_id);

ALTER TABLE public.layers
  ADD COLUMN folder_id uuid REFERENCES public.layer_folders(id) ON DELETE SET NULL,
  ADD COLUMN last_refreshed_at timestamptz;