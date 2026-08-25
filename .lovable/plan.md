# Published Map Viewer UI Refinement (Tab 12)

Polish the public viewer so the floating panels feel like one system, add legend-based category filtering, and make popup images real content.

## 1. Description below the title

The title card shows only the project title today. Add the project description (already editable in the Publish tab) beneath it:

- Bold title, then a smaller, muted, regular-weight description line.
- Clamp to 3 lines with a "Show more" / "Show less" toggle when it overflows.
- No description: card renders exactly as it does now.

## 2. Consistent spacing system

Panels currently use mixed offsets (title/legend at 16px from the edge, popup/comments at 10px) and different internal padding.

Standardize across title, legend, popup, and comments:

- 12px from every viewport edge.
- 8px between stacked panels.
- Same card shell: radius, border, background, shadow, and 12px internal padding.

## 3. Popup and comments alignment

Both live in the top-right column. Give them one shared width (320px, with the popup's per-layer max-width respected up to that) and identical card styling, so their left and right edges line up.

## 4. Category visibility toggles in the legend

For categorized and graduated layers, each legend row gets a checkbox. Unchecking hides that category's features on the map immediately.

- Viewer-local only: it never writes back to the saved layer style.
- Layer-level eye toggle stays; category checkboxes nest under it.
- Hiding all categories dims the layer row rather than erroring.

## 5. Popup improvements

- Slightly wider popup, with image rows getting a 4:3 frame instead of the current short, wide crop.
- Images read as featured content, not thumbnails.

## 6. Comment creation cleanup

Move the composer to the light card treatment used elsewhere in the viewer: white inputs, subtle borders, light background. Trim the form so the flow reads as Add comment → click map → write → submit, with name/email/category kept but visually secondary.

## 7. Popup image lightbox

Clicking a popup image opens it in a modal over a dimmed map. Close via X, Escape, or clicking the backdrop. Image scales to fit the viewport (never exceeding width or height). Single image for now; gallery navigation is left for later.

## Technical notes

- Files touched: `src/components/public/public-map.tsx`, `src/components/map/map-legend.tsx` (title card + legend), `src/components/map/map-canvas.tsx` (popup card, new lightbox), `src/components/comments/comment-panel.tsx` and `comment-composer.tsx`.
- Category filtering reuses the existing style engine: the categorized/graduated specs already carry a per-entry `visible` flag that drives MapLibre filter expressions, so the viewer passes a cloned style with those flags flipped — no new expression logic, no schema change.
- Shared panel styling is extracted into one card class used by all four panels so future panels stay consistent.
- No database changes; the description already exists on `projects`.
