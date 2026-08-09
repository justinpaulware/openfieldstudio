# Phase 2 — Data: layers, uploads, and the map editor

Backend check first: the hosted backend is healthy, security checks come back clean, and your account, profile and first project all landed correctly. Nothing to fix before moving on.

Phase 2 turns a project from a record into a map. You bring data in, see it on a real map, and manage it in a layer panel.

## What you get in this step

**The map editor**
- Project detail gains a real MapLibre map filling the workspace, with a layer panel docked to the left.
- Free OpenFreeMap basemaps with a style switcher (light / dark / positron-style minimal).
- Standard controls: zoom, compass, scale, geolocate, plus a "zoom to data" action.
- Map view state (center/zoom/pitch) saves back to the project so it reopens where you left it.

**Bringing data in — three sources**
- **GeoJSON upload**: drag-and-drop or file picker. Validated on the client (valid JSON, valid FeatureCollection, WGS84 assumed, size cap), then stored as a file in a private datasets bucket. Clear, specific errors when a file is malformed.
- **CSV by URL**: paste a public CSV link, pick the latitude and longitude columns from a preview of the first rows, and it becomes a point layer.
- **ArcGIS REST**: paste a FeatureServer or MapServer layer URL, we query its metadata, show what we found (name, geometry type, feature count), and add it as a layer.

For each source we record name, source type, storage path or source URL, geometry type, bounding box, feature count, and the attribute field list so styling in Phase 3 has fields to work with.

**Layer panel**
- Drag to reorder (draw order matches the list), show/hide, rename inline, duplicate, delete.
- Per-layer opacity slider and zoom-to-layer.
- Feature count and geometry-type badge on each row.
- Sensible default styling per geometry type so a layer always looks presentable the moment it lands.

**Attribute table**
- Open any layer's records in a paged table, sort by column, and click a row to fly to that feature.

## Not in this step

Full cartographic styling (categories, graduated ramps, labels, popups) is Phase 3. Publishing and the public viewer are Phase 4. Comments are Phase 5.

## Technical notes

- New `layers` table: `project_id`, `name`, `source_type` (`geojson_file` | `csv_url` | `arcgis_rest`), `storage_path`, `source_url`, `geometry_type`, `bbox`, `feature_count`, `fields` (jsonb), `visible`, `opacity`, `sort_order`, timestamps. A separate `layer_styles` row per layer is created with defaults now so Phase 3 only edits it.
- RLS on both tables scoped through the parent project's owner, plus a public read path for layers of published projects so Phase 4 needs no schema change. Grants issued alongside every table.
- New private `datasets` storage bucket, with owner-scoped policies keyed on a `{user_id}/{project_id}/` path prefix. The map reads files through short-lived signed URLs.
- CSV and ArcGIS fetches run through server functions, not the browser, so we avoid CORS problems and can validate and normalize responses before they reach the map.
- `maplibre-gl` is installed this phase; the map component is loaded client-side only, since MapLibre needs a browser and this app server-renders.
- File-backed layers only, as agreed — no feature ingestion into Postgres. The `source_type` column is the seam where database-backed layers slot in later without changing the interface.

## Suggested order within the phase

1. Schema, storage bucket, and policies.
2. MapLibre canvas with basemaps and controls in the project view.
3. GeoJSON upload end to end.
4. Layer panel with reorder, visibility, opacity, rename, duplicate, delete.
5. CSV-by-URL and ArcGIS REST connectors.
6. Attribute table.
