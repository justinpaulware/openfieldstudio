import type { FeatureCollection } from "@/lib/geo";

/** Per-view setting: whether address search also finds a containing feature. */
export type AddressLookupConfig = {
  mode: "locate" | "feature";
  /** Polygon layers searched, in order; the smallest containing shape wins. */
  layerIds: string[];
  highlight: boolean;
  openPopup: boolean;
  zoomTo: "address" | "feature";
  noMatchMessage: string;
};

export const DEFAULT_NO_MATCH =
  "This location was found, but does not fall within the mapped area.";

export const DEFAULT_LOOKUP: AddressLookupConfig = {
  mode: "locate",
  layerIds: [],
  highlight: true,
  openPopup: true,
  zoomTo: "address",
  noMatchMessage: "",
};

export function parseLookup(value: unknown): AddressLookupConfig {
  if (!value || typeof value !== "object") return DEFAULT_LOOKUP;
  const raw = value as Partial<AddressLookupConfig> & { layerId?: unknown };
  const ids = Array.isArray(raw.layerIds)
    ? raw.layerIds.filter((id): id is string => typeof id === "string")
    : typeof raw.layerId === "string"
      ? [raw.layerId]
      : [];
  return {
    mode: raw.mode === "feature" ? "feature" : "locate",
    layerIds: ids,
    highlight: raw.highlight !== false,
    openPopup: raw.openPopup !== false,
    zoomTo: raw.zoomTo === "feature" ? "feature" : "address",
    noMatchMessage: typeof raw.noMatchMessage === "string" ? raw.noMatchMessage.slice(0, 300) : "",
  };
}

type Ring = number[][];

function inRing(x: number, y: number, ring: Ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i] as [number, number];
    const [xj, yj] = ring[j] as [number, number];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(x: number, y: number, rings: Ring[]) {
  if (!rings.length || !inRing(x, y, rings[0]!)) return false;
  return !rings.slice(1).some((hole) => inRing(x, y, hole));
}

function ringArea(ring: Ring) {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j]![0]! + ring[i]![0]!) * (ring[j]![1]! - ring[i]![1]!);
  }
  return Math.abs(a / 2);
}

export type LookupHit = {
  area: number;
  properties: Record<string, unknown>;
  geometry: unknown;
  bbox: [number, number, number, number];
};

/** Finds the polygon containing [lng, lat]; the smallest wins when shapes overlap. */
export function findContainingFeature(
  data: FeatureCollection | null,
  lng: number,
  lat: number,
): LookupHit | null {
  if (!data) return null;
  let best: LookupHit | null = null;
  let bestArea = Infinity;
  for (const feature of data.features as Array<{ geometry?: { type: string; coordinates: unknown } | null; properties?: Record<string, unknown> | null }>) {
    const g = feature.geometry;
    if (!g) continue;
    const polys: Ring[][] =
      g.type === "Polygon"
        ? [g.coordinates as Ring[]]
        : g.type === "MultiPolygon"
          ? (g.coordinates as Ring[][])
          : [];
    for (const rings of polys) {
      if (!inPolygon(lng, lat, rings)) continue;
      const area = ringArea(rings[0]!);
      if (area < bestArea) {
        bestArea = area;
        const all = polys.flatMap((p) => p[0] ?? []);
        const xs = all.map((c) => c[0]!);
        const ys = all.map((c) => c[1]!);
        best = {
          area,
          properties: feature.properties ?? {},
          geometry: g,
          bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
        };
      }
    }
  }
  return best;
}
