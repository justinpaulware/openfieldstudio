import {
  collectFields,
  computeBbox,
  detectGeometryType,
  toFeatureCollection,
  type FeatureCollection,
  type FieldDef,
  type SimpleGeometryType,
} from "./geo";

export type RemoteSummary = {
  name: string;
  geometryType: SimpleGeometryType;
  featureCount: number;
  bbox: [number, number, number, number] | null;
  fields: FieldDef[];
};

/** Byte cap for any single remote response (a page, not the whole dataset). */
const MAX_BYTES = 50 * 1024 * 1024;
/** Overall feature cap for paged ArcGIS imports. */
const MAX_ARCGIS_FEATURES = 100_000;
const ARCGIS_PAGE_SIZE = 1000;


export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http and https links are supported.");
  }
  const host = url.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) throw new Error("That address isn't publicly reachable.");
  return url;
}

async function fetchText(url: URL): Promise<string> {
  const response = await fetch(url.toString(), {
    headers: { accept: "text/csv,application/json,*/*" },
    redirect: "follow",
  });
  if (!response.ok) {
    throw new Error(`The source responded with ${response.status} ${response.statusText}.`);
  }
  const length = Number(response.headers.get("content-length") ?? 0);
  if (length > MAX_BYTES) throw new Error("That response is larger than the 50 MB limit.");
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error("That response is larger than the 50 MB limit.");

  return text;
}

/** Minimal RFC4180-ish CSV parser (handles quotes, escaped quotes, CRLF). */
export function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((c) => c !== "")) rows.push(row);

  const headers = (rows.shift() ?? []).map((h) => h.trim());
  return { headers, rows };
}

export async function loadCsvPreview(rawUrl: string) {
  const text = await fetchText(assertPublicHttpUrl(rawUrl));
  const { headers, rows } = parseCsv(text);
  if (!headers.length) throw new Error("No columns found in that CSV.");
  return { headers, rows: rows.slice(0, 5), rowCount: rows.length };
}

function guessNumber(value: string | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  // Number("") is 0, which would silently place blank rows at 0, 0.
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}


export async function loadCsvGeoJSON(rawUrl: string, latField: string, lonField: string) {
  const text = await fetchText(assertPublicHttpUrl(rawUrl));
  const { headers, rows } = parseCsv(text);
  const latIndex = headers.indexOf(latField);
  const lonIndex = headers.indexOf(lonField);
  if (latIndex < 0 || lonIndex < 0) {
    throw new Error("The chosen latitude or longitude column is no longer in that CSV.");
  }

  const features = [];
  for (const row of rows) {
    const lat = guessNumber(row[latIndex]);
    const lon = guessNumber(row[lonIndex]);
    if (lat == null || lon == null) continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
    // 0, 0 is almost always missing data rather than a real location.
    if (lat === 0 && lon === 0) continue;

    const properties: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      properties[header] = row[index] ?? "";
    });
    features.push({
      type: "Feature" as const,
      geometry: { type: "Point" as const, coordinates: [lon, lat] },
      properties,
    });
  }

  if (!features.length) throw new Error("No rows had usable coordinates.");
  return { type: "FeatureCollection", features } as unknown as FeatureCollection;
}

export type ArcgisServerType = "FeatureServer" | "MapServer";

export type ArcgisEndpoint =
  | { kind: "layer"; serverType: ArcgisServerType; url: string; layerId: number }
  | { kind: "service"; serverType: ArcgisServerType; url: string };

/** Classify a pasted ArcGIS REST URL as a service root or a single layer. */
export function classifyArcgisUrl(rawUrl: string): ArcgisEndpoint {
  const url = assertPublicHttpUrl(rawUrl);
  url.search = "";
  url.hash = "";
  url.pathname = url.pathname.replace(/\/+$/, "");

  const match = url.pathname.match(/\/(FeatureServer|MapServer)(\/(\d+))?$/i);
  if (!match) {
    throw new Error(
      "This URL isn't an ArcGIS REST endpoint. Expect a URL containing /FeatureServer or /MapServer, optionally followed by a layer number.",
    );
  }
  const serverType: ArcgisServerType = /featureserver/i.test(match[1] ?? "")
    ? "FeatureServer"
    : "MapServer";

  if (match[3] === undefined) {
    return { kind: "service", serverType, url: url.toString() };
  }
  return { kind: "layer", serverType, url: url.toString(), layerId: Number(match[3]) };
}

type ArcgisLayerMeta = {
  name?: string;
  type?: string;
  description?: string;
  geometryType?: string;

  capabilities?: string;
  drawingInfo?: unknown;
  error?: { message?: string; details?: string[] };
  layers?: { id: number; name?: string; geometryType?: string; type?: string; subLayerIds?: number[] | null }[];
  tables?: { id: number; name?: string }[];
};

async function fetchArcgisJson(url: URL, what: string): Promise<ArcgisLayerMeta> {
  let parsed: ArcgisLayerMeta;
  try {
    parsed = JSON.parse(await fetchText(url)) as ArcgisLayerMeta;
  } catch (error) {
    throw new Error(`Couldn't read ${what} from ${url.origin}${url.pathname}: ${(error as Error).message}`);
  }
  if (parsed.error) {
    throw new Error(
      `The ArcGIS service returned an error for ${url.pathname}: ${parsed.error.message ?? "unknown error"}`,
    );
  }
  return parsed;
}

export type ArcgisDescription =
  | {
      kind: "service";
      serverType: ArcgisServerType;
      url: string;
      layers: {
        id: number;
        name: string;
        geometryType: string | null;
        url: string;
        raster: boolean;
      }[];
    }
  | {
      kind: "layer";
      serverType: ArcgisServerType;
      url: string;
      name: string;
      geometryType: string | null;
      /** Imagery rather than features: drawn as map tiles, styled as a raster. */
      raster: boolean;
      description: string | null;
      layerType: string | null;
    };


/** Inspect an ArcGIS REST URL: list a service's layers, or describe a single layer. */
export async function describeArcgis(rawUrl: string): Promise<ArcgisDescription> {
  const endpoint = classifyArcgisUrl(rawUrl);
  const metaUrl = new URL(endpoint.url);
  metaUrl.searchParams.set("f", "json");
  const meta = await fetchArcgisJson(metaUrl, `${endpoint.serverType} metadata`);

  if (endpoint.kind === "service") {
    const layers = (meta.layers ?? []).filter(
      (layer) => !(layer.subLayerIds && layer.subLayerIds.length) && layer.type !== "Group Layer",
    );
    if (!layers.length) {
      throw new Error(
        `This ${endpoint.serverType} doesn't expose any queryable layers. Point at a specific layer, e.g. ${endpoint.url}/0`,
      );
    }
    return {
      kind: "service",
      serverType: endpoint.serverType,
      url: endpoint.url,
      layers: layers.map((layer) => ({
        id: layer.id,
        name: layer.name ?? `Layer ${layer.id}`,
        geometryType: layer.geometryType ?? null,
        url: `${endpoint.url}/${layer.id}`,
        raster: !layer.geometryType,
      })),
    };
  }

  // Imagery layers report no geometry type; they're drawn as tiles instead of
  // being queried for features.
  const raster = isRasterMeta(meta, endpoint.serverType);
  if (!raster) assertQueryableLayer(meta, endpoint.serverType);
  return {
    kind: "layer",
    serverType: endpoint.serverType,
    url: endpoint.url,
    name: meta.name ?? `${endpoint.serverType} layer`,
    geometryType: meta.geometryType ?? null,
    raster,
    description: meta.description ?? null,
    layerType: meta.type ?? null,
  };
}

function isRasterMeta(meta: ArcgisLayerMeta, serverType: ArcgisServerType) {
  if (meta.geometryType) return false;
  if (meta.type === "Group Layer") return false;
  if (meta.layers && meta.layers.length) return false;
  // Feature services never serve imagery.
  return serverType === "MapServer";
}

function assertQueryableLayer(meta: ArcgisLayerMeta, serverType: ArcgisServerType) {
  if (meta.type === "Group Layer" || (meta.layers && meta.layers.length && !meta.geometryType)) {
    throw new Error(
      `This ArcGIS layer can't be queried. Detected: ${serverType} group layer. Add one of its sublayers instead.`,
    );
  }
  if (!meta.geometryType) {
    throw new Error(
      `This ArcGIS layer has no vector geometry. Detected: ${serverType} ${meta.type ?? "layer"}. Open Field supports point, line and polygon layers.`,
    );
  }
  const capabilities = (meta.capabilities ?? "Query").toLowerCase();
  if (!capabilities.includes("query")) {
    throw new Error(
      `This ${serverType} layer doesn't allow queries (capabilities: ${meta.capabilities}). Ask the publisher to enable Query, or use a different layer.`,
    );
  }
}


type EsriGeometry = {
  x?: number;
  y?: number;
  points?: number[][];
  paths?: number[][][];
  rings?: number[][][];
};

/** Convert an Esri JSON feature set into GeoJSON (MapServer fallback path). */
export function esriJsonToGeoJSON(payload: {
  geometryType?: string;
  features?: { attributes?: Record<string, unknown>; geometry?: EsriGeometry | null }[];
}): FeatureCollection {
  const features = (payload.features ?? []).flatMap((feature) => {
    const geometry = feature.geometry;
    if (!geometry) return [];
    let geo: { type: string; coordinates: unknown } | null = null;

    if (typeof geometry.x === "number" && typeof geometry.y === "number") {
      geo = { type: "Point", coordinates: [geometry.x, geometry.y] };
    } else if (geometry.points) {
      geo = { type: "MultiPoint", coordinates: geometry.points };
    } else if (geometry.paths) {
      geo =
        geometry.paths.length === 1
          ? { type: "LineString", coordinates: geometry.paths[0] }
          : { type: "MultiLineString", coordinates: geometry.paths };
    } else if (geometry.rings) {
      geo = { type: "Polygon", coordinates: geometry.rings };
    }
    if (!geo) return [];
    return [
      {
        type: "Feature" as const,
        geometry: geo,
        properties: feature.attributes ?? {},
      },
    ];
  });
  return { type: "FeatureCollection", features } as unknown as FeatureCollection;
}

export async function loadArcgisGeoJSON(rawUrl: string) {
  const endpoint = classifyArcgisUrl(rawUrl);
  if (endpoint.kind === "service") {
    throw new Error(
      `That's an ArcGIS ${endpoint.serverType} root, not a layer. Choose a layer from the service, e.g. ${endpoint.url}/0`,
    );
  }

  const metaUrl = new URL(endpoint.url);
  metaUrl.searchParams.set("f", "json");
  const meta = await fetchArcgisJson(metaUrl, `${endpoint.serverType} layer metadata`);
  assertQueryableLayer(meta, endpoint.serverType);

  // MapServer endpoints often reject f=geojson; fall back to Esri JSON once and stay there.
  let format: "geojson" | "json" = "geojson";

  const fetchPage = async (offset: number): Promise<{ fc: FeatureCollection; exceeded: boolean }> => {
    const request = async (f: "geojson" | "json") => {
      const queryUrl = new URL(`${endpoint.url}/query`);
      queryUrl.searchParams.set("where", "1=1");
      queryUrl.searchParams.set("outFields", "*");
      queryUrl.searchParams.set("outSR", "4326");
      queryUrl.searchParams.set("f", f);
      queryUrl.searchParams.set("resultRecordCount", String(ARCGIS_PAGE_SIZE));
      if (offset > 0) queryUrl.searchParams.set("resultOffset", String(offset));
      return JSON.parse(await fetchText(queryUrl)) as {
        error?: { message?: string };
        exceededTransferLimit?: boolean;
        properties?: { exceededTransferLimit?: boolean };
        features?: unknown[];
      };
    };

    let parsed = await request(format);
    if (format === "geojson" && (parsed?.error || !toFeatureCollection(parsed))) {
      format = "json";
      parsed = await request("json");
    }
    if (parsed?.error) {
      throw new Error(
        `The ArcGIS ${endpoint.serverType} refused the query: ${parsed.error.message ?? "unknown error"}`,
      );
    }

    const fc =
      format === "geojson"
        ? toFeatureCollection(parsed)
        : esriJsonToGeoJSON(parsed as Parameters<typeof esriJsonToGeoJSON>[0]);
    if (!fc) {
      throw new Error(
        `The ArcGIS ${endpoint.serverType} didn't return usable geometry for this layer.`,
      );
    }
    const exceeded = Boolean(parsed.exceededTransferLimit ?? parsed.properties?.exceededTransferLimit);
    return { fc, exceeded };
  };

  const features: FeatureCollection["features"] = [];
  let offset = 0;
  let truncated = false;
  let previousFirst: string | null = null;

  for (;;) {
    const { fc, exceeded } = await fetchPage(offset);
    const page = fc.features ?? [];
    if (!page.length) break;

    // A service that ignores resultOffset keeps replaying the same first page.
    const firstKey = JSON.stringify(page[0]);
    if (previousFirst !== null && firstKey === previousFirst) break;
    previousFirst = firstKey;

    features.push(...page);

    if (features.length >= MAX_ARCGIS_FEATURES) {
      truncated = true;
      features.length = MAX_ARCGIS_FEATURES;
      break;
    }
    if (page.length < ARCGIS_PAGE_SIZE && !exceeded) break;
    offset += page.length;
  }

  if (!features.length) {
    throw new Error(`The ${endpoint.serverType} returned no features for this layer.`);
  }

  return {
    name: meta.name ?? `${endpoint.serverType} layer`,
    serverType: endpoint.serverType,
    featureCollection: { type: "FeatureCollection", features } as unknown as FeatureCollection,
    truncated,
  };
}



export function summarize(name: string, fc: FeatureCollection): RemoteSummary {
  return {
    name,
    geometryType: detectGeometryType(fc),
    featureCount: fc.features.length,
    bbox: computeBbox(fc),
    fields: collectFields(fc),
  };
}
