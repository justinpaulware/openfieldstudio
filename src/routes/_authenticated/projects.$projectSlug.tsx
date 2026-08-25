import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
  useSearch,
} from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { StatusChip } from "@/components/status-chip";
import { AppHeaderSlot } from "@/components/app-shell";
import { PROJECT_ACTIONS_ID } from "@/components/project-header";
import { ProjectSwitcher } from "@/components/projects/project-switcher";
import { ProjectProvider } from "@/components/projects/project-context";
import { ViewSwitcher } from "@/components/projects/view-switcher";

export const Route = createFileRoute("/_authenticated/projects/$projectSlug")({
  component: ProjectLayout,
});

const TABS = [
  { to: "/projects/$projectSlug/map", label: "Map Editor" },
  { to: "/projects/$projectSlug/publish", label: "Publish" },
  { to: "/projects/$projectSlug/comments", label: "Comments" },
] as const;

function ProjectLayout() {
  const { projectSlug } = Route.useParams();
  const search = useSearch({ strict: false }) as { view?: string };
  // The map editor is a full-height tool: it must never sit inside a scroll
  // container, or an appearing/disappearing scrollbar resizes the map canvas
  // in a loop (flickering scrollbars, jumpy zoom, broken pan).
  const isMapTab = useRouterState({
    select: (state) => state.location.pathname.endsWith("/map"),
  });

  const { data: project, isLoading } = useQuery({
    queryKey: ["project-by-slug", projectSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("slug", projectSlug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center">
        <h1 className="text-xl font-semibold">Project not found</h1>
        <Button asChild variant="outline" className="mt-6">
          <Link to="/projects">Back to projects</Link>
        </Button>
      </div>
    );
  }

  return (
    <ProjectProvider project={project}>
      <div className="flex h-full min-h-0 flex-col">
        <AppHeaderSlot>
          <nav className="flex items-center gap-1">
            {TABS.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                params={{ projectSlug }}
                className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                activeProps={{ className: "bg-muted text-foreground font-semibold" }}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </AppHeaderSlot>

        <header className="flex h-12 shrink-0 items-center justify-between gap-x-6 border-b border-border px-4">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              to="/projects"
              className="shrink-0 text-sm text-muted-foreground hover:text-foreground"
            >
              Projects
            </Link>
            <span className="text-sm text-muted-foreground">/</span>
            <ProjectSwitcher projectSlug={projectSlug} title={project.title} />
            <StatusChip status={project.status} />
            <ViewSwitcher
              projectId={project.id}
              projectSlug={projectSlug}
              activeSlug={search.view ?? "main"}
            />
          </div>
          <div id={PROJECT_ACTIONS_ID} className="flex items-center gap-2" />
        </header>

        <div
          className={
            isMapTab
              ? "min-h-0 flex-1 overflow-hidden"
              : "min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable]"
          }
        >
          <Outlet />
        </div>
      </div>
    </ProjectProvider>
  );
}
