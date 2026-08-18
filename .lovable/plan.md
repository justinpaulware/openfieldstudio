# Proportional Symbols + Heatmap symbology

Both style types are already in the Style type dropdown, disabled with "Coming next". This step turns them on for point layers, following Tab 6bc.

## Proportional Symbols

Each point is sized continuously from a numeric field — no classes.

Controls:
- **Value field** — numeric fields only; shows the detected min/max of the data.
- **Size range** — minimum (default 4 px) and maximum (default 40 px), 1–80.
- **Scaling** — Linear or Square root (default Square root, which reads better on maps).
- **Color** — one fill color for all symbols, plus opacity.
- **Stroke** — stroke color and width, same controls as single symbol.
- Marker shape stays circle for V1; features with a missing or non-numeric value draw at the minimum size and can be hidden with a "Hide features with no value" toggle.

Legend: an automatic nested-circle legend showing roughly four representative values (min, two intermediate steps, max) drawn at their true sizes with formatted number labels. The layers sidebar shows a small two-circle chip so a proportional layer is recognizable at a glance.

## Heatmap

A density surface for point layers.

Controls:
- **Weight field** — optional; "None" means every point counts equally, otherwise higher values push intensity up.
- **Radius** — 5–100 px, default 30.
- **Intensity** — 0.1–5.0, default 1.0.
- **Blur** — 0–50, default 20 (mapped onto the ramp's soft edge).
- **Color ramp** — Blue, Purple, Viridis, Inferno, Red/Orange, with a live gradient preview.
- **Opacity** — 0–100%.

Radius scales with zoom so patterns stay readable when zoomed out and tighten when zoomed in. Labels and popups keep working; the point symbols themselves are replaced by the heat surface.

Legend: a gradient bar labeled Low → High density using the selected ramp.

## Availability

Both types enable only for point (or mixed) layers. On line/polygon layers they stay visible but dimmed with a short explanation, matching how Mask layer behaves today. Switching back to Single symbol restores the layer exactly — nothing is destructive, and no data is altered.

Published maps and the public viewer inherit both automatically since they render through the same style engine.

## Technical notes

- No migration. Both specs are stored in the existing `layer_styles.style_config` jsonb alongside `categories`, `graduated`, and `mask`.
- `src/lib/layer-style.ts`: add `ProportionalSpec { field, minSize, maxSize, scale: "linear" | "sqrt", color, opacity, strokeColor, strokeWidth, hideNoValue }` and `HeatmapSpec { weightField, radius, intensity, blur, ramp, opacity }` with parse/serialize plus `activeProportional(style)` / `activeHeatmap(style)` helpers mirroring `activeMask`. Add a `proportionalRadiusExpression(spec, min, max)` builder using `["interpolate", ["linear"], ["get", field], ...]` for linear and a stop-sampled curve for square root, and `HEATMAP_RAMPS` for the five presets.
- `src/components/map/map-canvas.tsx`: in proportional mode the circle layer uses the radius expression and single color; in heatmap mode the layer's normal circle/label paint layers are skipped in favor of a `heatmap` layer (`heatmap-weight` from the weight field normalized to the data range, `heatmap-intensity`, `heatmap-radius` zoom-interpolated, `heatmap-color` from the ramp, `heatmap-opacity`). Extend the owned-id prune regex for the new `of-heat-<id>` layer.
- `src/components/map/style-symbology.tsx`: enable both entries in the mode dropdown (geometry-gated), and add `ProportionalEditor` and `HeatmapEditor` blocks; `GeometryControls` is hidden in heatmap mode and reduced to stroke/opacity in proportional mode.
- `src/components/map/map-legend.tsx`: `ProportionalSwatch` (nested circles with value labels) and `HeatmapSwatch` (gradient bar); `layer-panel.tsx` gets matching sidebar chips.
- Data ranges for the chosen field come from the existing `numbersFor(field)` prop already threaded through `LayerEditor`, so no extra fetching.
