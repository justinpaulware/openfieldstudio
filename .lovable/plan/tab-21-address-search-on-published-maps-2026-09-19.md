# Tab 21: Address Search on Published Maps

Add an optional "Search location" card to published maps, turned on or off by the author for each published view.

## What the visitor sees

A compact card in the top-left stack, sitting directly under the Title card:

```text
Title
Search location
Map views
Legend
```

- Same card look as Map views and Legend: icon, title, collapsible chevron.
- A single text box: "Search address, place, or landmark...".
- Typing shows a short dropdown of matching places (addresses, towns, neighborhoods, landmarks).
- Picking a result flies the map to it (zoom ~15 for an address, wider for a town or region) and drops a temporary marker.
- An X clears the box and removes the marker; the map stays where it is.
- Results prefer places near the map's current area, so "Main Street" finds the local one first.
- If nothing matches, the dropdown says "No places found".

Search uses the free OpenStreetMap place-search service, so there is no account or usage cost.

## What the author sees

In the Publish tab, inside each view's card (next to the existing view navigation toggle):

- **Address search** — a toggle, off by default. Turning it on makes the search card appear on that published view.

## Technical notes

- Store the flag in the existing `project_views.embed_config` JSON as `addressSearch: boolean`, read through the current `parseEmbed`/`useUpdateView` path — no migration needed. Main-view publishing already mirrors the rest of the view state, so nothing changes there.
- `loadPublishedMap` in `src/lib/publish.server.ts` returns `addressSearch` alongside `viewNav`; the viewer payload type in `public-map.tsx` gains the field.
- New `src/components/public/address-search-card.tsx`, built on the shared `MapCardHeader` (Search icon), rendered in `public-map.tsx` between `MapTitleCard` and `ViewSwitcherCard`. Honors a `?search=0` URL flag like the existing `legend`/`title`/`views` flags, on both viewer routes.
- Geocoding runs through a new server function (`src/lib/geocode.functions.ts`) that calls Nominatim server-side with a descriptive User-Agent, a 300ms-debounced query from the client, `viewbox` bias from the current map bounds, `limit=5`, and a short in-memory cache. Keeping it server-side avoids browser CORS and rate-limit issues and keeps usage attributable.
- Marker: reuse the existing pin overlay path in `map-canvas.tsx` via a new `searchPin` prop, cleared on X.
- Camera moves reuse `MapHandle` — `flyTo` for points, `setView`/bounds fit when the result carries a bounding box.

Out of scope (noted as future in the doc): use-my-location, recent searches, and searching layer attributes.
