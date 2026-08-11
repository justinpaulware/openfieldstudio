/**
 * Inverted-polygon ("mask") geometry.
 *
 * Builds a single world-spanning polygon whose holes are the rings of the
 * source features, so everything OUTSIDE the study area gets painted.
 * The source data is never modified — this is a render-time derivative.
 */

type Ring = number[][];

const WORLD_RING: Ring = [
  [-180, -85.05112878],
  [180, -85.05112878],
  [180, 85.05112878],
  [-180, 85.05112878],
  [-180, -85.05112878],
];

function ringArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[j]!;
    const b = ring[i]!;
    sum += (b[0]! - a[0]!) * (b[1]! + a[1]!);
  }
  return sum;
}

/** Holes must wind opposite the clockwise world ring. */
function asHole(ring: Ring): Ring {
  const closed =
    ring.length > 2 &&
    (ring[0]![0] !== ring[ring.length - 1]![0] || ring[0]![1] !== ring[ring.length - 1]![1])
      ? [...ring, ring[0]!]
      : ring;
  // World ring above is counter-clockwise (negative area), so holes go clockwise.
  return ringArea(closed) < 0 ? [...closed].reverse() : closed;
}

function collectRings(geometry: unknown, out: Ring[]) {
  if (!geometry || typeof geometry !== "object") return;
  const geom = geometry as { type?: string; coordinates?: unknown; geometries?: unknown[] };
  if (geom.type === "GeometryCollection") {
    for (const child of geom.geometries ?? []) collectRings(child, out);
    return;
  }
  if (geom.type === "Polygon") {
    for (const ring of (geom.coordinates as Ring[] | undefined) ?? []) {
      if (ring?.length > 2) out.push(asHole(ring));
    }
    return;
  }
  if (geom.type === "MultiPolygon") {
    for (const polygon of (geom.coordinates as Ring[][] | undefined) ?? []) {
      for (const ring of polygon ?? []) {
        if (ring?.length > 2) out.push(asHole(ring));
      }
    }
  }
}

const cache = new WeakMap<object, unknown>();

/** World polygon minus every polygon ring in the data, as a FeatureCollection. */
export function buildMaskGeometry(data: unknown): unknown {
  if (!data || typeof data !== "object") return null;
  const cached = cache.get(data as object);
  if (cached !== undefined) return cached;

  const holes: Ring[] = [];
  const collection = data as { type?: string; features?: unknown[] };
  if (collection.type === "FeatureCollection") {
    for (const feature of collection.features ?? []) {
      collectRings((feature as { geometry?: unknown } | null)?.geometry, holes);
    }
  } else if (collection.type === "Feature") {
    collectRings((collection as { geometry?: unknown }).geometry, holes);
  } else {
    collectRings(collection, holes);
  }

  const result = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [WORLD_RING, ...holes] },
      },
    ],
  };
  cache.set(data as object, result);
  return result;
}
