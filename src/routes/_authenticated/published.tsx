import { createFileRoute } from "@tanstack/react-router";

import { ProjectGallery } from "@/components/projects/project-gallery";

export const Route = createFileRoute("/_authenticated/published")({
  head: () => ({
    meta: [
      { title: "Published maps — Open Field" },
      {
        name: "description",
        content: "See which of your Open Field projects are live and shareable.",
      },
      { property: "og:title", content: "Published maps — Open Field" },
      { property: "og:description", content: "Your live, shareable webmaps." },
    ],
  }),
  component: PublishedPage,
});

function PublishedPage() {
  return <ProjectGallery mode="published" />;
}
