# Zoom to layer respects filters

Today "Zoom to layer" in the layer menu always uses the layer's stored full extent, so it zooms out to cover features that the filter is currently hiding.

## Change

- When a layer has an active filter, zoom to the extent of the features that are actually shown.
- When no filter is active (or the filtered data isn't loaded yet), keep using the stored full extent — same behaviour as today.
- Raster layers keep using their stored extent, since they have no features to filter.
- If a filter hides everything, show a short message ("No visible features to zoom to.") instead of moving the map.

## Technical notes

In `src/routes/_authenticated/projects.$projectSlug.map.tsx`:

- `filteredById` already holds the filtered `FeatureCollection` per layer.
- Change `onZoomTo` to call a new `zoomToLayer(layer)` that, when `isFilterActive(filterFor(layer))` and `filteredById[layer.id]` exists, computes the bbox with `computeBbox` from `@/lib/geo`; otherwise falls back to `layer.bbox`. Empty filtered result → toast, no camera move.
- `zoomTo(bbox)` and `fitBbox` are unchanged.

No database or styling changes.
