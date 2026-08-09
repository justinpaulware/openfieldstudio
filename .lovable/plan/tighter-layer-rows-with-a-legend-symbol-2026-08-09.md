# Tighter layer rows with a legend symbol

Restructure each row in the Layers sidebar so it reads like a legend, with the layer's real map symbol on the left and the controls right-justified.

## New row layout

```text
[grip] [symbol] Layer name            (1,204)  [eye]  [...]
        └ when selected: source type chip + opacity slider
```

- **Symbol** replaces the eye at the left. It renders from the layer's current style and geometry type:
  - point → filled circle with stroke
  - line → short horizontal stroke-colored bar
  - polygon → small rounded square, fill color at its fill opacity, with stroke
  - Layer opacity is applied so the swatch matches the map.
  - Loading spinner / error triangle take the symbol's slot while a layer is fetching or failed, so nothing shifts.
- **Feature count** moves next to the name: right-justified, gray, in parentheses — `(1,204)` — same treatment as the folder counts.
- **Eye toggle** moves right, immediately left of the `...` menu.
- **Source type** (GeoJSON / CSV / ArcGIS) chip only appears in the expanded area when the layer is selected, on the same line as the opacity slider.
- **Last refreshed** leaves the row and becomes a non-clickable caption under "Refresh from source" in the `...` menu (e.g. "Refresh from source · 2h ago"); shown as "Never refreshed" when absent.
- Rows get tighter vertical padding since the second line is gone unless selected.

Opacity slider stays in the selected area for now; it moves to the styling panel when that phase lands.

## Technical notes

All in `src/components/map/layer-panel.tsx`:
- Widen the panel's layer type to include the joined `layer_styles` rows (the editor route already selects `*, layer_styles(*)`), so the swatch can read fill/stroke color, stroke width and fill opacity, falling back to the same defaults the map uses.
- Add a small `LayerSymbol` component (pure CSS/SVG, no map dependency) keyed off `geometry_type`.
- Rework `renderLayer`'s header row to a single flex line: grip, symbol, name (flex-1, truncating), count, eye, menu. Keep drag handlers, drop lines, rename editor and selection behavior unchanged.
- No database, route, or map changes.
