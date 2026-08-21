-- Project Views & Multi-Publish (Tab 10)
-- Separates presentation (views) from data (projects/layers).

-- 1. project_views: one row per view. "Main" (is_main=true) mirrors the project.
CREATE TABLE public.project_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL DEFAULT 'main',
  description text,
  is_main boolean NOT NULL DEFAULT false,
  status public.project_status NOT NULL DEFAULT 'draft',
  map_center double precision[] NOT NULL DEFAULT ARRAY[0, 20]::double precision[],
  map_zoom double precision NOT NULL DEFAULT 1.6,
  map_pitch double precision NOT NULL DEFAULT 0,
  map_bearing double precision NOT NULL DEFAULT 0,
  basemap text NOT NULL DEFAULT 'positron',
  show_legend boolean NOT NULL DEFAULT true,
  scale_units text NOT NULL DEFAULT 'imperial',
  published_at timestamptz,
  embed_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, slug)
);

CREATE INDEX project_views_project_id_idx ON public.project_views(project_id);
CREATE UNIQUE INDEX project_views_one_main_per_project
  ON public.project_views(project_id) WHERE is_main;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_views TO authenticated;
GRANT SELECT ON public.project_views TO anon;
GRANT ALL ON public.project_views TO service_role;

ALTER TABLE public.project_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage views in their projects"
  ON public.project_views FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projects p
    WHERE p.id = project_views.project_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p
    WHERE p.id = project_views.project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Anyone can view published views"
  ON public.project_views FOR SELECT TO anon, authenticated
  USING (status = 'published');

CREATE TRIGGER project_views_set_updated_at
  BEFORE UPDATE ON public.project_views
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. view_layers: one row per layer per view (per-view layer set + presentation + style override)
CREATE TABLE public.view_layers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  view_id uuid NOT NULL REFERENCES public.project_views(id) ON DELETE CASCADE,
  layer_id uuid NOT NULL REFERENCES public.layers(id) ON DELETE CASCADE,
  visible boolean NOT NULL DEFAULT true,
  opacity double precision NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  filter_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  style_override jsonb,
  UNIQUE (view_id, layer_id)
);

CREATE INDEX view_layers_view_id_idx ON public.view_layers(view_id);
CREATE INDEX view_layers_layer_id_idx ON public.view_layers(layer_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.view_layers TO authenticated;
GRANT SELECT ON public.view_layers TO anon;
GRANT ALL ON public.view_layers TO service_role;

ALTER TABLE public.view_layers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage view layers in their projects"
  ON public.view_layers FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_views pv
    JOIN public.projects p ON p.id = pv.project_id
    WHERE pv.id = view_layers.view_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_views pv
    JOIN public.projects p ON p.id = pv.project_id
    WHERE pv.id = view_layers.view_id AND p.owner_id = auth.uid()));

CREATE POLICY "Anyone can view layers of published views"
  ON public.view_layers FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_views pv
    WHERE pv.id = view_layers.view_id AND pv.status = 'published'));

-- 3. Widen layers / layer_styles public read: any published view in the project grants public access,
--    so a named view can be published independently of the Main view.
DROP POLICY IF EXISTS "Anyone can view layers of published projects" ON public.layers;
CREATE POLICY "Anyone can view layers of projects with a published view"
  ON public.layers FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.project_views pv
    WHERE pv.project_id = layers.project_id AND pv.status = 'published'));

DROP POLICY IF EXISTS "Anyone can view styles of published projects" ON public.layer_styles;
CREATE POLICY "Anyone can view styles of projects with a published view"
  ON public.layer_styles FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.layers l
    JOIN public.project_views pv ON pv.project_id = l.project_id
    WHERE l.id = layer_styles.layer_id AND pv.status = 'published'));

-- 4. Seed one Main view per existing project from its current presentation + publish state.
INSERT INTO public.project_views (
  project_id, name, slug, description, is_main, status,
  map_center, map_zoom, map_pitch, map_bearing, basemap, show_legend, scale_units,
  published_at, embed_config, thumbnail_url, sort_order
)
SELECT
  p.id, 'Main', 'main', NULL, true, p.status,
  p.map_center, p.map_zoom, p.map_pitch, p.map_bearing, p.basemap, p.show_legend, p.scale_units,
  p.published_at, p.embed_config, p.thumbnail_url, 0
FROM public.projects p;

-- 5. Seed view_layers for every Main view from each project's current layer presentation.
INSERT INTO public.view_layers (view_id, layer_id, visible, opacity, sort_order, filter_config)
SELECT pv.id, l.id, l.visible, l.opacity, l.sort_order, l.filter_config
FROM public.project_views pv
JOIN public.layers l ON l.project_id = pv.project_id
WHERE pv.is_main;

-- 6. Auto-create a Main view when a project is created (keeps app code consistent).
CREATE OR REPLACE FUNCTION public.create_main_view_for_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_views (
    project_id, name, slug, is_main, status,
    map_center, map_zoom, map_pitch, map_bearing, basemap, show_legend, scale_units
  )
  VALUES (
    NEW.id, 'Main', 'main', true, NEW.status,
    NEW.map_center, NEW.map_zoom, NEW.map_pitch, NEW.map_bearing, NEW.basemap, NEW.show_legend, NEW.scale_units
  )
  ON CONFLICT (project_id, slug) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_main_view_for_project() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER projects_create_main_view
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.create_main_view_for_project();

-- 7. Auto-add new layers to the project's Main view (named views opt in explicitly).
CREATE OR REPLACE FUNCTION public.add_layer_to_main_view()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.view_layers (view_id, layer_id, visible, opacity, sort_order, filter_config)
  SELECT pv.id, NEW.id, NEW.visible, NEW.opacity, NEW.sort_order, NEW.filter_config
  FROM public.project_views pv
  WHERE pv.project_id = NEW.project_id AND pv.is_main
  ON CONFLICT (view_id, layer_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.add_layer_to_main_view() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER layers_add_to_main_view
  AFTER INSERT ON public.layers
  FOR EACH ROW EXECUTE FUNCTION public.add_layer_to_main_view();
