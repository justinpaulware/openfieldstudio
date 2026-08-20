# Wrap up symbology, then design Project Views

## Part 1 — Finish Proportional + Heatmap (build now)

The style specs, editors, and map rendering are all done and typecheck is clean. Three loose ends remain:

- **Legend rows.** `ProportionalLegend` (nested circles with value labels) and `HeatmapLegend` (gradient bar) exist in `map-legend.tsx` but nothing renders them. Wire them into the legend entry list next to the existing category/graduated branch, so a proportional layer shows sized circles and a heatmap layer shows a Low → High bar.
- **Sidebar chips.** The layers sidebar still draws a plain single-symbol swatch for these layers. Add a two-circle chip for proportional and a small gradient chip for heatmap so the mode is recognizable at a glance.
- **Verification.** Load a point layer in both modes in the editor and in a published map, confirm legend, sidebar chip, and rendering agree, and that switching back to Single symbol restores the layer unchanged.

Also a small housekeeping item: the published viewer hardcodes `https://openfieldstudio.lovable.app` for canonical/OG URLs, so shared links advertise the lovable.app host instead of openfield.nu. Point it at the custom domain.

## Part 2 — Project Views architecture (discussion, no build yet)

Based on your answers, the shape is:

**One project owns the data. Views own the presentation.**

- Every existing project gets a **Main view** seeded from its current publish settings, layer visibility, order, filters, and extent. Nothing changes for you on day one, and every live `openfield.nu/justinpaulware/st-louis-schools` link keeps working — that 2-segment URL is the Main view.
- Additional views publish at `openfield.nu/justinpaulware/st-louis-schools/existing-conditions`. Each view has its own name, description, slug, Draft/Published/Archived status, published timestamp, and thumbnail.
- A view stores: layer visibility, layer order, per-layer filters, default extent and zoom, sidebar/legend state, and its own map title-card copy and publish metadata.
- A view never stores data. Datasets, layers, source connections, and comments stay project-level, so refreshing an ArcGIS source or replacing a file updates every view at once.
- **Style overrides are per view.** A layer's style lives on the project as the default; a view can override symbology, labels, or popups for that layer. Overridden layers show a clear "Overridden in this view" marker with a one-click Reset to project style, so it never becomes invisible state.
- Comments stay project-wide, with a per-view toggle for whether the comment layer is shown and accepting input on that published view.

**Where you work with them**

- A **view selector** sits at the top of the Map Editor. Whatever you change — visibility, order, filters, extent, style overrides — applies to the active view. Editing data (add layer, refresh source, rename layer) is understood as project-level and shows a brief "affects all views" note the first few times.
- A **Views tab** joins Map Editor / Publish / Comments, listing views as cards with thumbnail, status, public URL, and Duplicate / Rename / Delete. Duplicating a view is the cheap way to fork a presentation.
- The **Publish tab** becomes per-view: pick a view, set its slug and metadata, publish it. A summary at the top lists every published view and its URL.

**Sequencing** (each step ships on its own)

1. Data model + Main view backfill, with the editor still writing to the Main view. Nothing visible changes.
2. Views tab, view creation, duplication, and the editor's view selector.
3. Per-view publishing, 3-segment public URLs, and the Publish tab rework.
4. Per-view style overrides with reset affordances.

A future published-map **view switcher** (a dropdown letting a visitor hop between Existing Conditions / Proposed / Feedback) is **on the long-term wishlist**, not part of this phase, but the URL and data shape above are designed so it can be added later without rework.

## Technical notes

- Part 1 touches only `src/components/map/map-legend.tsx`, `src/components/map/layer-panel.tsx`, and the `SITE` constant in `src/routes/$username.$mapSlug.tsx`.
- Views schema (Part 2, not built yet): `project_views` (id, project_id, name, description, slug, status, is_default, view_state jsonb, publish metadata, published_at) plus `view_layer_settings` (view_id, layer_id, visible, sort_order, filter_config jsonb, style_overrides jsonb — null means inherit the project style). Unique published slug per project; the default view keeps `projects.published_slug` as its public path.
- Backfill migration creates one `is_default` view per project and copies current `layers.visible` / `sort_order` / `filter_config` and the project's publish fields into it.
- Public routing gains `/$username/$mapSlug/$viewSlug` alongside the existing 2-segment route, both served by `loadPublishedMap` with an optional view slug that resolves to the default when absent.
- The map editor, legend, attribute table, and published viewer all read layer visibility/order/filter/style through one resolver (`view settings ?? project defaults`) so no renderer needs to know views exist.
