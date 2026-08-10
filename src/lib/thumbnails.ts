import { supabase } from "@/integrations/supabase/client";
import type { MapHandle } from "@/components/map/map-canvas";

export const THUMBNAIL_BUCKET = "project-thumbnails";

export function thumbnailPath(projectId: string) {
  return `${projectId}/thumb.jpg`;
}

/**
 * Snapshot the live map canvas and store it as the project's thumbnail.
 * Failures are non-fatal — saving the view should never break on this.
 */
export async function captureProjectThumbnail(
  projectId: string,
  handle: MapHandle | null | undefined,
) {
  try {
    const blob = await handle?.captureThumbnail?.();
    if (!blob) return;
    const path = thumbnailPath(projectId);
    const { error } = await supabase.storage
      .from(THUMBNAIL_BUCKET)
      .upload(path, blob, { upsert: true, contentType: "image/jpeg" });
    if (error) throw error;
    await supabase
      .from("projects")
      .update({ thumbnail_url: `${path}?v=${Date.now()}` })
      .eq("id", projectId);
  } catch {
    // ignore — thumbnails are best-effort
  }
}

/** Sign the stored thumbnail paths so authenticated galleries can display them. */
export async function signThumbnails(
  projects: { id: string; thumbnail_url: string | null }[],
): Promise<Record<string, string>> {
  const withThumbs = projects.filter((p) => p.thumbnail_url);
  if (!withThumbs.length) return {};
  const paths = withThumbs.map((p) => thumbnailPath(p.id));
  const { data, error } = await supabase.storage
    .from(THUMBNAIL_BUCKET)
    .createSignedUrls(paths, 60 * 60);
  if (error || !data) return {};
  const map: Record<string, string> = {};
  data.forEach((entry, index) => {
    const project = withThumbs[index];
    if (project && entry.signedUrl && !entry.error) map[project.id] = entry.signedUrl;
  });
  return map;
}
