# Move map title and legend to the top left

The title card and legend currently sit on the right side of the map, stacked below the navigation/basemap controls. Move them to the top-left corner instead.

## Change

- In the map editor overlay, reposition the stack that holds the title card and legend from the right edge to the left edge, at the top of the map (small inset from the top and left).
- Align the cards to the left instead of the right so they read cleanly against the map edge.
- Keep everything else the same: same white "printed map" styling, same collapse behavior on the legend, same visibility rules.
- The scale bar stays bottom-left; the title/legend stack sits high enough to not collide with it.

## Technical detail

Single edit in `src/routes/_authenticated/projects.$projectId.map.tsx` (around line 582): change the overlay container classes from `absolute right-2.5 top-[190px] ... items-end` to a left-anchored equivalent (`absolute left-4 top-4 ... items-start`).
