import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/slug";

export const Route = createFileRoute("/_authenticated/projects/$projectId/details")({
  head: () => ({
    meta: [
      { title: "Project details — Open Field" },
      {
        name: "description",
        content: "Edit the title, description, URL slug and tags of your Open Field map project.",
      },
      { property: "og:title", content: "Project details — Open Field" },
      { property: "og:description", content: "Manage an Open Field mapping project." },
    ],
  }),
  component: ProjectDetails,
});

function ProjectDetails() {
  const { projectId } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [tags, setTags] = useState("");

  useEffect(() => {
    if (!project) return;
    setTitle(project.title);
    setDescription(project.description ?? "");
    setSlug(project.slug);
    setTags((project.tags ?? []).join(", "));
  }, [project]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          slug: slugify(slug) || slug,
          tags: tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project saved.");
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message.includes("duplicate") ? "That URL slug is already taken." : e.message,
      ),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").delete().eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project deleted.");
      navigate({ to: "/projects" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !project) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <h1 className="text-2xl font-semibold">Project details</h1>
      <p className="mt-1 text-sm text-muted-foreground">/maps/{project.slug}</p>

      <div className="mt-6 space-y-5 rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">URL slug</Label>
          <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            Used for the public map address once published.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tags">Tags</Label>
          <Input id="tags" value={tags} onChange={(e) => setTags(e.target.value)} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
          <p className="text-xs text-muted-foreground">
            Created {new Date(project.created_at).toLocaleDateString()} · Updated{" "}
            {new Date(project.updated_at).toLocaleDateString()}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm(`Delete "${project.title}"? This can't be undone.`)) remove.mutate();
              }}
            >
              Delete
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
