# Satellite basemap

## Free options compared

| Source | Detail | Coverage | Key needed | Terms |
|---|---|---|---|---|
| **Esri World Imagery** | Very sharp (street/building level, ~0.3–1 m in most cities) | Global | No | Free to use with "Esri, Maxar, Earthstar…" credit; Esri asks heavy commercial users to get an ArcGIS account |
| **EOX Sentinel-2 Cloudless** | Coarse (10 m, good to ~zoom 13, blurry for neighborhoods) | Global, cloud-free mosaic | No | Free with credit, non-commercial only |
| **USGS National Map Imagery** | Sharp | US only | No | Public domain |

Recommendation: **Esri World Imagery**. It is the only free global source sharp enough for the civic maps Open Field is used for (precincts, streets, parcels). Open Field is free and non-commercial, which fits Esri's terms, and the credit line will show in the map corner automatically.

## What you'll get

Two new choices in the basemap picker (editor and per-view settings), shown on published maps too:

1. **Satellite** — imagery only.
2. **Satellite + labels** — imagery with street and place names from the existing basemap drawn on top, so people can still find their way.

Everything else keeps working the same: your data layers, comments, address search, highlights and masks all sit on top of the imagery, and switching basemaps keeps your layers.

## Technical details

- Add `satellite` and `satellite-labels` to `BASEMAPS` in `map-canvas.tsx`; `basemapUrl()` points both at new public style routes.
- `src/routes/api/public/styles/satellite.ts`: returns a small style with an Esri raster source (`server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`, 256px, maxzoom 19) plus OpenFreeMap glyphs/sprite so labels and comment markers still render; attribution string included.
- `satellite-labels.ts`: same raster, plus the label (`symbol`) and road-outline layers taken from OpenFreeMap Liberty, recoloured with white text/dark halo for legibility on imagery.
- Edge-cached like the existing no-labels style route; no secrets.
- Thumbnails/social images keep working, since Esri tiles allow canvas capture.
