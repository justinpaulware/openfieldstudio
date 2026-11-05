import { createFileRoute } from "@tanstack/react-router";
import { buildSatelliteStyle, styleResponse } from "@/lib/satellite-style";

/** Public satellite basemap with place and street names on top. No secrets. */
export const Route = createFileRoute("/api/public/styles/satellite-labels")({
  server: {
    handlers: {
      GET: async () => styleResponse(await buildSatelliteStyle(true)),
    },
  },
});
