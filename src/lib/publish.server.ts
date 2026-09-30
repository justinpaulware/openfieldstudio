/** Server-only helpers backing the public map viewer. */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { parseLayerFields, toFeatureCollection } from "@/lib/geo";
import type { StyleRelation } from "@/lib/layer-style";
import { allowCommentReplies, commentGeometryTypes } from "@/lib/comment-style";


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

  // All published views of this project, ordered (Main first) — powers the switcher.
  const { data: publishedViews } = await supabase
    .from("project_views")
    .select("*")
    .eq("project_id", project.id)
    .eq("status", "published")
    .order("is_main", { ascending: false })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  const views = publishedViews ?? [];

  // Resolve the requested view: explicit slug, else the project's default, else Main.
  const view = viewSlug
    ? views.find((v) => v.slug === viewSlug)
    : (views.find((v) => v.id === project.default_view_id) ?? views.find((v) => v.is_main));
  if (!view) return null;

  // Every published view's layer overrides, fetched once. The viewer keeps these
  // client-side so switching views is instant instead of a fresh server round-trip.
  const { data: allViewLayers } = await supabase
    .from("view_layers")
    .select("*")
    .in(
      "view_id",
      views.map((v) => v.id),
    );

  const byView = new Map<string, typeof allViewLayers>();
  for (const row of allViewLayers ?? []) {
    const list = byView.get(row.view_id) ?? [];
    list.push(row);
    byView.set(row.view_id, list);
  }

  const baseLayers = (layersResult.data ?? []) as PublishedLayer[];

  /** Per-view settings the viewer needs to re-render without another fetch. */
  const viewConfigs = views.map((v) => ({
    id: v.id,
    name: v.name,
    slug: v.slug,
    is_main: v.is_main,
    title: v.is_main ? project.title : `${project.title} — ${v.name}`,
    description: v.description ?? project.description,
    map_center: v.map_center,
    map_zoom: v.map_zoom,
    map_pitch: v.map_pitch,
    map_bearing: v.map_bearing,
    basemap: v.basemap,
    show_legend: v.show_legend,
    scale_units: v.scale_units,
    viewNav: project.view_nav_enabled && v.show_view_nav && views.length > 1,
    addressSearch: (v.embed_config as { addressSearch?: boolean } | null)?.addressSearch === true,
    addressLookup: (v.embed_config as { addressLookup?: unknown } | null)?.addressLookup ?? null,
    overrides: Object.fromEntries(
      (byView.get(v.id) ?? []).map((row) => [
        row.layer_id,
        {
          visible: row.visible,
          opacity: row.opacity,
          sort_order: row.sort_order,
          filter_config: row.filter_config,
        },
      ]),
    ),
  }));

  const overrides = new Map((byView.get(view.id) ?? []).map((row) => [row.layer_id, row]));
  const layers = baseLayers
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
    views: views.map((v) => ({
      id: v.id,
      name: v.name,
      slug: v.slug,
      is_main: v.is_main,
    })),
    /** All published views' settings + layer overrides, for instant switching. */
    viewConfigs,
    viewNav: project.view_nav_enabled && view.show_view_nav && views.length > 1,
    // Per-view address search flag, stored alongside the embed settings.
    addressSearch:
      (view.embed_config as { addressSearch?: boolean } | null)?.addressSearch === true,
    addressLookup: (view.embed_config as { addressLookup?: unknown } | null)?.addressLookup ?? null,
    /** Layers with the active view's overrides already applied. */
    layers,
    /** Layers exactly as stored on the project, before any view override. */
    baseLayers,
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
        .select(
          "id, comments_enabled, comment_categories, comments_allow_shapes, embed_config",
        )
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
  const allowed = commentGeometryTypes(project.embed_config, project.comments_allow_shapes);
  const allowedForType =
    geometryType === "Point" ? allowed.point : geometryType === "LineString" ? allowed.line : allowed.area;
  if (!allowedForType) {
    return {
      ok: false as const,
      error: "This map does not accept that kind of comment.",
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
    geometry_type: geometryType,
    // Everything submitted here came through the published map itself.
    source: "Webmap",
  });
  if (error) return { ok: false as const, error: "Your comment could not be saved." };
  return { ok: true as const };
}


/** Approved comments for a published map, with reaction tallies. */
export async function loadApprovedComments(
  username: string,
  slug: string,
  visitorId: string | null,
) {
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
    .select(
      "id, lng, lat, body, category, author_name, created_at, source, geometry, geometry_type",
    )
    .eq("project_id", project.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false })
    .limit(500);
  const comments = data ?? [];
  if (!comments.length) return [];

  const ids = comments.map((c) => c.id);
  const { data: reactions } = await supabase
    .from("comment_reactions")
    .select("comment_id, visitor_id, vote")
    .in("comment_id", ids);

  const tally = new Map<string, { up: number; down: number; mine: number }>();
  for (const row of reactions ?? []) {
    const entry = tally.get(row.comment_id) ?? { up: 0, down: 0, mine: 0 };
    if (row.vote > 0) entry.up += 1;
    else entry.down += 1;
    if (visitorId && row.visitor_id === visitorId) entry.mine = row.vote;
    tally.set(row.comment_id, entry);
  }

  const { data: replyRows } = await supabase
    .from("comment_replies")
    .select("id, comment_id, body, author_name, is_team_reply, created_at")
    .in("comment_id", ids)
    .eq("status", "approved")
    .order("created_at", { ascending: true })
    .limit(2000);
  const repliesByComment = new Map<string, typeof replyRows>();
  for (const reply of replyRows ?? []) {
    const list = repliesByComment.get(reply.comment_id) ?? [];
    list.push(reply);
    repliesByComment.set(reply.comment_id, list);
  }

  return comments.map((comment) => {
    const entry = tally.get(comment.id) ?? { up: 0, down: 0, mine: 0 };
    return {
      ...comment,
      upvotes: entry.up,
      downvotes: entry.down,
      myVote: entry.mine,
      replies: repliesByComment.get(comment.id) ?? [],
    };
  });
}

/**
 * Post a visitor reply under an approved comment. Only works when the map is
 * published, comments are on, and the owner has allowed replies.
 */
export async function submitPublicReply(input: {
  commentId: string;
  body: string;
  authorName?: string | null;
}) {
  const supabase = publicClient();
  const { data: comment } = await supabase
    .from("comments")
    .select("id, project_id, projects!inner(status, comments_enabled, embed_config)")
    .eq("id", input.commentId)
    .eq("status", "approved")
    .maybeSingle();
  if (!comment) return { ok: false as const, error: "That comment is not available." };
  const project = comment.projects as unknown as {
    status: string;
    comments_enabled: boolean;
    embed_config: unknown;
  };
  if (project.status !== "published" || !project.comments_enabled) {
    return { ok: false as const, error: "Comments are turned off for this map." };
  }
  if (!allowCommentReplies(project.embed_config)) {
    return { ok: false as const, error: "Replies are turned off for this map." };
  }

  const { error } = await supabase.from("comment_replies").insert({
    comment_id: comment.id,
    project_id: comment.project_id,
    body: input.body.trim().slice(0, 1000),
    author_name: input.authorName?.trim() || null,
    is_team_reply: false,
  });
  if (error) return { ok: false as const, error: "Your reply could not be saved." };
  return { ok: true as const };
}


/**
 * Cast, switch or clear a visitor's reaction on a public comment. Runs with
 * admin rights but only ever touches approved comments on published maps.
 */
export async function reactToPublicComment(input: {
  commentId: string;
  visitorId: string;
  vote: -1 | 0 | 1;
}) {
  const supabase = publicClient();
  const { data: comment } = await supabase
    .from("comments")
    .select("id, project_id, projects!inner(status, comments_enabled)")
    .eq("id", input.commentId)
    .eq("status", "approved")
    .maybeSingle();
  if (!comment) return { ok: false as const, error: "That comment is not available." };

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  if (input.vote === 0) {
    await supabaseAdmin
      .from("comment_reactions")
      .delete()
      .eq("comment_id", input.commentId)
      .eq("visitor_id", input.visitorId);
  } else {
    await supabaseAdmin
      .from("comment_reactions")
      .upsert(
        { comment_id: input.commentId, visitor_id: input.visitorId, vote: input.vote },
        { onConflict: "comment_id,visitor_id" },
      );
  }

  const { data: rows } = await supabaseAdmin
    .from("comment_reactions")
    .select("vote")
    .eq("comment_id", input.commentId);
  const up = (rows ?? []).filter((r) => r.vote > 0).length;
  const down = (rows ?? []).length - up;
  return { ok: true as const, upvotes: up, downvotes: down, myVote: input.vote };
}
