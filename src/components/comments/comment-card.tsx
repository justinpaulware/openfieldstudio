import { useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  MapPin,
  MessageSquare,
  Pentagon,
  Spline,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  categoryLabel,
  colorFor,
  initialsFor,
  relativeTime,
  TEAM_REPLY_LABEL,
  type CategoryColors,
} from "@/lib/comment-style";
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
  showSource = false,
  allowReplies = false,
  onReply,
  className,
}: {
  comment: PublicComment;
  colors: CategoryColors;
  onVote?: ((vote: -1 | 0 | 1) => void) | undefined;
  onClose?: () => void;
  /** Show where this feedback came from (webmap, workshop, …). */
  showSource?: boolean;
  /** Let visitors post a response under this comment. */
  allowReplies?: boolean;
  onReply?: (body: string, authorName: string | null) => void | Promise<unknown>;
  className?: string;
}) {
  const color = colorFor(colors, comment.category);
  const shape = geometryLabel(comment.geometry_type);
  const source = showSource ? (comment.source ?? "").trim() : "";
  const replies = comment.replies ?? [];

  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyName, setReplyName] = useState("");
  const [sending, setSending] = useState(false);
  useEffect(() => {
    setRepliesOpen(false);
    setReplyOpen(false);
    setReplyBody("");
  }, [comment.id]);


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
          <div className="mt-1 flex flex-wrap gap-1">
            <span
              className="inline-block rounded-full px-1.5 py-0.5 font-secondary text-[10px] font-medium"
              style={{ background: `${color}22`, color }}
            >
              {categoryLabel(comment.category)}
            </span>
            {shape && (
              <span className="inline-flex items-center gap-1 rounded-full border border-map-overlay-border px-1.5 py-0.5 font-secondary text-[10px] opacity-70">
                <ShapeIcon type={comment.geometry_type} />
                {shape}
              </span>
            )}
          </div>
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

      {source && (
        <div>
          <span className="inline-flex h-5 items-center rounded-full bg-map-overlay-foreground/10 px-2 font-secondary text-[10px] leading-none opacity-80">
            Source: {source}
          </span>
        </div>
      )}


      {(replies.length > 0 || allowReplies) && (
        <div className="space-y-2 border-t border-map-overlay-border/60 pt-2">
          {replies.length > 0 && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setRepliesOpen((open) => !open);
              }}
              className="flex items-center gap-1 font-secondary text-[11px] opacity-70 hover:opacity-100"
            >
              <MessageSquare className="h-3 w-3" aria-hidden />
              {replies.length} {replies.length === 1 ? "reply" : "replies"}
              {repliesOpen ? (
                <ChevronUp className="h-3 w-3" aria-hidden />
              ) : (
                <ChevronDown className="h-3 w-3" aria-hidden />
              )}
            </button>
          )}

          {repliesOpen && replies.length > 0 && (
            <ul className="space-y-2">
              {replies.map((reply) => (
                <li key={reply.id} className="rounded-md bg-black/[0.04] px-2 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-secondary text-[11px] font-semibold">
                      {reply.author_name || "Anonymous"}
                    </span>
                    {reply.is_team_reply && (
                      <span
                        className="inline-flex h-4 items-center rounded-full px-1.5 font-secondary text-[9px] font-medium leading-none"
                        style={{ background: `${color}22`, color }}
                      >
                        {TEAM_REPLY_LABEL}
                      </span>
                    )}
                    <span className="ml-auto shrink-0 font-secondary text-[10px] opacity-60">
                      {relativeTime(reply.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 font-secondary text-[11px] leading-snug opacity-90">
                    {reply.body}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {allowReplies && !replyOpen && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setReplyOpen(true);
                setRepliesOpen(true);
              }}
              className="font-secondary text-[11px] font-medium opacity-70 hover:opacity-100"
            >
              Reply
            </button>
          )}

          {allowReplies && replyOpen && (
            <form
              onClick={(event) => event.stopPropagation()}
              onSubmit={(event) => {
                event.preventDefault();
                const text = replyBody.trim();
                if (text.length < 2 || sending) return;
                setSending(true);
                Promise.resolve(onReply?.(text, replyName.trim() || null))
                  .then(() => {
                    setReplyBody("");
                    setReplyOpen(false);
                  })
                  .finally(() => setSending(false));
              }}
              className="space-y-1.5"
            >
              <input
                value={replyName}
                onChange={(event) => setReplyName(event.target.value)}
                placeholder="Your name (optional)"
                maxLength={120}
                className="w-full rounded-md border border-map-overlay-border bg-transparent px-2 py-1 font-secondary text-[11px] outline-none placeholder:opacity-50"
              />
              <textarea
                value={replyBody}
                onChange={(event) => setReplyBody(event.target.value)}
                placeholder="Write a reply…"
                rows={2}
                maxLength={1000}
                className="w-full resize-none rounded-md border border-map-overlay-border bg-transparent px-2 py-1 font-secondary text-[11px] outline-none placeholder:opacity-50"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={replyBody.trim().length < 2 || sending}
                  className="rounded-full bg-map-overlay-foreground px-2.5 py-1 font-secondary text-[11px] font-medium text-map-overlay disabled:opacity-40"
                >
                  {sending ? "Posting…" : "Post reply"}
                </button>
                <button
                  type="button"
                  onClick={() => setReplyOpen(false)}
                  className="font-secondary text-[11px] opacity-60 hover:opacity-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      )}

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
