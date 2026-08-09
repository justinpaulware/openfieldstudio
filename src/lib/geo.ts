export type Bbox = [number, number, number, number];

export type FieldDef = { name: string; type: "string" | "number" | "boolean" };

export type LayerFields = {
  list: FieldDef[];
  latField?: string | null;
  lonField?: string | null;
};

export type Position = number[];
export type Coordinates = Position | Position[] | Position[][] | Position[][][];
export type PropertyValue = string | number | boolean | null;

export type GeoJSONFeature = {
  type: "Feature";
  geometry: { type: string; coordinates: Coordinates } | null;
  properties: Record<string, PropertyValue> | null;
};

export type FeatureCollection = {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
};

export type SimpleGeometryType = "point" | "line" | "polygon" | "mixed";

const GEOMETRY_GROUPS: Record<string, SimpleGeometryType> = {
  Point: "point",
  MultiPoint: "point",
  LineString: "line",
  MultiLineString: "line",
  Polygon: "polygon",
  MultiPolygon: "polygon",
};

export function isFeatureCollection(value: unknown): value is FeatureCollection {
  return (
    !!value &&
    typeof value === "object" &&
    (value as { type?: unknown }).type === "FeatureCollection" &&
    Array.isArray((value as { features?: unknown }).features)
  );
}

/** Normalizes a bare Feature or geometry into a FeatureCollection. */
export function toFeatureCollection(value: unknown): FeatureCollection | null {
  if (isFeatureCollection(value)) return value;
  if (value && typeof value === "object") {
    const v = value as { type?: string };
    if (v.type === "Feature") return { type: "FeatureCollection", features: [value as GeoJSONFeature] };
    if (v.type && GEOMETRY_GROUPS[v.type]) {
      return {
        type: "FeatureCollection",
        features: [
          { type: "Feature", geometry: value as GeoJSONFeature["geometry"], properties: {} },
        ],
      };
    }
  }
  return null;
}

function walkCoordinates(coords: unknown, visit: (lng: number, lat: number) => void) {
  if (!Array.isArray(coords)) return;
  if (typeof coords[0] === "number" && typeof coords[1] === "number") {
    visit(coords[0] as number, coords[1] as number);
    return;
  }
  for (const child of coords) walkCoordinates(child, visit);
}

export function computeBbox(fc: FeatureCollection): Bbox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const feature of fc.features) {
    if (!feature?.geometry) continue;
    walkCoordinates(feature.geometry.coordinates, (lng, lat) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      if (lng < minX) minX = lng;
      if (lat < minY) minY = lat;
      if (lng > maxX) maxX = lng;
      if (lat > maxY) maxY = lat;
    });
  }

  if (minX === Infinity) return null;
  return [minX, minY, maxX, maxY];
}

export function detectGeometryType(fc: FeatureCollection): SimpleGeometryType {
  const seen = new Set<SimpleGeometryType>();
  for (const feature of fc.features) {
    const t = feature?.geometry?.type;
    if (!t) continue;
    const group = GEOMETRY_GROUPS[t];
    if (group) seen.add(group);
    if (seen.size > 1) return "mixed";
  }
  const [only] = [...seen];
  return only ?? "point";
}

export function collectFields(fc: FeatureCollection, sample = 200): FieldDef[] {
  const types = new Map<string, FieldDef["type"]>();
  for (const feature of fc.features.slice(0, sample)) {
    const props = feature?.properties;
    if (!props) continue;
    for (const [key, value] of Object.entries(props)) {
      if (types.has(key)) continue;
      const t =
        typeof value === "number" ? "number" : typeof value === "boolean" ? "boolean" : "string";
      types.set(key, t);
    }
  }
  return [...types].map(([name, type]) => ({ name, type }));
}

export function parseLayerFields(value: unknown): LayerFields {
  if (Array.isArray(value)) return { list: value as FieldDef[] };
  if (value && typeof value === "object") {
    const v = value as Partial<LayerFields>;
    return {
      list: Array.isArray(v.list) ? v.list : [],
      latField: v.latField ?? null,
      lonField: v.lonField ?? null,
    };
  }
  return { list: [] };
}

export function mergeBboxes(boxes: (Bbox | null | undefined)[]): Bbox | null {
  const valid = boxes.filter(Boolean) as Bbox[];
  const first = valid[0];
  if (!first) return null;
  return valid.reduce<Bbox>(
    (acc, b) => [
      Math.min(acc[0], b[0]),
      Math.min(acc[1], b[1]),
      Math.max(acc[2], b[2]),
      Math.max(acc[3], b[3]),
    ],
    [...first] as Bbox,
  );
}
