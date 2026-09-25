# Address-to-Feature Lookup (Tab 22)

Extend the published-map Search location card so an author can choose, per view, whether a search just finds an address or also finds the shape that contains it, highlights that shape, and opens its popup.

## What authors get (Publish tab, per view)
- Search behavior: "Locate address only" (current behavior) or "Find containing feature".
- When "Find containing feature" is picked:
  - Lookup layer: a list showing only the polygon layers in that view.
  - Toggles: Highlight feature (on), Open popup (on), Zoom to feature or keep the address zoom.
  - Optional message shown when no feature matches (default: "This location was found, but does not fall within the mapped area.").
- A warning if the chosen layer is later removed or hidden in the view; the search then just locates the address.

## What visitors see
1. They type an address and pick a result. The map zooms and drops a pin, as it does today.
2. The app finds the shape that contains the pin in the chosen layer (for example, the Brooklyn election district).
3. That shape gets a clear outline highlight and its usual popup opens, using the layer's existing popup settings.
4. If no shape contains the address, the card shows the no-match message with a Clear search button. The pin stays.
5. Clear search removes the pin, the highlight, and the popup. Clicking another shape replaces the highlight with that shape's normal popup.

## Build order
1. Settings: add the new options to each view's search settings, with safe defaults so existing maps keep working unchanged.
2. Publish tab controls for the options above.
3. Lookup on the published map: point-in-polygon check against the layer's full data (not just what is drawn on screen), picking the smallest match if shapes overlap.
4. Highlight and popup: reuse the existing popup panel and add a highlight outline style.
5. No-match and cleanup states in the Search card.
6. Test on the Brooklyn County Committee map: an address inside a district, an address outside Brooklyn, clearing, and clicking elsewhere afterward, on both click and hover popup modes.

## Technical details
- `project_views.embed_config.addressSearch` gains `mode: "locate" | "feature"`, `lookupLayerId`, `highlight`, `openPopup`, `zoomTo: "address" | "feature"`, `noMatchMessage`. Missing fields default to locate mode; no database migration is needed because this is JSON.
- Public payload already includes layer GeoJSON; the lookup runs in the browser with `@turf/boolean-point-in-polygon` (supports Polygon/MultiPolygon, holes). For ArcGIS vector layers, query the service with the point geometry (`esriSpatialRelIntersects`).
- `MapCanvas` gains a controlled `highlightFeature` prop (dedicated line layer on top) and a way to open the popup for a given feature and layer programmatically, reusing the keyed popup rendering from the recent popup fix.
- `public-map.tsx` wires search result, lookup, highlight, popup, and clear. `?search=0` overrides still work.
- Left-side card width stays 272px.
