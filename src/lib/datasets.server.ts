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

const MAX_BYTES = 25 * 1024 * 1024;

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
  if (length > MAX_BYTES) throw new Error("That file is larger than the 25 MB limit.");
  const text = await response.text();
  if (text.length > MAX_BYTES) throw new Error("That file is larger than the 25 MB limit.");
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
  const n = Number(value.trim());
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

function normalizeArcgisUrl(rawUrl: string): URL {
  const url = assertPublicHttpUrl(rawUrl);
  url.search = "";
  url.pathname = url.pathname.replace(/\/+$/, "");
  if (!/\/\d+$/.test(url.pathname)) {
    throw new Error("Point at a specific layer, e.g. .../FeatureServer/0");
  }
  return url;
}

export async function loadArcgisGeoJSON(rawUrl: string) {
  const base = normalizeArcgisUrl(rawUrl);

  const metaUrl = new URL(base.toString());
  metaUrl.searchParams.set("f", "json");
  const metaText = await fetchText(metaUrl);
  const meta = JSON.parse(metaText) as { name?: string; error?: { message?: string } };
  if (meta.error) throw new Error(meta.error.message ?? "The ArcGIS service returned an error.");

  const queryUrl = new URL(`${base.toString()}/query`);
  queryUrl.searchParams.set("where", "1=1");
  queryUrl.searchParams.set("outFields", "*");
  queryUrl.searchParams.set("outSR", "4326");
  queryUrl.searchParams.set("f", "geojson");
  queryUrl.searchParams.set("resultRecordCount", "5000");

  const dataText = await fetchText(queryUrl);
  const parsed = JSON.parse(dataText) as unknown;
  if ((parsed as { error?: { message?: string } })?.error) {
    throw new Error(
      (parsed as { error?: { message?: string } }).error?.message ??
        "The ArcGIS service returned an error.",
    );
  }
  const fc = toFeatureCollection(parsed);
  if (!fc) throw new Error("That service didn't return GeoJSON features.");
  return { name: meta.name ?? "ArcGIS layer", featureCollection: fc };
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
