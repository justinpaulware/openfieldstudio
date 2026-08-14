# Fix the Publish tab URLs, then build the Layer Editor + filtering

## Part 1 — Finish the URL work

The database side of Tab 8 landed correctly: your maps already have a public slug and your username namespace works (`St. Louis Schools` is `justinpaulware/st-louis-schools`). What never got updated is the **Publish tab UI**, which is still the only place in the app pointing at the retired `/maps/[slug]` pattern.

What changes in the Publish tab:

- **URL slug field** now edits the *public* slug (`published_slug`), not the internal project slug, and the helper text under it reads `openfield.nu/justinpaulware/st-louis-schools`.
- **Map URL**, **View live map**, and the **embed snippet** all build from `/[username]/[published-slug]`.
- Saving a public slug that's already used by another of your maps shows "This URL is already in use. Please choose another slug." instead of a generic duplicate error.
- If you haven't set a username yet, the link area says so and links to Settings, and the public link is not shown as if it worked.
- The internal project slug (what's in the browser bar while editing) stays as-is and is not editable here — renaming a project won't break its editor URL.

Everything else on the site (dashboard cards, project switcher, gallery "View published" links) already uses the new pattern; those get a pass to confirm.

## Part 2 — Layer Editor & filtering (Tab 9)

The Style Editor becomes the **Layer Editor**: one panel per layer with five sections in GIS order.

```text
Data → Filter → Symbology → Labels → Popups
```

### Data
Read-only-plus-name panel that absorbs the metadata currently cluttering the layer sidebar: layer name (editable), source type, geometry type, feature count (shown as "24 of 150 features" when filtered), and the source detail (file name, CSV URL, or ArcGIS URL). Space is left for Refresh / Replace / Download later.

### Filter
Attribute filtering as a layer property, not a style property.

- Rules of `field` / `operator` / `value`, combined with AND.
- Operators: equals, not equal, contains, starts with, ends with, greater than, less than, between, is empty, is not empty.
- The value input adapts: a picker for text fields with few distinct values, a number input for numeric fields.
- Live "24 of 150 features" readout and a Clear all button.
- Filters save with the layer and apply everywhere — the editor, legend counts, the attribute table, and the published public map.
- The layer's `...` menu gains **Filter layer**, opening the Layer Editor with Filter expanded.

### Symbology / Labels / Popups
Same behaviour, re-homed into the new panel.

### Layer sidebar cleanup
Rows drop the GeoJSON / CSV / ArcGIS source chips and keep name, symbol, visibility, count, ordering and the `...` menu. A small "Filtered" badge marks any layer with an active filter.

## Technical notes

- `projects.published_slug` already exists and is populated; Part 1 is UI-only in `projects.$projectSlug.publish.tsx`, reading the username from `useMyProfile()`.
- Filtering: new `src/lib/layer-filter.ts` with `filterToExpression(config, fields)` → MapLibre expression, plus `matchesFilter` for counts. `layers.filter_config` jsonb already exists (`{ combinator: "and", rules: [...] }`).
- `map-canvas.tsx` applies the expression to each layer's fill/line/circle/label layers; mask geometry rebuilds from filtered features.
- The published viewer reads `filter_config` the same way it reads styles.
- `style-panel.tsx` → `layer-editor.tsx` with `LayerData`, `LayerFilter`, and the existing symbology/labels/popups sections; filter edits join the existing autosave queue.
- Very large layers (100k+ features) get no special handling yet; filtering runs on loaded features.
