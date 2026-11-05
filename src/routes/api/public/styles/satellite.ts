import { createFileRoute } from "@tanstack/react-router";
import { buildSatelliteStyle, styleResponse } from "@/lib/satellite-style";

/** Public satellite basemap style (Esri World Imagery). No secrets. */
export const Route = createFileRoute("/api/public/styles/satellite")({
  server: {
    handlers: {
      GET: async () => styleResponse(await buildSatelliteStyle(false)),
    },
  },
});
