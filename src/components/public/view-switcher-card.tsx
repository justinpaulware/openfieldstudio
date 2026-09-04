import { useState } from "react";
import { ChevronDown, Layers } from "lucide-react";

import { cn } from "@/lib/utils";

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
  const [open, setOpen] = useState(false);
  if (views.length < 2) return null;
  const active = views.find((view) => view.slug === activeSlug) ?? views[0]!;

  const list = (
    <ul className="mt-2 space-y-0.5">
      {views.map((view) => {
        const isActive = view.slug === active.slug;
        return (
          <li key={view.id}>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
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
  );

  return (
    <div
      className={cn(
        "w-fit min-w-56 max-w-[min(50vw,26rem)] rounded-lg border border-map-overlay-border bg-map-overlay p-3 text-map-overlay-foreground shadow-[var(--shadow-lift)]",
        className,
      )}
    >
      {/* Mobile: collapsed row that expands to the same list. */}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 text-left sm:hidden"
        aria-expanded={open}
      >
        <Layers className="h-3.5 w-3.5 opacity-70" />
        <span className="flex-1 truncate text-xs font-semibold">{active.name}</span>
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      <div className={cn("sm:block", open ? "block" : "hidden")}>
        <p className="hidden font-secondary text-[10px] font-semibold uppercase tracking-wide opacity-60 sm:block">
          Map views
        </p>
        {list}
      </div>
    </div>
  );
}
