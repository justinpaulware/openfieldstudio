import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { StatusChip } from "@/components/status-chip";
import { AppHeaderSlot } from "@/components/app-shell";

export const Route = createFileRoute("/_authenticated/projects/$projectId")({
  component: ProjectLayout,
});

const ProjectActionsContext = createContext<HTMLElement | null>(null);

/** Renders `children` into the right side of the project header band. */
export function ProjectHeaderActions({ children }: { children: ReactNode }) {
  const node = useContext(ProjectActionsContext);
  if (!node) return null;
  return createPortal(children, node);
}

const TABS = [
  { to: "/projects/$projectId/map", label: "Map Editor", primary: true },
  { to: "/projects/$projectId/details", label: "Details", primary: false },
  
  { to: "/projects/$projectId/publishing", label: "Publishing", primary: false },
] as const;


function ProjectLayout() {
  const { projectId } = Route.useParams();
  const [actionsSlot, setActionsSlot] = useState<HTMLElement | null>(null);

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
    <ProjectActionsContext.Provider value={actionsSlot}>
      <div className="flex h-full min-h-0 flex-col">
        <AppHeaderSlot>
          <nav className="flex items-center gap-1">
            {TABS.map((tab) => (
              <Link
                key={tab.to}
                to={tab.to}
                params={{ projectId }}
                className={
                  tab.primary
                    ? "rounded-md px-3 py-1.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                    : "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                }
                activeProps={{ className: "bg-muted text-foreground font-semibold" }}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        </AppHeaderSlot>

        <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b border-border px-4 py-1.5">
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
          <div ref={setActionsSlot} className="flex items-center gap-2" />
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </ProjectActionsContext.Provider>
  );

}
