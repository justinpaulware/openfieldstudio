import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getPublishedMap = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        username: z.string().min(1).max(30),
        slug: z.string().min(1).max(120),
        viewSlug: z.string().min(1).max(120).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { loadPublishedMap } = await import("./publish.server");
    return loadPublishedMap(data.username, data.slug, data.viewSlug ?? null);
  });

export const getPublishedLayerData = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        username: z.string().min(1).max(30),
        slug: z.string().min(1).max(120),
        layerId: z.string().uuid(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { loadPublishedLayerData } = await import("./publish.server");
    return loadPublishedLayerData(data.username, data.slug, data.layerId);
  });

const position = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]);

const geometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Point"), coordinates: position }),
  z.object({ type: z.literal("LineString"), coordinates: z.array(position).min(2).max(500) }),
  z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(position).min(4).max(500)).min(1).max(1),
  }),
]);

export const submitComment = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        username: z.string().min(1).max(30),
        slug: z.string().min(1).max(120),
        lng: z.number().min(-180).max(180),
        lat: z.number().min(-90).max(90),
        body: z.string().trim().min(2).max(2000),
        category: z.string().max(80).nullish(),
        authorName: z.string().trim().max(120).nullish(),
        authorEmail: z.string().trim().email().max(255).nullish().or(z.literal("")),
        geometry: geometrySchema.nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { submitPublicComment } = await import("./publish.server");
    return submitPublicComment({
      username: data.username,
      slug: data.slug,
      lng: data.lng,
      lat: data.lat,
      body: data.body,
      category: data.category ?? null,
      authorName: data.authorName ?? null,
      authorEmail: data.authorEmail || null,
      geometry: data.geometry ?? null,
    });
  });

export const listApprovedComments = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({ username: z.string().min(1).max(30), slug: z.string().min(1).max(120) })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { loadApprovedComments } = await import("./publish.server");
    return loadApprovedComments(data.username, data.slug);
  });
