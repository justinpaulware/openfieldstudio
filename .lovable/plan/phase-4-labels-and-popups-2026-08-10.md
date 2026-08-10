# Phase 4 — Labels and Popups

Fills in the two remaining accordion sections of the Style Editor. Both are per-layer, both preview live on the map, and both save with the existing autosave + Save button.

## Labels section

```text
Labels
├── [ ] Show labels
├── Label field        (dropdown of attribute fields)
├── Text               font size, weight, color, halo color + halo width
├── Placement          points: center / above / below / left / right, offset
│                      lines: along line / horizontal
│                      polygons: centroid
├── Behavior           allow overlap, min/max zoom visibility
└── Advanced           uppercase, max line width (wrap), number formatting
```

Details:

- Off by default. Turning it on picks a sensible default field (first name-like text field) so a label appears immediately.
- Halo defaults to white at 1.2px so labels stay legible on any basemap.
- Zoom range uses a two-handle slider (0–22) with "visible from z8" style text.
- Collision handling is MapLibre's default (labels drop when crowded) unless "allow overlap" is on.
- Labels honor the layer's visibility and the categorized/graduated hidden-class filters.

## Popups section

```text
Popups
├── [ ] Enable popups
├── Trigger            click (default) / hover
├── Title              field dropdown or static text
├── Fields             checkbox list of attributes, drag to reorder
│                      each row: alias (rename) + show/hide
├── Format             per-field: text / number / date / link / image URL
└── Appearance         compact / roomy, max width
```

Details:

- The field list starts with every attribute enabled for new layers; aliases default to the raw field name.
- Empty values are hidden by default so popups stay tight.
- Link and image formats render an anchor / thumbnail rather than raw text.
- Popup content is rendered as sanitized text nodes — no raw HTML from data.
- One popup at a time; clicking the map background closes it. Clicking a feature in a lower layer only fires when no higher layer has a popup at that point.

## Legend and sidebar

No change. Labels and popups do not add legend entries.

## Technical notes

- No migration needed. `layer_styles.style_config` (jsonb) gains `labels` and `popup` objects; `style_mode` is untouched. Missing keys resolve to defaults, so existing layers keep working.
- `src/lib/layer-style.ts` gains `LabelSpec` and `PopupSpec` types plus resolve/serialize handling and defaults.
- `map-canvas.tsx` adds a companion `symbol` layer per layer when labels are on (`text-field`, `text-font`, `text-size`, `text-color`, `text-halo-*`, `symbol-placement`, `text-allow-overlap`, `minzoom`/`maxzoom`), kept in the same stacking order as its parent layer and removed when labels are off.
- Popups use a single shared `maplibregl.Popup` instance driven by a `queryRenderedFeatures` hit test on click/mousemove, honoring the sidebar layer order for which feature wins.
- `style-panel.tsx` un-disables the Labels and Popups sections; two new files `style-labels.tsx` and `style-popups.tsx` hold the editors, matching the existing `style-symbology.tsx` structure.
- Field lists reuse the attribute fields already derived for categorized styling in `use-layer-data.ts`; no extra network calls.

## Not in this step

Label collision priority between layers, curved multi-line label tuning, popup templates/rich text editor, per-category label colors, and publishing. Publishing is the next phase.
