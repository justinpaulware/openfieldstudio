# Published map: drop the sidebar, branded title card, on-map credit

Three changes to the public viewer at `/maps/:slug` so it matches the map editor's cartographic look.

## 1. Remove the collapsible sidebar

The left sidebar duplicates the floating legend, so remove it entirely along with its show/hide tab. The map fills the full window, and the floating white legend card in the top-left becomes the only layer list. Project description, sources and credits move nowhere — they're dropped from the viewer chrome (title stays in the title card).


## 2. "Made with Open Field" on the map

Move the credit link out of the sidebar footer and onto the map, bottom-left, immediately to the right of the scale bar, on the same baseline and with matching spacing. Text reads "Made with **Open Field**" with "Open Field" bold, linking to the Open Field site.

## 3. Logo + larger title card

Add the Open Field mark as a small icon to the left of the map title inside the white title card. The card gets a bit wider with more padding, and the title text steps up a size. The title card shows regardless of sidebar state on the published map.

## Technical detail

- `src/components/map/map-legend.tsx`: `MapTitleCard` gains a leading brand icon, larger padding and `text-base` title; widen from `w-56`.
- New small brand mark component (inline SVG) so the same icon can be reused by the header brand menu later.
- `src/routes/maps.$slug.tsx`: always render `MapTitleCard` + `MapLegend` in the existing top-left overlay stack; remove the layer-swatch list duplication concern by keeping sidebar toggles but dropping the sidebar credit footer; add a bottom-left credit element positioned to the right of MapLibre's `.maplibregl-ctrl-bottom-left` scale control (offset left padding so it clears the 120px scale bar).
- `?legend=0` and `?title=0` search params keep working as-is.
