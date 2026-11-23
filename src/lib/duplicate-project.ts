/**
 * Deep-copy a project: settings, layer folders, layers (with their own copies
 * of uploaded files), styles/labels/popups, views and per-view layer settings.
 * Comments are not copied — the duplicate starts with a clean slate.
 */
import { supabase } from "@/integrations/supabase/client";
import { uniqueProjectSlug } from "@/lib/slug";

const strip = <T extends Record<string, unknown>>(row: T, keys: string[]) => {
  const out: Record<string, unknown> = { ...row };
  for (const k of keys) delete out[k];
  return out;
};

export async function duplicateProject(sourceId: string): Promise<string> {
  const { data: auth } = await supabase.auth.getUser();
  const userId = auth.user?.id;
  if (!userId) throw new Error("Not signed in");

  const { data: src, error: srcErr } = await supabase
    .from("projects").select("*").eq("id", sourceId).single();
  if (srcErr) throw srcErr;

  const title = `${src.title} (copy)`;
  const slug = await uniqueProjectSlug(userId, title);
  const { data: proj, error: projErr } = await supabase
    .from("projects")
    .insert({
      ...(strip(src, ["id", "created_at", "updated_at", "published_at", "default_view_id", "thumbnail_url"]) as object),
      owner_id: userId,
      title,
      slug,
      published_slug: slug,
      status: "draft",
    })
    .select("id")
    .single();
  if (projErr) throw projErr;
  const newId = proj.id;

  try {
    // Layer folders, parents before children.
    const { data: folders } = await supabase.from("layer_folders").select("*").eq("project_id", sourceId);
    const folderMap = new Map<string, string>();
    let pending = [...(folders ?? [])];
    while (pending.length) {
      const ready = pending.filter((f) => !f.parent_id || folderMap.has(f.parent_id));
      if (!ready.length) break;
      for (const f of ready) {
        const { data, error } = await supabase
          .from("layer_folders")
          .insert({
            ...(strip(f, ["id", "created_at", "updated_at"]) as object),
            project_id: newId,
            parent_id: f.parent_id ? folderMap.get(f.parent_id) ?? null : null,
          })
          .select("id").single();
        if (error) throw error;
        folderMap.set(f.id, data.id);
      }
      pending = pending.filter((f) => !folderMap.has(f.id));
    }

    // Layers + styles, each uploaded file copied so the two maps stay independent.
    const { data: layers } = await supabase.from("layers").select("*").eq("project_id", sourceId);
    const layerMap = new Map<string, string>();
    const fileMap = new Map<string, string>();
    for (const layer of layers ?? []) {
      let storagePath = layer.storage_path;
      if (storagePath) {
        const existing = fileMap.get(storagePath);
        if (existing) storagePath = existing;
        else {
          const next = `${userId}/${newId}/${crypto.randomUUID()}.geojson`;
          const { error } = await supabase.storage.from("datasets").copy(storagePath, next);
          if (error) throw error;
          fileMap.set(storagePath, next);
          storagePath = next;
        }
      }
      const { data: created, error } = await supabase
        .from("layers")
        .insert({
          ...(strip(layer, ["id", "created_at", "updated_at"]) as object),
          project_id: newId,
          storage_path: storagePath,
          folder_id: layer.folder_id ? folderMap.get(layer.folder_id) ?? null : null,
        } as never)
        .select("id").single();
      if (error) throw error;
      layerMap.set(layer.id, created.id);
    }

    if (layerMap.size) {
      const { data: styles } = await supabase
        .from("layer_styles").select("*").in("layer_id", [...layerMap.keys()]);
      const rows = (styles ?? []).map((s) => ({
        ...(strip(s, ["id", "created_at", "updated_at"]) as never as object),
        layer_id: layerMap.get(s.layer_id)!,
      }));
      if (rows.length) {
        const { error } = await supabase.from("layer_styles").insert(rows as never);
        if (error) throw error;
      }
    }

    // Views: the Main view already exists (database trigger); others are created.
    const { data: srcViews } = await supabase.from("project_views").select("*").eq("project_id", sourceId);
    const { data: newMain } = await supabase
      .from("project_views").select("id").eq("project_id", newId).eq("is_main", true).single();
    const viewMap = new Map<string, string>();
    const viewFields = ["id", "project_id", "slug", "is_main", "status", "published_at", "thumbnail_url", "created_at", "updated_at"];
    for (const v of srcViews ?? []) {
      if (v.is_main && newMain) {
        await supabase.from("project_views").update(strip(v, viewFields) as never).eq("id", newMain.id);
        viewMap.set(v.id, newMain.id);
      } else if (!v.is_main) {
        const { data, error } = await supabase
          .from("project_views")
          .insert({ ...(strip(v, viewFields.filter((k) => k !== "slug")) as object), project_id: newId, is_main: false, status: "draft" } as never)
          .select("id").single();
        if (error) throw error;
        viewMap.set(v.id, data.id);
      }
    }

    if (viewMap.size) {
      const { data: vls } = await supabase
        .from("view_layers").select("*").in("view_id", [...viewMap.keys()]);
      const rows = (vls ?? [])
        .filter((r) => layerMap.has(r.layer_id))
        .map((r) => ({
          ...(strip(r, ["id"]) as never as object),
          view_id: viewMap.get(r.view_id)!,
          layer_id: layerMap.get(r.layer_id)!,
        }));
      if (rows.length) {
        const { error } = await supabase
          .from("view_layers").upsert(rows as never, { onConflict: "view_id,layer_id" });
        if (error) throw error;
      }
    }

    if (src.default_view_id && viewMap.has(src.default_view_id)) {
      await supabase.from("projects").update({ default_view_id: viewMap.get(src.default_view_id)! }).eq("id", newId);
    }
  } catch (e) {
    await supabase.from("projects").delete().eq("id", newId);
    throw e;
  }
  return newId;
}
