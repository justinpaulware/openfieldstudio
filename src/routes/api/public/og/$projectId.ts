import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { publicClient } from "@/lib/publish.server";

/** Social-share image for a published map: serves its saved map snapshot. */
export const Route = createFileRoute("/api/public/og/$projectId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = z.string().uuid().safeParse(params.projectId.replace(/\.jpg$/, ""));
        if (!id.success) return new Response("Not found", { status: 404 });
        // Anon RLS only resolves published projects.
        const { data: project } = await publicClient()
          .from("projects")
          .select("id, status, thumbnail_url")
          .eq("id", id.data)
          .eq("status", "published")
          .maybeSingle();
        if (!project?.thumbnail_url) return new Response("Not found", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: blob, error } = await supabaseAdmin.storage
          .from("project-thumbnails")
          .download(`${project.id}/thumb.jpg`);
        if (error || !blob) return new Response("Not found", { status: 404 });
        return new Response(await blob.arrayBuffer(), {
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=3600, s-maxage=86400",
          },
        });
      },
    },
  },
});
