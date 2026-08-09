import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { LayerPanel, type FolderRow } from "@/components/map/layer-panel";
import { AddLayerDialog } from "@/components/map/add-layer-dialog";
import { AttributeTable } from "@/components/map/attribute-table";
import { LayerSourceDialog } from "@/components/map/layer-source-dialog";
import { useLayerRefresh, type SourcePatch } from "@/components/map/use-layer-refresh";
import { useLayerData, type LayerRow } from "@/components/map/use-layer-data";
import { BASEMAPS, type MapHandle, type RenderLayer } from "@/components/map/map-canvas";
import type { Bbox, PropertyValue } from "@/lib/geo";
import type { Tables } from "@/integrations/supabase/types";

const MapCanvas = lazy(() => import("@/components/map/map-canvas"));

export const Route = createFileRoute("/_authenticated/projects/$projectId_/map")({
  head: () => ({
    meta: [
      { title: "Map editor — Open Field" },
      {
        name: "description",
        content: "Add data, arrange layers and frame the view for your Open Field webmap.",
      },
      { property: "og:title", content: "Map editor — Open Field" },
      { property: "og:description", content: "Build an interactive webmap in Open Field." },
    ],
  }),
  component: MapEditor,
});

type LayerWithStyle = LayerRow & { layer_styles: Tables<"layer_styles">[] | null };

const DEFAULT_STYLE = {
  fillColor: "#f5c518",
  strokeColor: "#1b1d22",
  strokeWidth: 1,
  circleRadius: 5,
  fillOpacity: 0.55,
};

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
    mutationFn: async (basemap?: string) => {
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
          ...(basemap ? { basemap } : {}),
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

  const renderLayers: RenderLayer[] = useMemo(
    () =>
      layers.map((layer) => {
        const style = layer.layer_styles?.[0];
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
    [layers, byId],
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

  const tableLayer = layers.find((l) => l.id === tableLayerId) ?? null;
  const nextSortOrder = layers.length
    ? Math.min(...layers.map((l) => l.sort_order)) - 1
    : 0;

  if (projectLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
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
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/projects/$projectId" params={{ projectId }}>
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              {project.title}
            </Link>
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={activeBasemap}
            onValueChange={(value) => {
              setBasemap(value);
              saveView.mutate(value);
            }}
          >
            <SelectTrigger className="h-9 w-[190px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BASEMAPS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            disabled={!viewDirty || saveView.isPending}
            onClick={() => saveView.mutate(undefined)}
          >
            {saveView.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {viewDirty ? "Save view" : "View saved"}
          </Button>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            Add data
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-72 shrink-0 flex-col border-r border-border bg-card/40 md:flex">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Layers</h2>
            <span className="font-secondary text-xs text-muted-foreground">{layers.length}</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {layersLoading ? (
              <div className="flex justify-center py-10">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <LayerPanel
                layers={layers}
                loading={loading}
                errors={errors}
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
    </div>
  );
}
