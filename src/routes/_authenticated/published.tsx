import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Globe2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StatusChip } from "@/components/status-chip";

export const Route = createFileRoute("/_authenticated/published")({
  head: () => ({
    meta: [
      { title: "Published maps — Map Studio" },
      { name: "description", content: "See which of your Map Studio projects are live and shareable." },
      { property: "og:title", content: "Published maps — Map Studio" },
      { property: "og:description", content: "Your live, shareable webmaps." },
    ],
  }),
  component: PublishedPage,
});

function PublishedPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["projects", "published"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, title, slug, status, updated_at")
        .eq("status", "published")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Published maps</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Maps you've made public. Publishing itself lands in a later phase.
      </p>

      {isLoading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : !data?.length ? (
        <div className="mt-8 rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Globe2 className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Nothing published yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            Build a project first — publishing controls arrive with the map editor.
          </p>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {data.map((project) => (
            <li key={project.id} className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: project.id }}
                  className="font-medium hover:underline"
                >
                  {project.title}
                </Link>
                <p className="truncate text-sm text-muted-foreground">/maps/{project.slug}</p>
              </div>
              <StatusChip status={project.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
