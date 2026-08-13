import { supabase } from "@/integrations/supabase/client";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6);
}

/**
 * Readable internal slug, unique within the owner's account:
 * `brooklyn-greenway`, then `brooklyn-greenway-2`, `-3`, ...
 */
export async function uniqueProjectSlug(ownerId: string, title: string): Promise<string> {
  const base = slugify(title) || "map";
  const { data } = await supabase
    .from("projects")
    .select("slug")
    .eq("owner_id", ownerId)
    .like("slug", `${base}%`);
  const taken = new Set((data ?? []).map((row) => row.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 500; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return `${base}-${randomSuffix()}`;
}
