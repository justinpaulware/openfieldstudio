ALTER TYPE public.layer_geometry_type ADD VALUE IF NOT EXISTS 'raster';
ALTER TYPE public.layer_source_type ADD VALUE IF NOT EXISTS 'raster_arcgis';

ALTER TABLE public.layers ADD COLUMN IF NOT EXISTS raster_style jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.view_layers ADD COLUMN IF NOT EXISTS raster_style jsonb;