import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Download,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  MessageSquare,
  Pencil,
  Pentagon,
  Plus,
  Spline,
  Trash2,
  Upload,
} from "lucide-react";

import { ShapeIcon } from "@/components/comments/comment-card";
import { EditCommentDialog } from "@/components/comments/edit-comment-dialog";
import { ImportCommentsDialog } from "@/components/comments/import-comments-dialog";
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
import { categoryLabel, geometryTag, showCommentSource } from "@/lib/comment-style";
import { ColorField } from "@/components/map/color-field";
import {
  ALL_GEOMETRY_TYPES,
  categoryColors,
  colorFor,
  commentGeometryTypes,
  geometryTypeList,
  initialsFor,
  savedCategoryColors,
  UNCATEGORIZED_COLOR,
  type CommentGeometryTypes,
} from "@/lib/comment-style";


const MapCanvas = lazy(() => import("@/components/map/map-canvas"));

/**
 * Comments publish immediately, so moderation is simply visible vs hidden.
 * The legacy pending/rejected states are folded into those two buckets.
 */
const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "visible", label: "Visible" },
  { id: "hidden", label: "Hidden" },
] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number]["id"];

/** Legacy rejected comments are treated as hidden. */
const isCommentHidden = (status: string) => status === "hidden" || status === "rejected";


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
  source: string | null;
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
        .select(
          "id, body, category, author_name, created_at, lng, lat, status, geometry_type, source",
        )
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CommentRow[];
    },
  });

  const [commentsEnabled, setCommentsEnabled] = useState(false);
  /** Which shapes visitors may leave: points, lines, areas. */
  const [geometryTypes, setGeometryTypes] = useState<CommentGeometryTypes>(ALL_GEOMETRY_TYPES);
  /** Categories are edited one row at a time, like layers. */
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  /** Author overrides keyed by category name; unset names fall back to the palette. */
  const [categoryColorMap, setCategoryColorMap] = useState<Record<string, string>>({});
  /** Whether visitors see where each comment came from. */
  const [sourceVisible, setSourceVisible] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  /** Comment currently open in the edit dialog. */
  const [editing, setEditing] = useState<CommentRow | null>(null);

  useEffect(() => {
    if (!project) return;
    setCommentsEnabled(project.comments_enabled);
    setGeometryTypes(
      commentGeometryTypes(project.embed_config, project.comments_allow_shapes),
    );
    setCategories(project.comment_categories ?? []);
    setCategoryColorMap(savedCategoryColors(project.embed_config));
    setSourceVisible(showCommentSource(project.embed_config));
  }, [project]);


  const categoryList = useMemo(
    () => categories.map((c) => c.trim()).filter(Boolean),
    [categories],
  );

  const addCategory = () => {
    const name = newCategory.trim();
    if (!name || categories.some((c) => c.toLowerCase() === name.toLowerCase())) return;
    setCategories((current) => [...current, name]);
    setNewCategory("");
  };

  const renameCategory = (index: number, name: string) => {
    setCategories((current) => {
      const previous = current[index];
      // Carry the chosen color across the rename so the swatch doesn't reset.
      if (previous && previous !== name) {
        setCategoryColorMap((colors) => {
          if (!(previous in colors)) return colors;
          const next = { ...colors, [name]: colors[previous]! };
          delete next[previous];
          return next;
        });
      }
      return current.map((c, i) => (i === index ? name : c));
    });
  };

  const removeCategory = (index: number) => {
    setCategories((current) => current.filter((_, i) => i !== index));
  };
  const activeColors = useMemo(
    () => categoryColors(categoryList, categoryColorMap),
    [categoryList, categoryColorMap],
  );

  const saveSettings = useMutation({
    mutationFn: async () => {
      const embed = {
        ...((project?.embed_config as Record<string, unknown> | null) ?? {}),
        comment_category_colors: Object.fromEntries(
          categoryList.map((name) => [name, activeColors[name] ?? UNCATEGORIZED_COLOR]),
        ),
        comment_geometry_types: geometryTypeList(geometryTypes),
        show_comment_source: sourceVisible,
      };
      const { error } = await supabase
        .from("projects")
        .update({
          comments_enabled: commentsEnabled,
          // Kept in sync for older readers that only know the single flag.
          comments_allow_shapes: geometryTypes.line || geometryTypes.area,
          comment_categories: categoryList,
          embed_config: embed,
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
    return (comments ?? []).filter((c) => {
      const isHidden = isCommentHidden(c.status);
      const statusOk =
        statusFilter === "all" || (statusFilter === "hidden" ? isHidden : !isHidden);
      return statusOk && (!term || c.body.toLowerCase().includes(term));
    });
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

  // Preview pins match the published map: category color plus author initials.
  const pins = useMemo(
    () =>
      filtered.map((c) => ({
        id: c.id,
        lng: c.lng,
        lat: c.lat,
        color: colorFor(activeColors, c.category),
        initials: initialsFor(c.author_name),
      })),
    [filtered, activeColors],
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
    if (target) {
      const current = mapRef.current?.getView()?.zoom ?? 0;
      mapRef.current?.flyTo(target.lng, target.lat, Math.max(current, 16));
    }
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
          <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
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
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
            {STATUS_FILTERS.map((option) => (
              <Button
                key={option.id}
                type="button"
                size="sm"
                variant={statusFilter === option.id ? "secondary" : "ghost"}
                className="h-7 font-secondary text-xs"
                onClick={() => setStatusFilter(option.id)}
              >
                {option.label}
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
                  isCommentHidden(comment.status) && "opacity-60",
                )}
              >
                <button
                  type="button"
                  onClick={() => select(comment.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold leading-5">
                      {comment.author_name || "Anonymous"}
                    </span>
                    <span
                      className="inline-flex h-5 items-center rounded-full px-2 font-secondary text-[10px] font-medium leading-none"
                      style={{
                        background: `${colorFor(activeColors, comment.category)}26`,
                        color: colorFor(activeColors, comment.category),
                      }}
                    >
                      {categoryLabel(comment.category)}
                    </span>
                    <span className="inline-flex h-5 items-center gap-1 rounded-full border border-border px-2 font-secondary text-[10px] leading-none text-muted-foreground">
                      <ShapeIcon type={comment.geometry_type} />
                      {geometryTag(comment.geometry_type)}
                    </span>
                    {isCommentHidden(comment.status) && (
                      <span className="inline-flex h-5 items-center font-secondary text-[10px] uppercase leading-none tracking-wide text-muted-foreground">
                        Hidden
                      </span>
                    )}
                    <span className="ml-auto font-secondary text-xs leading-5 text-muted-foreground">
                      {new Date(comment.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-1 font-secondary text-sm leading-snug">{comment.body}</p>
                  {comment.source && (
                    <div className="mt-1.5">
                      <span className="inline-flex h-5 items-center rounded-full bg-muted px-2 font-secondary text-[10px] leading-none text-muted-foreground">
                        Source: {comment.source}
                      </span>
                    </div>
                  )}

                </button>
                <div className="flex shrink-0 items-start gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Edit comment"
                    aria-label="Edit comment"
                    onClick={() => setEditing(comment)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    title={isCommentHidden(comment.status) ? "Restore comment" : "Hide comment"}
                    aria-label={isCommentHidden(comment.status) ? "Restore comment" : "Hide comment"}
                    onClick={() =>
                      setStatus.mutate({
                        id: comment.id,
                        status: isCommentHidden(comment.status) ? "approved" : "hidden",
                      })
                    }
                  >
                    {isCommentHidden(comment.status) ? (
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
          <Label htmlFor="show-comment-source" className="font-secondary text-xs">
            Show where each comment came from
          </Label>
          <Switch
            id="show-comment-source"
            checked={sourceVisible}
            onCheckedChange={setSourceVisible}
          />
        </div>
        <div className="space-y-2 rounded-lg border border-border px-3 py-2.5">
          <Label className="font-secondary text-xs">Comment types</Label>
          {(
            [
              { key: "point", label: "Points", icon: MapPin },
              { key: "line", label: "Lines", icon: Spline },
              { key: "area", label: "Polygons", icon: Pentagon },
            ] as const
          ).map((option) => (
            <div key={option.key} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 font-secondary text-xs text-muted-foreground">
                <option.icon className="h-3.5 w-3.5" aria-hidden />
                {option.label}
              </span>
              <Switch
                checked={geometryTypes[option.key]}
                onCheckedChange={(checked) =>
                  setGeometryTypes((current) => ({ ...current, [option.key]: checked }))
                }
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Label>Categories</Label>
          <p className="font-secondary text-xs text-muted-foreground">
            Each category gets its own color for pins, shapes and labels on the published map.
          </p>

          {categories.length > 0 && (
            <div className="space-y-2">
              {categories.map((name, index) => (
                <div key={index} className="space-y-2 rounded-md border border-border p-2">
                  <div className="flex items-center gap-1">
                    <Input
                      value={name}
                      onChange={(e) => renameCategory(index, e.target.value)}
                      placeholder="Category name"
                      className="h-8 flex-1 font-secondary text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      title="Remove category"
                      aria-label={`Remove ${name || "category"}`}
                      onClick={() => removeCategory(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <ColorField
                    label={`${name || "Category"} color`}
                    hideLabel
                    value={colorFor(activeColors, name)}
                    allowTransparent={false}
                    onChange={(color) =>
                      setCategoryColorMap((current) => ({ ...current, [name]: color }))
                    }
                  />
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1">
            <Input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCategory();
                }
              }}
              placeholder="Add a category"
              className="h-8 flex-1 font-secondary text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              disabled={!newCategory.trim()}
              onClick={addCategory}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add
            </Button>
          </div>
          {categories.length === 0 && (
            <p className="font-secondary text-xs text-muted-foreground">
              With no categories, visitors won't see a category picker.
            </p>
          )}
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
      <EditCommentDialog
        comment={editing}
        categories={categoryList}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={() =>
          queryClient.invalidateQueries({ queryKey: ["project-comments", projectId] })
        }
      />
      <ImportCommentsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={projectId}
        categories={categoryList}
        onImported={() => {
          queryClient.invalidateQueries({ queryKey: ["project-comments", projectId] });
          queryClient.invalidateQueries({ queryKey: ["project-layers", projectId] });
        }}
      />

    </div>
  );
}
