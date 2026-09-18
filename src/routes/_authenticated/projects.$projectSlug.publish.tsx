import { useEffect, useMemo, useState } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Globe2,
  Layers,
  Loader2,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { useMyProfile } from "@/hooks/use-profile";
import { useProjectViews, useUpdateView, type ProjectView } from "@/lib/views";

export const Route = createFileRoute("/_authenticated/projects/$projectSlug/publish")({
  head: () => ({
    meta: [
      { title: "Publish — Open Field" },
      {
        name: "description",
        content:
          "Publish your Open Field project and its views to public URLs, add attribution and copy embeds.",
      },
      { property: "og:title", content: "Publish — Open Field" },
      { property: "og:description", content: "Share and embed your Open Field webmaps." },
    ],
  }),
  component: ProjectPublish,
});

type EmbedConfig = { legend: boolean; title: boolean; height: number };

const DEFAULT_EMBED: EmbedConfig = { legend: true, title: true, height: 540 };

function parseEmbed(value: unknown): EmbedConfig {
  if (!value || typeof value !== "object") return DEFAULT_EMBED;
  const raw = value as Partial<EmbedConfig>;
  return {
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

/** One expandable card: URL, slug, navigation, embed and publish state for a view. */
function ViewCard({
  view,
  views,
  projectId,
  username,
  publicSlug,
  projectTitle,
  viewNavEnabled,
}: {
  view: ProjectView;
  views: ProjectView[];
  projectId: string;
  username: string | null;
  publicSlug: string;
  projectTitle: string;
  viewNavEnabled: boolean;
}) {
  const updateView = useUpdateView(projectId);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(view.is_main);
  const [slug, setSlug] = useState(view.slug);
  const [embed, setEmbed] = useState<EmbedConfig>(parseEmbed(view.embed_config));
  const [pending, setPending] = useState(false);

  useEffect(() => {
    setSlug(view.slug);
    setEmbed(parseEmbed(view.embed_config));
  }, [view.slug, view.embed_config]);

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const path = `${publicSlug}${view.is_main ? "" : `/${slugify(slug) || slug}`}`;
  const url = username ? `${origin}/${username}/${path}` : "";

  const embedUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (!embed.legend) params.set("legend", "0");
    if (!embed.title) params.set("title", "0");
    const query = params.toString();
    return query ? `${url}?${query}` : url;
  }, [url, embed]);
  const embedCode = `<iframe src="${embedUrl}" width="100%" height="${embed.height}" style="border:0" loading="lazy" allowfullscreen title="${view.name} — ${projectTitle}"></iframe>`;

  const commitSlug = () => {
    const next = slugify(slug) || slug.trim();
    if (!next || next === view.slug) {
      setSlug(view.slug);
      return;
    }
    if (views.some((other) => other.id !== view.id && other.slug === next)) {
      toast.error("Another view already uses that address.");
      setSlug(view.slug);
      return;
    }
    updateView.mutate(
      { id: view.id, patch: { slug: next } },
      { onError: (e: Error) => toast.error(e.message) },
    );
  };

  const saveEmbed = (next: EmbedConfig) => {
    setEmbed(next);
    updateView.mutate({ id: view.id, patch: { embed_config: next } });
  };

  const togglePublish = async () => {
    const status = view.status === "published" ? "draft" : "published";
    const publishedAt = status === "published" ? new Date().toISOString() : null;
    setPending(true);
    try {
      if (view.is_main) {
        // The main view is the project's publication — keep both rows in lockstep.
        const { error } = await supabase
          .from("projects")
          .update({ status, published_at: publishedAt })
          .eq("id", projectId);
        if (error) throw error;
      }
      await updateView.mutateAsync({ id: view.id, patch: { status, published_at: publishedAt } });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-by-slug"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(status === "published" ? "View published." : "View unpublished.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", !open && "-rotate-90")}
          />
          <span className="truncate text-sm font-semibold">{view.name}</span>
          {view.is_main && (
            <span className="rounded border border-border px-1.5 py-0.5 font-secondary text-[10px] uppercase tracking-wide text-muted-foreground">
              Main
            </span>
          )}
          <StatusChip status={view.status} />
        </button>
        <div className="flex items-center gap-2">
          {view.status === "published" && url && (
            <Button asChild variant="outline" size="sm">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Open
              </a>
            </Button>
          )}
          <Button
            variant={view.status === "published" ? "outline" : "default"}
            size="sm"
            disabled={pending}
            onClick={() => void togglePublish()}
          >
            {pending ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              view.status !== "published" && <Globe2 className="mr-1.5 h-3.5 w-3.5" />
            )}
            {view.status === "published" ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      {open && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          {view.is_main ? (
            <p className="font-secondary text-xs text-muted-foreground">
              The Main view publishes at the project address.
            </p>
          ) : (
            <div className="space-y-2 sm:max-w-sm">
              <Label htmlFor={`slug-${view.id}`}>View address</Label>
              <Input
                id={`slug-${view.id}`}
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onBlur={commitSlug}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
              />
              <p className="font-secondary text-xs text-muted-foreground">
                /{username ?? "your-username"}/{path}
              </p>
            </div>
          )}

          {username ? (
            <CopyField label="Public URL" value={url} />
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/settings">Choose a username in Settings</Link>
            </Button>
          )}

          {viewNavEnabled && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <Label htmlFor={`nav-${view.id}`} className="font-secondary text-xs">
                Show view navigation on this view
              </Label>
              <Switch
                id={`nav-${view.id}`}
                checked={view.show_view_nav}
                onCheckedChange={(checked) =>
                  updateView.mutate({ id: view.id, patch: { show_view_nav: checked } })
                }
              />
            </div>
          )}

          <div className="space-y-3 rounded-lg border border-border px-3 py-3">
            <p className="text-xs font-semibold">Embed</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["legend", "Legend"],
                  ["title", "Title card"],
                ] as const
              ).map(([key, label]) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                >
                  <Label htmlFor={`embed-${key}-${view.id}`} className="font-secondary text-xs">
                    {label}
                  </Label>
                  <Switch
                    id={`embed-${key}-${view.id}`}
                    checked={embed[key]}
                    onCheckedChange={(checked) => saveEmbed({ ...embed, [key]: checked })}
                  />
                </div>
              ))}
            </div>
            <div className="space-y-2 sm:max-w-[12rem]">
              <Label htmlFor={`embed-height-${view.id}`}>Height (px)</Label>
              <Input
                id={`embed-height-${view.id}`}
                type="number"
                min={200}
                value={embed.height}
                onChange={(e) => setEmbed({ ...embed, height: Number(e.target.value) || embed.height })}
                onBlur={() => saveEmbed(embed)}
              />
            </div>
            <CopyField label="Embed code" value={embedCode} />
          </div>
        </div>
      )}
    </section>
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

  const { data: views = [] } = useProjectViews(projectId);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [tags, setTags] = useState("");
  const [author, setAuthor] = useState("");
  const [credits, setCredits] = useState("");
  const [dataSources, setDataSources] = useState("");

  useEffect(() => {
    if (!project) return;
    setTitle(project.title);
    setDescription(project.description ?? "");
    setSlug(project.published_slug ?? project.slug);
    setTags((project.tags ?? []).join(", "));
    setAuthor(project.author ?? "");
    setCredits(project.credits ?? "");
    setDataSources(project.data_sources ?? "");
  }, [project]);

  const dirty = !!project &&
    (title !== project.title ||
      description !== (project.description ?? "") ||
      slug !== (project.published_slug ?? project.slug) ||
      tags !== (project.tags ?? []).join(", ") ||
      author !== (project.author ?? "") ||
      credits !== (project.credits ?? "") ||
      dataSources !== (project.data_sources ?? ""));

  // Warn before a full page unload with unsaved project fields.
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

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

  const saveProjectSetting = async (patch: {
    view_nav_enabled?: boolean;
    default_view_id?: string | null;
  }) => {
    const { error } = await supabase.from("projects").update(patch).eq("id", projectId);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["project", projectId] });
  };

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const username = profile?.username ?? null;
  const publicSlug = slugify(slug) || slug || project?.published_slug || project?.slug || "";
  const publicUrl = username ? `${origin}/${username}/${publicSlug}` : "";

  if (isLoading || !project) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const saveButton = (
    <Button onClick={() => save.mutate()} disabled={save.isPending || !dirty}>
      {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      Save changes
    </Button>
  );

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">Publish</h1>
          <StatusChip status={project.status} />
        </div>
        <div className="flex items-center gap-3">
          {saveButton}
          {dirty && (
            <span className="font-secondary text-xs text-muted-foreground">Unsaved changes</span>
          )}
        </div>
      </div>

      <Section title="Project" description="Shown on every published view and in your library.">
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
            <Label htmlFor="slug">Project address</Label>
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
        title="Public project URL"
        description={
          !username
            ? "Choose a username to unlock your public URLs."
            : project.status === "published"
              ? "Anyone with this link can view the project."
              : "Publish the Main view to make this link work."
        }
      >
        {username ? (
          <CopyField label="Project URL" value={publicUrl} />
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

      <Section
        title="Views"
        description="Views are different published presentations of the same project."
      >
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-4 py-3">
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
            checked={project.view_nav_enabled}
            onCheckedChange={(checked) => void saveProjectSetting({ view_nav_enabled: checked })}
          />
        </div>
        <div className="space-y-2 sm:max-w-sm">
          <Label htmlFor="default-view">Default view</Label>
          <select
            id="default-view"
            className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={project.default_view_id ?? ""}
            onChange={(e) => void saveProjectSetting({ default_view_id: e.target.value || null })}
          >
            <option value="">Main view</option>
            {views
              .filter((view) => !view.is_main && view.status === "published")
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
      </Section>

      {views.length > 0 && (
        <div className="space-y-3">
          <p className="flex items-center gap-2 font-secondary text-xs uppercase tracking-wide text-muted-foreground">
            <Layers className="h-3.5 w-3.5" />
            Published outputs
          </p>
          {views.map((view) => (
            <ViewCard
              key={view.id}
              view={view}
              views={views}
              projectId={projectId}
              username={username}
              publicSlug={publicSlug}
              projectTitle={title}
              viewNavEnabled={project.view_nav_enabled}
            />
          ))}
        </div>
      )}

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
          {saveButton}
        </div>
      </div>
    </div>
  );
}
