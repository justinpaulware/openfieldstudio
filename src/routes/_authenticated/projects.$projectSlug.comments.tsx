import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Eye, EyeOff, Loader2, MessageSquare, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useProjectId } from "@/components/projects/project-context";
import { supabase } from "@/integrations/supabase/client";
import { exportComments } from "@/lib/comments.functions";
import { cn } from "@/lib/utils";
import type { MapHandle } from "@/components/map/map-canvas";
import { geometryLabel } from "@/components/comments/comment-panel";

const MapCanvas = lazy(() => import("@/components/map/map-canvas"));

const STATUS_FILTERS = ["all", "pending", "approved", "hidden", "rejected"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];


export const Route = createFileRoute("/_authenticated/projects/$projectSlug/comments")({
  head: () => ({
    meta: [
      { title: "Engagement — Open Field" },
      {
        name: "description",
        content: "Review, hide and delete the feedback visitors leave on your map.",
      },
      { property: "og:title", content: "Engagement — Open Field" },
      { property: "og:description", content: "Moderate feedback on your Open Field map." },
    ],
  }),
  component: ProjectComments,
});

type CommentRow = {
  id: string;
  body: string;
  category: string | null;
  author_name: string | null;
  created_at: string;
  lng: number;
  lat: number;
  status: "pending" | "approved" | "hidden" | "rejected";
  geometry_type: string | null;
};

function ProjectComments() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();
  const mapRef = useRef<MapHandle | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: project } = useQuery({
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

  const { data: comments, isLoading } = useQuery({
    queryKey: ["project-comments", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("id, body, category, author_name, created_at, lng, lat, status, geometry_type")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CommentRow[];
    },
  });

  const [commentsEnabled, setCommentsEnabled] = useState(false);
  const [allowShapes, setAllowShapes] = useState(false);
  const [categories, setCategories] = useState("");

  useEffect(() => {
    if (!project) return;
    setCommentsEnabled(project.comments_enabled);
    setAllowShapes(project.comments_allow_shapes);
    setCategories((project.comment_categories ?? []).join(", "));
  }, [project]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("projects")
        .update({
          comments_enabled: commentsEnabled,
          comments_allow_shapes: allowShapes,
          comment_categories: categories
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean),
        })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comment settings saved.");
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CommentRow["status"] }) => {
      const { error } = await supabase.from("comments").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-comments", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("comments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Comment deleted.");
      queryClient.invalidateQueries({ queryKey: ["project-comments", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (comments ?? []).filter(
      (c) =>
        (statusFilter === "all" || c.status === statusFilter) &&
        (!term || c.body.toLowerCase().includes(term)),
    );
  }, [comments, statusFilter, search]);

  const runExport = useServerFn(exportComments);
  const [exporting, setExporting] = useState(false);

  async function download(format: "csv" | "geojson") {
    setExporting(true);
    try {
      const result = await runExport({
        data: { projectId, format, status: statusFilter, search },
      });
      const blob = new Blob([result.content], { type: result.mimeType });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = result.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.count} comment${result.count === 1 ? "" : "s"}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  const pins = useMemo(
    () => filtered.map((c) => ({ id: c.id, lng: c.lng, lat: c.lat })),
    [filtered],
  );


  const initialView = {
    center: [project?.map_center?.[0] ?? 0, project?.map_center?.[1] ?? 20] as [number, number],
    zoom: project?.map_zoom ?? 2,
    pitch: 0,
    bearing: 0,
  };

  function select(id: string) {
    setSelectedId(id);
    const target = (comments ?? []).find((c) => c.id === id);
    if (target) mapRef.current?.flyTo(target.lng, target.lat);
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-6 py-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Engagement</h1>
            <p className="mt-1 font-secondary text-sm text-muted-foreground">
              Feedback visitors have left on this map.
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={exporting}>
                {exporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => void download("csv")}>
                CSV (with contact details)
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => void download("geojson")}>GeoJSON</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
            {STATUS_FILTERS.map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={statusFilter === value ? "secondary" : "ghost"}
                className="h-7 font-secondary text-xs capitalize"
                onClick={() => setStatusFilter(value)}
              >
                {value}
              </Button>
            ))}
          </div>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search comments"
            className="h-9 max-w-[16rem] flex-1"
          />
          <span className="font-secondary text-xs text-muted-foreground">
            {filtered.length} shown
          </span>
        </div>


        <div className="h-[380px] overflow-hidden rounded-xl border border-border">
          {project ? (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <MapCanvas
                basemap={project.basemap ?? "positron"}
                layers={[]}
                initialView={initialView}
                handleRef={mapRef}
                commentPins={pins}
                selectedCommentId={selectedId}
                onCommentClick={select}
              />
            </Suspense>
          ) : null}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground" />
            <h2 className="mt-4 text-lg font-semibold">
              {(comments ?? []).length > 0 ? "No matching comments" : "No comments yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-md font-secondary text-sm text-muted-foreground">
              {(comments ?? []).length > 0
                ? "No comments match the current filters."
                : commentsEnabled
                  ? "Once visitors drop pins on your published map, they'll show up here."
                  : "Commenting is currently off for this project. Turn it on to collect feedback."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {filtered.map((comment) => (
              <li
                key={comment.id}
                className={cn(
                  "flex gap-3 px-4 py-3",
                  selectedId === comment.id && "bg-muted/60",
                  comment.status === "hidden" && "opacity-60",
                )}
              >
                <button
                  type="button"
                  onClick={() => select(comment.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold">
                      {comment.author_name || "Anonymous"}
                    </span>
                    {comment.category && (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 font-secondary text-[10px]">
                        {comment.category}
                      </span>
                    )}
                    {geometryLabel(comment.geometry_type) && (
                      <span className="rounded-full border border-border px-1.5 py-0.5 font-secondary text-[10px] text-muted-foreground">
                        {geometryLabel(comment.geometry_type)}
                      </span>
                    )}
                    {comment.status === "hidden" && (
                      <span className="font-secondary text-[10px] uppercase tracking-wide text-muted-foreground">
                        Hidden
                      </span>
                    )}
                    <span className="ml-auto font-secondary text-xs text-muted-foreground">
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 font-secondary text-sm leading-snug">{comment.body}</p>
                </button>
                <div className="flex shrink-0 items-start gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title={comment.status === "hidden" ? "Restore comment" : "Hide comment"}
                    aria-label={comment.status === "hidden" ? "Restore comment" : "Hide comment"}
                    onClick={() =>
                      setStatus.mutate({
                        id: comment.id,
                        status: comment.status === "hidden" ? "approved" : "hidden",
                      })
                    }
                  >
                    {comment.status === "hidden" ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Delete comment"
                    aria-label="Delete comment"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      if (confirm("Delete this comment? This can't be undone."))
                        remove.mutate(comment.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <aside className="space-y-4 rounded-xl border border-border bg-card p-6 lg:sticky lg:top-6 lg:self-start">
        <div>
          <h2 className="text-sm font-semibold">Comment settings</h2>
          <p className="mt-1 font-secondary text-xs text-muted-foreground">
            Comments appear on the published map right away.
          </p>
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <Label htmlFor="comments-enabled" className="font-secondary text-xs">
            Allow public comments
          </Label>
          <Switch
            id="comments-enabled"
            checked={commentsEnabled}
            onCheckedChange={setCommentsEnabled}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
          <Label htmlFor="comments-allow-shapes" className="font-secondary text-xs">
            Allow drawn lines and areas
          </Label>
          <Switch
            id="comments-allow-shapes"
            checked={allowShapes}
            onCheckedChange={setAllowShapes}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="comment-categories">Categories</Label>
          <Input
            id="comment-categories"
            value={categories}
            onChange={(e) => setCategories(e.target.value)}
            placeholder="General feedback, Question, Issue"
          />
          <p className="font-secondary text-xs text-muted-foreground">
            Comma separated. Leave empty to hide the category picker.
          </p>
        </div>
        <Button
          className="w-full"
          disabled={saveSettings.isPending}
          onClick={() => saveSettings.mutate()}
        >
          {saveSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save settings
        </Button>
      </aside>
    </div>
  );
}
