import { createContext, useContext, type ReactNode } from "react";
import type { Tables } from "@/integrations/supabase/types";

export type ProjectRow = Tables<"projects">;

const ProjectContext = createContext<ProjectRow | null>(null);

export function ProjectProvider({
  project,
  children,
}: {
  project: ProjectRow;
  children: ReactNode;
}) {
  return <ProjectContext.Provider value={project}>{children}</ProjectContext.Provider>;
}

/** The project resolved by the `/projects/$projectSlug` layout. */
export function useProject(): ProjectRow {
  const project = useContext(ProjectContext);
  if (!project) throw new Error("useProject must be used inside a project route.");
  return project;
}

export function useProjectId(): string {
  return useProject().id;
}
