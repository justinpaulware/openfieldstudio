/**
 * Project views: named, independently publishable configurations of one project.
 *
 * A view stores its own map framing (center/zoom/pitch/bearing), basemap and
 * chrome settings, plus a `view_layers` row per layer with the layer's
 * visibility, opacity, order and filter *within that view*. The Main view is
 * created automatically by a database trigger and mirrors the project row so
 * older project-level reads keep working.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { slugify } from "@/lib/slug";

export type ProjectView = Tables<"project_views">;
export type ViewLayer = Tables<"view_layers">;

/** Per-layer settings a view can override. */
export type ViewOverride = {
  visible: boolean;
  opacity: number;
  sort_order: number;
  filter_config: unknown;
};

export function useProjectViews(projectId: string) {
  return useQuery({
    queryKey: ["project-views", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_views")
        .select("*")
        .eq("project_id", projectId)
        .order("is_main", { ascending: false })
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ProjectView[];
    },
    enabled: !!projectId,
  });
}

export function useViewLayers(viewId: string | null | undefined) {
  return useQuery({
    queryKey: ["view-layers", viewId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("view_layers")
        .select("*")
        .eq("view_id", viewId!);
      if (error) throw error;
      return (data ?? []) as ViewLayer[];
    },
    enabled: !!viewId,
  });
}

/** Index `view_layers` rows by layer id for quick override lookups. */
export function overrideMap(rows: ViewLayer[] | undefined): Record<string, ViewOverride> {
  const out: Record<string, ViewOverride> = {};
  for (const row of rows ?? []) {
    out[row.layer_id] = {
      visible: row.visible,
      opacity: row.opacity,
      sort_order: row.sort_order,
      filter_config: row.filter_config,
    };
  }
  return out;
}

/** Apply a view's per-layer overrides on top of the project's layer rows. */
export function applyViewOverrides<
  T extends {
    id: string;
    visible: boolean;
    opacity: number;
    sort_order: number;
    filter_config: unknown;
  },
>(layers: T[], overrides: Record<string, ViewOverride>): T[] {
  return layers
    .map((layer) => {
      const override = overrides[layer.id];
      return override ? { ...layer, ...override } : layer;
    })
    .sort((a, b) => a.sort_order - b.sort_order);
}

/** Unique, url-safe slug for a new view inside one project. */
export function uniqueViewSlug(name: string, existing: ProjectView[]): string {
  const base = slugify(name) || "view";
  const taken = new Set(existing.map((v) => v.slug));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

type CreateInput = { name: string; from?: ProjectView | null };

/** Create a view, seeding its layer settings from an existing view when given. */
export function useCreateView(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, from }: CreateInput) => {
      const { data: existing } = await supabase
        .from("project_views")
        .select("*")
        .eq("project_id", projectId);
      const views = (existing ?? []) as ProjectView[];
      const slug = uniqueViewSlug(name, views);

      const { data: created, error } = await supabase
        .from("project_views")
        .insert({
          project_id: projectId,
          name: name.trim() || "New view",
          slug,
          is_main: false,
          status: "draft",
          sort_order: views.length,
          ...(from
            ? {
                description: from.description,
                map_center: from.map_center,
                map_zoom: from.map_zoom,
                map_pitch: from.map_pitch,
                map_bearing: from.map_bearing,
                basemap: from.basemap,
                show_legend: from.show_legend,
                scale_units: from.scale_units,
                embed_config: from.embed_config,
              }
            : {}),
        })
        .select("*")
        .single();
      if (error) throw error;

      // Seed layer settings: copy the source view when duplicating, otherwise
      // fall back to the project's own layer defaults.
      let seed: {
        layer_id: string;
        visible: boolean;
        opacity: number;
        sort_order: number;
        filter_config: unknown;
        style_override?: unknown;
      }[] = [];

      if (from) {
        const { data: rows } = await supabase
          .from("view_layers")
          .select("*")
          .eq("view_id", from.id);
        seed = (rows ?? []).map((row) => ({
          layer_id: row.layer_id,
          visible: row.visible,
          opacity: row.opacity,
          sort_order: row.sort_order,
          filter_config: row.filter_config,
          style_override: row.style_override,
        }));
      }

      if (!seed.length) {
        const { data: layers } = await supabase
          .from("layers")
          .select("id, visible, opacity, sort_order, filter_config")
          .eq("project_id", projectId);
        seed = (layers ?? []).map((layer) => ({
          layer_id: layer.id,
          visible: layer.visible,
          opacity: layer.opacity,
          sort_order: layer.sort_order,
          filter_config: layer.filter_config,
        }));
      }

      if (seed.length) {
        const { error: seedError } = await supabase
          .from("view_layers")
          .insert(seed.map((row) => ({ ...row, view_id: created.id })) as never);
        if (seedError) throw seedError;
      }

      return created as ProjectView;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-views", projectId] });
    },
  });
}

export function useUpdateView(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ProjectView> }) => {
      const { error } = await supabase.from("project_views").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-views", projectId] });
    },
  });
}

export function useDeleteView(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (view: ProjectView) => {
      if (view.is_main) throw new Error("The Main view cannot be deleted.");
      const { error } = await supabase.from("project_views").delete().eq("id", view.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["project-views", projectId] });
    },
  });
}
