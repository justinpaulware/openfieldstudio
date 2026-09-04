import { useState } from "react";
import { Eye, EyeOff, MessageSquare, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { CommentComposer, type PendingPin } from "@/components/comments/comment-composer";
import { MapCardHeader } from "@/components/map/map-card-header";
import type { CommentGeometry } from "@/components/map/map-canvas";

export type CommentDrawMode = "point" | "line" | "area";

export type PublicComment = {
  id: string;
  lng: number;
  lat: number;
  body: string;
  category: string | null;
  author_name: string | null;
  created_at: string;
  geometry_type?: string | null;
};

function relativeTime(iso: string) {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** "Line" / "Area" chip; pins get no chip because they are the default. */
export function geometryLabel(type?: string | null) {
  if (type === "LineString") return "Line";
  if (type === "Polygon") return "Area";
  return null;
}

const MODES: { id: CommentDrawMode; label: string }[] = [
  { id: "point", label: "Point" },
  { id: "line", label: "Line" },
  { id: "area", label: "Area" },
];

export function CommentPanel({
  username,
  slug,
  comments,
  categories,
  visible,
  onToggleVisible,
  adding,
  onToggleAdding,
  pin,
  geometry,
  allowShapes = false,
  mode = "point",
  onModeChange,
  vertexCount = 0,
  onUndo,
  selectedId,
  onSelect,
  onSubmitted,
}: {
  username: string;
  slug: string;
  comments: PublicComment[];
  categories: string[];
  visible: boolean;
  onToggleVisible: () => void;
  adding: boolean;
  onToggleAdding: () => void;
  pin: PendingPin | null;
  geometry?: CommentGeometry | null;
  allowShapes?: boolean;
  mode?: CommentDrawMode;
  onModeChange?: (mode: CommentDrawMode) => void;
  vertexCount?: number;
  onUndo?: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSubmitted: () => void;
}) {
  const ready = mode === "point" ? Boolean(pin) : Boolean(geometry);
  const hint =
    mode === "point"
      ? "Click the map where your comment belongs."
      : mode === "line"
        ? "Click along the map to draw a line. Two points or more."
        : "Click around the area you mean. Three points or more.";

  const [open, setOpen] = useState(true);
  // Keep the body visible while composing so the form never hides mid-flow.
  const bodyOpen = open || adding;

  return (
    <div className="pointer-events-auto w-full overflow-hidden rounded-lg border border-map-overlay-border bg-map-overlay text-map-overlay-foreground shadow-[var(--shadow-soft)]">
      <MapCardHeader
        icon={MessageSquare}
        title="Comments"
        subtitle={comments.length}
        open={bodyOpen}
        onToggle={() => setOpen((value) => !value)}
        actions={
          <>
            <button
              type="button"
              onClick={onToggleVisible}
              aria-label={visible ? "Hide comments on map" : "Show comments on map"}
              title={visible ? "Hide comments on map" : "Show comments on map"}
              className="rounded p-0.5 opacity-70 hover:bg-black/5 hover:opacity-100"
            >
              {visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
            <button
              type="button"
              onClick={onToggleAdding}
              aria-label={adding ? "Cancel new comment" : "Add a comment"}
              title={adding ? "Cancel new comment" : "Add a comment"}
              className={cn(
                "rounded p-0.5 opacity-70 hover:bg-black/5 hover:opacity-100",
                adding && "opacity-100",
              )}
            >
              {adding ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            </button>
          </>
        }
      />

      {bodyOpen && adding && (
        <div className="space-y-3 border-t border-map-overlay-border p-3">
          {allowShapes && (
            <div className="flex items-center gap-1 rounded-md border border-map-overlay-border p-0.5">
              {MODES.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => onModeChange?.(option.id)}
                  className={cn(
                    "flex-1 rounded px-2 py-1 font-secondary text-xs",
                    mode === option.id ? "bg-black/10 font-semibold" : "opacity-70 hover:bg-black/5",
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}

          {ready ? (
            <CommentComposer
              inline
              username={username}
              slug={slug}
              pin={pin!}
              geometry={geometry ?? null}
              categories={categories}
              onClose={onToggleAdding}
              onSubmitted={onSubmitted}
            />
          ) : (
            <div className="space-y-2">
              <p className="font-secondary text-xs opacity-70">{hint}</p>
              {mode !== "point" && vertexCount > 0 && (
                <div className="flex items-center gap-2">
                  <span className="font-secondary text-xs opacity-60">
                    {vertexCount} point{vertexCount === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={onUndo}
                    className="rounded px-1.5 py-0.5 font-secondary text-xs opacity-70 hover:bg-black/5 hover:opacity-100"
                  >
                    Undo last point
                  </button>
                </div>
              )}
            </div>
          )}

          {ready && mode !== "point" && (
            <button
              type="button"
              onClick={onUndo}
              className="font-secondary text-xs opacity-70 hover:opacity-100"
            >
              Undo last point
            </button>
          )}
        </div>
      )}

      {bodyOpen && comments.length > 0 && (
        <ul className="max-h-[40vh] overflow-y-auto border-t border-map-overlay-border">
          {comments.map((comment) => {
            const shape = geometryLabel(comment.geometry_type);
            return (
              <li key={comment.id}>
                <button
                  type="button"
                  onClick={() => onSelect(comment.id)}
                  className={cn(
                    "w-full border-b border-map-overlay-border px-3 py-2.5 text-left last:border-b-0 hover:bg-black/5",
                    selectedId === comment.id && "bg-black/5",
                  )}
                >
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-xs font-semibold">
                      {comment.author_name || "Anonymous"}
                    </span>
                    <span className="ml-auto shrink-0 font-secondary text-[11px] opacity-60">
                      {relativeTime(comment.created_at)}
                    </span>
                  </div>
                  {(comment.category || shape) && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {comment.category && (
                        <span className="inline-block rounded-full bg-black/10 px-1.5 py-0.5 font-secondary text-[10px]">
                          {comment.category}
                        </span>
                      )}
                      {shape && (
                        <span className="inline-block rounded-full border border-map-overlay-border px-1.5 py-0.5 font-secondary text-[10px] opacity-70">
                          {shape}
                        </span>
                      )}
                    </div>
                  )}
                  <p className="mt-1 font-secondary text-xs leading-snug opacity-90">
                    {comment.body}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {bodyOpen && comments.length === 0 && !adding && (
        <p className="border-t border-map-overlay-border p-3 font-secondary text-xs opacity-70">
          No comments yet. Use + to add the first one.
        </p>
      )}
    </div>
  );
}
