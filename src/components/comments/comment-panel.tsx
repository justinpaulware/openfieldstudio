import { useState } from "react";
import { Eye, EyeOff, MapPin, MessageSquare, Pentagon, Plus, Spline, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { CommentComposer, type PendingPin } from "@/components/comments/comment-composer";
import { CommentCard } from "@/components/comments/comment-card";
import { MapCardHeader } from "@/components/map/map-card-header";
import type { CommentGeometry } from "@/components/map/map-canvas";
import { geometryLabel, type CategoryColors, type PublicComment } from "@/lib/comment-style";

export type CommentDrawMode = "point" | "line" | "area";

export { geometryLabel };
export type { PublicComment };

const MODES: { id: CommentDrawMode; label: string; icon: typeof MapPin }[] = [
  { id: "point", label: "Point", icon: MapPin },
  { id: "line", label: "Line", icon: Spline },
  { id: "area", label: "Area", icon: Pentagon },
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
  colors,
  onVote,
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
  colors: CategoryColors;
  onVote?: (commentId: string, vote: -1 | 0 | 1) => void;
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
                    "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 font-secondary text-xs",
                    mode === option.id ? "bg-black/10 font-semibold" : "opacity-70 hover:bg-black/5",
                  )}
                >
                  <option.icon className="h-3.5 w-3.5" aria-hidden />
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
          {comments.map((comment) => (
            <li key={comment.id}>
              <div
                role="button"
                tabIndex={0}
                onClick={() => onSelect(comment.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(comment.id);
                  }
                }}
                className={cn(
                  "w-full cursor-pointer border-b border-map-overlay-border px-3 py-2.5 text-left last:border-b-0 hover:bg-black/5",
                  selectedId === comment.id && "bg-black/5",
                )}
              >
                <CommentCard
                  comment={comment}
                  colors={colors}
                  onVote={onVote ? (vote) => onVote(comment.id, vote) : undefined}
                />
              </div>
            </li>
          ))}
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
