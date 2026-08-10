import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Globe2, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { StatusChip } from "@/components/status-chip";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/slug";

export const Route = createFileRoute("/_authenticated/projects/$projectId/publish")({
  head: () => ({
    meta: [
      { title: "Publish — Open Field" },
      {
        name: "description",
        content:
          "Publish your Open Field map to a public URL, add credits and copy an iframe embed.",
      },
      { property: "og:title", content: "Publish — Open Field" },
      { property: "og:description", content: "Share and embed your Open Field webmap." },
    ],
  }),
  component: ProjectPublish,
});

type EmbedConfig = { sidebar: boolean; legend: boolean; title: boolean; height: number };

const DEFAULT_EMBED: EmbedConfig = { sidebar: true, legend: true, title: true, height: 540 };

function parseEmbed(value: unknown): EmbedConfig {
  if (!value || typeof value !== "object") return DEFAULT_EMBED;
  const raw = value as Partial<EmbedConfig>;
  return {
    sidebar: raw.sidebar ?? DEFAULT_EMBED.sidebar,
    legend: raw.legend ?? DEFAULT_EMBED.legend,
    title: raw.title ?? DEFAULT_EMBED.title,
    height: Number(raw.height) > 0 ? Number(raw.height) : DEFAULT_EMBED.height,
  };
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]">
      <h2 className="text-sm font-semibold">{title}</h2>
      {description && (
        <p className="mt-1 font-secondary text-xs text-muted-foreground">{description}</p>
      )}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-secondary text-xs" />
        <Button
          variant="outline"
          size="icon"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            toast.success("Copied to clipboard.");
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

function ProjectPublish() {
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
  const [author, setAuthor] = useState("");
  const [credits, setCredits] = useState("");
  const [dataSources, setDataSources] = useState("");
  const [embed, setEmbed] = useState<EmbedConfig>(DEFAULT_EMBED);

  useEffect(() => {
    if (!project) return;
    setTitle(project.title);
    setDescription(project.description ?? "");
    setSlug(project.slug);
    setTags((project.tags ?? []).join(", "));
    setAuthor(project.author ?? "");
    setCredits(project.credits ?? "");
    setDataSources(project.data_sources ?? "");
    setEmbed(parseEmbed(project.embed_config));
  }, [project]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

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
          author: author.trim() || null,
          credits: credits.trim() || null,
          data_sources: dataSources.trim() || null,
          embed_config: embed,
        })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project saved.");
      invalidate();
    },
    onError: (e: Error) =>
      toast.error(e.message.includes("duplicate") ? "That URL slug is already taken." : e.message),
  });

  const setStatus = useMutation({
    mutationFn: async (status: "draft" | "published") => {
      const { error } = await supabase
        .from("projects")
        .update({
          status,
          published_at: status === "published" ? new Date().toISOString() : null,
        })
        .eq("id", projectId);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      toast.success(status === "published" ? "Map published." : "Map unpublished.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
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

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const publicUrl = `${origin}/maps/${project?.slug ?? ""}`;
  const embedUrl = useMemo(() => {
    const params = new URLSearchParams();

    if (!embed.legend) params.set("legend", "0");
    if (!embed.title) params.set("title", "0");
    const query = params.toString();
    return query ? `${publicUrl}?${query}` : publicUrl;
  }, [publicUrl, embed]);
  const embedCode = `<iframe src="${embedUrl}" width="100%" height="${embed.height}" style="border:0" loading="lazy" allowfullscreen title="${title || "Open Field map"}"></iframe>`;

  if (isLoading || !project) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPublished = project.status === "published";

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Publish</h1>
          <StatusChip status={project.status} />
        </div>
        <div className="flex gap-2">
          {isPublished && (
            <Button asChild variant="outline">
              <a href={publicUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-4 w-4" />
                View live map
              </a>
            </Button>
          )}
          <Button
            variant={isPublished ? "outline" : "default"}
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate(isPublished ? "draft" : "published")}
          >
            {setStatus.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Globe2 className="mr-1.5 h-4 w-4" />
            )}
            {isPublished ? "Unpublish" : "Publish map"}
          </Button>
        </div>
      </div>

      <Section
        title="Public link"
        description={
          isPublished
            ? "Anyone with this link can view the map."
            : "Publish the map to make this link work."
        }
      >
        <CopyField label="Map URL" value={publicUrl} />
        {project.published_at && (
          <p className="font-secondary text-xs text-muted-foreground">
            Last published {new Date(project.published_at).toLocaleString()}
          </p>
        )}
      </Section>

      <Section title="Project details" description="Shown on the public map and in your dashboard.">
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="slug">URL slug</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <p className="font-secondary text-xs text-muted-foreground">/maps/{slugify(slug) || slug}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="hydrology, planning"
            />
          </div>
        </div>
      </Section>

      <Section title="Attribution" description="Credit yourself and the data behind the map.">
        <div className="space-y-2">
          <Label htmlFor="author">Author</Label>
          <Input id="author" value={author} onChange={(e) => setAuthor(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="data-sources">Data sources</Label>
          <Textarea
            id="data-sources"
            value={dataSources}
            onChange={(e) => setDataSources(e.target.value)}
            placeholder="USGS NHD, City of Portland open data"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="credits">Credits</Label>
          <Textarea
            id="credits"
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            placeholder="Cartography by …"
          />
        </div>
      </Section>

      <Section title="Embed" description="Drop this snippet into any website or CMS.">
        <div className="grid gap-4 sm:grid-cols-2">
          {(
            [
              ["legend", "Legend"],
              ["title", "Title card"],
            ] as const

          ).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <Label htmlFor={`embed-${key}`} className="font-secondary text-xs">
                {label}
              </Label>
              <Switch
                id={`embed-${key}`}
                checked={embed[key]}
                onCheckedChange={(checked) => setEmbed((prev) => ({ ...prev, [key]: checked }))}
              />
            </div>
          ))}
        </div>
        <div className="space-y-2 sm:max-w-[12rem]">
          <Label htmlFor="embed-height">Height (px)</Label>
          <Input
            id="embed-height"
            type="number"
            min={200}
            value={embed.height}
            onChange={(e) =>
              setEmbed((prev) => ({ ...prev, height: Number(e.target.value) || prev.height }))
            }
          />
        </div>
        <CopyField label="Embed code" value={embedCode} />
      </Section>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="font-secondary text-xs text-muted-foreground">
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
            Delete project
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
