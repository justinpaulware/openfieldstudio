import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Check, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Bbox, FeatureCollection, SimpleGeometryType } from "@/lib/geo";

export type RenderLayer = {
  id: string;
  visible: boolean;
  opacity: number;
  geometryType: SimpleGeometryType;
  data: FeatureCollection | null;
  style: {
    fillColor: string;
    strokeColor: string;
    strokeWidth: number;
    circleRadius: number;
    fillOpacity: number;
  };
};

export type MapHandle = {
  fitBbox: (bbox: Bbox, padding?: number) => void;
  flyTo: (lng: number, lat: number) => void;
  getView: () => { center: [number, number]; zoom: number; pitch: number; bearing: number } | null;
};

export const BASEMAPS = [
  { id: "positron", label: "Positron (minimal)" },
  { id: "bright", label: "Bright (light)" },
  { id: "dark", label: "Dark" },
  { id: "liberty", label: "Liberty (detailed)" },
] as const;

export type BasemapId = (typeof BASEMAPS)[number]["id"];

export function basemapUrl(id: string) {
  const known = BASEMAPS.some((b) => b.id === id) ? id : "positron";
  return `https://tiles.openfreemap.org/styles/${known}`;
}

export type ScaleUnits = "imperial" | "metric";

type Props = {
  basemap: string;
  layers: RenderLayer[];
  initialView: { center: [number, number]; zoom: number; pitch: number; bearing: number };
  onMoveEnd?: (view: { center: [number, number]; zoom: number; pitch: number; bearing: number }) => void;
  onFeatureClick?: (layerId: string, properties: Record<string, unknown>) => void;
  handleRef?: Ref<MapHandle>;
  /** When provided, style picks are reported upward (editor persists the default). */
  onBasemapChange?: (id: string) => void;
  scaleUnits?: ScaleUnits;
  /** When provided, scale-unit picks are reported upward (editor persists the default). */
  onScaleUnitsChange?: (units: ScaleUnits) => void;
};

const SRC = (id: string) => `of-src-${id}`;
const LYR = (id: string, kind: string) => `of-${kind}-${id}`;

export default function MapCanvas({
  basemap,
  layers,
  initialView,
  onMoveEnd,
  onFeatureClick,
  handleRef,
  onBasemapChange,
  scaleUnits = "imperial",
  onScaleUnitsChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  const scaleRef = useRef<maplibregl.ScaleControl | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [localBasemap, setLocalBasemap] = useState<string | null>(null);
  const [localScaleUnits, setLocalScaleUnits] = useState<ScaleUnits | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const activeBasemap = localBasemap ?? basemap;
  const activeScaleUnits = localScaleUnits ?? scaleUnits;
  const toggleScaleUnits = () => {
    const next: ScaleUnits = activeScaleUnits === "imperial" ? "metric" : "imperial";
    setLocalScaleUnits(next);
    onScaleUnitsChange?.(next);
  };
  const toggleScaleRef = useRef(toggleScaleUnits);
  toggleScaleRef.current = toggleScaleUnits;
  const layersRef = useRef<RenderLayer[]>(layers);
  layersRef.current = layers;



  useImperativeHandle(
    handleRef,
    (): MapHandle => ({
      fitBbox: (bbox, padding = 48) => {
        mapRef.current?.fitBounds(
          [
            [bbox[0], bbox[1]],
            [bbox[2], bbox[3]],
          ],
          { padding, duration: 700, maxZoom: 16 },
        );
      },
      flyTo: (lng, lat) => mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 700 }),
      getView: () => {
        const map = mapRef.current;
        if (!map) return null;
        const c = map.getCenter();
        return {
          center: [c.lng, c.lat],
          zoom: map.getZoom(),
          pitch: map.getPitch(),
          bearing: map.getBearing(),
        };
      },
    }),
    [],
  );

  // Create the map once. Teardown is deferred so React's dev double-invoke
  // (mount -> cleanup -> mount) does not destroy the shared worker pool
  // while the second instance is being constructed.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    // Keep MapLibre's worker pool alive across map.remove() calls.
    maplibregl.prewarm();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: basemapUrl(basemap),
      center: initialView.center,
      zoom: initialView.zoom,
      pitch: initialView.pitch,
      bearing: initialView.bearing,
      attributionControl: { compact: true },
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
    const scale = new maplibregl.ScaleControl({ maxWidth: 120, unit: activeScaleUnits });
    scaleRef.current = scale;
    map.addControl(scale, "bottom-left");
    map.addControl(
      new maplibregl.GeolocateControl({ trackUserLocation: true, showAccuracyCircle: true }),
      "top-right",
    );

    // Clicking the scale bar flips imperial <-> metric.
    const scaleEl = containerRef.current.querySelector<HTMLElement>(".maplibregl-ctrl-scale");
    if (scaleEl) {
      scaleEl.style.cursor = "pointer";
      scaleEl.title = "Click to switch units";
      scaleEl.addEventListener("click", () => toggleScaleRef.current());
    }


    map.on("error", (event) => {
      const message = (event as { error?: Error }).error?.message ?? "Unknown map error";
      console.error("[map] ", message);
      setMapError(message);
    });

    let watchdog: ReturnType<typeof setTimeout> | undefined;
    map.on("load", () => {
      readyRef.current = true;
      setMapError(null);
      syncLayers(map, layersRef.current);
      watchdog = setTimeout(() => {
        if (!map.areTilesLoaded()) {
          setMapError("Basemap tiles did not load.");
        }
      }, 8000);
    });
    map.on("idle", () => {
      if (map.areTilesLoaded()) setMapError(null);
    });
    map.on("moveend", () => {
      const c = map.getCenter();
      onMoveEnd?.({
        center: [c.lng, c.lat],
        zoom: map.getZoom(),
        pitch: map.getPitch(),
        bearing: map.getBearing(),
      });
    });

    return () => {
      if (watchdog) clearTimeout(watchdog);
      readyRef.current = false;
      mapRef.current = null;
      // Defer so a StrictMode remount can reuse the live worker pool.
      setTimeout(() => map.remove(), 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Basemap switching re-adds data layers once the new style settles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    map.setStyle(basemapUrl(activeBasemap));
    const onStyle = () => syncLayers(map, layersRef.current);
    map.once("styledata", onStyle);
  }, [activeBasemap]);

  // Scale-bar unit switching.
  useEffect(() => {
    scaleRef.current?.setUnit(activeScaleUnits);
  }, [activeScaleUnits]);


  // Data / style / visibility updates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;
    syncLayers(map, layers);
  }, [layers]);

  // Feature click handling.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onFeatureClick) return;
    const handler = (event: maplibregl.MapMouseEvent) => {
      const ids = layersRef.current
        .filter((l) => l.visible && l.data)
        .flatMap((l) => ["fill", "line", "circle"].map((k) => LYR(l.id, k)))
        .filter((id) => map.getLayer(id));
      if (!ids.length) return;
      const [hit] = map.queryRenderedFeatures(event.point, { layers: ids });
      if (!hit) return;
      const layerId = String(hit.layer.id).replace(/^of-(fill|line|circle)-/, "");
      onFeatureClick(layerId, (hit.properties ?? {}) as Record<string, unknown>);
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [onFeatureClick]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute bottom-8 right-2 z-10 flex flex-col items-end gap-1">
        {pickerOpen && (
          <div className="w-52 overflow-hidden rounded-lg border border-border bg-card/95 shadow-[var(--shadow-soft)] backdrop-blur">
            {BASEMAPS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setLocalBasemap(option.id);
                  setPickerOpen(false);
                  onBasemapChange?.(option.id);
                }}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted",
                  option.id === activeBasemap && "bg-muted/70 font-medium",
                )}
              >
                <Check
                  className={cn(
                    "h-3.5 w-3.5 shrink-0",
                    option.id === activeBasemap ? "opacity-100 text-primary" : "opacity-0",
                  )}
                />
                {option.label}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-card/95 px-2.5 py-1.5 text-xs font-medium shadow-[var(--shadow-soft)] backdrop-blur hover:bg-muted"
        >
          <Layers className="h-3.5 w-3.5" />
          Basemap
        </button>
      </div>

      {mapError ? (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-3 rounded-md border border-destructive/40 bg-card/95 px-3 py-2 text-sm text-foreground shadow-lg">
            <span>Basemap failed to load. {mapError}</span>
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 text-xs hover:bg-muted"
              onClick={() => {
                setMapError(null);
                mapRef.current?.setStyle(basemapUrl(activeBasemap));
              }}
            >
              Retry
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );

}

function removeLayerIfPresent(map: MapLibreMap, id: string) {
  if (map.getLayer(id)) map.removeLayer(id);
}

function syncLayers(map: MapLibreMap, layers: RenderLayer[]) {
  if (!map.isStyleLoaded()) {
    map.once("idle", () => syncLayers(map, layers));
    return;
  }

  const keep = new Set(layers.filter((l) => l.data).map((l) => l.id));

  // Drop anything we own that no longer belongs.
  for (const layer of map.getStyle().layers ?? []) {
    const match = /^of-(fill|line|circle|outline)-(.+)$/.exec(layer.id);
    if (match && !keep.has(match[2] as string)) removeLayerIfPresent(map, layer.id);
  }
  for (const sourceId of Object.keys(map.getStyle().sources ?? {})) {
    const match = /^of-src-(.+)$/.exec(sourceId);
    if (match && !keep.has(match[1] as string)) {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  }

  // Add / update in draw order (first item on top => add in reverse).
  for (const layer of [...layers].reverse()) {
    if (!layer.data) continue;
    const sourceId = SRC(layer.id);
    const existing = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
    if (existing) {
      existing.setData(layer.data as never);
    } else {
      map.addSource(sourceId, { type: "geojson", data: layer.data as never });
    }

    const visibility = layer.visible ? "visible" : "none";
    const { style } = layer;
    const alpha = layer.opacity;

    const ensure = (id: string, spec: maplibregl.AddLayerObject) => {
      if (!map.getLayer(id)) map.addLayer(spec);
      else map.moveLayer(id);
    };

    if (layer.geometryType === "polygon" || layer.geometryType === "mixed") {
      ensure(LYR(layer.id, "fill"), {
        id: LYR(layer.id, "fill"),
        type: "fill",
        source: sourceId,
        filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
      });
      map.setLayoutProperty(LYR(layer.id, "fill"), "visibility", visibility);
      map.setPaintProperty(LYR(layer.id, "fill"), "fill-color", style.fillColor);
      map.setPaintProperty(LYR(layer.id, "fill"), "fill-opacity", style.fillOpacity * alpha);

      ensure(LYR(layer.id, "outline"), {
        id: LYR(layer.id, "outline"),
        type: "line",
        source: sourceId,
        filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
      });
      map.setLayoutProperty(LYR(layer.id, "outline"), "visibility", visibility);
      map.setPaintProperty(LYR(layer.id, "outline"), "line-color", style.strokeColor);
      map.setPaintProperty(LYR(layer.id, "outline"), "line-width", style.strokeWidth);
      map.setPaintProperty(LYR(layer.id, "outline"), "line-opacity", alpha);
    }

    if (layer.geometryType === "line" || layer.geometryType === "mixed") {
      ensure(LYR(layer.id, "line"), {
        id: LYR(layer.id, "line"),
        type: "line",
        source: sourceId,
        filter: ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false],
      });
      map.setLayoutProperty(LYR(layer.id, "line"), "visibility", visibility);
      map.setPaintProperty(LYR(layer.id, "line"), "line-color", style.fillColor);
      map.setPaintProperty(LYR(layer.id, "line"), "line-width", Math.max(1, style.strokeWidth + 1));
      map.setPaintProperty(LYR(layer.id, "line"), "line-opacity", alpha);
    }

    if (layer.geometryType === "point" || layer.geometryType === "mixed") {
      ensure(LYR(layer.id, "circle"), {
        id: LYR(layer.id, "circle"),
        type: "circle",
        source: sourceId,
        filter: ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false],
      });
      map.setLayoutProperty(LYR(layer.id, "circle"), "visibility", visibility);
      map.setPaintProperty(LYR(layer.id, "circle"), "circle-color", style.fillColor);
      map.setPaintProperty(LYR(layer.id, "circle"), "circle-radius", style.circleRadius);
      map.setPaintProperty(LYR(layer.id, "circle"), "circle-opacity", alpha);
      map.setPaintProperty(LYR(layer.id, "circle"), "circle-stroke-color", style.strokeColor);
      map.setPaintProperty(LYR(layer.id, "circle"), "circle-stroke-width", style.strokeWidth);
      map.setPaintProperty(LYR(layer.id, "circle"), "circle-stroke-opacity", alpha);
    }
  }
}
