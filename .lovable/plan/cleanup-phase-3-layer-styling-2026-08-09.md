# Cleanup + Phase 3: Layer Styling

## Part A — the two preview comments

1. **Bold "Map Editor" tab** (thread f7de427f) — make the Map Editor tab visually the primary/default workspace in the project header nav, with the other tabs at normal weight.
2. **Collapsed attribution band** (thread e085c43e) — the OpenFreeMap attribution in the bottom-right starts collapsed; clicking the "i" expands it. Keeps the map view clean while attribution stays one click away.

## Part B — quick health review

A short pass before new feature work:

- Confirm every route has a distinct title/description (project routes already do).
- Run the database security/lint check and confirm row-level policies on projects, layers, layer_folders, layer_styles are intact.
- Smoke-test the editor end to end in a headless browser: load project, toggle visibility, reorder a layer and confirm map stacking follows, rename inline, drag a folder, refresh a CSV layer, zoom to all layers, switch basemap, toggle scale units.
- Fix anything that surfaces; report anything that looks like a bigger issue instead of silently patching.

Phase 1 (auth, projects, dashboard) and Phase 2 (map editor, GeoJSON/CSV/ArcGIS ingestion, folders, refresh, ordering, basemaps, scale) are functionally complete, so the review is a verification pass rather than a rebuild.

## Part C — Phase 3: single-symbol styling

Scope for this phase: **single symbol styling only**, plus an auto legend. Data-driven styling, labels and popups come later.

### Where it lives

A **Style panel inside the Map Editor**, on the right side, opened when a layer is selected (or via "Style" in the layer's menu). Edits preview live on the map with no save button — changes debounce-save to the layer's style record. The Styling tab in the project header redirects into the Map Editor with the panel open, so there is one place to style.

### Controls, by geometry type

- **Points** — fill colour, radius, opacity, stroke colour, stroke width, plus a small set of marker shapes (circle, square, triangle, ring).
- **Lines** — colour, width, opacity, dash pattern (solid / dashed / dotted), line cap.
- **Polygons** — fill colour, fill opacity, outline colour, outline width, dashed outline option.

Shared: a curated colour palette with a hex input, and a "reset to default" action.

### Legend

An auto-generated legend derived from the current symbology, shown as a collapsible card in the map view. Layer symbols in the sidebar already mirror style — they stay in sync automatically. Toggle for showing/hiding the legend, saved with the project.

## Technical notes

- No migration needed: `layer_styles` already has `fill_color`, `stroke_color`, `stroke_width`, `circle_radius`, `fill_opacity`, `style_mode`, and jsonb `style_config` / `label_config` / `popup_config`. Marker shape, dash pattern and line cap go in `style_config`; `style_mode` stays `"single"` this phase so categorized/graduated can slot in later.
- One new `src/components/map/style-panel.tsx`; `map-canvas.tsx` paint-property mapping extended to read the extra `style_config` keys; `layer-panel.tsx` `LayerSymbol` extended for shapes and dashes.
- Legend as `src/components/map/map-legend.tsx`, fed from the same flattened layer order used for map stacking so legend order matches the sidebar.
- Style writes go through a debounced mutation with optimistic cache update, so dragging a colour slider does not spam the database.

## Out of scope this phase

Categorized/graduated symbology, labels, popup builder, per-layer zoom ranges, publishing. These follow in Phase 4.
