import { useState } from "react";
import { Layers } from "lucide-react";

import { cn } from "@/lib/utils";
import { MapCardHeader } from "@/components/map/map-card-header";

export type SwitcherView = { id: string; name: string; slug: string; is_main: boolean };

/**
 * "Map Views" card on the published map. Lists the project's published views and
 * switches between them without reloading the map.
 */
export function ViewSwitcherCard({
  views,
  activeSlug,
  onSelect,
  className,
}: {
  views: SwitcherView[];
  /** Slug of the active view (main view included). */
  activeSlug: string | null;
  onSelect: (view: SwitcherView) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  if (views.length < 2) return null;
  const active = views.find((view) => view.slug === activeSlug) ?? views[0]!;

  return (
    <div
      className={cn(
        "w-56 max-w-[min(50vw,26rem)] overflow-hidden rounded-lg border border-map-overlay-border bg-map-overlay text-map-overlay-foreground shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      <MapCardHeader
        icon={Layers}
        title="Map views"
        subtitle={open ? undefined : active.name}
        open={open}
        onToggle={() => setOpen((value) => !value)}
      />
      {open && (
        <ul className="space-y-0.5 border-t border-map-overlay-border px-3 py-2">
          {views.map((view) => {
            const isActive = view.slug === active.slug;
            return (
              <li key={view.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (!isActive) onSelect(view);
                  }}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors",
                    isActive
                      ? "bg-primary/15 font-semibold text-map-overlay-foreground"
                      : "text-map-overlay-foreground/80 hover:bg-map-overlay-foreground/10",
                  )}
                >
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full border",
                      isActive ? "border-primary bg-primary" : "border-current opacity-50",
                    )}
                  />
                  <span className="truncate">{view.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
