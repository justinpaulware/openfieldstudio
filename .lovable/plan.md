# Live layer symbols, bigger ArcGIS imports, and color/stroke polish

## 1. Layer sidebar symbols follow live styling

The sidebar swatch reads the saved style row from the database, so it only changes after a save round-trip (and not at all while you are dragging sliders). The map editor already keeps a live draft style per layer — the panel will use that same draft, so sidebar symbol, legend, and map always match.

## 2. ArcGIS "25 MB limit"

That limit is ours, not ArcGIS's — a safety cap on any single remote fetch. A large service returns everything in one response and trips it. Fix:

- Page ArcGIS queries: fetch in batches (1,000 features per request) using `resultOffset` / `resultRecordCount`, following `exceededTransferLimit` until the service is exhausted.
- Cap by features instead of bytes for ArcGIS: stop at 100,000 features and tell the user the layer was truncated, with the option to filter at the source.
- Keep a per-request byte cap (25 MB per page) so a single hostile response still can't blow up memory; raise the overall single-file cap for CSV/GeoJSON to 50 MB.
- If a service refuses paging (no offset support), fall back to the single request and report a clear message.

## 3. "No fill" swatch

Replace the checkerboard with a clean white/transparent box with a thin red diagonal slash (SVG), used everywhere the sentinel appears: palette grid, trigger swatch, picker popover, legend, sidebar symbol.

## 4. Stroke width in 0.25 steps

Stroke/outline/line width sliders step by 0.25 (point + polygon stroke 0–8, line width 0.5–12), with the readout showing two decimals only when needed.

## 5 & 6. Palette layout

Two rows of equal-width swatches:

```text
row 1  red  orange  amber/yellow  green  teal  blue  indigo  violet  magenta
row 2  white  #eee  #ccc  #999  #666  #444  #222  black  no-color
```


## 7. Legend folder subheaders

The legend groups its entries the same way the Layers sidebar does: each folder becomes a small uppercase subheader with its layers listed beneath, in sidebar order. Layers outside any folder stay ungrouped at the top. Empty folders and folders whose layers are all hidden are skipped, and nesting shows as slight indentation.

## Technical notes



- `src/lib/layer-style.ts`: split `STYLE_PALETTE` into `PALETTE_HUES` and `PALETTE_NEUTRALS` (neutrals ending in `TRANSPARENT`).
- `src/components/map/color-field.tsx`: render two rows; new `NoColorSwatch` SVG replaces the `CHECKER` background.
- `src/components/map/map-legend.tsx`: `LegendSwatch` draws the red-slash box when both fill and stroke are transparent.
- `src/components/map/layer-panel.tsx`: accept an optional `styleFor(layer)` prop; fall back to the joined style row.
- `src/routes/_authenticated/projects.$projectId.map.tsx`: pass the existing `styleFor` into `LayerPanel`.
- `src/components/map/style-panel.tsx`: `step={0.25}` on width sliders.
- `src/lib/datasets.server.ts`: paged `loadArcgisGeoJSON`, per-page byte cap, feature cap, updated limit copy.
