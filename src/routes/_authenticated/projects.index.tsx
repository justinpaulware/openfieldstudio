import { createFileRoute } from "@tanstack/react-router";

import { ProjectGallery } from "@/components/projects/project-gallery";

export type LibrarySort = "name" | "updated" | "created" | "status" | "custom";

export type LibrarySearch = {
  folder?: string;
  sort?: LibrarySort;
  dir?: "asc" | "desc";
};

const SORTS: string[] = ["name", "updated", "created", "status", "custom"];

export const Route = createFileRoute("/_authenticated/projects/")({
  validateSearch: (search: Partial<LibrarySearch>): LibrarySearch => {
    const rawSort = String(search.sort ?? "");
    const rawDir = String(search.dir ?? "");
    const folder = typeof search.folder === "string" && search.folder ? search.folder : undefined;
    return {
      ...(folder ? { folder } : {}),
      ...(SORTS.includes(rawSort) ? { sort: rawSort as LibrarySort } : {}),
      ...(rawDir === "asc" || rawDir === "desc" ? { dir: rawDir } : {}),
    };
  },
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
