# "Around (auto-fit)" should never sit on top of the point

Right now the auto-fit option still allows a label to sit centered on its feature, so the first choice covers the dot. Change it so an auto-fit label always sits beside the feature.

## Change

- Auto-fit labels try the right side first, then the left, then below, then above — never centered on the geometry.
- The Offset slider keeps controlling how far out from the feature the label sits, in every one of those positions.
- Nothing changes for the fixed placements (Center / Above / Below / Left / Right).

## Technical

In `src/components/map/map-canvas.tsx` (around line 1207), drop `"center"` from `text-variable-anchor` and order the remaining anchors by preference: `["left", "right", "bottom", "top"]` (anchor `left` = label drawn to the right of the point). Keep `text-radial-offset` at `spec.offset`, `text-justify: "auto"`, and the cleared fixed `text-anchor`/`text-offset`. If `spec.offset` is 0 while auto-fit is active, use a small minimum (e.g. 0.6) so the label clears the symbol.
