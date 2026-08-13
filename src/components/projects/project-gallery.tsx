import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  Folder,
  FolderPlus,
  Globe2,
  Loader2,
  MapIcon,
  MoreHorizontal,
  Plus,
  Search,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { StatusChip } from "@/components/status-chip";
import { uniqueProjectSlug } from "@/lib/slug";
import { useMyProfile } from "@/hooks/use-profile";
import { signThumbnails } from "@/lib/thumbnails";
import { cn } from "@/lib/utils";

export type GalleryProject = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  published_slug: string | null;
  tags: string[];
  status: "draft" | "published" | "archived";
  updated_at: string;
  folder_id: string | null;
  thumbnail_url: string | null;
};

export type GalleryFolder = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
};

type DragItem = { kind: "project" | "folder"; id: string };

export function ProjectGallery({ mode }: { mode: "all" | "published" }) {
  const { data: myProfile } = useMyProfile();
  const publicPath = (project: GalleryProject) =>
    myProfile?.username ? `/${myProfile.username}/${project.published_slug ?? project.slug}` : null;
  const queryClient = useQueryClient();
  const publishedOnly = mode === "published";

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const dragRef = useRef<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const { data: folders } = useQuery({
    queryKey: ["project-folders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_folders")
        .select("id, name, parent_id, sort_order")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as GalleryFolder[];
    },
  });

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select(
          "id, title, description, slug, published_slug, tags, status, updated_at, folder_id, thumbnail_url",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as GalleryProject[];
    },
  });

  const scoped = useMemo(
    () => (projects ?? []).filter((p) => (publishedOnly ? p.status === "published" : true)),
    [projects, publishedOnly],
  );

  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!scoped.length) return;
    let cancelled = false;
    signThumbnails(scoped).then((map) => {
      if (!cancelled) setThumbs(map);
    });
    return () => {
      cancelled = true;
    };
  }, [scoped]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["projects"] });
    queryClient.invalidateQueries({ queryKey: ["project-folders"] });
  };

  const breadcrumbs = useMemo(() => {
    const trail: GalleryFolder[] = [];
    let current = folders?.find((f) => f.id === folderId) ?? null;
    while (current) {
      trail.unshift(current);
      const parentId: string | null = current.parent_id;
      current = parentId ? (folders?.find((f) => f.id === parentId) ?? null) : null;
    }
    return trail;
  }, [folders, folderId]);

  const childFolders = useMemo(
    () => (folders ?? []).filter((f) => (f.parent_id ?? null) === folderId),
    [folders, folderId],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scoped.filter(
      (p) =>
        (p.folder_id ?? null) === folderId &&
        (publishedOnly || status === "all" || p.status === status) &&
        (q === "" ||
          p.title.toLowerCase().includes(q) ||
          (p.description ?? "").toLowerCase().includes(q)),
    );
  }, [scoped, search, status, folderId, publishedOnly]);

  const createProject = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const slug = await uniqueProjectSlug(auth.user.id, title);
      const { error } = await supabase.from("projects").insert({
        owner_id: auth.user.id,
        title: title.trim(),
        description: description.trim() || null,
        slug,
        published_slug: slug,
        folder_id: folderId,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project created.");
      setOpen(false);
      setTitle("");
      setDescription("");
      setTags("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createFolder = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase.from("project_folders").insert({
        owner_id: auth.user.id,
        name: "New folder",
        parent_id: folderId,
        sort_order: (folders?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const renameFolder = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("project_folders").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("projects").update({ folder_id: null }).eq("folder_id", id);
      await supabase.from("project_folders").update({ parent_id: null }).eq("parent_id", id);
      const { error } = await supabase.from("project_folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Folder deleted.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const moveProject = useMutation({
    mutationFn: async ({ id, target }: { id: string; target: string | null }) => {
      const { error } = await supabase.from("projects").update({ folder_id: target }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const moveFolder = useMutation({
    mutationFn: async ({ id, parent }: { id: string; parent: string | null }) => {
      const { error } = await supabase
        .from("project_folders")
        .update({ parent_id: parent })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const duplicate = useMutation({
    mutationFn: async (project: GalleryProject) => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const copyTitle = `${project.title} (copy)`;
      const slug = await uniqueProjectSlug(auth.user.id, copyTitle);
      const { error } = await supabase.from("projects").insert({
        owner_id: auth.user.id,
        title: copyTitle,
        description: project.description,
        slug,
        published_slug: slug,
        tags: project.tags,
        folder_id: project.folder_id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project duplicated.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatusMutation = useMutation({
    mutationFn: async ({ id, next }: { id: string; next: GalleryProject["status"] }) => {
      const { error } = await supabase.from("projects").update({ status: next }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Project deleted.");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isDescendant = (folder: string, maybeParent: string) => {
    let current = folders?.find((f) => f.id === folder) ?? null;
    while (current?.parent_id) {
      if (current.parent_id === maybeParent) return true;
      current = folders?.find((f) => f.id === current?.parent_id) ?? null;
    }
    return false;
  };

  const dropInto = (target: string | null) => {
    const item = dragRef.current;
    dragRef.current = null;
    setDropTarget(null);
    if (!item) return;
    if (item.kind === "project") {
      moveProject.mutate({ id: item.id, target });
      return;
    }
    if (item.id === target) return;
    if (target && isDescendant(target, item.id)) return;
    moveFolder.mutate({ id: item.id, parent: target });
  };

  const countIn = (id: string) => scoped.filter((p) => p.folder_id === id).length;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {publishedOnly ? "Published maps" : "Projects"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {publishedOnly
              ? "Your live, shareable webmaps — organized in the same folders as your projects."
              : "Each project becomes a webmap you can style and publish."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => createFolder.mutate()}>
            <FolderPlus className="mr-2 h-4 w-4" />
            New folder
          </Button>
          {!publishedOnly && (
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New project
            </Button>
          )}
        </div>
      </div>

      <nav className="mt-5 flex flex-wrap items-center gap-1 font-secondary text-xs text-muted-foreground">
        <button
          type="button"
          onClick={() => setFolderId(null)}
          onDragOver={(e) => {
            e.preventDefault();
            setDropTarget("root");
          }}
          onDragLeave={() => setDropTarget(null)}
          onDrop={() => dropInto(null)}
          className={cn(
            "rounded px-2 py-1 hover:bg-secondary hover:text-foreground",
            !folderId && "text-foreground",
            dropTarget === "root" && "bg-primary/15 text-foreground",
          )}
        >
          {publishedOnly ? "All published" : "All projects"}
        </button>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            <button
              type="button"
              onClick={() => setFolderId(crumb.id)}
              className="rounded px-2 py-1 hover:bg-secondary hover:text-foreground"
            >
              {crumb.name}
            </button>
          </span>
        ))}
      </nav>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={publishedOnly ? "Search published maps" : "Search projects"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {!publishedOnly && (
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {childFolders.length > 0 && (
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {childFolders.map((folder) => (
            <li
              key={folder.id}
              draggable
              onDragStart={() => {
                dragRef.current = { kind: "folder", id: folder.id };
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDropTarget(folder.id);
              }}
              onDragLeave={() => setDropTarget((v) => (v === folder.id ? null : v))}
              onDrop={() => dropInto(folder.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5",
                dropTarget === folder.id && "bg-primary/10",
              )}
            >
              <button
                type="button"
                onClick={() => setFolderId(folder.id)}
                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
              >
                <Folder className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate text-sm font-medium">{folder.name}</span>
                <span className="font-secondary text-xs text-muted-foreground">
                  ({countIn(folder.id)})
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Folder actions">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onSelect={() => {
                      const name = prompt("Folder name", folder.name);
                      if (name?.trim()) renameFolder.mutate({ id: folder.id, name: name.trim() });
                    }}
                  >
                    Rename
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => {
                      if (confirm(`Delete "${folder.name}"? Its maps move back to the top level.`))
                        deleteFolder.mutate(folder.id);
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          ))}
        </ul>
      )}

      {isLoading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          {publishedOnly ? (
            <Globe2 className="mx-auto h-8 w-8 text-muted-foreground" />
          ) : (
            <MapIcon className="mx-auto h-8 w-8 text-muted-foreground" />
          )}
          <h2 className="mt-4 text-lg font-semibold">
            {publishedOnly ? "Nothing published here yet" : "No projects here yet"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
            {publishedOnly
              ? "Publish a map from its Publish tab and it will show up here."
              : "A project holds your datasets, styling and the map you publish."}
          </p>
          {!publishedOnly && (
            <Button className="mt-6" onClick={() => setOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New project
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((project) => (
            <div
              key={project.id}
              draggable
              onDragStart={() => {
                dragRef.current = { kind: "project", id: project.id };
              }}
              className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)]"
            >
              <Link
                to="/projects/$projectSlug"
                params={{ projectSlug: project.slug }}
                className="flex h-28 items-center justify-center overflow-hidden bg-secondary"
              >
                {thumbs[project.id] ? (
                  <img
                    src={thumbs[project.id]}
                    alt={`Map preview for ${project.title}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <MapIcon className="h-6 w-6 text-muted-foreground" />
                )}
              </Link>
              <div className="flex flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/projects/$projectSlug"
                    params={{ projectSlug: project.slug }}
                    className="font-medium leading-tight hover:underline"
                  >
                    {project.title}
                  </Link>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Project actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {project.status === "published" && publicPath(project) && (
                        <DropdownMenuItem asChild>
                          <a href={publicPath(project)!} target="_blank" rel="noreferrer">
                            Open live map
                          </a>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={() => duplicate.mutate(project)}>
                        Duplicate
                      </DropdownMenuItem>
                      {project.folder_id && (
                        <DropdownMenuItem
                          onSelect={() => moveProject.mutate({ id: project.id, target: null })}
                        >
                          Move to top level
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onSelect={() =>
                          setStatusMutation.mutate({
                            id: project.id,
                            next: project.status === "archived" ? "draft" : "archived",
                          })
                        }
                      >
                        {project.status === "archived" ? "Restore to draft" : "Archive"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => {
                          if (confirm(`Delete "${project.title}"? This can't be undone.`)) {
                            remove.mutate(project.id);
                          }
                        }}
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                {publishedOnly && publicPath(project) ? (
                  <a
                    href={publicPath(project)!}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 truncate font-secondary text-xs text-muted-foreground hover:text-foreground"
                  >
                    {publicPath(project)}
                  </a>
                ) : (
                  project.description && (
                    <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                      {project.description}
                    </p>
                  )
                )}
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {project.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between pt-1">
                  <StatusChip status={project.status} />
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(project.updated_at), { addSuffix: true })}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New project</DialogTitle>
            <DialogDescription>
              Give your map a name. You can change everything later.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="project-title">Title</Label>
              <Input
                id="project-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Downtown bike network"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What this map shows and who it's for."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-tags">Tags</Label>
              <Input
                id="project-tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="transportation, planning"
              />
              <p className="text-xs text-muted-foreground">Separate tags with commas.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createProject.mutate()}
              disabled={!title.trim() || createProject.isPending}
            >
              {createProject.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
