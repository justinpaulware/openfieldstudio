# Symbology roadmap — step 1: Mask Layer (inverted polygon)

Roadmap acknowledged: Single Symbol, Categories, Graduated ship today; Proportional Symbols, Heatmap and Mask Layer come next, in that priority order. This step builds **Mask Layer** and lays out the six-slot Style Type grid so the remaining two drop in without a redesign.

## Style type dropdown

The Style type buttons become a single dropdown, so the list stays compact as types are added:

```text
Style type  [ Single symbol        v ]
              Single symbol
              Categories
              Graduated
              Proportional
              Heatmap
              Mask layer
```


- Proportional and Heatmap render as visible but disabled with a "Coming next" tooltip this step.
- Mask layer only enables for polygon (or mixed) layers; on point/line layers it is disabled with a short explanation.
- Types not relevant to a geometry stay visible but dimmed, so the panel reads the same on every layer.

## Mask layer behavior

Selecting Mask layer turns the polygon layer into a focus mask: everything **inside** the polygons draws normally (basemap, other layers, labels), everything **outside** is covered by a colored overlay.

Controls in a "Mask settings" block:

- **Mask color** — the existing color picker (black / white / gray presets available in the palette).
- **Mask opacity** — 0–100%, default 60%.
- **Boundary** — outline color and width (default a visible 2px accent), plus the existing dash pattern control, so the study-area edge reads clearly. Boundary can be set to no color.
- **Mask scope** — a two-option control: **Entire map** (mask covers the basemap and all other layers) or **Basemap only** (mask sits above the basemap but under your other data layers). Default: Entire map.

The original geometry is never altered — the mask is purely a render-time effect, so switching back to Single symbol restores the layer exactly as it was.

Legend and sidebar: a masked layer shows a single swatch drawn as an outlined "window" (mask color surrounding a clear center) with the layer name, so it reads as a focus area rather than a filled polygon. Visibility toggles work as usual — hiding the layer removes the mask.

Publishing and the public viewer inherit this automatically, since both render through the same style engine.

## Technical notes

- `src/lib/layer-style.ts`: `StyleMode` gains `"mask"`, `"proportional"` and `"heatmap"` (only `"mask"` is selectable now). New `MaskSpec { color, opacity, scope: "all" | "basemap", boundaryColor, boundaryWidth, boundaryDash }` parsed from and serialized into the existing `style_config` jsonb — **no migration**. `activeMask(style)` helper mirrors `activeCategories` / `activeGraduated`, and returns null unless mode is `"mask"`.
- New `src/lib/mask-geometry.ts`: builds the inverted GeoJSON — one world-spanning outer ring with each polygon ring of the source features as holes (winding normalized, multipolygons flattened). Memoized on the source data reference so it recomputes only when data changes.
- `src/components/map/map-canvas.tsx`:
  - New owned source `of-mask-src-<id>` and layers `of-mask-<id>` (fill) plus reuse of the existing outline layer for the boundary; the id regex that prunes orphaned layers/sources is extended to match them.
  - When mode is `"mask"`, the layer's normal fill/circle/line layers are skipped and only mask + outline draw.
  - "Basemap only" inserts the mask fill beneath the first Open Field data layer; "Entire map" keeps it in the normal reverse-add ordering so sidebar order still controls stacking against other masks/layers.
- `src/components/map/style-symbology.tsx`: grid-based mode selector with per-geometry enablement, plus a `MaskEditor` block; `GeometryControls` is hidden in mask mode in favor of the mask controls.
- `src/components/map/map-legend.tsx` and `layer-panel.tsx`: a `MaskSwatch` variant used when `activeMask(style)` is set.
- `src/routes/maps.$slug.tsx` needs no change beyond what the shared canvas/legend components provide.

## Then, if time allows

Proportional Symbols (numeric field, min/max size, linear vs square-root scaling, auto size legend) followed by Heatmap (optional weight field, radius, intensity, blur, color ramps, density legend). Each ships as its own step so it can be reviewed on its own.
