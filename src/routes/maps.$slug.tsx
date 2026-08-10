import { lazy, Suspense, useMemo, useState } from "react";
import { createFileRoute, ClientOnly, Link, notFound } from "@tanstack/react-router";
import { useQueries } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { getPublishedLayerData, getPublishedMap } from "@/lib/publish.functions";
import { flattenLayerOrder } from "@/components/map/layer-panel";
import {
  MapLegend,
  MapTitleCard,
  LegendSwatch,
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

const SITE = "https://openfieldstudio.lovable.app";

type ViewerLayer = Tables<"layers"> & { layer_styles: StyleRelation };
type ViewerFolder = Tables<"layer_folders">;

type ViewerSearch = { sidebar?: boolean; legend?: boolean; title?: boolean };

const flag = (value: unknown, fallback: boolean) =>
  value === undefined ? fallback : !(value === false || value === "0" || value === "false");

export const Route = createFileRoute("/maps/$slug")({
  validateSearch: (search: Record<string, unknown>): ViewerSearch => ({
    sidebar: flag(search["sidebar"], true),
    legend: flag(search["legend"], true),
    title: flag(search["title"], true),
  }),
  loader: async ({ params }) => {
    const data = await getPublishedMap({ data: { slug: params.slug } });
    if (!data) throw notFound();
    return data;
  },
  head: ({ params, loaderData }) => {
    const title = loaderData?.project.title
      ? `${loaderData.project.title} — Open Field`
      : "Map — Open Field";
    const description =
      loaderData?.project.description?.slice(0, 155) ??
      "An interactive webmap published with Open Field.";
    const url = `${SITE}/maps/${params.slug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: () => <ViewerMessage title="This map could not be loaded." />,
  notFoundComponent: () => <ViewerMessage title="This map is not published." />,
  component: PublicMap,
});

function ViewerMessage({ title }: { title: string }) {
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

function PublicMap() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const loaderData = Route.useLoaderData();
  const project = loaderData.project;
  const layers = loaderData.layers as unknown as ViewerLayer[];
  const folders = loaderData.folders as unknown as ViewerFolder[];

  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const ordered = useMemo(
    () => flattenLayerOrder(layers, folders) as ViewerLayer[],
    [layers, folders],
  );

  const results = useQueries({
    queries: ordered.map((layer) => ({
      queryKey: ["published-layer-data", slug, layer.id, layer.updated_at],
      queryFn: () =>
        getPublishedLayerData({ data: { slug, layerId: layer.id } }) as Promise<
          FeatureCollection | null
        >,
      staleTime: 5 * 60 * 1000,
      retry: 0,
    })),
  });

  const dataById = useMemo(() => {
    const map: Record<string, FeatureCollection | null> = {};
    ordered.forEach((layer, index) => {
      map[layer.id] = (results[index]?.data as FeatureCollection | null) ?? null;
    });
    return map;
  }, [ordered, results]);

  const loading = results.some((result) => result.isLoading);

  const styleFor = useMemo(
    () => (layer: ViewerLayer) => resolveLayerStyle(styleRowFromRelation(layer.layer_styles)),
    [],
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
        style: styleFor(layer),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ordered, dataById, styleFor, hidden],
  );

  const legendGroups: LegendGroup[] = useMemo(() => {
    const toEntry = (layer: ViewerLayer): LegendEntry => ({
      id: layer.id,
      name: layer.name,
      kind: geometryKind(layer.geometry_type),
      opacity: layer.opacity,
      style: styleFor(layer),
    });
    const inFolder = (folderId: string | null) =>
      ordered.filter((layer) => isVisible(layer) && layer.folder_id === folderId).map(toEntry);

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

  const showSidebar = search.sidebar !== false && ordered.length > 0;
  const showLegend = search.legend !== false && project.show_legend;
  const showTitle = search.title !== false;

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-background">
      {showSidebar && (
        <aside
          className={cn(
            "z-20 flex shrink-0 flex-col border-r border-border bg-card transition-[width] duration-200",
            sidebarOpen ? "w-72" : "w-0 overflow-hidden border-r-0",
          )}
        >
          <div className="border-b border-border px-4 py-3">
            <h1 className="text-sm font-semibold leading-tight">{project.title}</h1>
            {project.author && (
              <p className="font-secondary text-xs text-muted-foreground">By {project.author}</p>
            )}
          </div>
          {project.description && (
            <p className="border-b border-border px-4 py-3 font-secondary text-xs leading-relaxed text-muted-foreground">
              {project.description}
            </p>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <p className="px-2 pb-1 font-secondary text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Layers
            </p>
            <ul className="space-y-0.5">
              {ordered.map((layer) => (
                <li key={layer.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setHidden((prev) => ({ ...prev, [layer.id]: !prev[layer.id] }))
                    }
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted/60",
                      !isVisible(layer) && "opacity-45",
                    )}
                  >
                    <LegendSwatch
                      kind={geometryKind(layer.geometry_type)}
                      style={styleFor(layer)}
                    />
                    <span className="min-w-0 flex-1 truncate">{layer.name}</span>
                    <span className="font-secondary text-[10px] text-muted-foreground">
                      ({layer.feature_count.toLocaleString()})
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          {(project.credits || project.data_sources) && (
            <div className="space-y-1 border-t border-border px-4 py-3 font-secondary text-[11px] leading-relaxed text-muted-foreground">
              {project.data_sources && <p>Sources: {project.data_sources}</p>}
              {project.credits && <p>{project.credits}</p>}
            </div>
          )}
          <div className="border-t border-border px-4 py-2">
            <a
              href={SITE}
              target="_blank"
              rel="noreferrer"
              className="font-secondary text-[11px] text-muted-foreground hover:text-foreground"
            >
              Made with Open Field
            </a>
          </div>
        </aside>
      )}

      {showSidebar && (
        <button
          type="button"
          onClick={() => setSidebarOpen((value) => !value)}
          aria-label={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
          className="absolute left-0 top-1/2 z-30 -translate-y-1/2 rounded-r-md border border-l-0 border-border bg-card px-0.5 py-3 text-muted-foreground shadow-sm hover:text-foreground"
          style={{ left: sidebarOpen ? "18rem" : 0 }}
        >
          {sidebarOpen ? (
            <ChevronLeft className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>
      )}

      <main className="relative min-w-0 flex-1">
        <ClientOnly fallback={<MapFallback />}>
          <Suspense fallback={<MapFallback />}>
            <MapCanvas
              basemap={project.basemap}
              layers={renderLayers}
              initialView={initialView}
              scaleUnits={(project.scale_units as ScaleUnits) ?? "imperial"}
              handleRef={{ current: null } as unknown as React.RefObject<MapHandle>}
            />
          </Suspense>
        </ClientOnly>

        <div className="pointer-events-auto absolute left-4 top-4 z-10 flex flex-col items-start gap-2">
          {showTitle && !sidebarOpen && <MapTitleCard title={project.title} />}
          {showLegend && <MapLegend groups={legendGroups} />}
        </div>

        {loading && (
          <div className="absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-md bg-map-overlay px-3 py-1.5 text-xs text-map-overlay-foreground shadow-[var(--shadow-lift)]">
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
