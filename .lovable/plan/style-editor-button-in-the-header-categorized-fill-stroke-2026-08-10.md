# Style Editor button in the header + categorized fill & stroke

Four things: a Style Editor button in the second header band, categorized colors that can drive stroke as well as fill, more categorical palettes, and an answer on Graduated.

## 1. Style Editor button (second header band)

- A button sits immediately to the right of the "Save view / View saved" button, in the same band as the project title and map controls.
- It shows the palette icon on the left with the text "Style editor".
- It toggles the same panel as the palette icon in the Layers sidebar: opens for the selected layer (or the first visible layer if nothing is selected), closes when the panel is already open, and highlights while open.
- The sidebar palette icon and the per-layer `...` → Edit style option both stay exactly as they are.

## 2. Categorized fill and stroke

Today categories only drive the fill/primary color, so strokes stay one flat color across every category.

- Categories mode gains an "Apply colors to" control with three choices: **Fill**, **Stroke**, **Fill + stroke**.
- Default is **Fill + stroke**, since matching outlines is what you want in most cases. Existing categorized layers keep behaving as they do today until changed (they load as Fill).
- When stroke is included, each category's color also paints the outline (points, lines, polygons alike) and the manual stroke color swatch is hidden, replaced by a short note that stroke follows the categories.
- Stroke width and opacity stay manual and global, so only color varies per category.
- When set to Fill only, the manual stroke color control returns unchanged.
- Legend swatches follow the same rule, so a stroke-only categorization reads correctly in the legend.

## 3. More palettes

Four more categorical palettes are added alongside Field, Bold, Muted and Earth: a high-contrast qualitative set, a cool blue-green set, a warm sunset set, and a colorblind-safe (Okabe-Ito based) set. The palette row wraps to two rows of four.

## 4. Graduated

Graduated is not broken — it was intentionally left visible but disabled in the last step so Categories could ship and be reviewed on its own. It needs its own work: numeric field detection, classification methods (quantile, equal interval, natural breaks, manual), color ramps, class count, and graduated point size. That is the next step after this one, unless you want it folded in now.

## Technical notes

- `src/lib/layer-style.ts`: `CategorySpec` gains `target: "fill" | "stroke" | "both"` (parsed with a `"fill"` fallback so saved layers are unchanged); new `strokeColorPaint(style)` mirroring `primaryColorPaint`; `primaryColorPaint` returns the flat fill when target is `"stroke"`; four new entries in `CATEGORY_PALETTES`. No migration — this lives in the existing `style_config` jsonb.
- `src/components/map/map-canvas.tsx`: outline/stroke paint properties read `strokeColorPaint` instead of `paintColor(style.strokeColor)`; the canvas marker renderer uses the resolved per-feature color where it can, falling back to the flat color for the sidebar/legend swatch canvas.
- `src/components/map/style-symbology.tsx`: target selector in `CategoryEditor`; `GeometryControls` hides the stroke color swatch when the target includes stroke; palette grid wraps.
- `src/components/map/map-legend.tsx` and `layer-panel.tsx`: swatch color picks fill vs stroke based on target.
- `src/routes/_authenticated/projects.$projectId.map.tsx`: header button rendered inside the existing `ProjectHeaderActions` block, reusing the sidebar toggle handler.
