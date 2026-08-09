# Basemap switcher on the map, and true layer stacking order

## 1. Basemap switcher moves onto the map

- The basemap dropdown leaves the editor toolbar and becomes a small control on the map itself (bottom-right, above the scale bar), styled to match the map controls: a compact "Basemap" button that opens a list of Positron, Bright, Dark, Liberty.
- It lives inside the map component, so the future published/embedded map gets the same control for viewers by default. In the viewer it will be a local preference only — it never writes anything.
- In the editor, picking a style still sets the project's default starting basemap (same save behaviour as today), so what you choose is what a visitor sees first.
- The toolbar keeps Zoom to all layers and Save view.

## 2. Map draw order follows the sidebar exactly

Confirmed cause: the sidebar renders folders (and their layers) first and loose top-level layers after, while the map is fed the raw layer list in database sort order. Those two orders diverge as soon as folders are in play, so reordering in the sidebar can leave the map stack unchanged.

Fix: the sidebar's visual, folder-aware order becomes the single source of truth for the map.

- A shared helper walks the same tree the sidebar draws (root folders → their subfolders and layers → top-level layers) and returns a flat list of layer ids top-to-bottom.
- The map renders in that exact order: the top row in the sidebar draws above everything, the bottom row draws underneath.
- Applies immediately after every drag, whether reordering, moving into a folder, or moving a folder itself.

## Technical notes

- `src/components/map/layer-panel.tsx`: export a pure `flattenLayerOrder(layers, folders)` helper and use it for the panel's own rendering so the panel and the map can never drift.
- `src/routes/_authenticated/projects.$projectId_.map.tsx`: order `renderLayers` by `flattenLayerOrder(...)` instead of the query order; remove the basemap `Select` from the header, pass `basemap` plus an `onBasemapChange` callback to `MapCanvas` (callback still calls `saveView.mutate(value)`).
- `src/components/map/map-canvas.tsx`: add an in-map basemap control (Popover/Radio list over `BASEMAPS`) positioned over the canvas; internal state falls back to the `basemap` prop, and `onBasemapChange` is optional so a read-only viewer can switch styles without persisting.
- `syncLayers` already adds layers in reverse, so no change to the draw logic — only the incoming array order changes.
