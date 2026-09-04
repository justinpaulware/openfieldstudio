import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, List, Loader2, Maximize, Palette, Plus } from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useProjectId } from "@/components/projects/project-context";
import { supabase } from "@/integrations/supabase/client";
import { ProjectHeaderActions } from "@/components/project-header";

import { LayerPanel, flattenLayerOrder, type FolderRow } from "@/components/map/layer-panel";
import { AddLayerDialog } from "@/components/map/add-layer-dialog";
import { AttributeTable } from "@/components/map/attribute-table";
import { LayerSourceDialog } from "@/components/map/layer-source-dialog";
import {
  LayerEditor,
  type EditorSection,
  type StyleSaveState,
} from "@/components/map/layer-editor";
import {
  MapLegend,
  MapTitleCard,
  type LegendEntry,
  type LegendGroup,
} from "@/components/map/map-legend";

import { useLayerRefresh, type SourcePatch } from "@/components/map/use-layer-refresh";
import {
  applyViewOverrides,
  overrideMap,
  useProjectViews,
  useViewLayers,
  type ViewLayer,
} from "@/lib/views";

import { useLayerData, type LayerRow } from "@/components/map/use-layer-data";
import type { MapHandle, RenderLayer, ScaleUnits } from "@/components/map/map-canvas";
import { captureProjectThumbnail } from "@/lib/thumbnails";
import {
  DEFAULT_LAYER_STYLE,
  geometryKind,
  resolveLayerStyle,
  styleRowFromRelation,
  styleToRow,
  type LayerStyle,
  type StyleRelation,
} from "@/lib/layer-style";
import {
  isRasterLayer,
  rasterSpecFor,
  resolveRasterStyle,
  type RasterStyle,
} from "@/lib/raster-style";

import { computeBbox, type Bbox, type FeatureCollection } from "@/lib/geo";
import {
  filterCollection,
  isFilterActive,
  parseFilterConfig,
  type FilterConfig,
} from "@/lib/layer-filter";

const MapCanvas = lazy(() => import("@/components/map/map-canvas"));

/** Attribute names present on the first few features of a dataset. */
function attributeFields(data: FeatureCollection | null | undefined): string[] {
  if (!data) return [];
  const names = new Set<string>();
  for (const feature of data.features.slice(0, 200)) {
    for (const key of Object.keys(feature.properties ?? {})) names.add(key);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}

type FieldValueEntry = { value: string; count: number };

/** Unique values for a field, most common first. */
function fieldValues(
  data: FeatureCollection | null | undefined,
  field: string,
): { value: string; count: number }[] {
  if (!data || !field) return [];
  const counts = new Map<string, number>();
  for (const feature of data.features) {
    const raw = (feature.properties ?? {})[field];
    const value = raw === null || raw === undefined ? "" : String(raw);
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}


/** Attribute names whose values parse as numbers on most features. */
function numericFields(data: FeatureCollection | null | undefined): string[] {
  if (!data) return [];
  const seen = new Map<string, { numeric: number; total: number }>();
  for (const feature of data.features.slice(0, 500)) {
    for (const [key, raw] of Object.entries(feature.properties ?? {})) {
      if (raw === null || raw === undefined || raw === "") continue;
      const entry = seen.get(key) ?? { numeric: 0, total: 0 };
      entry.total += 1;
      if (Number.isFinite(Number(raw))) entry.numeric += 1;
      seen.set(key, entry);
    }
  }
  return [...seen.entries()]
    .filter(([, entry]) => entry.total > 0 && entry.numeric / entry.total >= 0.8)
    .map(([key]) => key)
    .sort((a, b) => a.localeCompare(b));
}

/** All finite numeric values for a field, used to compute class breaks. */
function numberValues(data: FeatureCollection | null | undefined, field: string): number[] {
  if (!data || !field) return [];
  const out: number[] = [];
  for (const feature of data.features) {
    const raw = (feature.properties ?? {})[field];
    if (raw === null || raw === undefined || raw === "") continue;
    const value = Number(raw);
    if (Number.isFinite(value)) out.push(value);
  }
  return out;
}

type MapSearch = { style?: boolean | undefined; view?: string | undefined };

export const Route = createFileRoute("/_authenticated/projects/$projectSlug/map")({
  validateSearch: (search: Record<string, unknown>): MapSearch => ({
    ...(search["style"] === true || search["style"] === "true" ? { style: true as const } : {}),
    ...(typeof search["view"] === "string" && search["view"] && search["view"] !== "main"
      ? { view: search["view"] }
      : {}),
  }),
  head: () => ({
    meta: [
      { title: "Map editor — Open Field" },
      {
        name: "description",
        content: "Add data, style layers and frame the view for your Open Field webmap.",
      },
      { property: "og:title", content: "Map editor — Open Field" },
      { property: "og:description", content: "Build an interactive webmap in Open Field." },
    ],
  }),
  component: MapEditor,
});

type LayerWithStyle = LayerRow & { layer_styles: StyleRelation };


function MapEditor() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const mapHandle = useRef<MapHandle>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [tableLayerId, setTableLayerId] = useState<string | null>(null);
  const [viewDirty, setViewDirty] = useState(false);
  const viewRef = useRef<{
    center: [number, number];
    zoom: number;
    pitch: number;
    bearing: number;
  } | null>(null);

  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: rawLayers = [], isLoading: layersLoading } = useQuery({
    queryKey: ["layers", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("layers")
        .select("*, layer_styles(*)")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LayerWithStyle[];
    },
  });

  // Active view: everything below reads its per-layer overrides and framing.
  const search = Route.useSearch();
  const { data: views = [] } = useProjectViews(projectId);
  const activeView =
    views.find((v) => v.slug === (search.view ?? "main")) ?? views.find((v) => v.is_main) ?? null;
  const { data: viewLayerRows = [] } = useViewLayers(activeView?.id ?? null);
  const overrides = useMemo(() => overrideMap(viewLayerRows), [viewLayerRows]);

  const layers = useMemo(
    () => applyViewOverrides(rawLayers, overrides) as LayerWithStyle[],
    [rawLayers, overrides],
  );

  const invalidateViewLayers = () =>
    queryClient.invalidateQueries({ queryKey: ["view-layers", activeView?.id] });

  /** Write a layer's per-view settings; the Main view mirrors to the layer row. */
  const setViewLayer = useMutation({
    mutationFn: async ({
      layerId,
      patch,
    }: {
      layerId: string;
      patch: { visible?: boolean; opacity?: number; sort_order?: number };
    }) => {
      if (activeView) {
        const { error } = await supabase
          .from("view_layers")
          .upsert({ view_id: activeView.id, layer_id: layerId, ...patch }, {
            onConflict: "view_id,layer_id",
          });
        if (error) throw error;
      }
      if (!activeView || activeView.is_main) {
        const { error } = await supabase.from("layers").update(patch).eq("id", layerId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void invalidateViewLayers();
      void queryClient.invalidateQueries({ queryKey: ["layers", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const { data: folders = [] } = useQuery({
    queryKey: ["layer-folders", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("layer_folders")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FolderRow[];
    },
  });

  const { byId, loading, errors } = useLayerData(layers);

  const invalidateLayers = () =>
    queryClient.invalidateQueries({ queryKey: ["layers", projectId] });
  const invalidateFolders = () =>
    queryClient.invalidateQueries({ queryKey: ["layer-folders", projectId] });

  const refreshLayer = useLayerRefresh(projectId);
  const [sourceLayerId, setSourceLayerId] = useState<string | null>(null);

  const createFolder = useMutation({
    mutationFn: async (parentId: string | null) => {
      const { error } = await supabase.from("layer_folders").insert({
        project_id: projectId,
        parent_id: parentId,
        name: parentId ? "New subfolder" : "New folder",
        sort_order: folders.length,
      });
      if (error) throw error;
    },
    onSuccess: invalidateFolders,
    onError: (error: Error) => toast.error(error.message),
  });

  const reorderFolders = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase.from("layer_folders").update({ sort_order: index }).eq("id", id),
        ),
      );
    },
    onSuccess: invalidateFolders,
    onError: (error: Error) => toast.error(error.message),
  });


  const updateFolder = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<FolderRow> }) => {
      const { error } = await supabase.from("layer_folders").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateFolders,
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteFolder = useMutation({
    mutationFn: async (folder: FolderRow) => {
      const childIds = folders.filter((f) => f.parent_id === folder.id).map((f) => f.id);
      const ids = [folder.id, ...childIds];
      const { error: moveError } = await supabase
        .from("layers")
        .update({ folder_id: null })
        .in("folder_id", ids);
      if (moveError) throw moveError;
      const { error } = await supabase.from("layer_folders").delete().eq("id", folder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Folder deleted — its layers moved to the top level.");
      void invalidateFolders();
      void invalidateLayers();
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const updateLayer = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<LayerRow> }) => {
      const { error } = await supabase.from("layers").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidateLayers,
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteLayer = useMutation({
    mutationFn: async (layer: LayerRow) => {
      // Duplicated layers share a stored file — only remove it with the last copy.
      const shared = layers.some(
        (other) => other.id !== layer.id && other.storage_path === layer.storage_path,
      );
      if (layer.storage_path && !shared) {
        await supabase.storage.from("datasets").remove([layer.storage_path]);
      }
      const { error } = await supabase.from("layers").delete().eq("id", layer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Layer removed.");
      setSelectedId(null);
      void invalidateLayers();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const duplicateLayer = useMutation({
    mutationFn: async (layer: LayerRow) => {
      const { data: styleRow } = await supabase
        .from("layer_styles")
        .select("*")
        .eq("layer_id", layer.id)
        .maybeSingle();

      // sort_order is an integer: push the original and everything below it down
      // by one so the copy can sit directly above it.
      await Promise.all(
        layers
          .filter((other) => other.sort_order >= layer.sort_order)
          .map((other) =>
            supabase
              .from("layers")
              .update({ sort_order: other.sort_order + 1 })
              .eq("id", other.id),
          ),
      );

      const { data: created, error } = await supabase
        .from("layers")
        .insert({
          project_id: projectId,
          name: `${layer.name} copy`,
          source_type: layer.source_type,
          source_url: layer.source_url,
          storage_path: layer.storage_path,
          geometry_type: layer.geometry_type,
          feature_count: layer.feature_count,
          fields: layer.fields,
          bbox: layer.bbox,
          folder_id: layer.folder_id,
          visible: layer.visible,
          opacity: layer.opacity,
          sort_order: layer.sort_order,
        })
        .select("id")
        .single();
      if (error) throw error;

      if (styleRow && created) {
        const { error: styleError } = await supabase.from("layer_styles").insert({
          layer_id: created.id,
          fill_color: styleRow.fill_color,
          stroke_color: styleRow.stroke_color,
          stroke_width: styleRow.stroke_width,
          circle_radius: styleRow.circle_radius,
          fill_opacity: styleRow.fill_opacity,
          style_mode: styleRow.style_mode,
          style_config: styleRow.style_config,
        });
        if (styleError) throw styleError;
      }
    },
    onSuccess: () => {
      toast.success("Layer duplicated.");
      void invalidateLayers();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (activeView) {
        await Promise.all(
          orderedIds.map((id, index) =>
            supabase
              .from("view_layers")
              .upsert(
                { view_id: activeView.id, layer_id: id, sort_order: index },
                { onConflict: "view_id,layer_id" },
              ),
          ),
        );
      }
      if (!activeView || activeView.is_main) {
        await Promise.all(
          orderedIds.map((id, index) =>
            supabase.from("layers").update({ sort_order: index }).eq("id", id),
          ),
        );
      }
    },
    onSuccess: () => {
      void invalidateViewLayers();
      void invalidateLayers();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const saveView = useMutation({
    mutationFn: async (patch?: { basemap?: string; scale_units?: string; show_legend?: boolean }) => {
      const view = viewRef.current ?? mapHandle.current?.getView() ?? null;
      const framing = view
        ? {
            map_center: view.center,
            map_zoom: view.zoom,
            map_pitch: view.pitch,
            map_bearing: view.bearing,
          }
        : {};

      if (activeView) {
        const { error } = await supabase
          .from("project_views")
          .update({ ...framing, ...(patch ?? {}) })
          .eq("id", activeView.id);
        if (error) throw error;
      }

      // The Main view stays mirrored on the project row for legacy reads.
      if (!activeView || activeView.is_main) {
        const { error } = await supabase
          .from("projects")
          .update({ ...framing, ...(patch ?? {}) })
          .eq("id", projectId);
        if (error) throw error;
        await captureProjectThumbnail(projectId, mapHandle.current);
      }
    },
    onSuccess: () => {
      setViewDirty(false);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-views", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [basemap, setBasemap] = useState<string | null>(null);
  const activeBasemap = basemap ?? activeView?.basemap ?? project?.basemap ?? "positron";
  const [scaleUnits, setScaleUnits] = useState<ScaleUnits | null>(null);
  const activeScaleUnits: ScaleUnits =
    scaleUnits ??
    ((activeView?.scale_units ?? (project as { scale_units?: string } | undefined)?.scale_units) as
      | ScaleUnits
      | undefined) ??
    "imperial";
  const [legend, setLegend] = useState<boolean | null>(null);
  const showLegend =
    legend ??
    activeView?.show_legend ??
    (project as { show_legend?: boolean } | undefined)?.show_legend ??
    true;

  // Style drafts keep the map instant while the database write debounces.
  const [styleDrafts, setStyleDrafts] = useState<Record<string, LayerStyle>>({});
  const styleTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const pendingStyles = useRef<Record<string, LayerStyle>>({});
  const [saveState, setSaveState] = useState<Record<string, StyleSaveState>>({});
  const [styleLayerId, setStyleLayerId] = useState<string | null>(null);
  const [editorSection, setEditorSection] = useState<EditorSection>("symbology");

  // Filter drafts keep the map instant while the database write debounces.
  const [filterDrafts, setFilterDrafts] = useState<Record<string, FilterConfig>>({});
  const filterTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const filterFor = useCallback(
    (layer: LayerRow): FilterConfig =>
      filterDrafts[layer.id] ?? parseFilterConfig(layer.filter_config),
    [filterDrafts],
  );

  const persistFilter = useCallback(
    (layerId: string, config: FilterConfig) => {
      setFilterDrafts((drafts) => ({ ...drafts, [layerId]: config }));
      const timers = filterTimers.current;
      if (timers[layerId]) clearTimeout(timers[layerId]);
      timers[layerId] = setTimeout(async () => {
        delete timers[layerId];
        // Filters are a per-view setting; the Main view mirrors to the layer row.
        if (activeView) {
          const { error } = await supabase.from("view_layers").upsert(
            { view_id: activeView.id, layer_id: layerId, filter_config: config },
            { onConflict: "view_id,layer_id" },
          );
          if (error) {
            toast.error(`Filter was not saved: ${error.message}`);
            return;
          }
        }
        if (!activeView || activeView.is_main) {
          const { error } = await supabase
            .from("layers")
            .update({ filter_config: config })
            .eq("id", layerId);
          if (error) {
            toast.error(`Filter was not saved: ${error.message}`);
            return;
          }
        }
        // Patch the caches in place — refetching here re-mounts the panel mid-edit.
        queryClient.setQueryData(
          ["layers", projectId],
          (rows: LayerWithStyle[] | undefined) =>
            rows?.map((row) =>
              row.id === layerId ? { ...row, filter_config: config } : row,
            ),
        );
        if (activeView) {
          const cached = queryClient.getQueryData<ViewLayer[]>(["view-layers", activeView.id]);
          if (cached?.some((row) => row.layer_id === layerId)) {
            queryClient.setQueryData(["view-layers", activeView.id], (rows: ViewLayer[] | undefined) =>
              rows?.map((row) =>
                row.layer_id === layerId ? { ...row, filter_config: config } : row,
              ),
            );
          } else {
            // First write for this layer in this view: pick up the new row.
            void queryClient.invalidateQueries({ queryKey: ["view-layers", activeView.id] });
          }
        }


      }, 400);
    },
    [projectId, queryClient, activeView],
  );

  /** Raster appearance saves immediately; per-view where a named view is open. */
  const persistRaster = useCallback(
    (layerId: string, style: RasterStyle) => {
      void (async () => {
        if (activeView) {
          const { error } = await supabase.from("view_layers").upsert(
            { view_id: activeView.id, layer_id: layerId, raster_style: style },
            { onConflict: "view_id,layer_id" },
          );
          if (error) {
            toast.error(`Appearance was not saved: ${error.message}`);
            return;
          }
        }
        if (!activeView || activeView.is_main) {
          const { error } = await supabase
            .from("layers")
            .update({ raster_style: style })
            .eq("id", layerId);
          if (error) {
            toast.error(`Appearance was not saved: ${error.message}`);
            return;
          }
        }
        await queryClient.invalidateQueries({ queryKey: ["layers", projectId] });
        await queryClient.invalidateQueries({ queryKey: ["view-layers", activeView?.id] });
      })();
    },
    [projectId, queryClient, activeView],
  );



  const styleFor = useCallback(
    (layer: LayerWithStyle): LayerStyle =>
      styleDrafts[layer.id] ?? resolveLayerStyle(styleRowFromRelation(layer.layer_styles)),
    [styleDrafts],
  );

  const writeStyle = useCallback(
    async (layerId: string, style: LayerStyle) => {
      setSaveState((prev) => ({ ...prev, [layerId]: "saving" }));
      const { error } = await supabase
        .from("layer_styles")
        .upsert({ layer_id: layerId, ...styleToRow(style) }, { onConflict: "layer_id" });
      if (error) {
        pendingStyles.current[layerId] = pendingStyles.current[layerId] ?? style;
        toast.error(`Style was not saved: ${error.message}`);
        setSaveState((prev) => ({ ...prev, [layerId]: "dirty" }));
        return false;
      }

      if (pendingStyles.current[layerId] === style) delete pendingStyles.current[layerId];
      setStyleDrafts((drafts) =>
        pendingStyles.current[layerId]
          ? drafts
          : { ...drafts, [layerId]: style },
      );
      setSaveState((prev) =>
        pendingStyles.current[layerId] ? { ...prev, [layerId]: "dirty" } : { ...prev, [layerId]: "saved" },
      );
      await queryClient.invalidateQueries({ queryKey: ["layers", projectId] });
      return true;
    },
    [projectId, queryClient],
  );

  /** Write a queued style right away, cancelling its debounce. */
  const flushStyle = useCallback(
    (layerId: string) => {
      const timer = styleTimers.current[layerId];
      if (timer) {
        clearTimeout(timer);
        delete styleTimers.current[layerId];
      }
      const pending = pendingStyles.current[layerId];
      if (pending) void writeStyle(layerId, pending);
    },
    [writeStyle],
  );

  const flushAllStyles = useCallback(() => {
    Object.keys(pendingStyles.current).forEach((layerId) => flushStyle(layerId));
  }, [flushStyle]);

  const persistStyle = useCallback(
    (layerId: string, style: LayerStyle) => {
      pendingStyles.current[layerId] = style;
      setSaveState((prev) => ({ ...prev, [layerId]: "dirty" }));
      const timers = styleTimers.current;
      if (timers[layerId]) clearTimeout(timers[layerId]);
      timers[layerId] = setTimeout(() => {
        delete timers[layerId];
        writeStyle(layerId, style);
      }, 400);
    },
    [writeStyle],
  );

  // Never drop a queued style: flush on unmount, tab hide and page unload.
  const flushRef = useRef(flushAllStyles);
  flushRef.current = flushAllStyles;
  useEffect(() => {
    const flush = () => flushRef.current();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flush);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, []);


  const orderedLayers = useMemo(
    () => flattenLayerOrder(layers, folders) as LayerWithStyle[],
    [layers, folders],
  );

  /** Attribute filters apply everywhere the layer is used: map, legend, table. */
  const filteredById = useMemo(() => {
    const out: Record<string, FeatureCollection | null> = {};
    for (const layer of layers) {
      out[layer.id] = filterCollection(byId[layer.id] ?? null, filterFor(layer));
    }
    return out;
  }, [layers, byId, filterFor]);

  const renderLayers: RenderLayer[] = useMemo(
    () =>
      orderedLayers.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        geometryType: layer.geometry_type,
        data: filteredById[layer.id] ?? null,
        style: styleFor(layer),
        raster: rasterSpecFor(layer),
      })),
    [orderedLayers, filteredById, styleFor],
  );


  const legendGroups: LegendGroup[] = useMemo(() => {
    const toEntry = (layer: LayerWithStyle): LegendEntry => ({
      id: layer.id,
      name: layer.name,
      kind: geometryKind(layer.geometry_type),
      opacity: layer.opacity,
      style: styleFor(layer),
    });
    const visibleIn = (folderId: string | null) =>
      orderedLayers.filter((layer) => layer.visible && layer.folder_id === folderId).map(toEntry);

    const groups: LegendGroup[] = [];
    const ungrouped = visibleIn(null);
    if (ungrouped.length) groups.push({ id: "ungrouped", name: null, depth: 0, entries: ungrouped });

    const walk = (parentId: string | null, depth: number) => {
      folders
        .filter((folder) => folder.parent_id === parentId)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .forEach((folder) => {
          const entries = visibleIn(folder.id);
          if (entries.length) groups.push({ id: folder.id, name: folder.name, depth, entries });
          walk(folder.id, depth + 1);
        });
    };
    walk(null, 0);
    return groups;
  }, [orderedLayers, folders, styleFor]);



  const handleMoveEnd = useCallback(
    (view: { center: [number, number]; zoom: number; pitch: number; bearing: number }) => {
      viewRef.current = view;
      setViewDirty(true);
    },
    [],
  );

  const zoomTo = (bbox: Bbox | null | undefined) => {
    if (!bbox) {
      toast.info("That layer has no coordinates to zoom to.");
      return;
    }
    mapHandle.current?.fitBbox(bbox);
  };

  /** Zoom to what's actually shown: filtered extent when a filter is active. */
  const zoomToLayer = (layer: LayerWithStyle) => {
    if (isFilterActive(filterFor(layer))) {
      const data = filteredById[layer.id];
      if (data) {
        if (!data.features.length) {
          toast.info("No visible features to zoom to.");
          return;
        }
        const bbox = computeBbox(data);
        if (bbox) {
          mapHandle.current?.fitBbox(bbox);
          return;
        }
      }
    }
    zoomTo(layer.bbox as Bbox | null);
  };

  /** Union extent of every layer that has coordinates. */
  const allLayersBbox = useMemo<Bbox | null>(() => {
    let out: Bbox | null = null;
    for (const layer of layers) {
      const bbox = layer.bbox as Bbox | null;
      if (!bbox || bbox.length !== 4 || bbox.some((n) => !Number.isFinite(n))) continue;
      out = out
        ? [
            Math.min(out[0], bbox[0]),
            Math.min(out[1], bbox[1]),
            Math.max(out[2], bbox[2]),
            Math.max(out[3], bbox[3]),
          ]
        : bbox;
    }
    return out;
  }, [layers]);

  const autoFitted = useRef(false);
  const hasSavedView = !!(activeView?.map_center ?? project?.map_center);

  // Switching views re-frames the map and drops any unsaved local chrome edits.
  const lastViewId = useRef<string | null>(null);
  useEffect(() => {
    if (!activeView || lastViewId.current === activeView.id) return;
    const first = lastViewId.current === null;
    lastViewId.current = activeView.id;
    setBasemap(null);
    setScaleUnits(null);
    setLegend(null);
    setViewDirty(false);
    if (first || !activeView.map_center) return;
    mapHandle.current?.setView({
      center: [activeView.map_center[0] ?? 0, activeView.map_center[1] ?? 20],
      zoom: activeView.map_zoom,
      pitch: activeView.map_pitch,
      bearing: activeView.map_bearing,
    });
  }, [activeView]);

  useEffect(() => {
    if (autoFitted.current || hasSavedView || !allLayersBbox) return;
    autoFitted.current = true;
    const timer = setTimeout(() => mapHandle.current?.fitBbox(allLayersBbox), 400);
    return () => clearTimeout(timer);
  }, [allLayersBbox, hasSavedView]);

  // Arriving from the Styling tab opens the panel on the first layer.
  const styleParamHandled = useRef(false);
  useEffect(() => {
    if (styleParamHandled.current || !search.style || !orderedLayers.length) return;
    styleParamHandled.current = true;
    const first = orderedLayers[0];
    if (first) {
      setStyleLayerId(first.id);
      setSelectedId(first.id);
    }
  }, [search.style, orderedLayers]);

  const tableLayer = layers.find((l) => l.id === tableLayerId) ?? null;
  const sourceLayer = layers.find((l) => l.id === sourceLayerId) ?? null;
  const styleLayer = layers.find((l) => l.id === styleLayerId) ?? null;

  /** Attribute lists come from the unfiltered data so editor controls stay put. */
  const styleLayerData = styleLayer ? (byId[styleLayer.id] ?? null) : null;
  const editorFields = useMemo(() => attributeFields(styleLayerData), [styleLayerData]);
  const editorNumericFields = useMemo(() => numericFields(styleLayerData), [styleLayerData]);
  const editorValueCache = useRef<Map<FeatureCollection | null, Map<string, FieldValueEntry[]>>>(
    new Map(),
  );
  const editorValuesFor = useCallback(
    (field: string): FieldValueEntry[] => {
      let perData = editorValueCache.current.get(styleLayerData);
      if (!perData) {
        editorValueCache.current = new Map([[styleLayerData, new Map()]]);
        perData = editorValueCache.current.get(styleLayerData)!;
      }
      const hit = perData.get(field);
      if (hit) return hit;
      const values = fieldValues(styleLayerData, field);
      perData.set(field, values);
      return values;
    },
    [styleLayerData],
  );



  const toggleStyleEditor = () => {
    if (styleLayerId) {
      setStyleLayerId(null);
      return;
    }
    const target =
      orderedLayers.find((l) => l.id === selectedId) ??
      orderedLayers.find((l) => l.visible) ??
      orderedLayers[0];
    if (target) {
      setStyleLayerId(target.id);
      setSelectedId(target.id);
    }
  };

  const applyStyle = (layerId: string, current: LayerStyle, patch: Partial<LayerStyle>) => {
    const next = { ...current, ...patch };
    setStyleDrafts((drafts) => ({ ...drafts, [layerId]: next }));
    persistStyle(layerId, next);
  };

  const nextSortOrder = layers.length
    ? Math.min(...layers.map((l) => l.sort_order)) - 1
    : 0;

  if (projectLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">Project not found</h1>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  const framing = activeView ?? project;
  const initialView = {
    center: [framing.map_center?.[0] ?? 0, framing.map_center?.[1] ?? 20] as [number, number],
    zoom: framing.map_zoom ?? 2,
    pitch: framing.map_pitch ?? 0,
    bearing: framing.map_bearing ?? 0,
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <ProjectHeaderActions>
        <Button
          variant={showLegend ? "secondary" : "outline"}
          size="sm"
          title="Show legend on the map"
          onClick={() => {
            const next = !showLegend;
            setLegend(next);
            saveView.mutate({ show_legend: next });
          }}
        >
          <List className="mr-1.5 h-4 w-4" />
          Legend
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!allLayersBbox}
          title="Zoom to all layers"
          onClick={() => allLayersBbox && mapHandle.current?.fitBbox(allLayersBbox)}
        >
          <Maximize className="mr-1.5 h-4 w-4" />
          Zoom to all layers
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={!viewDirty || saveView.isPending}
          onClick={() => saveView.mutate(undefined)}
        >
          {saveView.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {viewDirty ? "Save view" : "View saved"}
        </Button>
        <Button
          variant={styleLayerId ? "secondary" : "outline"}
          size="sm"
          disabled={!orderedLayers.length}
          title="Open the layer editor"
          onClick={toggleStyleEditor}
        >
          <Palette className="mr-1.5 h-4 w-4" />
          Layer editor
        </Button>
      </ProjectHeaderActions>


      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold">Layers</h2>
              <span className="font-secondary text-xs text-muted-foreground">{layers.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant={styleLayerId ? "secondary" : "ghost"}
                size="icon"
                className="h-7 w-7"
                title="Layer editor"
                aria-label="Layer editor"
                disabled={!orderedLayers.length}
                onClick={toggleStyleEditor}
              >
                <Palette className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="New folder"
                aria-label="New folder"
                onClick={() => createFolder.mutate(null)}
              >
                <FolderPlus className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Add data"
                aria-label="Add data"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {layersLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <LayerPanel
                layers={layers}
                folders={folders}
                styleFor={(layer) => styleFor(layer as LayerWithStyle)}

                loading={loading}
                errors={errors}
                refreshingId={refreshLayer.isPending ? (refreshLayer.variables?.layer.id ?? null) : null}
                selectedId={selectedId}
                onSelect={(id) => {
                  if (styleLayerId) {
                    setStyleLayerId(id);
                    setSelectedId(id);
                    return;
                  }
                  setSelectedId((current) => (current === id ? null : id));
                }}
                onToggleVisible={(layer) =>
                  setViewLayer.mutate({ layerId: layer.id, patch: { visible: !layer.visible } })
                }
                onRename={(layer, name) => updateLayer.mutate({ id: layer.id, patch: { name } })}
                onZoomTo={(layer) => zoomToLayer(layer as LayerWithStyle)}
                onDelete={(layer) => deleteLayer.mutate(layer)}
                onDuplicate={(layer) => duplicateLayer.mutate(layer)}
                onReorder={(ids) => reorder.mutate(ids)}
                onOpenTable={(layer) => setTableLayerId(layer.id)}
                onRefresh={(layer) => refreshLayer.mutate({ layer })}
                onEditSource={(layer) => setSourceLayerId(layer.id)}
                onMoveToFolder={(layer, folderId) =>
                  updateLayer.mutate({ id: layer.id, patch: { folder_id: folderId } })
                }
                onFolderRename={(folder, name) =>
                  updateFolder.mutate({ id: folder.id, patch: { name } })
                }
                onFolderToggle={(folder) =>
                  updateFolder.mutate({ id: folder.id, patch: { collapsed: !folder.collapsed } })
                }
                onFolderDelete={(folder) => deleteFolder.mutate(folder)}
                onFolderMove={(folder, parentId) =>
                  updateFolder.mutate({ id: folder.id, patch: { parent_id: parentId } })
                }
                onFolderReorder={(ids) => reorderFolders.mutate(ids)}
                onCreateFolder={(parentId) => createFolder.mutate(parentId)}
                filteredFor={(layer) => isFilterActive(filterFor(layer))}
                onStyle={(layer) => {
                  setEditorSection("symbology");
                  setStyleLayerId(layer.id);
                  setSelectedId(layer.id);
                }}
                onFilter={(layer) => {
                  setEditorSection("filter");
                  setStyleLayerId(layer.id);
                  setSelectedId(layer.id);
                }}
              />
            )}
          </div>
        </aside>


        <main className="relative min-w-0 flex-1">
          <ClientOnly
            fallback={
              <div className="flex h-full items-center justify-center bg-muted/20">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center bg-muted/20">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <MapCanvas
                basemap={activeBasemap}
                layers={renderLayers}
                initialView={initialView}
                onMoveEnd={handleMoveEnd}
                handleRef={mapHandle}
                onBasemapChange={(id) => {
                  setBasemap(id);
                  saveView.mutate({ basemap: id });
                }}
                scaleUnits={activeScaleUnits}
                onScaleUnitsChange={(units) => {
                  setScaleUnits(units);
                  saveView.mutate({ scale_units: units });
                }}
              />
            </Suspense>
          </ClientOnly>

          {/* Printed-map overlay stack: title above the legend, top-left of the map. */}
          <div className="pointer-events-auto absolute left-2.5 top-2.5 z-10 flex flex-col items-start gap-2">
            <MapTitleCard title={project?.title ?? ""} />
            {showLegend && <MapLegend groups={legendGroups} />}
          </div>



        </main>

        {styleLayer && (
          <LayerEditor
            layerName={styleLayer.name}
            kind={geometryKind(styleLayer.geometry_type)}
            style={styleFor(styleLayer)}
            filter={filterFor(styleLayer)}
            raster={
              isRasterLayer(styleLayer)
                ? {
                    style: resolveRasterStyle(styleLayer.raster_style),
                    onChange: (patch) =>
                      persistRaster(styleLayer.id, {
                        ...resolveRasterStyle(styleLayer.raster_style),
                        ...patch,
                      }),
                  }
                : null
            }
            source={{

              sourceType: styleLayer.source_type,
              geometryType: styleLayer.geometry_type,
              storagePath: styleLayer.storage_path,
              sourceUrl: styleLayer.source_url,
            }}
            featureCount={byId[styleLayer.id]?.features.length ?? styleLayer.feature_count}
            filteredCount={
              filteredById[styleLayer.id]?.features.length ??
              byId[styleLayer.id]?.features.length ??
              styleLayer.feature_count
            }
            saveState={saveState[styleLayer.id] ?? "idle"}
            fields={editorFields}
            valuesFor={editorValuesFor}
            numericFields={editorNumericFields}
            numbersFor={(field) => numberValues(byId[styleLayer.id], field)}
            initialSection={editorSection}
            onChange={(patch) => applyStyle(styleLayer.id, styleFor(styleLayer), patch)}
            onFilterChange={(config) => persistFilter(styleLayer.id, config)}
            onRename={(name) => updateLayer.mutate({ id: styleLayer.id, patch: { name } })}
            onSave={() => flushStyle(styleLayer.id)}
            onReset={() => applyStyle(styleLayer.id, DEFAULT_LAYER_STYLE, {})}
            onClose={() => setStyleLayerId(null)}
          />
        )}

      </div>


      <AddLayerDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        projectId={projectId}
        nextSortOrder={nextSortOrder}
        onCreated={(bbox) => {
          void invalidateLayers();
          if (bbox) setTimeout(() => mapHandle.current?.fitBbox(bbox), 400);
        }}
      />

      <AttributeTable
        open={!!tableLayer}
        onOpenChange={(open) => !open && setTableLayerId(null)}
        layerName={tableLayer?.name ?? ""}
        data={tableLayer ? (filteredById[tableLayer.id] ?? null) : null}
      />

      <LayerSourceDialog
        layer={sourceLayer}
        open={!!sourceLayer}
        onOpenChange={(open) => !open && setSourceLayerId(null)}
        saving={refreshLayer.isPending}
        onSave={(patch: SourcePatch) => {
          if (!sourceLayer) return;
          refreshLayer.mutate(
            { layer: sourceLayer, patch },
            { onSuccess: () => setSourceLayerId(null) },
          );
        }}
      />

    </div>
  );
}
