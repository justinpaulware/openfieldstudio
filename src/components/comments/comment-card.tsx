import { useEffect, useState } from "react";
import { MapPin, Pentagon, Spline, ThumbsDown, ThumbsUp, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { colorFor, initialsFor, relativeTime, type CategoryColors } from "@/lib/comment-style";
import { geometryLabel } from "@/components/comments/comment-panel";
import type { PublicComment } from "@/components/comments/comment-panel";

/**
 * One comment rendered as an Atlas-style card: avatar, author, time, a
 * category chip tinted with the category color, the body, and reactions.
 * Used both inside the comments drawer and in the popup anchored on the map.
 */
export function CommentCard({
  comment,
  colors,
  onVote,
  onClose,
  className,
}: {
  comment: PublicComment;
  colors: CategoryColors;
  onVote?: ((vote: -1 | 0 | 1) => void) | undefined;
  onClose?: () => void;
  className?: string;
}) {
  const color = colorFor(colors, comment.category);
  const shape = geometryLabel(comment.geometry_type);

  // Votes render from local state first so the thumbs respond on the same frame
  // as the click; the server result simply confirms what is already on screen.
  const serverVote = (comment.myVote ?? 0) as -1 | 0 | 1;
  const [local, setLocal] = useState<{ vote: -1 | 0 | 1; up: number; down: number }>({
    vote: serverVote,
    up: comment.upvotes ?? 0,
    down: comment.downvotes ?? 0,
  });
  useEffect(() => {
    setLocal({
      vote: serverVote,
      up: comment.upvotes ?? 0,
      down: comment.downvotes ?? 0,
    });
  }, [comment.id, serverVote, comment.upvotes, comment.downvotes]);

  const mine = local.vote;
  const cast = (next: -1 | 0 | 1) => {
    setLocal((current) => {
      const up = current.up - (current.vote === 1 ? 1 : 0) + (next === 1 ? 1 : 0);
      const down = current.down - (current.vote === -1 ? 1 : 0) + (next === -1 ? 1 : 0);
      return { vote: next, up: Math.max(0, up), down: Math.max(0, down) };
    });
    onVote?.(next);
  };


  return (
    <div className={cn("space-y-2 text-map-overlay-foreground", className)}>
      <div className="flex items-start gap-2">
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
          style={{ background: color }}
        >
          {initialsFor(comment.author_name)}
        </span>
        <div className="min-w-0 flex-1">
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
                <span
                  className="inline-block rounded-full px-1.5 py-0.5 font-secondary text-[10px] font-medium"
                  style={{ background: `${color}22`, color }}
                >
                  {comment.category}
                </span>
              )}
              {shape && (
                <span className="inline-flex items-center gap-1 rounded-full border border-map-overlay-border px-1.5 py-0.5 font-secondary text-[10px] opacity-70">
                  <ShapeIcon type={comment.geometry_type} />
                  {shape}
                </span>
              )}
            </div>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comment"
            className="rounded p-0.5 opacity-60 hover:bg-black/5 hover:opacity-100"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <p className="font-secondary text-xs leading-snug opacity-90">{comment.body}</p>

      {onVote && (
        <div className="flex items-center gap-1">
          <VoteButton
            icon={ThumbsUp}
            label="Upvote"
            count={local.up}
            active={mine === 1}
            onClick={() => cast(mine === 1 ? 0 : 1)}
          />
          <VoteButton
            icon={ThumbsDown}
            label="Downvote"
            count={local.down}
            active={mine === -1}
            onClick={() => cast(mine === -1 ? 0 : -1)}
          />
        </div>
      )}
    </div>
  );
}

function VoteButton({
  icon: Icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: typeof ThumbsUp;
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-1 font-secondary text-[11px] transition-colors",
        active ? "bg-black/10 font-semibold" : "opacity-70 hover:bg-black/5 hover:opacity-100",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {count > 0 ? count : null}
    </button>
  );
}

/** Small glyph matching the comment's geometry: pin, line or area. */
export function ShapeIcon({ type }: { type?: string | null | undefined }) {
  const Icon = type === "LineString" || type === "MultiLineString" ? Spline
    : type === "Polygon" || type === "MultiPolygon" ? Pentagon
    : MapPin;
  return <Icon className="h-3 w-3" aria-hidden />;
}
