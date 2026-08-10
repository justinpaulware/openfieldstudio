# Published map: attribution, legend toggles, logo

Three fixes to the public viewer at `/maps/:slug`.

## 1. "Made with Open Field." beside the scale bar

Today the credit sits at a hardcoded left offset (150px), so the gap changes as the scale bar resizes. Make it flow directly after the scale bar with the same spacing used between other map controls, and add the period.

- Wrap the MapLibre scale control and the credit in one bottom-left row so the credit shifts with the scale bar's width.
- Consistent gap (matching the map control spacing), same baseline alignment.
- Text becomes "Made with **Open Field**." with the period outside the bold.

## 2. Hidden layers stay in the legend, grayed out

Currently toggling a layer off removes its row from the legend, so it can't be turned back on.

- Legend groups will include hidden layers instead of filtering them out.
- A hidden row renders dimmed with the closed-eye icon (already supported by the legend component) and stays clickable to restore.
- Map rendering is unchanged: the layer itself still hides.

## 3. Brand mark matches the site

The dashboard and landing header use a yellow rounded square with the Layers glyph; the map title card uses a different placeholder mark.

- Update the shared brand mark to the site's rounded-square + Layers glyph treatment and use it in the title card, so the map, dashboard, and landing page match.

## Technical notes

- `src/routes/maps.$slug.tsx`: attribution wrapper/positioning, and build `legendGroups` from all layers (drop the `isVisible` filter there only).
- `src/components/brand-mark.tsx`: replace the SVG with the site logo treatment.
- `src/components/map/map-legend.tsx`: title-card mark sizing if needed for the new shape.
