import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/comments")({
  head: () => ({
    meta: [
      { title: "Comments — Open Field" },
      { name: "description", content: "Geolocated feedback left by viewers on your published maps." },
      { property: "og:title", content: "Comments — Open Field" },
      { property: "og:description", content: "Map feedback from your audience." },
    ],
  }),
  component: CommentsPage,
});

function CommentsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Comments</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Geolocated feedback from viewers of your published maps.
      </p>
      <div className="mt-8 rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
        <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
        <h2 className="mt-4 text-lg font-semibold">Commenting arrives with public maps</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Once maps can be published, viewers will be able to drop pinned comments and you'll triage
          them here.
        </p>
      </div>
    </div>
  );
}
