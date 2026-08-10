# Phase 3b — Categorical Styling + Style Editor accordion

Next step: unique-value (categorical) symbology, plus the reorganized Style Editor shell from Tab 2 of the doc. Graduated styling follows as its own step after review.

## Style Editor structure

The right-hand panel becomes three collapsible sections:

```text
Style Editor
├── Styles      (open, fully built)
├── Labels      (collapsed, "Coming next")
└── Popups      (collapsed, "Coming next")
```

Section open/closed state is remembered while editing.

At the top of Styles, a Style Type selector:

```text
Style Type
● Single Symbol   ○ Categories   ○ Graduated (coming next)
```

Single Symbol keeps today's exact controls. Graduated is visible but disabled this step.

## Categories mode

1. **Field picker** — dropdown of the layer's attribute fields (text/short-value fields listed first).
2. **Detect values** — unique values are read from the layer's loaded features. All values are listed, no cap; the list scrolls.
3. **Auto-assign** — each value gets a color from a categorical palette on first generation, in the order values appear.
4. **Per-category row** — color swatch (same color picker as today, with hex/RGB), the value label, a feature count, and an eye toggle to hide that category on the map.
5. **Shared geometry controls** — size/width, opacity and stroke settings stay global for the layer, so only color varies by category. Categories change color; shape and size stay consistent.
6. **Other / null** — features whose value is empty or wasn't matched fall into an "Other" row with its own color and visibility toggle.
7. **Actions** — "Regenerate categories" (re-detects values, keeps colors for values that still exist), a palette switcher to recolor all categories at once, and "Reset to default" returning the layer to Single Symbol.

Everything previews live on the map; saving keeps the current autosave + Save button behavior.

## Legend and sidebar

- The legend card renders one entry per visible category, nested under the layer name, in the same order as the panel.
- The layers sidebar symbol shows a small multi-color chip when a layer is categorized, rather than a single swatch.
- Hidden categories disappear from both the map and the legend.

## Technical notes

- No migration required. `layer_styles` already has `style_mode` and jsonb `style_config`; categories are stored as `style_mode = "categorized"` with `style_config.categories = { field, entries: [{ value, color, visible }], otherColor, otherVisible, palette }`. Single-symbol values stay in the existing columns so switching modes back is lossless.
- `src/lib/layer-style.ts` gains the categorized type, resolve/serialize handling, categorical palettes, and a helper that builds a MapLibre `["match", ["get", field], ...]` color expression plus a filter expression for hidden categories.
- `map-canvas.tsx` paint mapping reads the match expression for fill/circle/line color and applies the visibility filter; single-symbol path is unchanged.
- Unique values are computed client-side from the already-loaded GeoJSON in `use-layer-data.ts` (memoized per layer + field), so no extra network calls.
- `style-panel.tsx` splits into the accordion shell plus `style-symbology.tsx` (single + categories); `map-legend.tsx` and `layer-panel.tsx` `LayerSymbol` extended for multi-swatch output.

## Not in this step

Graduated styling (classification methods, color ramps, graduated point size), Labels, Popups, presets, publishing. Graduated is the immediate next step and slots into the same Style Type switcher.
