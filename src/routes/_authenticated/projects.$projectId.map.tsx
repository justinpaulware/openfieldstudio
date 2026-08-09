import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderPlus, List, Loader2, Maximize, Plus, X } from "lucide-react";

import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LayerPanel, flattenLayerOrder, type FolderRow } from "@/components/map/layer-panel";
import { AddLayerDialog } from "@/components/map/add-layer-dialog";
import { AttributeTable } from "@/components/map/attribute-table";
import { LayerSourceDialog } from "@/components/map/layer-source-dialog";
import { StylePanel } from "@/components/map/style-panel";
import { MapLegend, type LegendEntry } from "@/components/map/map-legend";
import { useLayerRefresh, type SourcePatch } from "@/components/map/use-layer-refresh";
import { useLayerData, type LayerRow } from "@/components/map/use-layer-data";
import type { MapHandle, RenderLayer, ScaleUnits } from "@/components/map/map-canvas";
import {
  DEFAULT_LAYER_STYLE,
  geometryKind,
  resolveLayerStyle,
  styleToRow,
  type LayerStyle,
} from "@/lib/layer-style";
import type { Bbox, PropertyValue } from "@/lib/geo";
import type { Tables } from "@/integrations/supabase/types";

const MapCanvas = lazy(() => import("@/components/map/map-canvas"));

type MapSearch = { style?: boolean };

export const Route = createFileRoute("/_authenticated/projects/$projectId/map")({
  validateSearch: (search: Record<string, unknown>): MapSearch => ({
    style: search["style"] === true || search["style"] === "true" ? true : undefined,
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

type LayerWithStyle = LayerRow & { layer_styles: Tables<"layer_styles">[] | null };


function MapEditor() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const mapHandle = useRef<MapHandle>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [tableLayerId, setTableLayerId] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ name: string; props: Record<string, PropertyValue> } | null>(
    null,
  );
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

  const { data: layers = [], isLoading: layersLoading } = useQuery({
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
      if (layer.storage_path) {
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

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase.from("layers").update({ sort_order: index }).eq("id", id),
        ),
      );
    },
    onSuccess: invalidateLayers,
    onError: (error: Error) => toast.error(error.message),
  });

  const saveView = useMutation({
    mutationFn: async (patch?: { basemap?: string; scale_units?: string }) => {
      const view = viewRef.current ?? mapHandle.current?.getView() ?? null;
      const { error } = await supabase
        .from("projects")
        .update({
          ...(view
            ? {
                map_center: view.center,
                map_zoom: view.zoom,
                map_pitch: view.pitch,
                map_bearing: view.bearing,
              }
            : {}),
          ...(patch ?? {}),
        })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      setViewDirty(false);
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const [basemap, setBasemap] = useState<string | null>(null);
  const activeBasemap = basemap ?? project?.basemap ?? "positron";
  const [scaleUnits, setScaleUnits] = useState<ScaleUnits | null>(null);
  const activeScaleUnits: ScaleUnits =
    scaleUnits ?? ((project as { scale_units?: string } | undefined)?.scale_units as ScaleUnits) ?? "imperial";


  const renderLayers: RenderLayer[] = useMemo(
    () =>
      flattenLayerOrder(layers, folders).map((layer) => {
        const style = (layer as LayerWithStyle).layer_styles?.[0];
        return {
          id: layer.id,
          visible: layer.visible,
          opacity: layer.opacity,
          geometryType: layer.geometry_type,
          data: byId[layer.id] ?? null,
          style: {
            fillColor: style?.fill_color ?? DEFAULT_STYLE.fillColor,
            strokeColor: style?.stroke_color ?? DEFAULT_STYLE.strokeColor,
            strokeWidth: style?.stroke_width ?? DEFAULT_STYLE.strokeWidth,
            circleRadius: style?.circle_radius ?? DEFAULT_STYLE.circleRadius,
            fillOpacity: style?.fill_opacity ?? DEFAULT_STYLE.fillOpacity,
          },
        };
      }),
    [layers, folders, byId],
  );

  const handleMoveEnd = useCallback(
    (view: { center: [number, number]; zoom: number; pitch: number; bearing: number }) => {
      viewRef.current = view;
      setViewDirty(true);
    },
    [],
  );

  const handleFeatureClick = useCallback(
    (layerId: string, props: Record<string, unknown>) => {
      const layer = layers.find((l) => l.id === layerId);
      setPopup({
        name: layer?.name ?? "Feature",
        props: props as Record<string, PropertyValue>,
      });
    },
    [layers],
  );

  const zoomTo = (bbox: Bbox | null | undefined) => {
    if (!bbox) {
      toast.info("That layer has no coordinates to zoom to.");
      return;
    }
    mapHandle.current?.fitBbox(bbox);
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
  const hasSavedView = !!project?.map_center;

  useEffect(() => {
    if (autoFitted.current || hasSavedView || !allLayersBbox) return;
    autoFitted.current = true;
    const timer = setTimeout(() => mapHandle.current?.fitBbox(allLayersBbox), 400);
    return () => clearTimeout(timer);
  }, [allLayersBbox, hasSavedView]);



  const tableLayer = layers.find((l) => l.id === tableLayerId) ?? null;
  const sourceLayer = layers.find((l) => l.id === sourceLayerId) ?? null;
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

  const initialView = {
    center: [project.map_center?.[0] ?? 0, project.map_center?.[1] ?? 20] as [number, number],
    zoom: project.map_zoom ?? 2,
    pitch: project.map_pitch ?? 0,
    bearing: project.map_bearing ?? 0,
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center justify-end gap-3 border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
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
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
            <div className="flex items-baseline gap-2">
              <h2 className="text-sm font-semibold">Layers</h2>
              <span className="font-secondary text-xs text-muted-foreground">{layers.length}</span>
            </div>
            <div className="flex items-center gap-1">
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
                loading={loading}
                errors={errors}
                refreshingId={refreshLayer.isPending ? (refreshLayer.variables?.layer.id ?? null) : null}
                selectedId={selectedId}
                onSelect={(id) => setSelectedId((current) => (current === id ? null : id))}
                onToggleVisible={(layer) =>
                  updateLayer.mutate({ id: layer.id, patch: { visible: !layer.visible } })
                }
                onOpacity={(layer, opacity) =>
                  updateLayer.mutate({ id: layer.id, patch: { opacity } })
                }
                onRename={(layer, name) => updateLayer.mutate({ id: layer.id, patch: { name } })}
                onZoomTo={(layer) => zoomTo(layer.bbox as Bbox | null)}
                onDelete={(layer) => deleteLayer.mutate(layer)}
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
                onFeatureClick={handleFeatureClick}
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

          {popup && (
            <div className="absolute right-4 top-4 max-h-[60%] w-72 overflow-y-auto rounded-xl border border-border bg-card/95 p-4 shadow-[var(--shadow-soft)] backdrop-blur">
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold">{popup.name}</h3>
                <button
                  type="button"
                  onClick={() => setPopup(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <dl className="mt-3 space-y-2">
                {Object.entries(popup.props).map(([key, value]) => (
                  <div key={key}>
                    <dt className="font-secondary text-[11px] uppercase tracking-wide text-muted-foreground">
                      {key}
                    </dt>
                    <dd className="text-sm break-words">{String(value ?? "—")}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </main>
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
        data={tableLayer ? (byId[tableLayer.id] ?? null) : null}
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
