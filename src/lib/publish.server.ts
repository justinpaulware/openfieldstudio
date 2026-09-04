/** Server-only helpers backing the public map viewer. */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseLayerFields, toFeatureCollection } from "@/lib/geo";
import type { StyleRelation } from "@/lib/layer-style";

/** Publishable-key client: RLS applies as `anon`, so only published projects resolve. */
export function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export type PublishedProject = Database["public"]["Tables"]["projects"]["Row"];
export type PublishedLayer = Database["public"]["Tables"]["layers"]["Row"] & {
  layer_styles: StyleRelation;
};
export type PublishedFolder = Database["public"]["Tables"]["layer_folders"]["Row"];

/** Resolve a public `[username]/[map-slug]` pair to a published project id. */
async function resolveOwner(
  supabase: ReturnType<typeof publicClient>,
  username: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return data?.id ?? null;
}

export async function loadPublishedMap(username: string, slug: string, viewSlug?: string | null) {
  const supabase = publicClient();
  const ownerId = await resolveOwner(supabase, username);
  if (!ownerId) return null;
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("published_slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  if (!project) return null;

  const [layersResult, foldersResult] = await Promise.all([
    supabase
      .from("layers")
      .select("*, layer_styles(*)")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("layer_folders")
      .select("*")
      .eq("project_id", project.id)
      .order("sort_order", { ascending: true }),
  ]);
  if (layersResult.error) throw layersResult.error;
  if (foldersResult.error) throw foldersResult.error;

  // Resolve the requested view (or the Main view) and apply its overrides.
  const viewQuery = supabase
    .from("project_views")
    .select("*")
    .eq("project_id", project.id)
    .eq("status", "published");
  const { data: view } = await (viewSlug
    ? viewQuery.eq("slug", viewSlug)
    : viewQuery.eq("is_main", true)
  ).maybeSingle();
  if (!view) return null;

  const { data: viewLayers } = await supabase
    .from("view_layers")
    .select("*")
    .eq("view_id", view.id);

  const overrides = new Map((viewLayers ?? []).map((row) => [row.layer_id, row]));
  const layers = ((layersResult.data ?? []) as PublishedLayer[])
    .map((layer) => {
      const override = overrides.get(layer.id);
      return override
        ? {
            ...layer,
            visible: override.visible,
            opacity: override.opacity,
            sort_order: override.sort_order,
            filter_config: override.filter_config,
          }
        : layer;
    })
    .sort((a, b) => a.sort_order - b.sort_order);

  return {
    project: {
      ...(project as PublishedProject),
      title: view.is_main ? project.title : `${project.title} — ${view.name}`,
      description: view.description ?? project.description,
      map_center: view.map_center,
      map_zoom: view.map_zoom,
      map_pitch: view.map_pitch,
      map_bearing: view.map_bearing,
      basemap: view.basemap,
      show_legend: view.show_legend,
      scale_units: view.scale_units,
    } as PublishedProject,
    view: { id: view.id, name: view.name, slug: view.slug, is_main: view.is_main },
    layers,
    folders: (foldersResult.data ?? []) as PublishedFolder[],
  };
}

/** Fetch one layer's features for a published project. Verifies the project first. */
export async function loadPublishedLayerData(username: string, slug: string, layerId: string) {
  const supabase = publicClient();
  const ownerId = await resolveOwner(supabase, username);
  if (!ownerId) return null;
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("published_slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!project) return null;

  const { data: layer } = await supabase
    .from("layers")
    .select("*")
    .eq("id", layerId)
    .eq("project_id", project.id)
    .maybeSingle();
  if (!layer) return null;

  if (layer.source_type === "geojson_file") {
    if (!layer.storage_path) return null;
    // Private bucket: anonymous visitors can't sign URLs, so read it server-side.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.storage
      .from("datasets")
      .download(layer.storage_path);
    if (error) throw error;
    return toFeatureCollection(JSON.parse(await data.text()));
  }

  const fields = parseLayerFields(layer.fields);
  if (layer.source_type === "csv_url") {
    if (!layer.source_url || !fields.latField || !fields.lonField) return null;
    const { loadCsvGeoJSON } = await import("./datasets.server");
    return loadCsvGeoJSON(layer.source_url, fields.latField, fields.lonField);
  }

  if (!layer.source_url) return null;
  const { loadArcgisGeoJSON } = await import("./datasets.server");
  const { featureCollection } = await loadArcgisGeoJSON(layer.source_url);
  return featureCollection;
}

const MAX_BODY = 2000;

/** Public comment submission. RLS enforces "published + comments enabled". */
export async function submitPublicComment(input: {
  username: string;
  slug: string;
  lng: number;
  lat: number;
  body: string;
  category?: string | null;
  authorName?: string | null;
  authorEmail?: string | null;
  geometry?: { type: "Point" | "LineString" | "Polygon"; coordinates: unknown } | null;
}) {
  const supabase = publicClient();
  const ownerId = await resolveOwner(supabase, input.username);
  const { data: project } = ownerId
    ? await supabase
        .from("projects")
        .select("id, comments_enabled, comment_categories, comments_allow_shapes")
        .eq("owner_id", ownerId)
        .eq("published_slug", input.slug)
        .eq("status", "published")
        .maybeSingle()
    : { data: null };
  if (!project) return { ok: false as const, error: "This map is not published." };
  if (!project.comments_enabled) {
    return { ok: false as const, error: "Comments are turned off for this map." };
  }

  const geometry = input.geometry ?? null;
  const geometryType = geometry?.type ?? "Point";
  if (geometryType !== "Point" && !project.comments_allow_shapes) {
    return {
      ok: false as const,
      error: "This map only accepts pinned comments.",
    };
  }

  const category =
    input.category && project.comment_categories.includes(input.category) ? input.category : null;

  const { error } = await supabase.from("comments").insert({
    project_id: project.id,
    lng: input.lng,
    lat: input.lat,
    geometry:
      geometryType === "Point"
        ? { type: "Point", coordinates: [input.lng, input.lat] }
        : (geometry as unknown as import("@/integrations/supabase/types").Json),
    body: input.body.trim().slice(0, MAX_BODY),
    category,
    author_name: input.authorName?.trim() || null,
    author_email: input.authorEmail?.trim() || null,
  });
  if (error) return { ok: false as const, error: "Your comment could not be saved." };
  return { ok: true as const };
}


/** Approved comments for a published map. */
export async function loadApprovedComments(username: string, slug: string) {
  const supabase = publicClient();
  const ownerId = await resolveOwner(supabase, username);
  if (!ownerId) return [];
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("published_slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!project) return [];
  const { data } = await supabase
    .from("comments")
    .select("id, lng, lat, body, category, author_name, created_at, geometry, geometry_type")
    .eq("project_id", project.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
}
