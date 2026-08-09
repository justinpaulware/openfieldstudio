import { createFileRoute } from "@tanstack/react-router";
import { Globe2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$projectId/publishing")({
  head: () => ({
    meta: [
      { title: "Publishing — Open Field" },
      {
        name: "description",
        content: "Publish your map to a public URL with legends, search and an iframe embed.",
      },
      { property: "og:title", content: "Publishing — Open Field" },
      { property: "og:description", content: "Share and embed your Open Field webmap." },
    ],
  }),
  component: ProjectPublishing,
});

function ProjectPublishing() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
        <Globe2 className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold">Publishing and embedding arrive in Phase 4</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Publish to a public URL with layer toggles, a legend and search, plus a copy-paste iframe
          embed.
        </p>
      </div>
    </div>
  );
}
