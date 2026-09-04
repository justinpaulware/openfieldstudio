import { useEffect, useImperativeHandle, useRef, useState, type ReactNode, type Ref } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { Check, Layers, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Bbox, FeatureCollection, SimpleGeometryType } from "@/lib/geo";
import {
  isDataDriven,
  categoryFilter,
  dashArray,
  isTransparent,
  paintColor,
  primaryColorPaint,
  radiusPaint,
  strokeColorPaint,
  categoryDrives,
  activeLabels,
  labelTextExpression,
  labelAnchorOffset,
  popupRows,
  popupTitle,
  formatPopupValue,
  type LayerStyle,
  type PopupSpec,
  activeMask,
  activeProportional,
  activeHeatmap,
  proportionalRadiusExpression,
  proportionalFilter,
  heatmapColorExpression,
  heatmapWeightExpression,
  withAlpha,
} from "@/lib/layer-style";

import { buildMaskGeometry } from "@/lib/mask-geometry";
import { rasterPaint, type RasterStyle } from "@/lib/raster-style";



export type RenderLayer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  geometryType: SimpleGeometryType | "raster";
  data: FeatureCollection | null;
  style: LayerStyle;
  /** Set for raster layers: tile template plus raster appearance. */
  raster?: { tileUrl: string; style: RasterStyle } | null;
};



export type MapHandle = {
  fitBbox: (bbox: Bbox, padding?: number) => void;
  flyTo: (lng: number, lat: number) => void;
  /** Jump to a saved framing (used when switching project views). */
  setView: (view: {
    center: [number, number];
    zoom?: number | null;
    pitch?: number | null;
    bearing?: number | null;
  }) => void;
  getView: () => { center: [number, number]; zoom: number; pitch: number; bearing: number } | null;
  /** JPEG snapshot of the current map canvas, downscaled for use as a thumbnail. */
  captureThumbnail: (width?: number, height?: number) => Promise<Blob | null>;
};

export const BASEMAPS = [
  { id: "positron", label: "Positron (minimal)" },
  { id: "positron-nolabels", label: "Positron (no labels)" },
  { id: "bright", label: "Bright (light)" },
  { id: "dark", label: "Dark" },
  { id: "liberty", label: "Liberty (detailed)" },
] as const;

export type BasemapId = (typeof BASEMAPS)[number]["id"];

export function basemapUrl(id: string) {
  const known = BASEMAPS.some((b) => b.id === id) ? id : "positron";
  // The no-labels variant is a transformed OpenFreeMap Positron style served
  // by a public server route (label symbol layers stripped). All other
  // basemaps load directly from OpenFreeMap.
  if (known === "positron-nolabels") return "/api/public/styles/positron-nolabels";
  return `https://tiles.openfreemap.org/styles/${known}`;
}

export type ScaleUnits = "imperial" | "metric";

/** Comment geometry accepted from visitors: a pin, a line or a single-ring area. */
export type CommentGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "Polygon"; coordinates: [number, number][][] };


type Props = {
  basemap: string;
  layers: RenderLayer[];
  initialView: { center: [number, number]; zoom: number; pitch: number; bearing: number };
  onMoveEnd?: (view: { center: [number, number]; zoom: number; pitch: number; bearing: number }) => void;
  handleRef?: Ref<MapHandle>;
  /** When provided, style picks are reported upward (editor persists the default). */
  onBasemapChange?: (id: string) => void;
  scaleUnits?: ScaleUnits;
  /** When provided, scale-unit picks are reported upward (editor persists the default). */
  onScaleUnitsChange?: (units: ScaleUnits) => void;
  /** Comment placement mode: clicks report a location instead of opening popups. */
  pickMode?: boolean;
  onPick?: (lng: number, lat: number) => void;
  /** Temporary marker drawn at this location, e.g. a comment being written. */
  pin?: [number, number] | null;
  /** Approved comments drawn as their own markers. */
  commentPins?: { id: string; lng: number; lat: number }[];
  /** Approved line/area comments drawn as a GeoJSON overlay. */
  commentShapes?: { id: string; geometry: CommentGeometry }[];
  /** Shape currently being drawn (live preview) plus its vertices. */
  draftShape?: CommentGeometry | null;
  draftVertices?: [number, number][];
  selectedCommentId?: string | null;
  onCommentClick?: (id: string) => void;
  /** Extra cards stacked under the info popup in the top-right column. */
  rightSlot?: ReactNode;
};

const SRC = (id: string) => `of-src-${id}`;
const LYR = (id: string, kind: string) => `of-${kind}-${id}`;

export default function MapCanvas({
  basemap,
  layers,
  initialView,
  onMoveEnd,
  handleRef,
  onBasemapChange,
  scaleUnits = "imperial",
  onScaleUnitsChange,
  pickMode = false,
  onPick,
  pin = null,
  commentPins,
  commentShapes,
  draftShape = null,
  draftVertices,
  selectedCommentId = null,
  onCommentClick,
  rightSlot,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const readyRef = useRef(false);
  const scaleRef = useRef<maplibregl.ScaleControl | null>(null);
  const [popupHit, setPopupHit] = useState<{
    layerName: string;
    spec: PopupSpec;
    properties: Record<string, unknown>;
  } | null>(null);
  const [lightbox, setLightbox] = useState<{ src: string; caption: string } | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [localBasemap, setLocalBasemap] = useState<string | null>(null);
  const [localScaleUnits, setLocalScaleUnits] = useState<ScaleUnits | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

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
  const pickModeRef = useRef(pickMode);
  pickModeRef.current = pickMode;
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const pinRef = useRef<maplibregl.Marker | null>(null);

  // Temporary pin for the comment being written.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!pin) {
      pinRef.current?.remove();
      pinRef.current = null;
      return;
    }
    if (!pinRef.current) {
      pinRef.current = new maplibregl.Marker({ color: "#8b5cf6" }).setLngLat(pin).addTo(map);
    } else {
      pinRef.current.setLngLat(pin);
    }
  }, [pin]);

  useEffect(
    () => () => {
      pinRef.current?.remove();
      pinRef.current = null;
    },
    [],
  );

  // Approved comment markers.
  const commentMarkersRef = useRef<maplibregl.Marker[]>([]);
  const onCommentClickRef = useRef(onCommentClick);
  onCommentClickRef.current = onCommentClick;

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    for (const marker of commentMarkersRef.current) marker.remove();
    commentMarkersRef.current = [];
    for (const item of commentPins ?? []) {
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", "Comment");
      el.className = "of-comment-pin";
      el.style.cssText = [
        "width:22px",
        "height:22px",
        "border-radius:9999px",
        "border:2px solid #ffffff",
        "cursor:pointer",
        "box-shadow:0 1px 4px rgba(0,0,0,.35)",
        `background:${item.id === selectedCommentId ? "#6d28d9" : "#8b5cf6"}`,
        item.id === selectedCommentId ? "transform:scale(1.25)" : "",
      ].join(";");
      el.addEventListener("click", (event) => {
        event.stopPropagation();
        onCommentClickRef.current?.(item.id);
      });
      commentMarkersRef.current.push(
        new maplibregl.Marker({ element: el }).setLngLat([item.lng, item.lat]).addTo(map),
      );
    }
    return () => {
      for (const marker of commentMarkersRef.current) marker.remove();
      commentMarkersRef.current = [];
    };
  }, [commentPins, selectedCommentId, mapLoaded]);

  // Approved line/area comments plus the shape currently being drawn. Both live
  // in their own GeoJSON sources so they survive basemap style swaps.
  const shapesRef = useRef({ commentShapes, draftShape, draftVertices, selectedCommentId });
  shapesRef.current = { commentShapes, draftShape, draftVertices, selectedCommentId };

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const render = () => {
      if (!map.isStyleLoaded()) return;
      const state = shapesRef.current;

      const approved = {
        type: "FeatureCollection" as const,
        features: (state.commentShapes ?? []).map((item) => ({
          type: "Feature" as const,
          id: item.id,
          properties: { id: item.id, selected: item.id === state.selectedCommentId },
          geometry: item.geometry,
        })),
      };

      const draftFeatures = [];
      if (state.draftShape) {
        draftFeatures.push({
          type: "Feature" as const,
          properties: {},
          geometry: state.draftShape,
        });
      }
      for (const vertex of state.draftVertices ?? []) {
        draftFeatures.push({
          type: "Feature" as const,
          properties: { vertex: true },
          geometry: { type: "Point" as const, coordinates: vertex },
        });
      }
      const draft = { type: "FeatureCollection" as const, features: draftFeatures };

      const setData = (id: string, data: unknown) => {
        const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
        if (source) source.setData(data as never);
        else map.addSource(id, { type: "geojson", data: data as never });
      };

      setData("of-comment-shapes", approved);
      setData("of-comment-draft", draft);

      if (!map.getLayer("of-comment-shapes-fill")) {
        map.addLayer({
          id: "of-comment-shapes-fill",
          type: "fill",
          source: "of-comment-shapes",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "fill-color": "#8b5cf6", "fill-opacity": 0.2 },
        });
      }
      if (!map.getLayer("of-comment-shapes-line")) {
        map.addLayer({
          id: "of-comment-shapes-line",
          type: "line",
          source: "of-comment-shapes",
          paint: {
            "line-color": ["case", ["get", "selected"], "#6d28d9", "#8b5cf6"],
            "line-width": ["case", ["get", "selected"], 5, 3],
            "line-opacity": 0.95,
          },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
      if (!map.getLayer("of-comment-draft-fill")) {
        map.addLayer({
          id: "of-comment-draft-fill",
          type: "fill",
          source: "of-comment-draft",
          filter: ["==", ["geometry-type"], "Polygon"],
          paint: { "fill-color": "#8b5cf6", "fill-opacity": 0.15 },
        });
      }
      if (!map.getLayer("of-comment-draft-line")) {
        map.addLayer({
          id: "of-comment-draft-line",
          type: "line",
          source: "of-comment-draft",
          paint: { "line-color": "#6d28d9", "line-width": 2.5, "line-dasharray": [2, 1] },
          layout: { "line-cap": "round", "line-join": "round" },
        });
      }
      if (!map.getLayer("of-comment-draft-point")) {
        map.addLayer({
          id: "of-comment-draft-point",
          type: "circle",
          source: "of-comment-draft",
          filter: ["==", ["geometry-type"], "Point"],
          paint: {
            "circle-radius": 4,
            "circle-color": "#ffffff",
            "circle-stroke-color": "#6d28d9",
            "circle-stroke-width": 2,
          },
        });
      }
    };

    render();
    map.on("styledata", render);

    const onShapeClick = (event: maplibregl.MapLayerMouseEvent) => {
      if (pickModeRef.current) return;
      const id = event.features?.[0]?.properties?.["id"];
      if (typeof id === "string") {
        event.originalEvent.stopPropagation();
        onCommentClickRef.current?.(id);
      }
    };
    map.on("click", "of-comment-shapes-fill", onShapeClick);
    map.on("click", "of-comment-shapes-line", onShapeClick);

    return () => {
      map.off("styledata", render);
      map.off("click", "of-comment-shapes-fill", onShapeClick);
      map.off("click", "of-comment-shapes-line", onShapeClick);
    };
  }, [mapLoaded]);

  // Re-render the shape overlays whenever their inputs change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !map.isStyleLoaded()) return;
    const approved = {
      type: "FeatureCollection" as const,
      features: (commentShapes ?? []).map((item) => ({
        type: "Feature" as const,
        id: item.id,
        properties: { id: item.id, selected: item.id === selectedCommentId },
        geometry: item.geometry,
      })),
    };
    const draftFeatures: unknown[] = [];
    if (draftShape) draftFeatures.push({ type: "Feature", properties: {}, geometry: draftShape });
    for (const vertex of draftVertices ?? []) {
      draftFeatures.push({
        type: "Feature",
        properties: { vertex: true },
        geometry: { type: "Point", coordinates: vertex },
      });
    }
    (map.getSource("of-comment-shapes") as maplibregl.GeoJSONSource | undefined)?.setData(
      approved as never,
    );
    (map.getSource("of-comment-draft") as maplibregl.GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: draftFeatures,
    } as never);
  }, [commentShapes, draftShape, draftVertices, selectedCommentId, mapLoaded]);


  // Crosshair while placing a comment.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = pickMode ? "crosshair" : "";
  }, [pickMode]);




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
      setView: (view) =>
        mapRef.current?.easeTo({
          center: view.center,
          zoom: view.zoom ?? mapRef.current.getZoom(),
          pitch: view.pitch ?? 0,
          bearing: view.bearing ?? 0,
          duration: 600,
        }),
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
      captureThumbnail: async (width = 800, height = 450) => {
        const map = mapRef.current;
        if (!map) return null;
        await new Promise<void>((resolve) => {
          if (map.loaded() && !map.isMoving()) {
            map.once("render", () => resolve());
            map.triggerRepaint();
          } else {
            map.once("idle", () => resolve());
          }
        });
        const source = map.getCanvas();
        if (!source.width || !source.height) return null;
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        // Cover-crop the map canvas into the thumbnail aspect ratio.
        const scale = Math.max(width / source.width, height / source.height);
        const sw = width / scale;
        const sh = height / scale;
        ctx.drawImage(
          source,
          (source.width - sw) / 2,
          (source.height - sh) / 2,
          sw,
          sh,
          0,
          0,
          width,
          height,
        );
        return new Promise<Blob | null>((resolve) =>
          canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.8),
        );
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
      canvasContextAttributes: { preserveDrawingBuffer: true },
      // Resizes are handled below so tiny (sub-pixel / scrollbar-width) layout
      // jitter cannot drive a repeating resize loop.
      trackResize: false,
    });
    mapRef.current = map;

    map.addControl(
      new maplibregl.GeolocateControl({ trackUserLocation: true, showAccuracyCircle: true }),
      "bottom-right",
    );
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
    const scale = new maplibregl.ScaleControl({ maxWidth: 120, unit: activeScaleUnits });
    scaleRef.current = scale;
    map.addControl(scale, "bottom-left");

    // Clicking the scale bar flips imperial <-> metric (delegated: the element
    // is re-rendered by MapLibre whenever the unit or zoom changes).
    const scaleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest(".maplibregl-ctrl-scale")) {
        event.stopPropagation();
        toggleScaleRef.current();
      }
    };
    containerRef.current.addEventListener("click", scaleClick);
    const scaleContainerEl = containerRef.current;



    map.on("error", (event) => {
      const message = (event as { error?: Error }).error?.message ?? "Unknown map error";
      console.error("[map] ", message);
      setMapError(message);
    });

    let watchdog: ReturnType<typeof setTimeout> | undefined;
    map.on("load", () => {
      readyRef.current = true;
      setMapLoaded(true);
      setMapError(null);
      // Start the attribution collapsed behind the "i" button.
      scaleContainerEl
        .querySelector(".maplibregl-ctrl-attrib.maplibregl-compact")
        ?.classList.remove("maplibregl-compact-show");
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

    // Coalesced, threshold-guarded resize handling. Changes smaller than 2px
    // are ignored, and at most one resize runs per animation frame.
    let frame = 0;
    let lastW = Math.round(scaleContainerEl.clientWidth);
    let lastH = Math.round(scaleContainerEl.clientHeight);
    const observer = new ResizeObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!mapRef.current) return;
        const w = Math.round(scaleContainerEl.clientWidth);
        const h = Math.round(scaleContainerEl.clientHeight);
        if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
        lastW = w;
        lastH = h;
        map.resize();
      });
    });
    observer.observe(scaleContainerEl);

    return () => {
      if (watchdog) clearTimeout(watchdog);
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      scaleContainerEl.removeEventListener("click", scaleClick);
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

  // Feature popups (click or hover), rendered as a docked card in the top-right.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const hitFor = (point: maplibregl.Point) => {
      const candidates = layersRef.current.filter((l) => l.visible && l.data && l.style.popup.enabled);
      if (!candidates.length) return null;
      const owner = new Map<string, RenderLayer>();
      for (const layer of candidates) {
        for (const kind of ["fill", "line", "circle", "symbol"]) {
          const id = LYR(layer.id, kind);
          if (map.getLayer(id)) owner.set(id, layer);
        }
      }
      if (!owner.size) return null;
      const [feature] = map.queryRenderedFeatures(point, { layers: [...owner.keys()] });
      if (!feature) return null;
      const layer = owner.get(String(feature.layer.id));
      if (!layer) return null;
      return { layer, properties: (feature.properties ?? {}) as Record<string, unknown> };
    };

    const onClick = (event: maplibregl.MapMouseEvent) => {
      if (pickModeRef.current) {
        onPickRef.current?.(event.lngLat.lng, event.lngLat.lat);
        return;
      }
      const hit = hitFor(event.point);
      if (!hit || hit.layer.style.popup.trigger !== "click") {
        setPopupHit((current) => (current && current.spec.trigger === "click" ? null : current));
        return;
      }
      setPopupHit({
        layerName: hit.layer.name,
        spec: hit.layer.style.popup,
        properties: hit.properties,
      });
    };

    const onMove = (event: maplibregl.MapMouseEvent) => {
      if (pickModeRef.current) {
        map.getCanvas().style.cursor = "crosshair";
        return;
      }
      const hit = hitFor(event.point);
      map.getCanvas().style.cursor = hit ? "pointer" : "";
      if (hit && hit.layer.style.popup.trigger === "hover") {
        setPopupHit({
          layerName: hit.layer.name,
          spec: hit.layer.style.popup,
          properties: hit.properties,
        });
      } else {
        setPopupHit((current) => (current && current.spec.trigger === "hover" ? null : current));
      }
    };

    map.on("click", onClick);
    map.on("mousemove", onMove);
    return () => {
      map.off("click", onClick);
      map.off("mousemove", onMove);
    };
  }, []);


  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />

      <div className="absolute bottom-[196px] right-2.5 z-10 flex max-h-[calc(100%-220px)] flex-col-reverse items-end gap-1">
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          aria-expanded={pickerOpen}
          aria-label="Basemap"
          title="Basemap"
          className={cn(
            "flex h-[29px] w-[29px] shrink-0 items-center justify-center rounded border border-border shadow-[var(--shadow-soft)] backdrop-blur transition-colors",
            pickerOpen
              ? "bg-card/95 text-foreground"
              : "bg-foreground/85 text-background hover:bg-foreground",
          )}
        >
          <Layers className="h-4 w-4" />
        </button>
        {pickerOpen && (
          <div className="w-52 shrink-0 overflow-hidden rounded-lg border border-border bg-card/95 shadow-[var(--shadow-soft)] backdrop-blur">
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
      </div>

      <div className="pointer-events-none absolute right-2.5 top-2.5 z-10 flex max-h-[calc(100%-20px)] w-80 max-w-[calc(100vw-20px)] flex-col items-stretch gap-2">
        {popupHit && (
          <div className="pointer-events-auto max-h-[60%] min-h-0 w-full overflow-y-auto rounded-lg border border-map-overlay-border bg-map-overlay p-3 text-map-overlay-foreground shadow-[var(--shadow-lift)]">
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold">
                {popupTitle(popupHit.spec, popupHit.properties, popupHit.layerName)}
              </h3>
              {popupHit.spec.trigger === "click" && (
                <button
                  type="button"
                  onClick={() => setPopupHit(null)}
                  aria-label="Close popup"
                  className="rounded p-0.5 opacity-60 hover:bg-black/5 hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <dl className={popupHit.spec.density === "roomy" ? "space-y-2" : "space-y-1"}>
              {popupRows(popupHit.spec, popupHit.properties).map((row) => {
                const raw =
                  row.value === null || row.value === undefined ? "" : String(row.value);
                return (
                  <div key={row.label}>
                    <dt className="text-[10px] uppercase tracking-wide opacity-60">{row.label}</dt>
                    <dd className="break-words text-[13px]">
                      {row.format === "link" && raw ? (
                        <a
                          href={raw}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[13px] underline underline-offset-2"
                        >
                          {raw}
                        </a>
                      ) : row.format === "image" && raw ? (
                        <button
                          type="button"
                          onClick={() => setLightbox({ src: raw, caption: row.label })}
                          className="mt-1 block w-full overflow-hidden rounded"
                          aria-label={`Expand ${row.label}`}
                        >
                          <img
                            src={raw}
                            alt={row.label}
                            loading="lazy"
                            className="aspect-[4/3] w-full rounded object-cover transition hover:opacity-90"
                          />
                        </button>
                      ) : (
                        formatPopupValue(row.value, row.format)
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        )}
        {rightSlot}
      </div>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={lightbox.caption}
          onClick={() => setLightbox(null)}
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close image"
            className="absolute right-4 top-4 rounded-full bg-white/90 p-1.5 text-neutral-900 shadow hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
          <figure
            onClick={(event) => event.stopPropagation()}
            className="flex max-h-full max-w-full flex-col items-center gap-2"
          >
            <img
              src={lightbox.src}
              alt={lightbox.caption}
              className="max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl"
            />
            <figcaption className="font-secondary text-xs text-white/80">
              {lightbox.caption}
            </figcaption>
          </figure>
        </div>
      )}


      {mapError ? (
        <div className="pointer-events-none absolute inset-x-0 top-2.5 z-10 flex justify-center">
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
    const match = /^of-(fill|line|circle|outline|symbol|label|maskfill|heat)-(.+)$/.exec(layer.id);
    if (match && !keep.has(match[2] as string)) removeLayerIfPresent(map, layer.id);
  }
  for (const sourceId of Object.keys(map.getStyle().sources ?? {})) {
    const match = /^of-(?:mask-)?src-(.+)$/.exec(sourceId);
    if (match && !keep.has(match[1] as string)) {
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    }
  }

  /** Masks scoped to "basemap only" get pushed under every data layer afterwards. */
  const basemapMasks: string[] = [];

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
    const categorized = isDataDriven(style);
    const primaryColor = primaryColorPaint(style) as never;
    const strokeColor = strokeColorPaint(style) as never;
    const fillCategorized = categoryDrives(style, "fill");
    const strokeCategorized = categoryDrives(style, "stroke");
    const hideFilter = categoryFilter(style);
    const withCategories = (base: unknown[]): maplibregl.FilterSpecification =>
      (hideFilter ? ["all", base, hideFilter] : base) as maplibregl.FilterSpecification;
    // Opacity now lives entirely in the layer style (fill + stroke, separately).
    const fillAlpha = fillCategorized || !isTransparent(style.fillColor) ? style.fillOpacity : 0;
    const strokeAlpha =
      strokeCategorized || !isTransparent(style.strokeColor) ? style.strokeOpacity : 0;
    const lineAlpha = fillCategorized || !isTransparent(style.fillColor) ? style.strokeOpacity : 0;

    const ensure = (id: string, spec: maplibregl.AddLayerObject) => {
      if (!map.getLayer(id)) map.addLayer(spec);
      else map.moveLayer(id);
    };

    const polygonBase = ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false];
    const lineBase = ["match", ["geometry-type"], ["LineString", "MultiLineString"], true, false];
    const pointBase = ["match", ["geometry-type"], ["Point", "MultiPoint"], true, false];

    // Mask (inverted polygon): paint everything outside the study area.
    const mask = activeMask(style);
    const maskSourceId = `of-mask-src-${layer.id}`;
    const maskLayerId = LYR(layer.id, "maskfill");
    if (mask) {
      const inverted = buildMaskGeometry(layer.data);
      const maskSource = map.getSource(maskSourceId) as maplibregl.GeoJSONSource | undefined;
      if (maskSource) maskSource.setData(inverted as never);
      else map.addSource(maskSourceId, { type: "geojson", data: inverted as never });

      ensure(maskLayerId, { id: maskLayerId, type: "fill", source: maskSourceId });
      map.setLayoutProperty(maskLayerId, "visibility", visibility);
      map.setPaintProperty(maskLayerId, "fill-color", paintColor(mask.color));
      map.setPaintProperty(
        maskLayerId,
        "fill-opacity",
        isTransparent(mask.color) ? 0 : mask.opacity,
      );
      if (mask.scope === "basemap") basemapMasks.push(maskLayerId);

      // Boundary of the study area, drawn from the original geometry.
      const boundaryId = LYR(layer.id, "outline");
      ensure(boundaryId, {
        id: boundaryId,
        type: "line",
        source: sourceId,
        filter: polygonBase as maplibregl.FilterSpecification,
      });
      map.setFilter(boundaryId, polygonBase as maplibregl.FilterSpecification);
      map.setLayoutProperty(boundaryId, "visibility", visibility);
      map.setPaintProperty(boundaryId, "line-color", paintColor(mask.boundaryColor));
      map.setPaintProperty(boundaryId, "line-width", mask.boundaryWidth);
      map.setPaintProperty(
        boundaryId,
        "line-opacity",
        isTransparent(mask.boundaryColor) ? 0 : 1,
      );
      map.setPaintProperty(
        boundaryId,
        "line-dasharray",
        (dashArray(mask.boundaryDash) ?? undefined) as never,
      );

      removeLayerIfPresent(map, LYR(layer.id, "fill"));
      removeLayerIfPresent(map, LYR(layer.id, "line"));
      removeLayerIfPresent(map, LYR(layer.id, "circle"));
      removeLayerIfPresent(map, LYR(layer.id, "symbol"));
    } else {
      removeLayerIfPresent(map, maskLayerId);
      if (map.getSource(maskSourceId)) map.removeSource(maskSourceId);
    }

    if (!mask && (layer.geometryType === "polygon" || layer.geometryType === "mixed")) {
      ensure(LYR(layer.id, "fill"), {
        id: LYR(layer.id, "fill"),
        type: "fill",
        source: sourceId,
        filter: withCategories(polygonBase),
      });
      map.setFilter(LYR(layer.id, "fill"), withCategories(polygonBase));
      map.setLayoutProperty(LYR(layer.id, "fill"), "visibility", visibility);
      map.setPaintProperty(LYR(layer.id, "fill"), "fill-color", primaryColor);
      map.setPaintProperty(LYR(layer.id, "fill"), "fill-opacity", fillAlpha);

      ensure(LYR(layer.id, "outline"), {
        id: LYR(layer.id, "outline"),
        type: "line",
        source: sourceId,
        filter: withCategories(polygonBase),
      });
      map.setFilter(LYR(layer.id, "outline"), withCategories(polygonBase));
      map.setLayoutProperty(LYR(layer.id, "outline"), "visibility", visibility);
      map.setPaintProperty(LYR(layer.id, "outline"), "line-color", strokeColor);
      map.setPaintProperty(LYR(layer.id, "outline"), "line-width", style.strokeWidth);
      map.setPaintProperty(LYR(layer.id, "outline"), "line-opacity", strokeAlpha);
      map.setPaintProperty(
        LYR(layer.id, "outline"),
        "line-dasharray",
        (dashArray(style.dashPattern) ?? undefined) as never,
      );
    }

    if (!mask && (layer.geometryType === "line" || layer.geometryType === "mixed")) {
      ensure(LYR(layer.id, "line"), {
        id: LYR(layer.id, "line"),
        type: "line",
        source: sourceId,
        filter: withCategories(lineBase),
      });
      map.setFilter(LYR(layer.id, "line"), withCategories(lineBase));
      map.setLayoutProperty(LYR(layer.id, "line"), "visibility", visibility);
      map.setLayoutProperty(LYR(layer.id, "line"), "line-cap", style.lineCap);
      map.setLayoutProperty(LYR(layer.id, "line"), "line-join", "round");
      map.setPaintProperty(LYR(layer.id, "line"), "line-color", primaryColor);
      map.setPaintProperty(LYR(layer.id, "line"), "line-width", Math.max(0.5, style.strokeWidth));
      map.setPaintProperty(LYR(layer.id, "line"), "line-opacity", lineAlpha);
      map.setPaintProperty(
        LYR(layer.id, "line"),
        "line-dasharray",
        (dashArray(style.dashPattern) ?? undefined) as never,
      );
    }

    // Heatmap replaces the point symbols with a density surface.
    const heat = activeHeatmap(style);
    const heatId = LYR(layer.id, "heat");
    const pointish = layer.geometryType === "point" || layer.geometryType === "mixed";
    if (!mask && heat && pointish) {
      ensure(heatId, {
        id: heatId,
        type: "heatmap",
        source: sourceId,
        filter: pointBase as maplibregl.FilterSpecification,
      });
      map.setFilter(heatId, pointBase as maplibregl.FilterSpecification);
      map.setLayoutProperty(heatId, "visibility", visibility);
      map.setPaintProperty(heatId, "heatmap-weight", heatmapWeightExpression(heat) as never);
      map.setPaintProperty(heatId, "heatmap-intensity", heat.intensity);
      map.setPaintProperty(heatId, "heatmap-radius", heat.radius);
      map.setPaintProperty(heatId, "heatmap-color", heatmapColorExpression(heat) as never);
      map.setPaintProperty(heatId, "heatmap-opacity", heat.opacity);
      removeLayerIfPresent(map, LYR(layer.id, "circle"));
      removeLayerIfPresent(map, LYR(layer.id, "symbol"));
    } else {
      removeLayerIfPresent(map, heatId);
    }

    if (!mask && !heat && pointish) {
      const proportional = activeProportional(style);
      const noValue = proportional ? proportionalFilter(proportional) : null;
      const basePointFilter = withCategories(pointBase);
      const pointFilter = (
        noValue ? ["all", basePointFilter, noValue] : basePointFilter
      ) as maplibregl.FilterSpecification;
      // Square / triangle markers are rasterised icons, so a per-feature color
      // expression cannot apply — categorized and proportional layers use circles.
      const useSymbol =
        !categorized &&
        !proportional &&
        (style.markerShape === "square" || style.markerShape === "triangle");

      if (useSymbol) {
        removeLayerIfPresent(map, LYR(layer.id, "circle"));
        const iconId = `of-icon-${layer.id}`;
        const image = markerImage(style);
        if (image) {
          if (map.hasImage(iconId)) map.removeImage(iconId);
          map.addImage(iconId, image, { pixelRatio: 2 });
        }
        ensure(LYR(layer.id, "symbol"), {
          id: LYR(layer.id, "symbol"),
          type: "symbol",
          source: sourceId,
          filter: pointFilter,
          layout: { "icon-image": iconId, "icon-allow-overlap": true },
        });
        map.setFilter(LYR(layer.id, "symbol"), pointFilter);
        map.setLayoutProperty(LYR(layer.id, "symbol"), "icon-image", iconId);
        map.setLayoutProperty(LYR(layer.id, "symbol"), "visibility", visibility);
        map.setPaintProperty(
          LYR(layer.id, "symbol"),
          "icon-opacity",
          Math.max(fillAlpha, strokeAlpha),
        );
      } else {
        removeLayerIfPresent(map, LYR(layer.id, "symbol"));
        const ring = !categorized && style.markerShape === "ring";
        ensure(LYR(layer.id, "circle"), {
          id: LYR(layer.id, "circle"),
          type: "circle",
          source: sourceId,
          filter: pointFilter,
        });
        map.setFilter(LYR(layer.id, "circle"), pointFilter);
        map.setLayoutProperty(LYR(layer.id, "circle"), "visibility", visibility);
        map.setPaintProperty(LYR(layer.id, "circle"), "circle-color", primaryColor);
        map.setPaintProperty(
          LYR(layer.id, "circle"),
          "circle-radius",
          (proportional
            ? proportionalRadiusExpression(proportional)
            : radiusPaint(style)) as never,
        );
        map.setPaintProperty(LYR(layer.id, "circle"), "circle-opacity", ring ? 0 : fillAlpha);
        map.setPaintProperty(
          LYR(layer.id, "circle"),
          "circle-stroke-color",
          ring ? primaryColor : strokeColor,
        );
        map.setPaintProperty(
          LYR(layer.id, "circle"),
          "circle-stroke-width",
          ring ? Math.max(2, style.strokeWidth) : style.strokeWidth,
        );
        map.setPaintProperty(
          LYR(layer.id, "circle"),
          "circle-stroke-opacity",
          ring ? style.fillOpacity : strokeAlpha,
        );
      }
    }

  }

  // "Basemap only" masks slide beneath every Open Field data layer.
  if (basemapMasks.length) {
    const ordered = (map.getStyle().layers ?? []).map((l) => l.id);
    const firstData = ordered.find((id) => id.startsWith("of-") && !basemapMasks.includes(id));
    for (const id of basemapMasks) {
      if (map.getLayer(id)) map.moveLayer(id, firstData);
    }
  }



  // Labels sit above every data layer, added last in reverse draw order.
  for (const layer of [...layers].reverse()) {
    const labelId = LYR(layer.id, "label");
    const spec = layer.data ? activeLabels(layer.style) : null;
    if (!spec) {
      removeLayerIfPresent(map, labelId);
      continue;
    }
    const sourceId = SRC(layer.id);
    const { anchor, offset } = labelAnchorOffset(spec);
    const alongLine = layer.geometryType === "line" && spec.linePlacement === "line";
    if (!map.getLayer(labelId)) {
      map.addLayer({ id: labelId, type: "symbol", source: sourceId });
    } else {
      map.moveLayer(labelId);
    }
    const hideFilter = categoryFilter(layer.style);
    map.setFilter(labelId, (hideFilter ?? null) as maplibregl.FilterSpecification | null);
    map.setLayoutProperty(labelId, "visibility", layer.visible ? "visible" : "none");
    map.setLayoutProperty(labelId, "text-field", labelTextExpression(spec) as never);
    map.setLayoutProperty(labelId, "text-font", [
      spec.bold ? "Noto Sans Bold" : "Noto Sans Regular",
    ]);
    map.setLayoutProperty(labelId, "text-size", spec.size);
    map.setLayoutProperty(labelId, "text-anchor", alongLine ? "center" : anchor);
    map.setLayoutProperty(labelId, "text-offset", alongLine ? [0, 0] : offset);
    map.setLayoutProperty(labelId, "text-max-width", spec.maxWidth);
    map.setLayoutProperty(labelId, "text-allow-overlap", spec.allowOverlap);
    map.setLayoutProperty(labelId, "text-ignore-placement", spec.allowOverlap);
    map.setLayoutProperty(labelId, "symbol-placement", alongLine ? "line" : "point");
    map.setPaintProperty(labelId, "text-color", paintColor(spec.color));
    map.setPaintProperty(labelId, "text-opacity", spec.textOpacity);
    map.setPaintProperty(labelId, "text-halo-color", withAlpha(spec.haloColor, spec.haloOpacity));
    map.setPaintProperty(labelId, "text-halo-width", spec.haloWidth);

    // Label background: a solid image stretched behind the text in the same
    // symbol layer, so it collides and moves with the label. Curved along-line
    // labels can't carry a fitted rectangle, so it's skipped there.
    const wantsBg = spec.bgEnabled && !alongLine && !isTransparent(spec.bgColor);
    if (wantsBg) {
      const bgIconId = labelBackgroundImage(map, spec.bgColor);
      map.setLayoutProperty(labelId, "icon-image", bgIconId);
      map.setLayoutProperty(labelId, "icon-text-fit", "both");
      map.setLayoutProperty(labelId, "icon-text-fit-padding", [
        spec.bgPadding,
        spec.bgPadding,
        spec.bgPadding,
        spec.bgPadding,
      ]);
      map.setLayoutProperty(labelId, "icon-allow-overlap", spec.allowOverlap);
      map.setLayoutProperty(labelId, "icon-ignore-placement", spec.allowOverlap);
      map.setPaintProperty(labelId, "icon-opacity", spec.bgOpacity);
    } else {
      map.setLayoutProperty(labelId, "icon-image", undefined);
    }
    map.setLayerZoomRange(labelId, spec.minZoom, Math.max(spec.minZoom + 0.1, spec.maxZoom));

  }
}



/** Rasterise square / triangle markers so MapLibre can draw them as icons. */
function markerImage(style: LayerStyle): ImageData | null {
  if (typeof document === "undefined") return null;
  const ratio = 2;
  const size = Math.max(6, style.circleRadius) * 2 + Math.max(2, style.strokeWidth) * 2 + 2;
  const px = Math.ceil(size * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.scale(ratio, ratio);
  ctx.fillStyle = isTransparent(style.fillColor) ? "rgba(0,0,0,0)" : style.fillColor;
  ctx.strokeStyle = isTransparent(style.strokeColor) ? "rgba(0,0,0,0)" : style.strokeColor;
  ctx.lineWidth = style.strokeWidth;
  ctx.lineJoin = "round";

  const r = Math.max(3, style.circleRadius);
  const c = size / 2;
  ctx.beginPath();
  if (style.markerShape === "square") {
    ctx.rect(c - r, c - r, r * 2, r * 2);
  } else {
    ctx.moveTo(c, c - r);
    ctx.lineTo(c + r, c + r * 0.85);
    ctx.lineTo(c - r, c + r * 0.85);
    ctx.closePath();
  }
  ctx.fill();
  if (style.strokeWidth > 0) ctx.stroke();

  return ctx.getImageData(0, 0, px, px);
}

/**
 * Solid-color image used as the stretched label background. One image per
 * color, registered lazily and reused across layers.
 */
function labelBackgroundImage(map: maplibregl.Map, color: string): string {
  const hex = paintColor(color).toLowerCase();
  const id = `of-labelbg-${hex.replace(/[^a-z0-9]/g, "")}`;
  if (map.hasImage(id)) return id;
  // A larger solid image with explicit stretch zones: icon-text-fit then
  // stretches the interior, keeping the rectangle's opacity perfectly uniform
  // with hard edges (a tiny unstretched image fades at the extents).
  const size = 64;
  const data = new Uint8Array(size * size * 4);
  const rgb = withAlpha(hex, 1).match(/\d+/g) ?? ["255", "255", "255"];
  for (let i = 0; i < size * size; i += 1) {
    data[i * 4] = Number(rgb[0]);
    data[i * 4 + 1] = Number(rgb[1]);
    data[i * 4 + 2] = Number(rgb[2]);
    data[i * 4 + 3] = 255;
  }
  map.addImage(
    id,
    { width: size, height: size, data },
    {
      pixelRatio: 1,
      stretchX: [
        [0, size / 2],
        [size / 2, size],
      ],
      stretchY: [
        [0, size / 2],
        [size / 2, size],
      ],
      content: [0, 0, size, size],
    },
  );
  return id;
}
