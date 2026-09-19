import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PlaceResult = {
  id: string;
  /** Short primary label, e.g. "123 Main Street". */
  name: string;
  /** Remainder of the address, e.g. "Peekskill, NY". */
  context: string;
  lng: number;
  lat: number;
  /** [west, south, east, north] when the provider supplies one. */
  bbox: [number, number, number, number] | null;
  /** Rough result size, used to choose a zoom level. */
  kind: "address" | "place" | "area";
};

const CACHE = new Map<string, { at: number; results: PlaceResult[] }>();
const TTL = 5 * 60 * 1000;

const AREA_CLASSES = new Set(["boundary", "place", "landuse", "natural", "waterway"]);

function classify(row: { class?: string; type?: string; addresstype?: string }): PlaceResult["kind"] {
  const type = row.addresstype ?? row.type ?? "";
  if (["house", "building", "address"].includes(type) || row.class === "building") return "address";
  if (row.class && AREA_CLASSES.has(row.class)) return "area";
  return "place";
}

function splitLabel(display: string) {
  const parts = display.split(",").map((part) => part.trim());
  const name = parts.shift() ?? display;
  // Keep the context short: locality, region, country.
  const context = parts.filter(Boolean).slice(0, 3).join(", ");
  return { name, context };
}

/**
 * Place lookup for the published-map search card. Runs server-side against
 * Nominatim (OpenStreetMap) so the browser never hits their CORS/rate limits,
 * with a short in-memory cache for repeated keystrokes.
 */
export const searchPlaces = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        query: z.string().trim().min(2).max(120),
        /** [west, south, east, north] of the current map view, used as a bias. */
        viewbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<PlaceResult[]> => {
    const box = data.viewbox
      ? data.viewbox.map((n) => Number(n.toFixed(4))).join(",")
      : "";
    const key = `${data.query.toLowerCase()}|${box}`;
    const cached = CACHE.get(key);
    if (cached && Date.now() - cached.at < TTL) return cached.results;

    const params = new URLSearchParams({
      q: data.query,
      format: "jsonv2",
      limit: "6",
      addressdetails: "0",
    });
    if (data.viewbox) {
      const [w, s, e, n] = data.viewbox;
      params.set("viewbox", `${w},${n},${e},${s}`);
    }

    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        headers: {
          "User-Agent": "OpenField/1.0 (https://openfield.nu) map address search",
          Accept: "application/json",
        },
      });
      if (!response.ok) return [];
      const rows = (await response.json()) as Array<Record<string, unknown>>;
      const results: PlaceResult[] = rows.slice(0, 6).map((row, index) => {
        const display = String(row["display_name"] ?? "");
        const { name, context } = splitLabel(display);
        const bb = row["boundingbox"] as string[] | undefined;
        const bbox =
          bb && bb.length === 4
            ? ([Number(bb[2]), Number(bb[0]), Number(bb[3]), Number(bb[1])] as [
                number,
                number,
                number,
                number,
              ])
            : null;
        return {
          id: String(row["place_id"] ?? `${index}-${display}`),
          name,
          context,
          lng: Number(row["lon"]),
          lat: Number(row["lat"]),
          bbox: bbox && bbox.every(Number.isFinite) ? bbox : null,
          kind: classify(row as { class?: string; type?: string; addresstype?: string }),
        };
      });
      const clean = results.filter((r) => Number.isFinite(r.lng) && Number.isFinite(r.lat));
      CACHE.set(key, { at: Date.now(), results: clean });
      if (CACHE.size > 200) CACHE.delete(CACHE.keys().next().value as string);
      return clean;
    } catch {
      return [];
    }
  });
