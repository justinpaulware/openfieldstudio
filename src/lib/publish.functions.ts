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

export const submitComment = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        slug: z.string().min(1).max(120),
        lng: z.number().min(-180).max(180),
        lat: z.number().min(-90).max(90),
        body: z.string().trim().min(2).max(2000),
        category: z.string().max(80).nullish(),
        authorName: z.string().trim().max(120).nullish(),
        authorEmail: z.string().trim().email().max(255).nullish().or(z.literal("")),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { submitPublicComment } = await import("./publish.server");
    return submitPublicComment({
      ...data,
      authorEmail: data.authorEmail || null,
    });
  });

export const listApprovedComments = createServerFn({ method: "GET" })
  .inputValidator((data) => z.object({ slug: z.string().min(1).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { loadApprovedComments } = await import("./publish.server");
    return loadApprovedComments(data.slug);
  });
