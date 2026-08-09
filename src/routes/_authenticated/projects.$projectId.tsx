import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { StatusChip } from "@/components/status-chip";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectLayout,
});

const TABS = [
  { to: "/projects/$projectId/map", label: "Map Editor", primary: true },
  { to: "/projects/$projectId/details", label: "Details", primary: false },
  { to: "/projects/$projectId/styling", label: "Styling", primary: false },
  { to: "/projects/$projectId/publishing", label: "Publishing", primary: false },
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
    <div className="flex h-[calc(100vh-4rem)] min-h-0 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/projects"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Projects
          </Link>
          <span className="truncate text-sm font-semibold">{project.title}</span>
          <StatusChip status={project.status} />
        </div>
        <nav className="flex items-center gap-1">
          {TABS.map((tab) => (
            <Link
              key={tab.to}
              to={tab.to}
              params={{ projectId }}
              className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              activeProps={{ className: "bg-muted text-foreground font-medium" }}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </div>
    </div>
  );
}
