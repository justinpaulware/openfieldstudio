import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
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
} from "@/lib/layer-style";


export type RenderLayer = {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  geometryType: SimpleGeometryType;
  data: FeatureCollection | null;
  style: LayerStyle;
};


export type MapHandle = {
  fitBbox: (bbox: Bbox, padding?: number) => void;
  flyTo: (lng: number, lat: number) => void;
  getView: () => { center: [number, number]; zoom: number; pitch: number; bearing: number } | null;
  /** JPEG snapshot of the current map canvas, downscaled for use as a thumbnail. */
  captureThumbnail: (width?: number, height?: number) => Promise<Blob | null>;
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
  handleRef,
  onBasemapChange,
  scaleUnits = "imperial",
  onScaleUnitsChange,
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
      preserveDrawingBuffer: true,
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

    return () => {
      if (watchdog) clearTimeout(watchdog);
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

      <div className="absolute right-2.5 top-[146px] z-10 flex max-h-[calc(100%-160px)] flex-col items-end gap-1">
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

      {popupHit && (
          <div
            className="absolute right-[49px] top-[10px] z-10 max-h-[calc(100%-20px)] min-h-0 overflow-y-auto rounded-lg border border-neutral-200 bg-white/95 px-3 py-2.5 shadow-[var(--shadow-soft)] backdrop-blur"
            style={{ width: Math.min(popupHit.spec.maxWidth, 420) }}
          >
            <div className="mb-1.5 flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-neutral-900">
                {popupTitle(popupHit.spec, popupHit.properties, popupHit.layerName)}
              </h3>
              {popupHit.spec.trigger === "click" && (
                <button
                  type="button"
                  onClick={() => setPopupHit(null)}
                  aria-label="Close popup"
                  className="text-neutral-500 hover:text-neutral-900"
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
                    <dt className="text-[10px] uppercase tracking-wide text-neutral-500">
                      {row.label}
                    </dt>
                    <dd className="break-words text-[13px] text-neutral-900">
                      {row.format === "link" && raw ? (
                        <a
                          href={raw}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="text-[13px] text-blue-700 underline"
                        >
                          {raw}
                        </a>
                      ) : row.format === "image" && raw ? (
                        <img
                          src={raw}
                          alt={row.label}
                          loading="lazy"
                          className="mt-1 max-h-32 w-full rounded object-cover"
                        />
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
    const match = /^of-(fill|line|circle|outline|symbol|label)-(.+)$/.exec(layer.id);
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

    if (layer.geometryType === "polygon" || layer.geometryType === "mixed") {
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

    if (layer.geometryType === "line" || layer.geometryType === "mixed") {
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

    if (layer.geometryType === "point" || layer.geometryType === "mixed") {
      const pointFilter = withCategories(pointBase);
      // Square / triangle markers are rasterised icons, so a per-feature color
      // expression cannot apply — categorized layers fall back to circles.
      const useSymbol =
        !categorized && (style.markerShape === "square" || style.markerShape === "triangle");

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
        map.setPaintProperty(LYR(layer.id, "circle"), "circle-radius", radiusPaint(style) as never);
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
    map.setPaintProperty(labelId, "text-halo-color", paintColor(spec.haloColor));
    map.setPaintProperty(labelId, "text-halo-width", spec.haloWidth);
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
