import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const previewCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ url: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { loadCsvPreview } = await import("./datasets.server");
    return loadCsvPreview(data.url);
  });

export const loadCsvLayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ url: z.string().min(1), latField: z.string().min(1), lonField: z.string().min(1) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { loadCsvGeoJSON, summarize } = await import("./datasets.server");
    const fc = await loadCsvGeoJSON(data.url, data.latField, data.lonField);
    return { featureCollection: fc, summary: summarize("CSV layer", fc) };
  });

export const describeArcgisService = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ url: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { describeArcgis } = await import("./datasets.server");
    return describeArcgis(data.url);
  });

export const loadArcgisLayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ url: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const { loadArcgisGeoJSON, summarize } = await import("./datasets.server");
    const { name, featureCollection, truncated, serverType } = await loadArcgisGeoJSON(data.url);
    return {
      featureCollection,
      summary: summarize(name, featureCollection),
      truncated,
      serverType,
    };
  });


