import { useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/brand-mark";


import type { LayerStyle, SimpleKind } from "@/lib/layer-style";
import {
  activeCategories,
  activeGraduated,
  classLabel,
  categoryDrives,
  dashArray,
  isTransparent,
  paintColor,
} from "@/lib/layer-style";

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
export function categoryRows(style: LayerStyle): { label: string; color: string }[] {
  const spec = activeCategories(style);
  if (spec) {
    const rows = spec.entries
      .filter((entry) => entry.visible)
      .map((entry) => ({ label: entry.value === "" ? "(blank)" : entry.value, color: entry.color }));
    if (spec.otherVisible) rows.push({ label: "Other", color: spec.otherColor });
    return rows;
  }
  const grad = activeGraduated(style);
  if (grad) {
    const rows = grad.classes
      .filter((cls) => cls.visible)
      .map((cls) => ({ label: classLabel(cls), color: cls.color }));
    if (grad.otherVisible) rows.push({ label: "No value", color: grad.otherColor });
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
}: {
  groups: LegendGroup[];
  className?: string;
  /** When provided, each entry gets an eye toggle on the right. */
  hidden?: Record<string, boolean>;
  onToggle?: (id: string) => void;
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
        "w-56 overflow-hidden rounded-lg border border-map-overlay-border bg-map-overlay text-map-overlay-foreground shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-black/5"
      >
        <span className="flex items-center gap-1.5">
          <List className="h-3.5 w-3.5" />
          Legend
        </span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
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
                          {rows.map((row, rowIndex) => (
                            <li key={`${row.label}-${rowIndex}`} className="flex items-center gap-2">
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
                            </li>
                          ))}
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

export function MapTitleCard({ title, className }: { title: string; className?: string }) {
  if (!title) return null;
  return (
    <div
      className={cn(
        "flex w-64 items-center gap-2.5 rounded-lg border border-map-overlay-border bg-map-overlay px-3.5 py-2.5 text-map-overlay-foreground shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <BrandMark className="h-5 w-5 text-primary" />
      <h2 className="truncate text-base font-semibold leading-tight">{title}</h2>
    </div>
  );
}

