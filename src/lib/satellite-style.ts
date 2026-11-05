/**
 * Builds a MapLibre style with Esri World Imagery as the base raster.
 * With `labels`, the place/road name layers from OpenFreeMap Liberty are drawn
 * on top, recoloured white with a dark halo so they read on imagery.
 */
type StyleLayer = {
  id: string;
  type: string;
  source?: string;
  layout?: Record<string, unknown>;
  paint?: Record<string, unknown>;
  [k: string]: unknown;
};

const ESRI_ATTRIBUTION =
  "Imagery © Esri, Maxar, Earthstar Geographics, and the GIS User Community";

export async function buildSatelliteStyle(labels: boolean) {
  const liberty = (await fetch("https://tiles.openfreemap.org/styles/liberty", {
    headers: { Accept: "application/json" },
  }).then((r) => (r.ok ? r.json() : null))) as {
    sources?: Record<string, unknown>;
    layers?: StyleLayer[];
    glyphs?: string;
    sprite?: unknown;
  } | null;

  const labelLayers: StyleLayer[] =
    labels && liberty
      ? (liberty.layers ?? [])
          .filter((l) => l.type === "symbol" && l.layout && "text-field" in l.layout)
          .map((l) => ({
            ...l,
            paint: {
              ...(l.paint ?? {}),
              "text-color": "#ffffff",
              "text-halo-color": "rgba(0,0,0,0.85)",
              "text-halo-width": 1.4,
            },
          }))
      : [];

  const usedSources = new Set(labelLayers.map((l) => l.source).filter(Boolean) as string[]);
  const vectorSources = Object.fromEntries(
    Object.entries(liberty?.sources ?? {}).filter(([k]) => usedSources.has(k)),
  );

  return {
    version: 8,
    name: labels ? "Satellite + labels" : "Satellite",
    glyphs: liberty?.glyphs ?? "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    ...(liberty?.sprite ? { sprite: liberty.sprite } : {}),
    sources: {
      "esri-imagery": {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        maxzoom: 19,
        attribution: ESRI_ATTRIBUTION,
      },
      ...vectorSources,
    },
    layers: [
      { id: "esri-imagery", type: "raster", source: "esri-imagery" },
      ...labelLayers,
    ],
  };
}

export function styleResponse(style: unknown) {
  return new Response(JSON.stringify(style), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
