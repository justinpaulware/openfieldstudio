import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { StatusChip } from "@/components/status-chip";
import { AppHeaderSlot } from "@/components/app-shell";
import { PROJECT_ACTIONS_ID } from "@/components/project-header";
import { ProjectSwitcher } from "@/components/projects/project-switcher";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectLayout,
});

const TABS = [
  { to: "/projects/$projectId/map", label: "Map Editor" },
  { to: "/projects/$projectId/publish", label: "Publish" },
  { to: "/projects/$projectId/comments", label: "Comments" },
] as const;

function ProjectLayout() {
  const { projectId } = Route.useParams();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
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
    <div className="flex h-full min-h-0 flex-col">
      <AppHeaderSlot>
        <nav className="flex items-center gap-1">
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ projectId }}
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
          <ProjectSwitcher projectId={projectId} title={project.title} />
          <StatusChip status={project.status} />
        </div>
        <div id={PROJECT_ACTIONS_ID} className="flex items-center gap-2" />
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
