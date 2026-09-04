# Raster Layers — Phase 1

Open Field currently assumes every layer holds vector features. This adds Raster Layers as a second, first-class layer kind, starting with ArcGIS raster MapServer services.

## What you'll be able to do

- Paste an ArcGIS MapServer URL that serves imagery instead of features, and Open Field recognises it as a raster automatically — no extra choice to make.
- See it in the layers list alongside your vector layers, marked as a raster, with the same show/hide, rename, reorder, folder and delete behaviour.
- Open the layer editor and get a raster-specific panel instead of the vector symbology tools:
  - Opacity (0–100%)
  - Brightness, Contrast, Saturation
  - Grayscale toggle
  - A Data section showing source type, service URL, and any description/extent the service reports
- See the raster's name and visibility toggle in the legend (no colour ramp yet).
- Publish views containing rasters — order, visibility and appearance carry through to the public map and to per-view settings.

Blend modes are deliberately out of this build; the map engine can't blend one layer against another without a second stacked canvas, so we'll revisit that separately.

## What's not in this build

Raster legends with colour ramps and value ranges, colour ramp overrides, NoData handling, COG/WMTS/XYZ sources, and time sliders — Phases 3–6 in your document.

## Technical notes

**Data model.** Add `raster_arcgis` to the `layer_source_type` enum and a `raster` member to `layer_geometry_type` (keeps one layers table, one ordering scheme, one view-override path). Add a `raster_style jsonb` column on `layers` holding `{ opacity, brightness, contrast, saturation, grayscale }`, mirrored into `view_layers` so views can override appearance the same way they override vector styles.

**Detection.** `describeArcgis` in `src/lib/datasets.server.ts` already reads service metadata. Extend it: when a sublayer/service exposes no `geometryType` and is not a Group Layer, classify it as raster and return `kind: "raster"` rather than throwing. `add-layer-dialog.tsx` creates a raster layer row (no fetch of features, no `feature_count`).

**Rendering.** `map-canvas.tsx` gains a raster branch in the layer loop: a `raster` source of type `raster` using the MapServer `export` endpoint as a tile template, plus a `raster` layer with `raster-opacity`, `raster-brightness-min/max`, `raster-contrast`, `raster-saturation`, and `raster-hue-rotate`. Grayscale maps to `raster-saturation: -1`. Ordering uses the same insert-before sequence as vector layers, so rasters interleave correctly.

**Data loading.** `use-layer-data.ts` returns `null` for raster layers without a network call; every consumer that assumes a `FeatureCollection` (attribute table, filters, labels, popups, symbology, classification) is gated so raster layers never reach it.

**Editor UI.** New `src/components/map/style-raster.tsx` with the appearance sliders. `layer-editor.tsx` branches on layer kind: rasters show Data + Raster Appearance only — no Filter, Symbology, Labels or Popups sections.

**Public viewer.** `publish.server.ts` includes raster rows and their style in the published payload; `public-map.tsx` passes them through to the same shared `MapCanvas` raster branch.
