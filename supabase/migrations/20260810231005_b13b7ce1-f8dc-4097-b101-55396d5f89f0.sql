CREATE TABLE public.project_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.project_folders(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'New folder',
  sort_order integer NOT NULL DEFAULT 0,
  collapsed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_folders TO authenticated;
GRANT ALL ON public.project_folders TO service_role;

ALTER TABLE public.project_folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their project folders"
ON public.project_folders FOR ALL TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE TRIGGER project_folders_set_updated_at
BEFORE UPDATE ON public.project_folders
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.projects
  ADD COLUMN folder_id uuid REFERENCES public.project_folders(id) ON DELETE SET NULL,
  ADD COLUMN sort_order integer NOT NULL DEFAULT 0;