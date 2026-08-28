# Publish tab view cleanup + ArcGIS REST Service expansion

## 1. Publish tab: cleaner view hierarchy

Today the page header carries a "View live map" and a "Publish/Unpublish" button that act on the project (really the Main view), while the Views list below repeats "Edit"/"Open"/"Publish" per named view — two competing controls for the same thing.

Changes:
- Remove "View live map" and "Publish/Unpublish" from the page header. The header keeps the "Publish" title plus the status chip.
- The Views list becomes the single publish surface and always renders, even when the project has only the Main view (today it hides itself below two views).
- Each row shows: view name, "Main" tag on the main view, status chip, its public URL, and two actions:
  - "Open" (external link, only when that view is published)
  - "Publish" / "Unpublish"
- Publishing/unpublishing the Main view keeps writing both the project row and the main `project_views` row in lockstep, exactly as the header button does today, so the dashboard, gallery, and public layer access stay correct.
- Remove the per-row "Edit" button — editing lives in the Map Editor tab.

Everything else on the page (details, public link, attribution, embed, delete) stays as is.

## 2. ArcGIS REST Service expansion (Tab 11)

Currently only URLs ending in a layer index are accepted, metadata is read with `f=json`, and features are pulled with `f=geojson` — which works for FeatureServer but fails or returns unhelpful errors for many MapServer layers.

### Accepted inputs
- `.../FeatureServer/0` and `.../MapServer/0` — a single layer, added directly.
- `.../FeatureServer` and `.../MapServer` — a service root. The dialog queries the service, lists its layers (name, geometry type, feature count where available), and lets the user pick one to add. Multi-select add is out of scope for this pass; one layer per add keeps styling and the layer panel coherent.

### Service discovery
A new server-side resolver inspects the URL and the service metadata:
1. Classify the URL as FeatureServer/MapServer, layer or service root; reject anything else with a clear message.
2. Fetch `?f=json` metadata: layer name, `geometryType`, `fields`, `drawingInfo` (renderer), `capabilities`, `maxRecordCount`.
3. For service roots, return the `layers` array so the UI can present a picker.
4. For layers, verify the layer is queryable. Group/annotation/raster sublayers and layers without Query capability are rejected with an explicit reason.

### Feature loading
- Try `f=geojson` first (fast path, works on FeatureServer and modern MapServer).
- If the service rejects `f=geojson` (unsupported format error or a non-GeoJSON body), fall back to `f=json` (Esri JSON) and convert `esriGeometryPoint / Multipoint / Polyline / Polygon` plus attributes to GeoJSON server-side. This is what makes older MapServer endpoints work.
- Paging, the repeated-first-page guard, the 100k cap, and the truncation warning all carry over unchanged and apply to both formats.

### Renderer hints
Where `drawingInfo.renderer` is present, capture a lightweight hint (simple renderer fill/stroke color, or unique-value field + categories) and use it to seed the new layer's initial style instead of the generic default. If the renderer is absent or unsupported, fall back to the current default styling. This is a starting point only — the user can restyle freely afterwards.

### Error messages
Replace generic failures with specific ones, e.g.:
- "This URL isn't an ArcGIS REST endpoint. Expect a URL containing /FeatureServer or /MapServer."
- "This ArcGIS layer can't be queried. Detected: MapServer group layer. Add one of its sublayers instead."
- "The service returned no features for this layer."
- Progress copy while loading: "Loading ArcGIS MapServer layer…"
- Service errors are surfaced verbatim with the endpoint that failed.

### UI
- Rename the source-type label "ArcGIS Feature Service" to "ArcGIS REST Service" in the layer editor and anywhere else it appears.
- Add-layer dialog ArcGIS tab: placeholder and helper text mention both FeatureServer and MapServer; a "Fetch" step resolves the URL and shows either the resolved layer summary (name, geometry, feature count) or a layer picker for service roots before "Add layer".
- Existing `arcgis_rest` layers keep working; refresh and the public viewer go through the same resolver, so MapServer layers reload correctly on published maps.

## Technical notes

- Files touched: `src/routes/_authenticated/projects.$projectSlug.publish.tsx` (view controls), `src/lib/datasets.server.ts` (resolver, Esri JSON → GeoJSON conversion, paging fallback), `src/lib/datasets.functions.ts` (new `describeArcgisService` server fn alongside `loadArcgisLayer`), `src/components/map/add-layer-dialog.tsx` (discovery UI), `src/components/map/layer-editor.tsx` (label rename).
- No database migration is required; `arcgis_rest` already covers both service types and the source URL is stored as pasted.
- Verification: `tsgo --noEmit` clean, add a public FeatureServer layer and a public MapServer layer end to end, confirm a published map still renders both, and confirm the Publish tab publishes/unpublishes the Main view and a named view independently.
