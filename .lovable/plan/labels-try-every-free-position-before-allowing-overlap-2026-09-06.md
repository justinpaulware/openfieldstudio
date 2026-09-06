# Labels: try every free position before allowing overlap

## What's wrong today

With placement set to "Around (auto-fit)" and "Allow overlap" on, the map is told to skip collision checking entirely. Auto-fit only works while collision checking is on, so the labels never try the left or right side — they just stack on top of each other, exactly as in the screenshot.

## The new behaviour

"Allow overlap" becomes a last resort instead of an override:

1. Labels are always placed with collision checking on, so auto-fit can shift a label to a free side (left, right, and — as a second pass — above and below).
2. Only a label that still has nowhere free to go is drawn on top of its neighbour, and only when "Allow overlap" is on.
3. With "Allow overlap" off, nothing changes: crowded labels are simply hidden, as now.

Fixed placements (above, below, left, right, center) keep their pinned position; for those, "Allow overlap" still means "draw it even if it collides", since there is no alternative position to try.

## Technical notes

In `src/components/map/map-canvas.tsx` label setup:

- Never set `text-allow-overlap` / `text-ignore-placement` / `icon-allow-overlap` / `icon-ignore-placement` to `true` on the primary label layer when placement is `around`. Collision must stay on for `text-variable-anchor` to do its job.
- Widen the variable anchor list for `around` from `["left","right"]` to `["left","right","top","bottom"]` so horizontal sides are preferred first and vertical sides act as a fallback. `text-radial-offset` and `text-justify: auto` stay as they are.
- Add a companion "overflow" symbol layer (`<layerId>-label-overflow`) created only when placement is `around` and `allowOverlap` is true. It mirrors every layout/paint property of the primary layer but with overlap forced on and a fixed anchor, and it starts filtered to nothing.
- After each `idle` event, compare the features rendered by the primary label layer (`queryRenderedFeatures` on the primary label layer id, restricted to the viewport) against the layer's source features in view; the ids that are missing are the ones collision dropped. Feed those ids into the overflow layer's filter so exactly those labels are drawn overlapping. Recompute on `idle` (debounced) and clear the filter when the layer, spec, or placement changes.
- Feature identity: use the existing per-feature id already assigned to the GeoJSON sources; if a source lacks stable ids, fall back to the label text value for matching.
- Same code path is shared by the editor and the published viewer since both render through `map-canvas.tsx`.

## Out of scope

- No change to the label controls in the sidebar; "Allow overlap" keeps its label and position, only its meaning is refined.
- No custom label de-clutter engine beyond MapLibre's anchor candidates.
