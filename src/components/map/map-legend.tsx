import { useState } from "react";
import { ChevronDown, ChevronUp, List } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LayerStyle, SimpleKind } from "@/lib/layer-style";
import { dashArray } from "@/lib/layer-style";

export type LegendEntry = {
  id: string;
  name: string;
  kind: SimpleKind;
  opacity: number;
  style: LayerStyle;
};

export function LegendSwatch({ kind, style }: { kind: SimpleKind; style: LayerStyle }) {
  const dash = dashArray(style.dashPattern);
  const dashProp = dash
    ? dash.map((n) => n * Math.max(1, style.strokeWidth)).join(" ")
    : undefined;
  const strokeWidth = Math.max(1, Math.min(style.strokeWidth, 3));

  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" className="shrink-0">
      {kind === "point" &&
        (style.markerShape === "square" ? (
          <rect
            x="4"
            y="4"
            width="10"
            height="10"
            fill={style.fillColor}
            stroke={style.strokeColor}
            strokeWidth={strokeWidth}
          />
        ) : style.markerShape === "triangle" ? (
          <path
            d="M9 3.5 L15 14 L3 14 Z"
            fill={style.fillColor}
            stroke={style.strokeColor}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
          />
        ) : (
          <circle
            cx="9"
            cy="9"
            r="5"
            fill={style.markerShape === "ring" ? "none" : style.fillColor}
            stroke={style.strokeColor}
            strokeWidth={style.markerShape === "ring" ? Math.max(2, strokeWidth) : strokeWidth}
          />
        ))}
      {kind === "line" && (
        <path
          d="M2 13 L6.5 6 L11 11 L16 4.5"
          fill="none"
          stroke={style.fillColor}
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
          fill={style.fillColor}
          fillOpacity={style.fillOpacity}
          stroke={style.strokeColor}
          strokeWidth={strokeWidth}
          strokeDasharray={dashProp}
        />
      )}
    </svg>
  );
}

export function MapLegend({
  entries,
  className,
}: {
  entries: LegendEntry[];
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  if (!entries.length) return null;

  return (
    <div
      className={cn(
        "w-56 overflow-hidden rounded-lg border border-border bg-card/95 shadow-[var(--shadow-soft)] backdrop-blur",
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs font-semibold hover:bg-muted/60"
      >
        <span className="flex items-center gap-1.5">
          <List className="h-3.5 w-3.5" />
          Legend
        </span>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronUp className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <ul className="max-h-56 space-y-1.5 overflow-y-auto border-t border-border px-3 py-2">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2">
              <span style={{ opacity: entry.opacity }} className="flex">
                <LegendSwatch kind={entry.kind} style={entry.style} />
              </span>
              <span className="truncate text-xs">{entry.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
