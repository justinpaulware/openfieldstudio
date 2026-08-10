import type { Tables } from "@/integrations/supabase/types";

export type StyleRow = Tables<"layer_styles">;
export type StyleRelation = StyleRow | StyleRow[] | null | undefined;

export type MarkerShape = "circle" | "ring" | "square" | "triangle";
export type DashPattern = "solid" | "dashed" | "dotted";
export type LineCapStyle = "butt" | "round" | "square";
export type StyleMode = "single" | "categorized";

export type CategoryEntry = {
  /** Stringified attribute value. */
  value: string;
  color: string;
  visible: boolean;
};

export type CategorySpec = {
  field: string;
  entries: CategoryEntry[];
  otherColor: string;
  otherVisible: boolean;
  palette: string;
};

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
  mode: StyleMode;
  categories: CategorySpec | null;
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
  mode: "single",
  categories: null,
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


/** Named categorical palettes for unique-value styling. */
export const CATEGORY_PALETTES: { id: string; label: string; colors: string[] }[] = [
  {
    id: "field",
    label: "Field",
    colors: ["#4f7cf7", "#f0932b", "#4caf6a", "#c65fb5", "#2bb1a8", "#e0533d", "#f5c518", "#8b5cf6"],
  },
  {
    id: "bold",
    label: "Bold",
    colors: ["#e0533d", "#2bb1a8", "#f5c518", "#8b5cf6", "#4caf6a", "#f0932b", "#4f7cf7", "#c65fb5"],
  },
  {
    id: "muted",
    label: "Muted",
    colors: ["#8aa1c1", "#c9a227", "#7fa87f", "#b48ead", "#6fa3a0", "#c98a6f", "#9aa0a6", "#7d8bb5"],
  },
  {
    id: "earth",
    label: "Earth",
    colors: ["#8c6a4f", "#b8894b", "#6f8f4e", "#4c7d6d", "#9c5f4a", "#c2a878", "#5b6f52", "#7b5e3b"],
  },
];

export function paletteColors(id: string): string[] {
  return (CATEGORY_PALETTES.find((p) => p.id === id) ?? CATEGORY_PALETTES[0]!).colors;
}

const MARKER_SHAPES: MarkerShape[] = ["circle", "ring", "square", "triangle"];
const DASH_PATTERNS: DashPattern[] = ["solid", "dashed", "dotted"];
const LINE_CAPS: LineCapStyle[] = ["butt", "round", "square"];
const STYLE_MODES: StyleMode[] = ["single", "categorized"];

function pick<T extends string>(value: unknown, allowed: T[], fallback: T): T {
  return typeof value === "string" && (allowed as string[]).includes(value) ? (value as T) : fallback;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function parseCategories(value: unknown): CategorySpec | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw["field"] !== "string" || !raw["field"]) return null;
  const entries = Array.isArray(raw["entries"])
    ? (raw["entries"] as unknown[]).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const e = item as Record<string, unknown>;
        if (typeof e["value"] !== "string") return [];
        return [
          {
            value: e["value"],
            color: typeof e["color"] === "string" ? e["color"] : PALETTE_HUES[0]!,
            visible: e["visible"] !== false,
          } satisfies CategoryEntry,
        ];
      })
    : [];
  return {
    field: raw["field"],
    entries,
    otherColor: typeof raw["otherColor"] === "string" ? raw["otherColor"] : "#999999",
    otherVisible: raw["otherVisible"] !== false,
    palette: typeof raw["palette"] === "string" ? raw["palette"] : CATEGORY_PALETTES[0]!.id,
  };
}

/** Merge a layer_styles row (columns + style_config jsonb) into a complete style. */
export function resolveLayerStyle(row?: StyleRow | null): LayerStyle {
  const config = (row?.style_config ?? {}) as Record<string, unknown>;
  const categories = parseCategories(config["categories"]);
  const mode = pick(row?.style_mode, STYLE_MODES, DEFAULT_LAYER_STYLE.mode);
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
    mode: categories ? mode : "single",
    categories,
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
    style_mode: style.mode,
    style_config: {
      markerShape: style.markerShape,
      dashPattern: style.dashPattern,
      lineCap: style.lineCap,
      strokeOpacity: style.strokeOpacity,
      categories: style.categories,
    },
  };
}

/** Categorized styling is only live when a field and at least one value exist. */
export function activeCategories(style: LayerStyle): CategorySpec | null {
  if (style.mode !== "categorized") return null;
  const spec = style.categories;
  if (!spec || !spec.field || !spec.entries.length) return null;
  return spec;
}

/** MapLibre color for the layer's primary paint (fill / circle / line). */
export function primaryColorPaint(style: LayerStyle): string | unknown[] {
  const spec = activeCategories(style);
  if (!spec) return paintColor(style.fillColor);
  const match: unknown[] = ["match", ["to-string", ["get", spec.field]]];
  for (const entry of spec.entries) {
    match.push(entry.value, paintColor(entry.color));
  }
  match.push(paintColor(spec.otherColor));
  return match;
}

/** Filter hiding categories the user switched off; null when nothing is hidden. */
export function categoryFilter(style: LayerStyle): unknown[] | null {
  const spec = activeCategories(style);
  if (!spec) return null;
  const hidden = spec.entries.filter((entry) => !entry.visible).map((entry) => entry.value);
  const clauses: unknown[] = [];
  if (hidden.length) {
    clauses.push(["!", ["in", ["to-string", ["get", spec.field]], ["literal", hidden]]]);
  }
  if (!spec.otherVisible) {
    const known = spec.entries.map((entry) => entry.value);
    clauses.push(["in", ["to-string", ["get", spec.field]], ["literal", known]]);
  }
  if (!clauses.length) return null;
  return clauses.length === 1 ? (clauses[0] as unknown[]) : ["all", ...clauses];
}

/** Build categories for a field, keeping colors already assigned to a value. */
export function buildCategories(
  field: string,
  values: string[],
  paletteId: string,
  previous?: CategorySpec | null,
): CategorySpec {
  const colors = paletteColors(paletteId);
  const prior = new Map((previous?.entries ?? []).map((entry) => [entry.value, entry]));
  return {
    field,
    palette: paletteId,
    otherColor: previous?.otherColor ?? "#999999",
    otherVisible: previous?.otherVisible ?? true,
    entries: values.map((value, index) => {
      const existing = prior.get(value);
      return {
        value,
        color: existing?.color ?? colors[index % colors.length]!,
        visible: existing?.visible ?? true,
      };
    }),
  };
}

/** Reapply a palette to every category in order. */
export function recolorCategories(spec: CategorySpec, paletteId: string): CategorySpec {
  const colors = paletteColors(paletteId);
  return {
    ...spec,
    palette: paletteId,
    entries: spec.entries.map((entry, index) => ({
      ...entry,
      color: colors[index % colors.length]!,
    })),
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
