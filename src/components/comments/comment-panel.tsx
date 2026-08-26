import { Eye, EyeOff, MessageSquare, Plus, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { CommentComposer, type PendingPin } from "@/components/comments/comment-composer";

export type PublicComment = {
  id: string;
  lng: number;
  lat: number;
  body: string;
  category: string | null;
  author_name: string | null;
  created_at: string;
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
  selectedId: string | null;
  onSelect: (id: string) => void;
  onSubmitted: () => void;
}) {
  return (
    <div className="pointer-events-auto w-full overflow-hidden rounded-lg border border-map-overlay-border bg-map-overlay text-map-overlay-foreground shadow-[var(--shadow-lift)]">
      <div className="flex items-center gap-1.5 p-3">
        <MessageSquare className="h-4 w-4 opacity-70" />
        <h3 className="text-sm font-semibold">Comments</h3>
        <span className="font-secondary text-xs opacity-60">{comments.length}</span>
        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={onToggleVisible}
            aria-label={visible ? "Hide comments on map" : "Show comments on map"}
            title={visible ? "Hide comments on map" : "Show comments on map"}
            className="rounded p-1 opacity-70 hover:bg-black/5 hover:opacity-100"
          >
            {visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={onToggleAdding}
            aria-label={adding ? "Cancel new comment" : "Add a comment"}
            title={adding ? "Cancel new comment" : "Add a comment"}
            className={cn(
              "rounded p-1 opacity-70 hover:bg-black/5 hover:opacity-100",
              adding && "opacity-100",
            )}
          >
            {adding ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {adding && (
        <div className="border-t border-map-overlay-border px-3 py-2.5">
          {pin ? (
            <CommentComposer
              inline
              username={username}
              slug={slug}
              pin={pin}
              categories={categories}
              onClose={onToggleAdding}
              onSubmitted={onSubmitted}
            />
          ) : (
            <p className="font-secondary text-xs opacity-70">
              Click the map where your comment belongs.
            </p>
          )}
        </div>
      )}

      {comments.length > 0 && (
        <ul className="max-h-[40vh] overflow-y-auto border-t border-map-overlay-border">
          {comments.map((comment) => (
            <li key={comment.id}>
              <button
                type="button"
                onClick={() => onSelect(comment.id)}
                className={cn(
                  "w-full border-b border-map-overlay-border px-3 py-2 text-left last:border-b-0 hover:bg-black/5",
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
                {comment.category && (
                  <span className="mt-1 inline-block rounded-full bg-black/10 px-1.5 py-0.5 font-secondary text-[10px]">
                    {comment.category}
                  </span>
                )}
                <p className="mt-1 font-secondary text-xs leading-snug opacity-90">
                  {comment.body}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {comments.length === 0 && !adding && (
        <p className="border-t border-map-overlay-border px-3 py-2.5 font-secondary text-xs opacity-70">
          No comments yet. Use + to add the first one.
        </p>
      )}
    </div>
  );
}
