# Fixed-position popups and a clearer basemap button

## 1. Popups dock to the top right

Right now a popup opens as a bubble pinned to the clicked feature, so it lands in a different spot every time and can cover the feature itself.

- Popups become a fixed card in the top-right corner of the map, directly below the basemap button, with the same small inset and gap as the zoom / compass / basemap stack.
- Same content as today: title, field rows, formats, density and max width from each layer's popup settings.
- Click trigger: the card stays open until you close it (X) or click empty map. Hover trigger: the card follows whatever feature is under the cursor and clears when you move off.
- The card scrolls internally if a feature has many fields, capped so it never runs past the bottom of the map.
- Styling matches the other map overlays (white printed-map card, soft shadow, rounded border).

## 2. Basemap button color inverts

- Collapsed: the layers icon reads white, matching the other map control icons.
- Opened/selected: it turns the current gray, matching the open dropdown — so the "on" state is the darker one.

## Technical notes

- `src/components/map/map-canvas.tsx`:
  - Drop the `maplibregl.Popup` / `hoverPopup` instances. Keep the existing `queryRenderedFeatures` hit test, but store the hit in React state (`{ layerName, spec, properties }`) instead of mounting a MapLibre popup.
  - Render a new overlay div in the existing absolute-positioned stack: `absolute right-2.5 top-[185px] z-10`, width from `spec.maxWidth`, `max-h-[60vh] overflow-y-auto`, reusing `popupTitle` / `popupRows` from `@/lib/layer-style` so formatting logic is unchanged. `popupContent`'s DOM builder is replaced by JSX rendering the same rows (values still rendered as text nodes, never HTML).
  - Click on empty map clears the state; hover trigger sets/clears on `mousemove`; cursor pointer behavior unchanged.
  - Basemap button: add `text-primary-foreground`-style white icon by default and switch to the muted/foreground color when `pickerOpen`, e.g. `pickerOpen ? "text-muted-foreground bg-muted" : "text-white"` using existing tokens rather than raw colors.
