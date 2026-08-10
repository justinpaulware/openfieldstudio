import { createFileRoute } from "@tanstack/react-router";

import { ProjectGallery } from "@/components/projects/project-gallery";

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({
    meta: [
      { title: "Projects — Open Field" },
      { name: "description", content: "Create and manage your Open Field mapping projects." },
      { property: "og:title", content: "Projects — Open Field" },
      { property: "og:description", content: "Your mapping projects in one place." },
    ],
  }),
  component: ProjectsPage,
});

function ProjectsPage() {
  return <ProjectGallery mode="all" />;
}
