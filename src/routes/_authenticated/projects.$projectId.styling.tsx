import { createFileRoute } from "@tanstack/react-router";
import { Palette } from "lucide-react";

export const Route = createFileRoute("/_authenticated/projects/$projectId/styling")({
  head: () => ({
    meta: [
      { title: "Layer styling — Open Field" },
      {
        name: "description",
        content: "Style points, lines and polygons, add labels and build popups for your webmap.",
      },
      { property: "og:title", content: "Layer styling — Open Field" },
      { property: "og:description", content: "Cartographic styling for Open Field webmaps." },
    ],
  }),
  component: ProjectStyling,
});

function ProjectStyling() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
        <Palette className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-4 text-lg font-semibold">
          Styling, labels and popups arrive in Phase 3
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          Visual controls for point, line and polygon styling, data-driven colours, labels and a
          popup builder.
        </p>
      </div>
    </div>
  );
}
