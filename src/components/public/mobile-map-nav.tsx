import type { ReactNode } from "react";
import { Info, Layers, MessageSquare, Plus, SquareStack, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type MobileSheet = "about" | "legend" | "views" | "comments";

const LABELS: Record<MobileSheet, string> = {
  about: "About",
  legend: "Legend",
  views: "Views",
  comments: "Comments",
};

/**
 * Phone layout for published maps: the map stays full screen, cards live in
 * floating chips that open a bottom sheet. Comment drafting uses a short sheet
 * so the map stays tappable above it.
 */
export function MobileMapNav({
  title,
  search,
  sheet,
  onSheet,
  adding,
  onAddComment,
  commentCount,
  about,
  legend,
  views,
  comments,
}: {
  title: string;
  search: ReactNode;
  sheet: MobileSheet | null;
  onSheet: (sheet: MobileSheet | null) => void;
  adding: boolean;
  onAddComment: (() => void) | null;
  commentCount: number;
  about: ReactNode;
  legend: ReactNode;
  views: ReactNode;
  comments: ReactNode;
}) {
  const content: Record<MobileSheet, ReactNode> = { about, legend, views, comments };
  const chips = (
    [
      { id: "legend", icon: Layers, label: "Legend" },
      { id: "views", icon: SquareStack, label: "Views" },
      { id: "comments", icon: MessageSquare, label: `${commentCount}` },
    ] as const
  ).filter((chip) => content[chip.id]);

  const chip =
    "pointer-events-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-map-overlay-border bg-map-overlay px-3 font-secondary text-xs font-semibold text-map-overlay-foreground shadow-[var(--shadow-lift)]";

  return (
    <>
      {!adding && (
        <div className="pointer-events-none absolute inset-x-2.5 top-2.5 z-10 flex flex-col gap-2">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
            <button
              type="button"
              onClick={() => about && onSheet("about")}
              className={cn(chip, "min-w-0 justify-start")}
            >
              <span className="truncate">{title}</span>
              {about && <Info className="h-3.5 w-3.5 shrink-0 opacity-60" />}
            </button>
          </div>
          {search && <div className="pointer-events-auto [&>*]:!w-full [&_.w-\[17rem\]]:!w-full [&_.w-\[17rem\]]:!max-w-none [&_.min-w-\[17rem\]]:!w-full [&_.min-w-\[17rem\]]:!max-w-none">{search}</div>}
        </div>
      )}

      {!adding && !sheet && (
        <div className="pointer-events-none absolute bottom-8 left-2.5 right-14 z-10 flex items-center gap-2 overflow-x-auto pb-1">
          {chips.map((item) => (
            <button key={item.id} type="button" onClick={() => onSheet(item.id)} className={chip}>
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
          {onAddComment && (
            <button
              type="button"
              onClick={() => {
                onAddComment();
              }}
              className={cn(chip, "ml-auto", "border-transparent bg-map-overlay-foreground text-map-overlay")}
            >
              <Plus className="h-3.5 w-3.5" />
              Comment
            </button>
          )}
        </div>
      )}

      {(sheet || adding) && (
        <>
          {!adding && (
            <button
              type="button"
              aria-label="Close"
              onClick={() => onSheet(null)}
              className="absolute inset-0 z-20 bg-foreground/20"
            />
          )}
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 z-30 flex flex-col rounded-t-2xl border-t border-map-overlay-border bg-map-overlay text-map-overlay-foreground shadow-[var(--shadow-lift)]",
              adding ? "max-h-[48%]" : "max-h-[70%]",
            )}
          >
            <div className="flex items-center justify-between px-4 pb-1 pt-2">
              <span className="mx-auto h-1 w-10 rounded-full bg-map-overlay-foreground/20" />
            </div>
            {!adding && sheet && (
              <div className="flex items-center justify-between px-4 pb-2">
                <span className="text-sm font-semibold">{LABELS[sheet]}</span>
                <button
                  type="button"
                  onClick={() => onSheet(null)}
                  aria-label="Close"
                  className="rounded-full p-1.5 hover:bg-black/5"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 [&>*]:!w-full [&_.w-\[17rem\]]:!w-full [&_.w-\[17rem\]]:!max-w-none [&_.min-w-\[17rem\]]:!w-full [&_.min-w-\[17rem\]]:!max-w-none [&_.max-h-\[40vh\]]:max-h-none">
              {adding ? comments : sheet ? content[sheet] : null}
            </div>
          </div>
        </>
      )}
    </>
  );
}
