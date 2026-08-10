# Taller legend, reversible palettes, duplicate layer, and graduated styling

## 1. Legend can grow

The legend body is currently capped at a short fixed height, so long layer/category lists scroll inside a small box. Cap it at 60% of the viewport height instead, so it grows with content and only scrolls once it gets tall. The title card above it stays put; the legend still collapses with its chevron.

## 2. Reverse a palette

A small flip icon button sits next to the Palette label in both Categories and Graduated. Clicking it reverses the color order across the entries (and reverses the swatch preview), so a light-to-dark ramp becomes dark-to-light. The choice is remembered with the layer, so regenerating categories or changing class count keeps the reversed direction.

## 3. Graduated styling

"Graduated" becomes selectable in the Style type row and gets its own editor:

- **Field** — dropdown listing only numeric attributes of the layer (fields whose values parse as numbers).
- **Method** — Quantile, Equal interval, Natural breaks (Jenks), and Manual. Manual lets you type each break value.
- **Classes** — 3 to 9, default 5.
- **Ramp** — sequential and diverging color ramps (Viridis, Blues, Greens, Oranges, Magma, Grey, Red-Blue, Brown-Teal) shown as gradient chips, with the reverse toggle from item 2.
- **Class list** — each class shows its range, its color (editable via the same swatch picker used for categories), a feature count, and a show/hide eye.
- **Apply colors to** — Fill, Stroke, or Fill + stroke, same control as Categories.
- **Graduated size (points only)** — an optional toggle that also scales point radius across classes, with min and max radius sliders.
- Features with a missing or non-numeric value fall into an "Other / no value" row with its own color and visibility toggle.

Legend and the sidebar layer symbol show graduated classes the same way they show categories: one row per class, labeled with its range.

## Technical notes

- `src/components/map/map-legend.tsx`: body `max-h-56` becomes `max-h-[60vh]`; legend rows extended to render graduated classes (shared row builder with categories).
- `src/lib/layer-style.ts`:
  - `CategorySpec` gains `reversed: boolean` (parsed with `false` fallback); `recolorCategories` and `buildCategories` respect it.
  - New `GraduatedSpec { field, method, classes, breaks[], colors[], target, reversed, ramp, otherColor, otherVisible, hidden[], sizeEnabled, minRadius, maxRadius }` stored in the same `style_config` jsonb — no migration.
  - `StyleMode` gains `"graduated"`; `primaryColorPaint` / `strokeColorPaint` / `categoryFilter` extended to emit MapLibre `step` expressions on `["to-number", ["get", field]]` for graduated layers, with a `case` guard so non-numeric values get the "other" color; radius uses a matching `step` when graduated size is on.
  - New `src/lib/classify.ts` with quantile, equal-interval and Jenks break computation plus the ramp definitions.
- `src/components/map/style-symbology.tsx`: `PaletteHeader` with the flip button shared by both editors; new `GraduatedEditor`; enable the Graduated mode button.
- `src/routes/_authenticated/projects.$projectId.map.tsx`: add a `numericFieldValues(field)` helper (raw numeric array from the loaded features) passed to the style panel for break computation and class counts.
- `src/components/map/map-canvas.tsx`: already reads `primaryColorPaint` / `strokeColorPaint`; add the graduated radius expression for circle layers.
