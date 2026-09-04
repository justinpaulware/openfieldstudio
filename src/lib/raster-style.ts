/**
 * Raster layers (Phase 1): ArcGIS MapServer imagery drawn as map tiles.
 *
 * Rasters don't use the vector symbology system at all — they carry their own
 * small appearance record, stored on `layers.raster_style` (and optionally
 * overridden per view on `view_layers.raster_style`).
 */

export type RasterStyle = {
  /** 0 – 1 */
  opacity: number;
  /** -100 – 100, 0 = untouched */
  brightness: number;
  /** -100 – 100, 0 = untouched */
  contrast: number;
  /** -100 – 100, 0 = untouched */
  saturation: number;
  grayscale: boolean;
};

export const DEFAULT_RASTER_STYLE: RasterStyle = {
  opacity: 1,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  grayscale: false,
};

const clamp = (value: number, min: number, max: number) =>
  Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;

/** Read a stored jsonb blob into a complete raster style. */
export function resolveRasterStyle(raw: unknown): RasterStyle {
  const record = (raw && typeof raw === "object" ? raw : {}) as Partial<RasterStyle>;
  return {
    opacity: clamp(Number(record.opacity ?? DEFAULT_RASTER_STYLE.opacity), 0, 1),
    brightness: clamp(Number(record.brightness ?? 0), -100, 100),
    contrast: clamp(Number(record.contrast ?? 0), -100, 100),
    saturation: clamp(Number(record.saturation ?? 0), -100, 100),
    grayscale: record.grayscale === true,
  };
}

export function isRasterLayer(layer: { geometry_type?: string | null; source_type?: string | null }) {
  return layer.geometry_type === "raster" || layer.source_type === "raster_arcgis";
}

/** MapLibre raster paint properties for a raster appearance record. */
export function rasterPaint(style: RasterStyle) {
  const brightness = style.brightness / 100;
  return {
    "raster-opacity": style.opacity,
    "raster-brightness-min": brightness > 0 ? brightness : 0,
    "raster-brightness-max": brightness < 0 ? 1 + brightness : 1,
    "raster-contrast": style.contrast / 100,
    "raster-saturation": style.grayscale ? -1 : style.saturation / 100,
  };
}

/**
 * Turn an ArcGIS MapServer layer URL (…/MapServer/3) into a tile template the
 * map can request. MapLibre substitutes the bounding box per tile.
 */
export function arcgisRasterTileUrl(sourceUrl: string): string | null {
  const match = /^(.*\/MapServer)(?:\/(\d+))?\/?$/i.exec(sourceUrl.trim().split("?")[0] ?? "");
  if (!match) return null;
  const base = match[1] as string;
  const layerId = match[2];
  const params = new URLSearchParams({
    bbox: "{bbox-epsg-3857}",
    bboxSR: "3857",
    imageSR: "3857",
    size: "512,512",
    format: "png32",
    transparent: "true",
    dpi: "96",
    f: "image",
  });
  if (layerId !== undefined) params.set("layers", `show:${layerId}`);
  // URLSearchParams escapes the braces; MapLibre needs them literal.
  return `${base}/export?${params.toString().replace("%7Bbbox-epsg-3857%7D", "{bbox-epsg-3857}")}`;
}

/**
 * Everything the map needs to draw one raster layer, or null when the row
 * isn't a usable raster. The layer's own opacity multiplies the raster one.
 */
export function rasterSpecFor(layer: {
  geometry_type?: string | null;
  source_type?: string | null;
  source_url?: string | null;
  raster_style?: unknown;
  opacity?: number | null;
}): { tileUrl: string; style: RasterStyle } | null {
  if (!isRasterLayer(layer) || !layer.source_url) return null;
  const tileUrl = arcgisRasterTileUrl(layer.source_url);
  if (!tileUrl) return null;
  const style = resolveRasterStyle(layer.raster_style);
  return {
    tileUrl,
    style: { ...style, opacity: style.opacity * (layer.opacity ?? 1) },
  };
}

