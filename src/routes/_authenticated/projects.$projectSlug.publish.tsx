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
import { useProjectId } from "@/components/projects/project-context";
import { supabase } from "@/integrations/supabase/client";
import { slugify } from "@/lib/slug";
import { useMyProfile } from "@/hooks/use-profile";
import { useProjectViews, useUpdateView, type ProjectView } from "@/lib/views";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/$projectSlug/publish")({
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

/** Publish state and public link for every view in the project. */
function ViewsSection({
  projectId,
  username,
  publicSlug,
  viewNavEnabled,
  defaultViewId,
}: {
  projectId: string;
  username: string | null;
  publicSlug: string;
  viewNavEnabled: boolean;
  defaultViewId: string | null;
}) {
  const { data: views = [] } = useProjectViews(projectId);
  const updateView = useUpdateView(projectId);
  const queryClient = useQueryClient();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const origin = typeof window === "undefined" ? "" : window.location.origin;

  const publishedViews = views.filter((view) => view.status === "published");

  const saveProject = async (patch: { view_nav_enabled?: boolean; default_view_id?: string | null }) => {
    const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
  };

  const urlFor = (view: ProjectView) =>
    username ? `${origin}/${username}/${publicSlug}${view.is_main ? "" : `/${view.slug}`}` : "";


  const toggle = async (view: ProjectView) => {
    const status = view.status === "published" ? "draft" : "published";
    const publishedAt = status === "published" ? new Date().toISOString() : null;
    setPendingId(view.id);
    try {
      if (view.is_main) {
        // The main view is the project's publication — keep both rows in lockstep.
        const { error } = await supabase
          .from("projects")
          .update({ status, published_at: publishedAt })
          .eq("id", projectId);
        if (error) throw error;
      }
      await updateView.mutateAsync({
        id: view.id,
        patch: { status, published_at: publishedAt },
      });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-by-slug"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(status === "published" ? "View published." : "View unpublished.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPendingId(null);
    }
  };

  if (!views.length) return null;

  return (
    <Section
      title="Views"
      description="Each view publishes on its own URL with its own framing and layer visibility."
    >
      <div className="space-y-3 rounded-lg border border-border px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <Label htmlFor="view-nav" className="text-sm">
              Enable view navigation
            </Label>
            <p className="font-secondary text-xs text-muted-foreground">
              Shows a "Map views" card on the published map so visitors can switch views.
            </p>
          </div>
          <Switch
            id="view-nav"
            checked={viewNavEnabled}
            onCheckedChange={(checked) => void saveProject({ view_nav_enabled: checked })}
          />
        </div>
        <div className="space-y-2 sm:max-w-sm">
          <Label htmlFor="default-view">Default view</Label>
          <select
            id="default-view"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={defaultViewId ?? ""}
            onChange={(e) => void saveProject({ default_view_id: e.target.value || null })}
          >
            <option value="">Main view</option>
            {publishedViews
              .filter((view) => !view.is_main)
              .map((view) => (
                <option key={view.id} value={view.id}>
                  {view.name}
                </option>
              ))}
          </select>
          <p className="font-secondary text-xs text-muted-foreground">
            Which view opens at openfield.nu/{username ?? "your-username"}/{publicSlug}.
          </p>
        </div>
      </div>

      <ul className="divide-y divide-border rounded-lg border border-border">
        {views.map((view) => (
          <li key={view.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium">{view.name}</span>
                {view.is_main && (
                  <span className="rounded border border-border px-1.5 py-0.5 font-secondary text-[10px] uppercase tracking-wide text-muted-foreground">
                    Main
                  </span>
                )}
                <StatusChip status={view.status} />
              </div>
              <p className="truncate font-secondary text-xs text-muted-foreground">
                {urlFor(view) || "Set a username in Settings to get a public link."}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {viewNavEnabled && (
                <label className="flex items-center gap-2 font-secondary text-xs text-muted-foreground">
                  <Switch
                    checked={view.show_view_nav}
                    onCheckedChange={(checked) =>
                      updateView.mutate({ id: view.id, patch: { show_view_nav: checked } })
                    }
                  />
                  Show navigation
                </label>
              )}
              {view.status === "published" && urlFor(view) && (
                <Button asChild variant="outline" size="sm">
                  <a href={urlFor(view)} target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Open
                  </a>
                </Button>
              )}
              <Button
                variant={view.status === "published" ? "outline" : "default"}
                size="sm"
                disabled={pendingId === view.id}
                onClick={() => void toggle(view)}
              >
                {pendingId === view.id ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  view.status !== "published" && <Globe2 className="mr-1.5 h-3.5 w-3.5" />
                )}
                {view.status === "published" ? "Unpublish" : "Publish"}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}


function ProjectPublish() {
  const projectId = useProjectId();
  
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useMyProfile();

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
    setSlug(project.published_slug ?? project.slug);
    setTags((project.tags ?? []).join(", "));
    setAuthor(project.author ?? "");
    setCredits(project.credits ?? "");
    setDataSources(project.data_sources ?? "");
    setEmbed(parseEmbed(project.embed_config));
  }, [project]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    queryClient.invalidateQueries({ queryKey: ["project-by-slug"] });
    queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          published_slug: slugify(slug) || slug,
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
      toast.error(
        e.message.includes("duplicate")
          ? "This URL is already in use. Please choose another slug."
          : e.message,
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

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const username = profile?.username ?? null;
  const publicSlug = slugify(slug) || slug || project?.published_slug || project?.slug || "";
  const publicUrl = username ? `${origin}/${username}/${publicSlug}` : "";
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

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Publish</h1>
        <StatusChip status={project.status} />
      </div>

      <ViewsSection
        projectId={projectId}
        username={username}
        publicSlug={publicSlug}
        viewNavEnabled={project.view_nav_enabled}
        defaultViewId={project.default_view_id}
      />



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
            <Label htmlFor="slug">Public URL slug</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
            <p className="font-secondary text-xs text-muted-foreground">
              openfield.nu/{username ?? "your-username"}/{publicSlug}
            </p>
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

      <Section
        title="Public link"
        description={
          !username
            ? "Choose a username to unlock your public map URLs."
            : project.status === "published"
              ? "Anyone with this link can view the map."
              : "Publish the map to make this link work."
        }
      >
        {username ? (
          <CopyField label="Map URL" value={publicUrl} />
        ) : (
          <Button asChild variant="outline" size="sm">
            <Link to="/settings">Choose a username in Settings</Link>
          </Button>
        )}
        {project.published_at && (
          <p className="font-secondary text-xs text-muted-foreground">
            Last published {new Date(project.published_at).toLocaleString()}
          </p>
        )}
      </Section>

      {/* Comment settings live in the project's Comments tab. */}





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
