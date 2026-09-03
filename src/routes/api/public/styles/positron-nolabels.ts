import { createFileRoute } from "@tanstack/react-router";

/**
 * Public, label-free variant of the OpenFreeMap Positron basemap.
 *
 * Fetches the upstream Positron style JSON, drops every `symbol` layer that
 * carries a `text-field` (place names, road names, water names, shields —
 * all 19 of them in the current style), and returns the stripped style so
 * MapLibre can load it like any other basemap URL. The sprite, glyphs, and
 * tile sources inside the style stay as absolute OpenFreeMap URLs, so they
 * keep working unchanged. No secrets; fully public and edge-cacheable.
 */
export const Route = createFileRoute("/api/public/styles/positron-nolabels")({
  server: {
    handlers: {
      GET: async () => {
        const upstream = "https://tiles.openfreemap.org/styles/positron";
        const res = await fetch(upstream, { headers: { Accept: "application/json" } });
        if (!res.ok) {
          return new Response(`Upstream style unavailable (${res.status})`, {
            status: 502,
            headers: { "Content-Type": "text/plain" },
          });
        }
        const style = (await res.json()) as {
          layers?: Array<{ type: string; layout?: Record<string, unknown> }>;
        };
        const layers = (style.layers ?? []).filter(
          (l) => !(l.type === "symbol" && l.layout && "text-field" in l.layout),
        );
        const stripped = { ...style, layers };
        return new Response(JSON.stringify(stripped), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
