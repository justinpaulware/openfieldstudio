# Match map editor overlay padding to the published viewer

In the published viewer, the title card, legend, popups and comment panel all sit 10px from the map edge, matching the zoom, basemap and scale controls.

In the map editor the popup column and basemap/zoom controls already use 10px, but the title + legend stack in the top-left is still inset 16px, so it looks misaligned against everything else.

## Change

- Map editor title/legend overlay: change its offset from 16px to 10px so it lines up with the popup card, basemap button, scale bar and zoom controls.

## Technical detail

`src/routes/_authenticated/projects.$projectSlug.map.tsx`: the overlay wrapper at the map's top-left uses `left-4 top-4`; change to `left-2.5 top-2.5` (matching `map-canvas.tsx`, which already uses `2.5` for the popup column and centered slot).

No other spacing or behavior changes.
