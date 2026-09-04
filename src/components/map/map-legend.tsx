import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";


import type { HeatmapSpec, LayerStyle, ProportionalSpec, SimpleKind } from "@/lib/layer-style";
import {
  HEATMAP_RAMPS,
  activeCategories,
  activeGraduated,
  activeHeatmap,
  activeMask,
  activeProportional,
  classLabel,
  categoryDrives,
  dashArray,
  isTransparent,
  paintColor,
  proportionalRadius,
} from "@/lib/layer-style";

const compact = (n: number) =>
  Math.abs(n) >= 1000 ? n.toLocaleString(undefined, { maximumFractionDigits: 0 }) : `${+n.toFixed(2)}`;

/** Nested circles sized from the layer's data range. */
export function ProportionalLegend({
  spec,
  style,
}: {
  spec: ProportionalSpec;
  style: LayerStyle;
}) {
  const mid = (spec.dataMin + spec.dataMax) / 2;
  const stops = [spec.dataMax, mid, spec.dataMin];
  const max = Math.max(spec.minSize, spec.maxSize);
  const box = max * 2 + 4;
  const fill = isTransparent(style.fillColor) ? "none" : paintColor(style.fillColor);
  const stroke = isTransparent(style.strokeColor) ? "none" : paintColor(style.strokeColor);
  return (
    <div className="flex items-end gap-2">
      <svg width={box} height={box} viewBox={`0 0 ${box} ${box}`} aria-hidden="true">
        {stops.map((value, index) => {
          const r = proportionalRadius(spec, value);
          return (
            <circle
              key={index}
              cx={box / 2}
              cy={box - 2 - r}
              r={r}
              fill={fill}
              fillOpacity={style.fillOpacity * 0.5}
              stroke={stroke}
              strokeOpacity={style.strokeOpacity}
              strokeWidth={1}
            />
          );
        })}
      </svg>
      <ul className="space-y-0.5 text-[11px]">
        {stops.map((value, index) => (
          <li key={index}>{compact(value)}</li>
        ))}
      </ul>
    </div>
  );
}

/** Gradient bar for a heatmap layer. */
export function HeatmapLegend({ spec }: { spec: HeatmapSpec }) {
  const colors = HEATMAP_RAMPS[spec.ramp] ?? HEATMAP_RAMPS["magma"]!;
  return (
    <div className="space-y-1">
      <div
        className="h-2.5 w-full rounded-sm"
        style={{ background: `linear-gradient(to right, ${colors.join(", ")})` }}
      />
      <div className="flex justify-between text-[10px] opacity-70">
        <span>Low</span>
        <span>{spec.weightField ? spec.weightField : "Density"}</span>
        <span>High</span>
      </div>
    </div>
  );
}

export type LegendEntry = {
  id: string;
  name: string;
  kind: SimpleKind;
  opacity: number;
  style: LayerStyle;
};

export type LegendGroup = {
  id: string;
  /** Folder name, or null for layers that sit outside every folder. */
  name: string | null;
  depth: number;
  entries: LegendEntry[];
};

/** Category rows for a categorized layer: value label + color. */
export function categoryRows(style: LayerStyle): { label: string; color: string; key: string }[] {
  const spec = activeCategories(style);
  if (spec) {
    const rows = spec.entries
      .filter((entry) => entry.visible)
      .map((entry) => ({
        label: entry.value === "" ? "(blank)" : entry.value,
        color: entry.color,
        key: `cat:${entry.value}`,
      }));
    if (spec.otherVisible) rows.push({ label: "Other", color: spec.otherColor, key: "other" });
    return rows;
  }
  const grad = activeGraduated(style);
  if (grad) {
    const rows = grad.classes
      .map((cls, index) => ({ cls, index }))
      .filter(({ cls }) => cls.visible)
      .map(({ cls, index }) => ({
        label: classLabel(cls),
        color: cls.color,
        key: `cls:${index}`,
      }));
    if (grad.otherVisible) rows.push({ label: "No value", color: grad.otherColor, key: "other" });
    return rows;
  }
  return [];
}

/** Small multi-color chip standing in for a categorized layer. */
export function CategoryChip({ colors }: { colors: string[] }) {
  const shown = colors.slice(0, 4);
  return (
    <span
      className="flex h-[14px] w-[18px] shrink-0 overflow-hidden rounded-[3px] border border-border/80"
      aria-hidden="true"
    >
      {shown.length ? (
        shown.map((color, index) => (
          <span key={`${color}-${index}`} className="flex-1" style={{ backgroundColor: color }} />
        ))
      ) : (
        <span className="flex-1 bg-muted" />
      )}
    </span>
  );
}

export function LegendSwatch({
  kind,
  style,
  colorOverride,
  strokeOverride,
}: {
  kind: SimpleKind;
  style: LayerStyle;
  colorOverride?: string;
  strokeOverride?: string;
}) {
  const prop = activeProportional(style);
  if (prop) {
    const fill = isTransparent(style.fillColor) ? "none" : paintColor(style.fillColor);
    const stroke = isTransparent(style.strokeColor) ? "none" : paintColor(style.strokeColor);
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
        <circle cx="11.5" cy="11.5" r="5" fill={fill} fillOpacity={style.fillOpacity} stroke={stroke} strokeWidth="1" />
        <circle cx="7" cy="7" r="2.5" fill={fill} fillOpacity={style.fillOpacity} stroke={stroke} strokeWidth="1" />
      </svg>
    );
  }
  const heat = activeHeatmap(style);
  if (heat) {
    const colors = HEATMAP_RAMPS[heat.ramp] ?? HEATMAP_RAMPS["magma"]!;
    return (
      <span
        className="h-3.5 w-4 shrink-0 rounded-[3px] border border-border/80"
        style={{ background: `linear-gradient(to right, ${colors.join(", ")})` }}
        aria-hidden="true"
      />
    );
  }
  const mask = activeMask(style);
  if (mask) {
    const maskFill = isTransparent(mask.color) ? "none" : paintColor(mask.color);
    const boundary = isTransparent(mask.boundaryColor) ? "none" : paintColor(mask.boundaryColor);
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
        {/* Mask surrounding a clear "window" — the visible study area. */}
        <path
          d="M1.5 2.5 H16.5 V15.5 H1.5 Z M5.5 6 H12.5 V12 H5.5 Z"
          fill={maskFill}
          fillOpacity={mask.opacity}
          fillRule="evenodd"
        />
        <rect
          x="5.5"
          y="6"
          width="7"
          height="6"
          fill="none"
          stroke={boundary}
          strokeWidth={Math.max(1, Math.min(mask.boundaryWidth, 2))}
        />
      </svg>
    );
  }


  const dash = dashArray(style.dashPattern);
  const dashProp = dash
    ? dash.map((n) => n * Math.max(1, style.strokeWidth)).join(" ")
    : undefined;
  const strokeWidth = Math.max(1, Math.min(style.strokeWidth, 3));
  const baseColor = colorOverride ?? style.fillColor;
  const fill = isTransparent(baseColor) ? "none" : paintColor(baseColor);
  const strokeBase = strokeOverride ?? style.strokeColor;
  const stroke = isTransparent(strokeBase) ? "none" : paintColor(strokeBase);


  // Nothing to paint: show the same "no color" mark the palette uses.
  if (fill === "none" && (kind === "line" || stroke === "none")) {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
        <rect x="2.5" y="2.5" width="13" height="13" rx="2" fill="#ffffff" stroke="#c9cdd4" />
        <line x1="4" y1="14" x2="14" y2="4" stroke="#e0533d" strokeWidth="1.25" />
      </svg>
    );
  }

  return (

    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      {kind === "point" &&
        (style.markerShape === "square" ? (
          <rect
            x="4"
            y="4"
            width="10"
            height="10"
            fill={fill}
            fillOpacity={style.fillOpacity}
            stroke={stroke}
            strokeOpacity={style.strokeOpacity}
            strokeWidth={strokeWidth}
          />
        ) : style.markerShape === "triangle" ? (
          <path
            d="M9 3.5 L15 14 L3 14 Z"
            fill={fill}
            fillOpacity={style.fillOpacity}
            stroke={stroke}
            strokeOpacity={style.strokeOpacity}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        ) : (
          <circle
            cx="9"
            cy="9"
            r="5"
            fill={style.markerShape === "ring" ? "none" : fill}
            fillOpacity={style.fillOpacity}
            stroke={style.markerShape === "ring" ? fill : stroke}
            strokeOpacity={style.strokeOpacity}
            strokeWidth={style.markerShape === "ring" ? Math.max(2, strokeWidth) : strokeWidth}
          />
        ))}
      {kind === "line" && (
        <path
          d="M2 13 L6.5 6 L11 11 L16 4.5"
          fill="none"
          stroke={fill}
          strokeOpacity={style.strokeOpacity}
          strokeWidth={Math.max(1.5, strokeWidth)}
          strokeDasharray={dashProp}
          strokeLinecap={style.lineCap === "butt" ? "butt" : style.lineCap}
          strokeLinejoin="round"
        />
      )}
      {kind === "polygon" && (
        <rect
          x="2.5"
          y="4"
          width="13"
          height="10"
          rx="2"
          fill={fill}
          fillOpacity={style.fillOpacity}
          stroke={stroke}
          strokeOpacity={style.strokeOpacity}
          strokeWidth={strokeWidth}
          strokeDasharray={dashProp}
        />
      )}
    </svg>
  );
}

export function MapLegend({
  groups,
  className,
  hidden,
  onToggle,
  categoryHidden,
  onToggleCategory,
}: {
  groups: LegendGroup[];
  className?: string;
  /** When provided, each entry gets an eye toggle on the right. */
  hidden?: Record<string, boolean>;
  onToggle?: (id: string) => void;
  /** layerId -> { categoryKey: true } for viewer-local category filtering. */
  categoryHidden?: Record<string, Record<string, boolean>>;
  onToggleCategory?: (layerId: string, key: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const visible = groups.filter((group) => group.entries.length > 0);
  if (!visible.length) return null;

  const EyeToggle = ({ id, name }: { id: string; name: string }) =>
    onToggle ? (
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-label={hidden?.[id] ? `Show ${name}` : `Hide ${name}`}
        className="ml-auto shrink-0 rounded p-0.5 opacity-70 hover:bg-black/5 hover:opacity-100"
      >
        {hidden?.[id] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
    ) : null;

  return (
    <div
      className={cn(
        "w-56 overflow-hidden rounded-lg border border-map-overlay-border bg-map-overlay text-map-overlay-foreground shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <MapCardHeader
        icon={List}
        title="Legend"
        open={open}
        onToggle={() => setOpen((value) => !value)}
      />
      {open && (
        <div className="max-h-[60vh] space-y-2 overflow-y-auto border-t border-map-overlay-border px-3 py-2">
          {visible.map((group) => (
            <div key={group.id} style={{ marginLeft: group.depth * 8 }}>
              {group.name && (
                <p className="mb-1 font-secondary text-[10px] font-semibold uppercase tracking-wide opacity-60">
                  {group.name}
                </p>
              )}
              <ul className="space-y-1.5">
                {group.entries.map((entry) => {
                  const rows = categoryRows(entry.style);
                  const dim = hidden?.[entry.id] ? "opacity-45" : "";
                  const prop = activeProportional(entry.style);
                  const heat = activeHeatmap(entry.style);
                  if (prop) {
                    return (
                      <li key={entry.id} className={cn("space-y-1", dim)}>
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">
                            {entry.name}
                          </span>
                          <EyeToggle id={entry.id} name={entry.name} />
                        </div>
                        <div className="pl-1">
                          <ProportionalLegend spec={prop} style={entry.style} />
                        </div>
                      </li>
                    );
                  }
                  if (heat) {
                    return (
                      <li key={entry.id} className={cn("space-y-1", dim)}>
                        <div className="flex items-center gap-2">
                          <span className="min-w-0 flex-1 truncate text-xs font-medium">
                            {entry.name}
                          </span>
                          <EyeToggle id={entry.id} name={entry.name} />
                        </div>
                        <div className="pl-1">
                          <HeatmapLegend spec={heat} />
                        </div>
                      </li>
                    );
                  }
                  if (rows.length) {
                    return (
                      <li key={entry.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn("min-w-0 flex-1 truncate text-xs font-medium", dim)}
                          >
                            {entry.name}
                          </span>
                          <EyeToggle id={entry.id} name={entry.name} />
                        </div>


                        <ul className={cn("space-y-1 pl-1", dim)}>
                          {rows.map((row, rowIndex) => {
                            const catOff = categoryHidden?.[entry.id]?.[row.key] === true;
                            const swatch = (
                              <>
                                <span className="flex">
                                  <LegendSwatch
                                    kind={entry.kind}
                                    style={entry.style}
                                    {...(categoryDrives(entry.style, "fill")
                                      ? { colorOverride: row.color }
                                      : {})}
                                    {...(categoryDrives(entry.style, "stroke")
                                      ? { strokeOverride: row.color }
                                      : {})}
                                  />
                                </span>
                                <span className="truncate text-xs">{row.label}</span>
                              </>
                            );
                            return (
                              <li key={`${row.key}-${rowIndex}`}>
                                {onToggleCategory ? (
                                  <button
                                    type="button"
                                    onClick={() => onToggleCategory(entry.id, row.key)}
                                    aria-pressed={!catOff}
                                    title={catOff ? `Show ${row.label}` : `Hide ${row.label}`}
                                    className={cn(
                                      "flex w-full items-center gap-2 rounded px-0.5 py-px text-left hover:bg-black/5",
                                      catOff && "opacity-40",
                                    )}
                                  >
                                    <span
                                      aria-hidden="true"
                                      className={cn(
                                        "flex h-3 w-3 shrink-0 items-center justify-center rounded-[3px] border border-current/40",
                                        !catOff && "bg-current/10",
                                      )}
                                    >
                                      {!catOff && <Check className="h-2.5 w-2.5" />}
                                    </span>
                                    {swatch}
                                  </button>
                                ) : (
                                  <span className="flex items-center gap-2">{swatch}</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  }
                  return (
                    <li key={entry.id} className="flex items-center gap-2">
                      <span className={cn("flex min-w-0 flex-1 items-center gap-2", dim)}>
                        <LegendSwatch kind={entry.kind} style={entry.style} />
                        <span className="truncate text-xs">{entry.name}</span>
                      </span>
                      <EyeToggle id={entry.id} name={entry.name} />
                    </li>
                  );
                })}
              </ul>

            </div>
          ))}
        </div>
      )}

    </div>
  );
}

export function MapTitleCard({
  title,
  description,
  className,
}: {
  title: string;
  description?: string | null;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [clamped, setClamped] = useState(false);
  const textRef = useRef<HTMLParagraphElement | null>(null);
  const text = (description ?? "").trim();

  useEffect(() => {
    const node = textRef.current;
    if (!node || !text) {
      setClamped(false);
      return;
    }
    setClamped(node.scrollHeight - node.clientHeight > 2);
  }, [text, expanded]);

  if (!title) return null;
  return (
    <div
      className={cn(
        "w-fit min-w-56 max-w-[min(50vw,26rem)] rounded-lg border border-map-overlay-border bg-map-overlay p-3 text-map-overlay-foreground shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <div className="inline-flex w-full items-center gap-2.5">
        <BrandMark />
        <h2 className="truncate text-base font-semibold leading-tight">{title}</h2>
      </div>
      {text && (
        <div className="mt-1.5">
          <p
            ref={textRef}
            className={cn(
              "font-secondary text-xs leading-relaxed opacity-70",
              !expanded && "line-clamp-3",
            )}
          >
            {text}
          </p>
          {(clamped || expanded) && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-1 font-secondary text-[11px] font-semibold underline underline-offset-2 opacity-70 hover:opacity-100"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

