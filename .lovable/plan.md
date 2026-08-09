# Fix: CSV layer loads but nothing is visible on the map

## What's actually happening

Your layer imported fine — 65 features, latitude/longitude columns detected correctly. The problem is in how blank rows are handled.

The stored extent for the layer is `[-74.828, 0, 0, 42.089]`. Those zeros are the giveaway: rows in the sheet with an empty Latitude or Longitude cell are being read as the number **0** instead of being skipped, so they get placed at "null island" (0°, 0°) off the coast of Africa.

Two consequences:

1. The layer's extent stretches from West Africa to New York. "Zoom to layer" frames the middle of the Atlantic, where there is nothing to see.
2. At that zoom (and at the default world view), the real Hudson Valley points are a few sub-pixel dots — effectively invisible.

The basemap itself is rendering correctly (tiles, scale bar and controls were all present).

## The fix

1. **Reject empty and non-numeric coordinate cells** in CSV parsing instead of treating them as 0. Also drop exact `0, 0` pairs, which are almost always missing data rather than a real location.
2. **Report skipped rows**: after import, show how many rows had no usable coordinates, so a partially-geocoded sheet is obvious rather than silent.
3. **Recompute the extent from the data that actually loaded**, and store the corrected extent on the layer. Existing broken layers self-heal the next time they load — no need to delete and re-add the layer.
4. **Auto-frame the data on open**: when a project is still at its default world view, fit the map to the combined extent of its layers on first load so the data is on screen without any clicking.
5. **Make points readable**: slightly larger default point radius with a contrasting halo, so a small set of points reads clearly at regional zoom.

## Technical notes

- `guessNumber` in `src/lib/datasets.server.ts` currently uses `Number(value.trim())`, and `Number("")` is `0`. Replace with an empty/NaN guard; also skip rows where both coordinates are exactly 0.
- `loadCsvGeoJSON` returns a skipped-row count alongside the features; `loadCsvLayer` passes it through in the summary and the add-layer dialog surfaces it in the success toast.
- In the map editor, after a layer's data resolves, compare the computed bbox with the stored `layers.bbox` and write back when they differ.
- Add a one-shot effect in the editor that fits the merged bbox of loaded layers when the project's saved zoom is still the default world view.
- Bump the default `circle_radius` used for new layers and the fallback style, and give points a stroke that contrasts against light basemaps.
