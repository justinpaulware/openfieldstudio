import type { Tables } from "@/integrations/supabase/types";

export type StyleRow = Tables<"layer_styles">;
export type StyleRelation = StyleRow | StyleRow[] | null | undefined;

export type MarkerShape = "circle" | "ring" | "square" | "triangle";
export type DashPattern = "solid" | "dashed" | "dotted";
export type LineCapStyle = "butt" | "round" | "square";

export type LayerStyle = {
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  circleRadius: number;
  fillOpacity: number;
  strokeOpacity: number;
  markerShape: MarkerShape;
  dashPattern: DashPattern;
  lineCap: LineCapStyle;
};

/** Sentinel for "no fill" / "no color". */
export const TRANSPARENT = "transparent";

export function isTransparent(color: string): boolean {
  const value = (color ?? "").trim().toLowerCase();
  return value === "transparent" || value === "none" || value === "#00000000";
}

/** Safe hex for canvas/svg/maplibre when a color may be the transparent sentinel. */
export function paintColor(color: string): string {
  return isTransparent(color) ? "#000000" : color;
}

/** Normalize the one-to-one joined relation across PostgREST response shapes. */
export function styleRowFromRelation(relation: StyleRelation): StyleRow | null {
  if (Array.isArray(relation)) return relation[0] ?? null;
  return relation ?? null;
}

export const DEFAULT_LAYER_STYLE: LayerStyle = {
  fillColor: "#f5c518",
  strokeColor: "#1b1d22",
  strokeWidth: 1,
  circleRadius: 5,
  fillOpacity: 0.55,
  strokeOpacity: 1,
  markerShape: "circle",
  dashPattern: "solid",
  lineCap: "round",
};

/** Row one: hues in rainbow order. */
export const PALETTE_HUES = [
  "#e0533d",
  "#f0932b",
  "#f5c518",
  "#a8c545",
  "#4caf6a",
  "#2bb1a8",
  "#4f7cf7",
  "#8b5cf6",
  "#c65fb5",
];

/** Row two: white, gray ramp, black, then "no color". */
export const PALETTE_NEUTRALS = [
  "#ffffff",
  "#e5e5e5",
  "#cccccc",
  "#999999",
  "#666666",
  "#444444",
  "#222222",
  "#000000",
  TRANSPARENT,
];

export const STYLE_PALETTE = [...PALETTE_HUES, ...PALETTE_NEUTRALS];


const MARKER_SHAPES: MarkerShape[] = ["circle", "ring", "square", "triangle"];
const DASH_PATTERNS: DashPattern[] = ["solid", "dashed", "dotted"];
const LINE_CAPS: LineCapStyle[] = ["butt", "round", "square"];

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Merge a layer_styles row (columns + style_config jsonb) into a complete style. */
export function resolveLayerStyle(row?: StyleRow | null): LayerStyle {
  const config = (row?.style_config ?? {}) as Record<string, unknown>;
  return {
    fillColor: row?.fill_color ?? DEFAULT_LAYER_STYLE.fillColor,
    strokeColor: row?.stroke_color ?? DEFAULT_LAYER_STYLE.strokeColor,
    strokeWidth: num(row?.stroke_width, DEFAULT_LAYER_STYLE.strokeWidth),
    circleRadius: num(row?.circle_radius, DEFAULT_LAYER_STYLE.circleRadius),
    fillOpacity: num(row?.fill_opacity, DEFAULT_LAYER_STYLE.fillOpacity),
    strokeOpacity: num(config["strokeOpacity"], DEFAULT_LAYER_STYLE.strokeOpacity),
    markerShape: pick(config["markerShape"], MARKER_SHAPES, DEFAULT_LAYER_STYLE.markerShape),
    dashPattern: pick(config["dashPattern"], DASH_PATTERNS, DEFAULT_LAYER_STYLE.dashPattern),
    lineCap: pick(config["lineCap"], LINE_CAPS, DEFAULT_LAYER_STYLE.lineCap),
  };
}

/** Split the style back into database columns + jsonb config. */
export function styleToRow(style: LayerStyle) {
  return {
    fill_color: style.fillColor,
    stroke_color: style.strokeColor,
    stroke_width: style.strokeWidth,
    circle_radius: style.circleRadius,
    fill_opacity: style.fillOpacity,
    style_mode: "single",
    style_config: {
      markerShape: style.markerShape,
      dashPattern: style.dashPattern,
      lineCap: style.lineCap,
      strokeOpacity: style.strokeOpacity,
    },
  };
}

/** MapLibre line-dasharray (units of line width). Solid returns null. */
export function dashArray(pattern: DashPattern): [number, number] | null {
  if (pattern === "dashed") return [2, 1.5];
  if (pattern === "dotted") return [0.2, 1.8];
  return null;
}

export type SimpleKind = "point" | "line" | "polygon";

export function geometryKind(geometryType: string | null | undefined): SimpleKind {
  const geom = (geometryType ?? "").toLowerCase();
  if (geom.includes("point")) return "point";
  if (geom.includes("line")) return "line";
  return "polygon";
}
