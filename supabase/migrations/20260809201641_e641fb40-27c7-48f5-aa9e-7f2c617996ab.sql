ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS map_center double precision[] NOT NULL DEFAULT ARRAY[0, 20]::double precision[],
  ADD COLUMN IF NOT EXISTS map_zoom double precision NOT NULL DEFAULT 1.6,
  ADD COLUMN IF NOT EXISTS map_pitch double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS map_bearing double precision NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS basemap text NOT NULL DEFAULT 'positron';

DO $$ BEGIN
  CREATE TYPE public.layer_source_type AS ENUM ('geojson_file', 'csv_url', 'arcgis_rest');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.layer_geometry_type AS ENUM ('point', 'line', 'polygon', 'mixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  source_type public.layer_source_type NOT NULL,
  storage_path text,
  source_url text,
  geometry_type public.layer_geometry_type NOT NULL DEFAULT 'point',
  bbox double precision[],
  feature_count integer NOT NULL DEFAULT 0,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  visible boolean NOT NULL DEFAULT true,
  opacity double precision NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX layers_project_id_idx ON public.layers(project_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.layers TO authenticated;
GRANT SELECT ON public.layers TO anon;
GRANT ALL ON public.layers TO service_role;

ALTER TABLE public.layers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage layers in their projects"
  ON public.layers FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = layers.project_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = layers.project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Anyone can view layers of published projects"
  ON public.layers FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = layers.project_id AND p.status = 'published'));

CREATE TABLE public.layer_styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  layer_id uuid NOT NULL UNIQUE REFERENCES public.layers(id) ON DELETE CASCADE,
  fill_color text NOT NULL DEFAULT '#f2c14e',
  stroke_color text NOT NULL DEFAULT '#1f2937',
  stroke_width double precision NOT NULL DEFAULT 1,
  circle_radius double precision NOT NULL DEFAULT 5,
  fill_opacity double precision NOT NULL DEFAULT 0.6,
  style_mode text NOT NULL DEFAULT 'simple',
  style_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  label_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  popup_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX layer_styles_layer_id_idx ON public.layer_styles(layer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.layer_styles TO authenticated;
GRANT SELECT ON public.layer_styles TO anon;
GRANT ALL ON public.layer_styles TO service_role;

ALTER TABLE public.layer_styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage styles in their projects"
  ON public.layer_styles FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.layers l JOIN public.projects p ON p.id = l.project_id
    WHERE l.id = layer_styles.layer_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.layers l JOIN public.projects p ON p.id = l.project_id
    WHERE l.id = layer_styles.layer_id AND p.owner_id = auth.uid()));

CREATE POLICY "Anyone can view styles of published projects"
  ON public.layer_styles FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.layers l JOIN public.projects p ON p.id = l.project_id
    WHERE l.id = layer_styles.layer_id AND p.status = 'published'));

CREATE TRIGGER update_layers_updated_at BEFORE UPDATE ON public.layers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER update_layer_styles_updated_at BEFORE UPDATE ON public.layer_styles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "Owners read their dataset files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'datasets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners upload their dataset files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'datasets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners update their dataset files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'datasets' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners delete their dataset files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'datasets' AND (storage.foldername(name))[1] = auth.uid()::text);