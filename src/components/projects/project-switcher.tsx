import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";

export type RecentProject = { id: string; title: string };

export function useRecentProjects() {
  return useQuery({
    queryKey: ["recent-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title")
        .order("updated_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as RecentProject[];
    },
  });
}

/** Project-name dropdown in the project header: jump to a recent project. */
export function ProjectSwitcher({ projectId, title }: { projectId: string; title: string }) {
  const { data: recent } = useRecentProjects();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 items-center gap-1 rounded-md px-1.5 py-1 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
        <span className="truncate text-sm font-semibold">{title}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-60">
        <DropdownMenuLabel className="font-secondary text-xs text-muted-foreground">
          Recent projects
        </DropdownMenuLabel>
        {(recent ?? [])
          .filter((p) => p.id !== projectId)
          .map((p) => (
            <DropdownMenuItem key={p.id} asChild>
              <Link to="/projects/$projectId/map" params={{ projectId: p.id }} className="truncate">
                {p.title}
              </Link>
            </DropdownMenuItem>
          ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/projects">All projects →</Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
