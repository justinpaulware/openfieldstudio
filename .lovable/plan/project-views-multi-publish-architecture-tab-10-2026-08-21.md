# Project Views & Multi-Publish Architecture (Tab 10)

## Goal

Separate **Project = data** from **View = presentation**. One project holds datasets, layers, base styles, and comments. Many views each hold their own layer set, visibility, order, filters, extent, basemap, legend state, and style overrides — and each publishes to its own URL. No data duplication.

## Decisions (confirmed)

- **Style scope:** Per-view overrides. A view may override a layer's symbology/labels/popups; falls back to the project's `layer_styles` (the default) when not overridden. Editing in the **Main view** writes to `layer_styles` (it *is* the default); editing in a **named view** writes to that view's `style_override`. Named views get a "Reset to project default" action.
- **Layer membership:** Per-view layer set. Each view picks which layers it includes. New layers auto-join the Main view; named views are seeded with all current layers at creation, and new layers added later are opted in per view.
- **Migration:** Every existing project gets one auto-created **Main view** seeded from its current presentation + publish state. Existing 2-segment URLs keep working unchanged.

## Data model

```
project_views                         (one row per view; "Main" is is_main=true)
  id, project_id (fk projects, cascade),
  name, slug (unique per project), description,
  is_main bool default false,
  -- presentation (moved off projects for the active view)
  map_center[], map_zoom, map_pitch, map_bearing,
  basemap, show_legend, scale_units,
  -- publishing (per view; Main view mirrors project)
  status project_status default 'draft',
  published_slug, published_at, embed_config jsonb, thumbnail_url,
  sort_order, created_at, updated_at
  unique(project_id, slug); unique (project_id) WHERE is_main

view_layers                            (one row per layer per view)
  id, view_id (fk project_views, cascade), layer_id (fk layers, cascade),
  visible bool, opacity, sort_order, filter_config jsonb,
  style_override jsonb  -- null = use project default layer_styles
  unique(view_id, layer_id)
```

**What stays project-level:** `layers` (source, geometry, fields, bbox, feature_count, folder_id), `layer_styles` (project default symbology/labels/popups), `layer_folders`, `comments`, `projects` metadata (title, description, author, credits, data_sources, tags, owner, internal slug, folder, comments_*).

**Publishing model:** Each view is independently publishable. The Main view's publication is the project's publication — its `status`/`published_slug`/`published_at` stay mirrored onto `projects.*` (one sync point in the publish server fn) so the dashboard/gallery keep working unchanged. Named views carry their own publish state on `project_views`.

**Comments:** stay project-level (pinned to geography, visible across all views), matching the spec. View-scoped comments are a future option.

## Public routing

```
/username/projectSlug            -> Main view (2 segments, unchanged)
/username/projectSlug/viewSlug   -> named view (3 segments, NEW route)
```
- `src/routes/$username.$mapSlug.tsx` resolves the Main view (status checks view + project).
- `src/routes/$username.$mapSlug.$viewSlug.tsx` (new) resolves a named view by `(project, view.slug)`; only loads if `view.status = 'published'`.

## Editor routing

- `src/routes/_authenticated/projects.$projectSlug.map.tsx` gains a `?view=$viewSlug` query param (default = Main). No new route files.
- New **Views tab**: `src/routes/_authenticated/projects.$projectSlug.views.tsx` — list, create, duplicate, rename, delete, reorder, publish/unpublish per view.

## Implementation steps (build & verify each before next)

### Step 1 — Database migration
- Create `project_views` + `view_layers` with GRANTs + RLS (owner write via project ownership; public SELECT when `status='published'`).
- Seed one Main view per project from `projects.map_*`, `basemap`, `show_legend`, `scale_units`, `status`, `published_slug`, `published_at`, `embed_config`, `thumbnail_url`.
- Seed `view_layers` for every Main view from each project's `layers` (visible, opacity, sort_order, filter_config).
- Leave `projects.*` columns in place (Main view mirrors them).
- **Verify:** counts match (one Main view per project; one view_layers row per layer per Main view).

### Step 2 — Backend query helpers
- Add view-scoped loaders/server fns: `getProjectViews(projectId)`, `getViewForEditor(projectSlug, viewSlug)`, `createView`, `duplicateView`, `updateView`, `deleteView`, `publishView`, `unpublishView`.
- `getViewForEditor` returns the active view's `view_layers` joined to `layers` + `layer_styles` (base) + `style_override` merged.
- Public map loader returns view presentation + merged view_layers for the viewer.

### Step 3 — Map Editor refactor (view-scoped)
- The editor loads the active view (`?view=` or Main). All presentation reads/writes target `project_views` (extent, basemap, legend) and `view_layers` (visibility, order, opacity, filter).
- **Layer panel** shows only the view's `view_layers` set. Reorder/visibility/opacity write to `view_layers`. "Add layer to this view" affordance for named views.
- **Layer editor (Symbology/Labels/Popups):** in the Main view, edits persist to `layer_styles` (default). In a named view, edits persist to `view_layers.style_override`; show a "Reset to project default" button that nulls the override.
- **Filter:** writes to `view_layers.filter_config` (not `layers.filter_config`).
- **Attribute table / extent / basemap / legend toggle:** all read the active view.
- Add a **view selector** (dropdown in the editor header) to switch the active view; persists `?view=`.

### Step 4 — Views tab
- CRUD UI: list views with name, slug, status, thumbnail; create (name + optional description + "include all layers" default); duplicate (clones view_layers + overrides); rename; delete (Main view cannot be deleted); reorder.
- Per-view publish controls (publish/unpublish, set published_slug, embed builder) — mirrors the existing Publish tab logic but scoped to the view.
- The existing **Publish tab** becomes the Main view's publish surface (unchanged behavior, now explicitly "Main view").

### Step 5 — Public viewer
- 2-segment route: resolve Main view; load view presentation + view_layers.
- 3-segment route (new): resolve named view; gate on `status='published'`; load its presentation + view_layers + merged styles.
- Thumbnails, title card, legend, comments all render from the view's state.

### Step 6 — Verification
- `tsgo --noEmit` clean.
- Existing published maps resolve unchanged at 2-segment URLs (Main view).
- Create a named view on St. Louis Schools, override a layer's symbology + filter + extent, publish it, open the 3-segment URL, confirm it differs from the Main view.
- Confirm Main view edits flow to `layer_styles`; named view edits flow to `style_override`; "Reset to default" works.

## Notes / out of scope (future)
- Shared Dataset Library (dataset referenced by many projects) — view architecture doesn't block it.
- Published-map view switcher (dropdown on the public map to flip between views) — explicitly deferred per spec.
- View-scoped comments.
- Deprecation of the mirrored `projects.*` publish columns (keep for now).
