import type { Tables } from "@/integrations/supabase/types";
import {
  computeBreaks,
  formatNumber,
  rampColors,
  type ClassifyMethod,
} from "@/lib/classify";

export type StyleRow = Tables<"layer_styles">;
export type StyleRelation = StyleRow | StyleRow[] | null | undefined;

export type MarkerShape = "circle" | "ring" | "square" | "triangle";
export type DashPattern = "solid" | "dashed" | "dotted";
export type LineCapStyle = "butt" | "round" | "square";
export type StyleMode = "single" | "categorized" | "graduated";

export type CategoryEntry = {
  /** Stringified attribute value. */
  value: string;
  color: string;
  visible: boolean;
};

/** Which paint the category / class colors drive. */
export type CategoryTarget = "fill" | "stroke" | "both";

export type CategorySpec = {
  field: string;
  target: CategoryTarget;
  entries: CategoryEntry[];
  otherColor: string;
  otherVisible: boolean;
  palette: string;
  reversed: boolean;
};

export type GraduatedClass = {
  min: number;
  max: number;
  color: string;
  visible: boolean;
};

export type GraduatedSpec = {
  field: string;
  method: ClassifyMethod;
  classCount: number;
  classes: GraduatedClass[];
  ramp: string;
  reversed: boolean;
  target: CategoryTarget;
  otherColor: string;
  otherVisible: boolean;
  sizeEnabled: boolean;
  minRadius: number;
  maxRadius: number;
};

export type LabelPlacement = "center" | "above" | "below" | "left" | "right";
export type LabelLinePlacement = "line" | "horizontal";

export type LabelSpec = {
  enabled: boolean;
  field: string;
  size: number;
  bold: boolean;
  color: string;
  haloColor: string;
  haloWidth: number;
  placement: LabelPlacement;
  offset: number;
  linePlacement: LabelLinePlacement;
  allowOverlap: boolean;
  minZoom: number;
  maxZoom: number;
  uppercase: boolean;
  maxWidth: number;
};

export type PopupTrigger = "click" | "hover";
export type PopupFieldFormat = "text" | "number" | "date" | "link" | "image";

export type PopupField = {
  name: string;
  alias: string;
  visible: boolean;
  format: PopupFieldFormat;
};

export type PopupSpec = {
  enabled: boolean;
  trigger: PopupTrigger;
  titleField: string;
  titleText: string;
  /** Empty means "every attribute, in data order". */
  fields: PopupField[];
  hideEmpty: boolean;
  density: "compact" | "roomy";
  maxWidth: number;
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
  graduated: GraduatedSpec | null;
  labels: LabelSpec;
  popup: PopupSpec;
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

export const DEFAULT_LABELS: LabelSpec = {
  enabled: false,
  field: "",
  size: 12,
  bold: false,
  color: "#1b1d22",
  haloColor: "#ffffff",
  haloWidth: 1.2,
  placement: "center",
  offset: 0.9,
  linePlacement: "line",
  allowOverlap: false,
  minZoom: 0,
  maxZoom: 22,
  uppercase: false,
  maxWidth: 10,
};

export const DEFAULT_POPUP: PopupSpec = {
  enabled: true,
  trigger: "click",
  titleField: "",
  titleText: "",
  fields: [],
  hideEmpty: true,
  density: "compact",
  maxWidth: 280,
};

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
  graduated: null,
  labels: DEFAULT_LABELS,
  popup: DEFAULT_POPUP,
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
  {
    id: "contrast",
    label: "Contrast",
    colors: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#17becf"],
  },
  {
    id: "cool",
    label: "Cool",
    colors: ["#0d3b66", "#1b6ca8", "#2e9cca", "#54c1c4", "#7fd8be", "#3f8f7a", "#5c7aa8", "#9ad1e5"],
  },
  {
    id: "sunset",
    label: "Sunset",
    colors: ["#f9c74f", "#f8961e", "#f3722c", "#e0533d", "#c9426b", "#9d4edd", "#6a4c93", "#ffb4a2"],
  },
  {
    id: "accessible",
    label: "Accessible",
    colors: ["#0072b2", "#e69f00", "#009e73", "#cc79a7", "#56b4e9", "#d55e00", "#f0e442", "#000000"],
  },
];

export function paletteColors(id: string, reversed = false): string[] {
  const colors = (CATEGORY_PALETTES.find((p) => p.id === id) ?? CATEGORY_PALETTES[0]!).colors;
  return reversed ? [...colors].reverse() : colors;
}

const MARKER_SHAPES: MarkerShape[] = ["circle", "ring", "square", "triangle"];
const DASH_PATTERNS: DashPattern[] = ["solid", "dashed", "dotted"];
const LINE_CAPS: LineCapStyle[] = ["butt", "round", "square"];
const STYLE_MODES: StyleMode[] = ["single", "categorized", "graduated"];
const CATEGORY_TARGETS: CategoryTarget[] = ["fill", "stroke", "both"];
const CLASSIFY_METHODS: ClassifyMethod[] = ["quantile", "equal", "jenks", "manual"];

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
    // Saved layers predate targeting and only ever colored the fill.
    target: pick(raw["target"], CATEGORY_TARGETS, "fill"),
    entries,
    otherColor: typeof raw["otherColor"] === "string" ? raw["otherColor"] : "#999999",
    otherVisible: raw["otherVisible"] !== false,
    palette: typeof raw["palette"] === "string" ? raw["palette"] : CATEGORY_PALETTES[0]!.id,
    reversed: raw["reversed"] === true,
  };
}

function parseGraduated(value: unknown): GraduatedSpec | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw["field"] !== "string" || !raw["field"]) return null;
  const classes = Array.isArray(raw["classes"])
    ? (raw["classes"] as unknown[]).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const c = item as Record<string, unknown>;
        if (typeof c["min"] !== "number" || typeof c["max"] !== "number") return [];
        return [
          {
            min: c["min"],
            max: c["max"],
            color: typeof c["color"] === "string" ? c["color"] : "#999999",
            visible: c["visible"] !== false,
          } satisfies GraduatedClass,
        ];
      })
    : [];
  return {
    field: raw["field"],
    method: pick(raw["method"], CLASSIFY_METHODS, "quantile"),
    classCount: num(raw["classCount"], classes.length || 5),
    classes,
    ramp: typeof raw["ramp"] === "string" ? raw["ramp"] : "viridis",
    reversed: raw["reversed"] === true,
    target: pick(raw["target"], CATEGORY_TARGETS, "fill"),
    otherColor: typeof raw["otherColor"] === "string" ? raw["otherColor"] : "#999999",
    otherVisible: raw["otherVisible"] !== false,
    sizeEnabled: raw["sizeEnabled"] === true,
    minRadius: num(raw["minRadius"], 4),
    maxRadius: num(raw["maxRadius"], 14),
  };
}

function str(value: unknown, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function parseLabels(value: unknown): LabelSpec {
  if (!value || typeof value !== "object") return DEFAULT_LABELS;
  const raw = value as Record<string, unknown>;
  return {
    enabled: raw["enabled"] === true,
    field: str(raw["field"], ""),
    size: num(raw["size"], DEFAULT_LABELS.size),
    bold: raw["bold"] === true,
    color: str(raw["color"], DEFAULT_LABELS.color),
    haloColor: str(raw["haloColor"], DEFAULT_LABELS.haloColor),
    haloWidth: num(raw["haloWidth"], DEFAULT_LABELS.haloWidth),
    placement: pick(raw["placement"], LABEL_PLACEMENTS, DEFAULT_LABELS.placement),
    offset: num(raw["offset"], DEFAULT_LABELS.offset),
    linePlacement: pick(raw["linePlacement"], LINE_PLACEMENTS, DEFAULT_LABELS.linePlacement),
    allowOverlap: raw["allowOverlap"] === true,
    minZoom: num(raw["minZoom"], DEFAULT_LABELS.minZoom),
    maxZoom: num(raw["maxZoom"], DEFAULT_LABELS.maxZoom),
    uppercase: raw["uppercase"] === true,
    maxWidth: num(raw["maxWidth"], DEFAULT_LABELS.maxWidth),
  };
}

function parsePopup(value: unknown): PopupSpec {
  if (!value || typeof value !== "object") return DEFAULT_POPUP;
  const raw = value as Record<string, unknown>;
  const fields = Array.isArray(raw["fields"])
    ? (raw["fields"] as unknown[]).flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const f = item as Record<string, unknown>;
        if (typeof f["name"] !== "string" || !f["name"]) return [];
        return [
          {
            name: f["name"],
            alias: str(f["alias"], f["name"]),
            visible: f["visible"] !== false,
            format: pick(f["format"], POPUP_FORMATS, "text"),
          } satisfies PopupField,
        ];
      })
    : [];
  return {
    enabled: raw["enabled"] !== false,
    trigger: pick(raw["trigger"], POPUP_TRIGGERS, DEFAULT_POPUP.trigger),
    titleField: str(raw["titleField"], ""),
    titleText: str(raw["titleText"], ""),
    fields,
    hideEmpty: raw["hideEmpty"] !== false,
    density: pick(raw["density"], POPUP_DENSITIES, DEFAULT_POPUP.density),
    maxWidth: num(raw["maxWidth"], DEFAULT_POPUP.maxWidth),
  };
}

/** Merge a layer_styles row (columns + style_config jsonb) into a complete style. */
export function resolveLayerStyle(row?: StyleRow | null): LayerStyle {
  const config = (row?.style_config ?? {}) as Record<string, unknown>;
  const categories = parseCategories(config["categories"]);
  const graduated = parseGraduated(config["graduated"]);
  const saved = pick(row?.style_mode, STYLE_MODES, DEFAULT_LAYER_STYLE.mode);
  const mode: StyleMode =
    saved === "categorized" && !categories
      ? "single"
      : saved === "graduated" && !graduated
        ? "single"
        : saved;
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
    mode,
    categories,
    graduated,
    labels: parseLabels(config["labels"]),
    popup: parsePopup(config["popup"]),
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
      graduated: style.graduated,
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

/** Graduated styling is only live when a field and at least one class exist. */
export function activeGraduated(style: LayerStyle): GraduatedSpec | null {
  if (style.mode !== "graduated") return null;
  const spec = style.graduated;
  if (!spec || !spec.field || !spec.classes.length) return null;
  return spec;
}

/** Sentinel returned by to-number when a value cannot be read as numeric. */
const NON_NUMERIC = -1.7976931348623157e307;

function numericValue(field: string): unknown[] {
  return ["to-number", ["get", field], NON_NUMERIC];
}

function matchExpression(spec: CategorySpec): unknown[] {
  const match: unknown[] = ["match", ["to-string", ["get", spec.field]]];
  for (const entry of spec.entries) {
    match.push(entry.value, paintColor(entry.color));
  }
  match.push(paintColor(spec.otherColor));
  return match;
}

function stepExpression(spec: GraduatedSpec, values: (number | string)[]): unknown[] {
  const value = numericValue(spec.field);
  const step: unknown[] = ["step", value, values[0]];
  for (let i = 1; i < spec.classes.length; i += 1) {
    step.push(spec.classes[i]!.min, values[i]);
  }
  return step;
}

function graduatedColorExpression(spec: GraduatedSpec): unknown[] {
  const colors = spec.classes.map((c) => paintColor(c.color));
  return [
    "case",
    ["==", numericValue(spec.field), NON_NUMERIC],
    paintColor(spec.otherColor),
    stepExpression(spec, colors),
  ];
}

/** MapLibre color for the layer's primary paint (fill / circle / line). */
export function primaryColorPaint(style: LayerStyle): string | unknown[] {
  const cat = activeCategories(style);
  if (cat) return cat.target === "stroke" ? paintColor(style.fillColor) : matchExpression(cat);
  const grad = activeGraduated(style);
  if (grad)
    return grad.target === "stroke" ? paintColor(style.fillColor) : graduatedColorExpression(grad);
  return paintColor(style.fillColor);
}

/** MapLibre color for the layer's stroke / outline paint. */
export function strokeColorPaint(style: LayerStyle): string | unknown[] {
  const cat = activeCategories(style);
  if (cat) return cat.target === "fill" ? paintColor(style.strokeColor) : matchExpression(cat);
  const grad = activeGraduated(style);
  if (grad)
    return grad.target === "fill" ? paintColor(style.strokeColor) : graduatedColorExpression(grad);
  return paintColor(style.strokeColor);
}

/** MapLibre circle-radius, graduated by class when enabled. */
export function radiusPaint(style: LayerStyle): number | unknown[] {
  const grad = activeGraduated(style);
  if (!grad || !grad.sizeEnabled) return style.circleRadius;
  const count = grad.classes.length;
  const radii = grad.classes.map((_, index) =>
    count <= 1
      ? grad.maxRadius
      : grad.minRadius + ((grad.maxRadius - grad.minRadius) * index) / (count - 1),
  );
  return [
    "case",
    ["==", numericValue(grad.field), NON_NUMERIC],
    style.circleRadius,
    stepExpression(grad, radii),
  ];
}

/** True when data-driven colors drive that paint. */
export function categoryDrives(style: LayerStyle, part: "fill" | "stroke"): boolean {
  const spec = activeCategories(style) ?? activeGraduated(style);
  if (!spec) return false;
  return spec.target === "both" || spec.target === part;
}

/** True when the layer paints per feature (categories or graduated classes). */
export function isDataDriven(style: LayerStyle): boolean {
  return !!(activeCategories(style) ?? activeGraduated(style));
}

/** Filter hiding categories / classes the user switched off; null when nothing is hidden. */
export function categoryFilter(style: LayerStyle): unknown[] | null {
  const spec = activeCategories(style);
  if (spec) {
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

  const grad = activeGraduated(style);
  if (!grad) return null;
  const value = numericValue(grad.field);
  const clauses: unknown[] = [];
  grad.classes.forEach((cls, index) => {
    if (cls.visible) return;
    const last = index === grad.classes.length - 1;
    clauses.push([
      "!",
      ["all", [">=", value, cls.min], last ? ["<=", value, cls.max] : ["<", value, cls.max]],
    ]);
  });
  if (!grad.otherVisible) clauses.push(["!=", value, NON_NUMERIC]);
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
  const reversed = previous?.reversed ?? false;
  const colors = paletteColors(paletteId, reversed);
  const prior = new Map((previous?.entries ?? []).map((entry) => [entry.value, entry]));
  return {
    field,
    palette: paletteId,
    reversed,
    target: previous?.target ?? "both",
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
export function recolorCategories(
  spec: CategorySpec,
  paletteId: string,
  reversed = spec.reversed,
): CategorySpec {
  const colors = paletteColors(paletteId, reversed);
  return {
    ...spec,
    palette: paletteId,
    reversed,
    entries: spec.entries.map((entry, index) => ({
      ...entry,
      color: colors[index % colors.length]!,
    })),
  };
}

/** Build (or rebuild) graduated classes from the layer's numeric values. */
export function buildGraduated(
  field: string,
  values: number[],
  previous?: Partial<GraduatedSpec> | null,
): GraduatedSpec {
  const method = previous?.method ?? "quantile";
  const classCount = previous?.classCount ?? 5;
  const rampId = previous?.ramp ?? "viridis";
  const reversed = previous?.reversed ?? false;
  const ranges =
    method === "manual" && previous?.classes?.length
      ? previous.classes.map((c) => ({ min: c.min, max: c.max }))
      : computeBreaks(values, classCount, method);
  const colors = rampColors(rampId, Math.max(1, ranges.length), reversed);
  const priorVisible = previous?.classes ?? [];
  return {
    field,
    method,
    classCount,
    ramp: rampId,
    reversed,
    target: previous?.target ?? "both",
    otherColor: previous?.otherColor ?? "#999999",
    otherVisible: previous?.otherVisible ?? true,
    sizeEnabled: previous?.sizeEnabled ?? false,
    minRadius: previous?.minRadius ?? 4,
    maxRadius: previous?.maxRadius ?? 14,
    classes: ranges.map((range, index) => ({
      min: range.min,
      max: range.max,
      color: colors[index] ?? colors[colors.length - 1]!,
      visible: priorVisible[index]?.visible ?? true,
    })),
  };
}

/** Reapply a ramp across the classes, honoring the reverse toggle. */
export function recolorGraduated(
  spec: GraduatedSpec,
  rampId: string,
  reversed = spec.reversed,
): GraduatedSpec {
  const colors = rampColors(rampId, Math.max(1, spec.classes.length), reversed);
  return {
    ...spec,
    ramp: rampId,
    reversed,
    classes: spec.classes.map((cls, index) => ({
      ...cls,
      color: colors[index] ?? colors[colors.length - 1]!,
    })),
  };
}

export function classLabel(cls: GraduatedClass): string {
  return `${formatNumber(cls.min)} – ${formatNumber(cls.max)}`;
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
