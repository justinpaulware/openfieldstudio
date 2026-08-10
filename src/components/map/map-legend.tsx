import { useState } from "react";
import { ChevronDown, ChevronUp, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LayerStyle, SimpleKind } from "@/lib/layer-style";
import { dashArray, isTransparent, paintColor } from "@/lib/layer-style";

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

export function LegendSwatch({ kind, style }: { kind: SimpleKind; style: LayerStyle }) {
  const dash = dashArray(style.dashPattern);
  const dashProp = dash
    ? dash.map((n) => n * Math.max(1, style.strokeWidth)).join(" ")
    : undefined;
  const strokeWidth = Math.max(1, Math.min(style.strokeWidth, 3));
  const fill = isTransparent(style.fillColor) ? "none" : paintColor(style.fillColor);
  const stroke = isTransparent(style.strokeColor) ? "none" : paintColor(style.strokeColor);

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
}: {
  groups: LegendGroup[];
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const visible = groups.filter((group) => group.entries.length > 0);
  if (!visible.length) return null;

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
        <div className="max-h-56 space-y-2 overflow-y-auto border-t border-map-overlay-border px-3 py-2">
          {visible.map((group) => (
            <div key={group.id} style={{ marginLeft: group.depth * 8 }}>
              {group.name && (
                <p className="mb-1 font-secondary text-[10px] font-semibold uppercase tracking-wide opacity-60">
                  {group.name}
                </p>
              )}
              <ul className="space-y-1.5">
                {group.entries.map((entry) => (
                  <li key={entry.id} className="flex items-center gap-2">
                    <span className="flex">
                      <LegendSwatch kind={entry.kind} style={entry.style} />
                    </span>
                    <span className="truncate text-xs">{entry.name}</span>
                  </li>
                ))}
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
        "w-56 rounded-lg border border-map-overlay-border bg-map-overlay px-3 py-2 text-map-overlay-foreground shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      <h2 className="truncate text-sm font-semibold leading-tight">{title}</h2>
    </div>
  );
}
