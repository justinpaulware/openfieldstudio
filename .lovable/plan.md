# Layers sidebar: folders, refresh, and editable sources

## What changes for you

**Sidebar header.** The "Layers" title stays on the left. On the right, replacing the layer count, two icon buttons: **Add data** (plus) and **New folder** (folder+). The count moves next to the title as a small muted number. The old "Add data" button leaves the map toolbar.

**Folders.** Create folders in the layers list, rename them inline, nest one level of subfolders, collapse/expand, and drag layers in and out of them. Deleting a folder moves its layers back to the top level rather than deleting data. Folders are for organisation in the editor and will carry through to the published legend later.

**Per-layer "..." menu gains two items:**

- **Refresh from source** — re-fetches the CSV, ArcGIS service, or stored GeoJSON, then rewrites feature count, field list, and extent from the fresh data. Styling, name, folder, opacity, and visibility are untouched. This is the fix for the stale extent on your existing CSV layer: refresh it once and "zoom to layer" will frame the Hudson Valley correctly. A relative timestamp ("updated 3m ago") shows under the layer name.
- **Data source…** — a dialog showing what backs the layer:
  - CSV: editable URL plus latitude/longitude column pickers (re-fetches headers when the URL changes).
  - ArcGIS: editable service layer URL.
  - GeoJSON file: file name and a **Replace file** drop zone that swaps the stored file in place.
  
  Saving runs the same refresh path, so extent and fields stay in sync with whatever the new source returns. Layer identity and styling are preserved in every case.

Refresh and source edits both show a spinner on the layer row, and a clear error on the row if the source is unreachable or the chosen coordinate columns no longer exist.

## Technical notes

Database migration:

- New `public.layer_folders` (project_id, name, parent_id self-reference, sort_order, timestamps) with owner-scoped RLS mirroring `layers`, published-project read access for `anon`, GRANTs for `authenticated`/`service_role`, and the `set_updated_at` trigger.
- `layers`: add `folder_id uuid references layer_folders(id) on delete set null` and `last_refreshed_at timestamptz`.

Server functions (`src/lib/datasets.functions.ts`, existing auth middleware): reuse `loadCsvLayer` / `loadArcgisLayer` summaries. Refresh is orchestrated client-side — fetch summary, then update the `layers` row (feature_count, bbox, fields, geometry_type, last_refreshed_at). GeoJSON-file refresh re-reads the stored object from the `datasets` bucket and recomputes locally with `src/lib/geo.ts`. `datasets.functions.ts` stays a thin wrapper file.

Components:

- `src/components/map/layer-panel.tsx` — header actions, folder tree rendering, drag-and-drop across folders, new menu items, relative timestamp.
- New `src/components/map/layer-source-dialog.tsx` — per-source-type edit form and replace-file drop zone.
- New `src/components/map/use-layer-refresh.ts` — shared mutation used by both refresh and source-edit save.
- `src/routes/_authenticated/projects.$projectId_.map.tsx` — remove toolbar Add data button, wire folder CRUD and refresh mutations, query folders alongside layers.
- `src/components/map/add-layer-dialog.tsx` — accepts an optional target folder so "Add data" from inside a folder lands there.
