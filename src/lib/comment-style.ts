/**
 * Shared styling helpers for engagement comments: category colors, avatar
 * initials and relative timestamps. Category colors come from Open Field's
 * standard palette and are stored per project in
 * `projects.embed_config.comment_category_colors`.
 */

/** Standard Open Field hues used for comment categories. */
export const COMMENT_PALETTE = [
  "#4f7cf7",
  "#f0932b",
  "#4caf6a",
  "#c65fb5",
  "#2bb1a8",
  "#e0533d",
  "#f5c518",
  "#8b5cf6",
] as const;

/** Color used for comments without a category. */
export const UNCATEGORIZED_COLOR = "#8b5cf6";

export type CategoryColors = Record<string, string>;

const HEX = /^#[0-9a-f]{6}$/i;

/** Default color for a category by its position in the project's list. */
export function defaultCategoryColor(index: number) {
  return COMMENT_PALETTE[index % COMMENT_PALETTE.length]!;
}

/**
 * Build the full category → color map: saved overrides win, everything else
 * falls back to the palette in list order.
 */
export function categoryColors(
  categories: string[],
  saved: unknown,
): CategoryColors {
  const overrides =
    saved && typeof saved === "object" && !Array.isArray(saved)
      ? (saved as Record<string, unknown>)
      : {};
  const out: CategoryColors = {};
  categories.forEach((name, index) => {
    const value = overrides[name];
    out[name] = typeof value === "string" && HEX.test(value) ? value : defaultCategoryColor(index);
  });
  return out;
}

/** Pull the saved overrides out of a project's embed_config. */
export function savedCategoryColors(embedConfig: unknown): Record<string, string> {
  if (!embedConfig || typeof embedConfig !== "object") return {};
  const raw = (embedConfig as Record<string, unknown>)["comment_category_colors"];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && HEX.test(value)) out[key] = value;
  }
  return out;
}

/** Color for one comment, falling back to the neutral violet. */
export function colorFor(colors: CategoryColors, category: string | null | undefined) {
  if (!category) return UNCATEGORIZED_COLOR;
  return colors[category] ?? UNCATEGORIZED_COLOR;
}

/** Up to two initials from an author name; "A" for anonymous visitors. */
export function initialsFor(name: string | null | undefined) {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "A";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

/** "just now" / "4m ago" / "2d ago" / a short date beyond a month. */
export function relativeTime(iso: string) {
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

/** Stable per-browser id so anonymous visitors can vote once per comment. */
export function visitorId() {
  if (typeof window === "undefined") return "";
  const KEY = "of-visitor-id";
  let id = window.localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
  }
  return id;
}
