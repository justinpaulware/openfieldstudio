# Match overlay padding to the map controls (10px)

The map's own controls (zoom, basemap button, scale bar) sit 10px off the edge — MapLibre's default. The title card, legend, popups, and comment panel sit at 16px. Everything moves to 10px so the whole perimeter is consistent.

## Changes

- Title card + legend stack (public viewer): `left-4 top-4` becomes `left-2.5 top-2.5`, and the max-height allowance updates from `calc(100%-32px)` to `calc(100%-20px)`.
- Popup / comment panel column (map canvas, right side): `right-4 top-4` becomes `right-2.5 top-2.5`, with `max-w` allowance updated to match.
- Centered top notice bar: `top-3` becomes `top-2.5`.
- "Loading data" chip: `left-4` becomes `left-2.5`.

No change to the zoom controls, basemap selector, scale bar, or the "Made with Open Field" credit, which is already aligned to the scale bar.

## Files

- `src/components/public/public-map.tsx` (lines 315, 349)
- `src/components/map/map-canvas.tsx` (lines 572, 668)

## Verification

Load the published viewer and confirm top-left, top-right, and bottom controls all share the same edge gap.
