import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ClientOnly, Link } from "@tanstack/react-router";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PendingPin } from "@/components/comments/comment-composer";
import { CommentPanel, type PublicComment } from "@/components/comments/comment-panel";
import { getPublishedLayerData, listApprovedComments } from "@/lib/publish.functions";
import { flattenLayerOrder } from "@/components/map/layer-panel";
import { filterCollection, parseFilterConfig } from "@/lib/layer-filter";
import {
  MapLegend,
  MapTitleCard,
  type LegendEntry,
  type LegendGroup,
} from "@/components/map/map-legend";
import type { MapHandle, RenderLayer, ScaleUnits } from "@/components/map/map-canvas";
import {
  geometryKind,
  resolveLayerStyle,
  styleRowFromRelation,
  type StyleRelation,
} from "@/lib/layer-style";
import type { Bbox, FeatureCollection } from "@/lib/geo";
import type { Tables } from "@/integrations/supabase/types";

const MapCanvas = lazy(() => import("@/components/map/map-canvas"));

export const SITE = "https://openfield.nu";

type ViewerLayer = Tables<"layers"> & { layer_styles: StyleRelation };
type ViewerFolder = Tables<"layer_folders">;

export type ViewerSearch = { legend?: false; title?: false };

/** Shape returned by the published-map loader. */
export type PublishedMapData = {
  project: Tables<"projects">;
  view?: { id: string; name: string; slug: string; is_main: boolean };
  layers: unknown[];
  folders: unknown[];
};

/** Only "off" flags are kept, so canonical URLs stay clean. */
export const off = (value: unknown) => value === false || value === "0" || value === "false";

export function ViewerMessage({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="max-w-md font-secondary text-sm text-muted-foreground">
        The link may be private, unpublished or mistyped.
      </p>
      <Button asChild variant="outline" size="sm">
        <Link to="/">Open Field home</Link>
      </Button>
    </div>
  );
}

export function PublicMapViewer({
  username,
  slug,
  search,
  data: loaderData,
}: {
  username: string;
  slug: string;
  search: ViewerSearch;
  data: PublishedMapData;
}) {
  const project = loaderData.project;
  const layers = loaderData.layers as unknown as ViewerLayer[];
  const folders = loaderData.folders as unknown as ViewerFolder[];

  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [commentMode, setCommentMode] = useState(false);
  const [pin, setPin] = useState<PendingPin | null>(null);
  const [commentsVisible, setCommentsVisible] = useState(true);
  const [selectedComment, setSelectedComment] = useState<string | null>(null);
  const mapRef = useRef<MapHandle | null>(null);
  const commentsEnabled = project.comments_enabled;
  const commentCategories = project.comment_categories ?? [];

  const commentsQuery = useQuery({
    queryKey: ["approved-comments", username, slug],
    queryFn: () => listApprovedComments({ data: { username, slug } }),
    enabled: commentsEnabled,
  });
  const comments = (commentsQuery.data ?? []) as PublicComment[];

  useEffect(() => {
    if (!commentMode) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setCommentMode(false);
        setPin(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [commentMode]);

  // Credit sits right after the scale bar, so it shifts as the scale bar resizes.
  const [creditLeft, setCreditLeft] = useState(150);

  useEffect(() => {
    let frame = 0;
    const measure = () => {
      const scale = document.querySelector<HTMLElement>(".maplibregl-ctrl-scale");
      const map = document.querySelector<HTMLElement>(".maplibregl-map");
      if (scale && map) {
        const gap = 10;
        setCreditLeft(
          scale.getBoundingClientRect().right - map.getBoundingClientRect().left + gap,
        );
      }
      frame = window.setTimeout(measure, 500);
    };
    measure();
    return () => window.clearTimeout(frame);
  }, []);

  const ordered = useMemo(
    () => flattenLayerOrder(layers, folders) as ViewerLayer[],
    [layers, folders],
  );

  const results = useQueries({
    queries: ordered.map((layer) => ({
      queryKey: ["published-layer-data", username, slug, layer.id, layer.updated_at],
      queryFn: () =>
        getPublishedLayerData({ data: { username, slug, layerId: layer.id } }) as Promise<
          FeatureCollection | null
        >,
      staleTime: 5 * 60 * 1000,
      retry: 0,
    })),
  });

  const dataById = useMemo(() => {
    const map: Record<string, FeatureCollection | null> = {};
    ordered.forEach((layer, index) => {
      const data = (results[index]?.data as FeatureCollection | null) ?? null;
      // Saved attribute filters apply to the public map too.
      map[layer.id] = filterCollection(data, parseFilterConfig(layer.filter_config));
    });
    return map;
  }, [ordered, results]);

  const loading = results.some((result) => result.isLoading);

  const styleFor = useMemo(
    () => (layer: ViewerLayer) => resolveLayerStyle(styleRowFromRelation(layer.layer_styles)),
    [],
  );

  /** Viewer-local category filtering: layerId -> { categoryKey: true }. */
  const [categoryHidden, setCategoryHidden] = useState<Record<string, Record<string, boolean>>>({});

  const renderStyleFor = useMemo(
    () => (layer: ViewerLayer) => {
      const style = styleFor(layer);
      const off = categoryHidden[layer.id];
      if (!off || !Object.keys(off).length) return style;
      const next = { ...style };
      if (style.categories) {
        next.categories = {
          ...style.categories,
          entries: style.categories.entries.map((entry) =>
            off[`cat:${entry.value}`] ? { ...entry, visible: false } : entry,
          ),
          otherVisible: off["other"] ? false : style.categories.otherVisible,
        };
      }
      if (style.graduated) {
        next.graduated = {
          ...style.graduated,
          classes: style.graduated.classes.map((cls, index) =>
            off[`cls:${index}`] ? { ...cls, visible: false } : cls,
          ),
          otherVisible: off["other"] ? false : style.graduated.otherVisible,
        };
      }
      return next;
    },
    [styleFor, categoryHidden],
  );

  const isVisible = (layer: ViewerLayer) => layer.visible && !hidden[layer.id];

  const renderLayers: RenderLayer[] = useMemo(
    () =>
      ordered.map((layer) => ({
        id: layer.id,
        name: layer.name,
        visible: isVisible(layer),
        opacity: layer.opacity,
        geometryType: layer.geometry_type,
        data: dataById[layer.id] ?? null,
        style: renderStyleFor(layer),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordered, dataById, renderStyleFor, hidden],
  );

  const legendGroups: LegendGroup[] = useMemo(() => {
    const toEntry = (layer: ViewerLayer): LegendEntry => ({
      id: layer.id,
      name: layer.name,
      kind: geometryKind(layer.geometry_type),
      opacity: layer.opacity,
      style: styleFor(layer),
    });
    // Hidden layers stay listed (dimmed) so they can be toggled back on.
    const inFolder = (folderId: string | null) =>
      ordered.filter((layer) => layer.visible && layer.folder_id === folderId).map(toEntry);

    const groups: LegendGroup[] = [];
    const ungrouped = inFolder(null);
    if (ungrouped.length) groups.push({ id: "ungrouped", name: null, depth: 0, entries: ungrouped });
    const walk = (parentId: string | null, depth: number) => {
      folders
        .filter((folder) => folder.parent_id === parentId)
        .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
        .forEach((folder) => {
          const entries = inFolder(folder.id);
          if (entries.length) groups.push({ id: folder.id, name: folder.name, depth, entries });
          walk(folder.id, depth + 1);
        });
    };
    walk(null, 0);
    return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ordered, folders, styleFor, hidden]);

  const allBbox = useMemo<Bbox | null>(() => {
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

  const initialView = {
    center: [project.map_center?.[0] ?? 0, project.map_center?.[1] ?? 20] as [number, number],
    zoom: project.map_zoom ?? 2,
    pitch: project.map_pitch ?? 0,
    bearing: project.map_bearing ?? 0,
  };

  const showLegend = search.legend !== false && project.show_legend;
  const showTitle = search.title !== false;

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      <main className="relative min-w-0 flex-1">
        <ClientOnly fallback={<MapFallback />}>
          <Suspense fallback={<MapFallback />}>
            <MapCanvas
              basemap={project.basemap}
              layers={renderLayers}
              initialView={initialView}
              scaleUnits={(project.scale_units as ScaleUnits) ?? "imperial"}
              pickMode={commentMode && !pin}
              onPick={(lng, lat) => setPin({ lng, lat })}
              pin={pin ? [pin.lng, pin.lat] : null}
              commentPins={commentsEnabled && commentsVisible ? comments : []}
              selectedCommentId={selectedComment}
              onCommentClick={(id) => setSelectedComment(id)}
              handleRef={mapRef}
              rightSlot={
                commentsEnabled ? (
                  <CommentPanel
                    username={username}
                    slug={slug}
                    comments={comments}
                    categories={commentCategories}
                    visible={commentsVisible}
                    onToggleVisible={() => setCommentsVisible((value) => !value)}
                    adding={commentMode}
                    onToggleAdding={() => {
                      setPin(null);
                      setCommentMode((value) => !value);
                    }}
                    pin={pin}
                    selectedId={selectedComment}
                    onSelect={(id) => {
                      setSelectedComment(id);
                      const found = comments.find((comment) => comment.id === id);
                      if (found) mapRef.current?.flyTo(found.lng, found.lat);
                    }}
                    onSubmitted={() => {
                      void commentsQuery.refetch();
                      setPin(null);
                      setCommentMode(false);
                    }}
                  />
                ) : null
              }
            />
          </Suspense>
        </ClientOnly>

        <div className="pointer-events-auto absolute left-4 top-4 z-10 flex max-h-[calc(100%-32px)] flex-col items-start gap-2 overflow-y-auto">
          {showTitle && <MapTitleCard title={project.title} description={project.description} />}
          {showLegend && (
            <MapLegend
              groups={legendGroups}
              hidden={hidden}
              onToggle={(id) => setHidden((prev) => ({ ...prev, [id]: !prev[id] }))}
              categoryHidden={categoryHidden}
              onToggleCategory={(layerId, key) =>
                setCategoryHidden((prev) => {
                  const forLayer = { ...(prev[layerId] ?? {}) };
                  if (forLayer[key]) delete forLayer[key];
                  else forLayer[key] = true;
                  return { ...prev, [layerId]: forLayer };
                })
              }
            />
          )}
        </div>



        <a
          href={SITE}
          target="_blank"
          rel="noreferrer"
          style={{ left: creditLeft }}
          className="absolute bottom-[7px] z-10 font-secondary text-[11px] text-map-overlay-foreground/80 hover:text-map-overlay-foreground"
        >
          Made with <span className="font-semibold">Open Field</span>.
        </a>


        {loading && (
          <div className="absolute bottom-12 left-4 z-10 flex items-center gap-2 rounded-md bg-map-overlay px-3 py-1.5 text-xs text-map-overlay-foreground shadow-[var(--shadow-lift)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading data
          </div>
        )}
        {allBbox === null && !loading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <p className="rounded-md bg-map-overlay px-3 py-2 text-xs text-map-overlay-foreground shadow-[var(--shadow-lift)]">
              This map has no data layers yet.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}


function MapFallback() {
  return (
    <div className="flex h-full items-center justify-center bg-muted/20">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  );
}
