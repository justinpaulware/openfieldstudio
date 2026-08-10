/** Server-only helpers backing the public map viewer. */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseLayerFields, toFeatureCollection } from "@/lib/geo";

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
  layer_styles: unknown;
};
export type PublishedFolder = Database["public"]["Tables"]["layer_folders"]["Row"];

export async function loadPublishedMap(slug: string) {
  const supabase = publicClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select("*")
    .eq("slug", slug)
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

  return {
    project: project as PublishedProject,
    layers: (layersResult.data ?? []) as PublishedLayer[],
    folders: (foldersResult.data ?? []) as PublishedFolder[],
  };
}

/** Fetch one layer's features for a published project. Verifies the project first. */
export async function loadPublishedLayerData(slug: string, layerId: string) {
  const supabase = publicClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("slug", slug)
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
