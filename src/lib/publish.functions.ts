import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getPublishedMap = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { loadPublishedMap } = await import("./publish.server");
    return loadPublishedMap(data.slug);
  });

export const getPublishedLayerData = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ slug: z.string().min(1).max(120), layerId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { loadPublishedLayerData } = await import("./publish.server");
    return loadPublishedLayerData(data.slug, data.layerId);
  });
