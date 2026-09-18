import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useRouter, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Folder,
  FolderPlus,
  Globe2,
  GripVertical,
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
import { MoveToFolderDialog } from "./move-to-folder-dialog";

export type GalleryProject = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  published_slug: string | null;
  tags: string[];
  status: "draft" | "published" | "archived";
  updated_at: string;
  created_at: string;
  sort_order: number;
  folder_id: string | null;
  thumbnail_url: string | null;
};

export type GalleryFolder = {
  id: string;
  name: string;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

type SortKey = "name" | "updated" | "created" | "status" | "custom";
type DragItem = { kind: "project" | "folder"; id: string };
type DropSpot = { id: string; position: "before" | "after" };
type MoveTargetItem = { kind: "project" | "folder"; id: string; name: string; parent: string | null };

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  updated: "Date updated",
  created: "Date created",
  status: "Status",
  custom: "Custom order",
};

const STATUS_RANK: Record<GalleryProject["status"], number> = {
  published: 0,
  draft: 1,
  archived: 2,
};

export function ProjectGallery({ mode }: { mode: "all" | "published" }) {
  const { data: myProfile } = useMyProfile();
  const publicPath = (project: GalleryProject) =>
    myProfile?.username ? `/${myProfile.username}/${project.published_slug ?? project.slug}` : null;
  const queryClient = useQueryClient();
  const publishedOnly = mode === "published";

  const router = useRouter();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as {
    folder?: string;
    sort?: SortKey;
    dir?: "asc" | "desc";
  };
  const folderId = search.folder ?? null;
  const sortKey: SortKey = search.sort ?? "updated";
  const sortDir: "asc" | "desc" = search.dir ?? "desc";
  const [forwardDepth, setForwardDepth] = useState(0);

  const goTo = (next: { folder?: string | null; sort?: SortKey; dir?: "asc" | "desc" }) => {
    setForwardDepth(0);
    const folder = next.folder === undefined ? folderId : next.folder;
    navigate({
      to: "/projects",
      search: {
        ...(folder ? { folder } : {}),
        sort: next.sort ?? sortKey,
        dir: next.dir ?? sortDir,
      },
    });
  };

  const [searchText, setSearchText] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const dragRef = useRef<DragItem | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [insertBefore, setInsertBefore] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTargetItem | null>(null);

  const { data: folders } = useQuery({
    queryKey: ["project-folders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_folders")
        .select("id, name, parent_id, sort_order, created_at, updated_at")
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
          "id, title, description, slug, published_slug, tags, status, updated_at, created_at, sort_order, folder_id, thumbnail_url",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as GalleryProject[];
    },
  });

  const allFolders = useMemo(() => folders ?? [], [folders]);

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
    let current = allFolders.find((f) => f.id === folderId) ?? null;
    while (current) {
      trail.unshift(current);
      const parentId: string | null = current.parent_id;
      current = parentId ? (allFolders.find((f) => f.id === parentId) ?? null) : null;
    }
    return trail;
  }, [allFolders, folderId]);

  const query = searchText.trim().toLowerCase();
  const searching = query.length > 0;

  const counts = useMemo(() => {
    const map = new Map<string, { folders: number; projects: number }>();
    const ensure = (id: string) => {
      const existing = map.get(id);
      if (existing) return existing;
      const created = { folders: 0, projects: 0 };
      map.set(id, created);
      return created;
    };
    allFolders.forEach((f) => {
      ensure(f.id);
      if (f.parent_id) ensure(f.parent_id).folders += 1;
    });
    scoped.forEach((p) => {
      if (p.folder_id) ensure(p.folder_id).projects += 1;
    });
    return map;
  }, [allFolders, scoped]);

  const describeFolder = (id: string) => {
    const c = counts.get(id) ?? { folders: 0, projects: 0 };
    const parts: string[] = [];
    if (c.folders) parts.push(`${c.folders} ${c.folders === 1 ? "folder" : "folders"}`);
    if (c.projects) parts.push(`${c.projects} ${c.projects === 1 ? "project" : "projects"}`);
    return parts.length ? parts.join(" · ") : "Empty";
  };

  const sortFolders = (list: GalleryFolder[]) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "custom":
          return a.sort_order - b.sort_order || a.name.localeCompare(b.name);
        case "created":
          return (Date.parse(a.created_at) - Date.parse(b.created_at)) * dir;
        case "updated":
          return (Date.parse(a.updated_at) - Date.parse(b.updated_at)) * dir;
        case "name":
        case "status":
        default:
          return a.name.localeCompare(b.name) * (sortKey === "name" ? dir : 1);
      }
    });
    return sorted;
  };

  const sortProjects = (list: GalleryProject[]) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "custom":
          return a.sort_order - b.sort_order || a.title.localeCompare(b.title);
        case "name":
          return a.title.localeCompare(b.title) * dir;
        case "created":
          return (Date.parse(a.created_at) - Date.parse(b.created_at)) * dir;
        case "status":
          return (STATUS_RANK[a.status] - STATUS_RANK[b.status]) * dir;
        case "updated":
        default:
          return (Date.parse(a.updated_at) - Date.parse(b.updated_at)) * dir;
      }
    });
    return sorted;
  };

  const visibleFolders = useMemo(() => {
    const base = searching
      ? allFolders.filter((f) => f.name.toLowerCase().includes(query))
      : allFolders.filter((f) => (f.parent_id ?? null) === folderId);
    return sortFolders(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allFolders, folderId, query, searching, sortKey, sortDir]);

  const visibleProjects = useMemo(() => {
    const base = scoped.filter(
      (p) =>
        (publishedOnly || status === "all" || p.status === status) &&
        (searching
          ? p.title.toLowerCase().includes(query) ||
            (p.description ?? "").toLowerCase().includes(query)
          : (p.folder_id ?? null) === folderId),
    );
    return sortProjects(base);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoped, status, folderId, query, searching, publishedOnly, sortKey, sortDir]);

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
        sort_order: allFolders.length + 1,
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

  const reorder = useMutation({
    mutationFn: async ({ table, ids }: { table: "projects" | "project_folders"; ids: string[] }) => {
      await Promise.all(
        ids.map((id, index) => supabase.from(table).update({ sort_order: index }).eq("id", id)),
      );
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


  const folderName = (id: string | null) =>
    id ? (allFolders.find((f) => f.id === id)?.name ?? "a folder") : "All projects";

  const applyMove = (item: MoveTargetItem, target: string | null) => {
    if (item.parent === target) return;
    const undo = () => {
      if (item.kind === "project") moveProject.mutate({ id: item.id, target: item.parent });
      else moveFolder.mutate({ id: item.id, parent: item.parent });
    };
    if (item.kind === "project") moveProject.mutate({ id: item.id, target });
    else moveFolder.mutate({ id: item.id, parent: target });
    toast.success(`Moved “${item.name}” to ${folderName(target)}.`, {
      action: { label: "Undo", onClick: undo },
    });
  };

  const isDescendant = (folder: string, maybeParent: string) => {
    let current = allFolders.find((f) => f.id === folder) ?? null;
    while (current?.parent_id) {
      if (current.parent_id === maybeParent) return true;
      const parentId: string = current.parent_id;
      current = allFolders.find((f) => f.id === parentId) ?? null;
    }
    return false;
  };

  const clearDrag = () => {
    dragRef.current = null;
    setDropTarget(null);
    setInsertBefore(null);
  };

  const dropInto = (target: string | null) => {
    const item = dragRef.current;
    clearDrag();
    if (!item || item.mode !== "move") return;
    if (item.kind === "project") {
      const project = scoped.find((p) => p.id === item.id);
      if (!project) return;
      applyMove(
        { kind: "project", id: project.id, name: project.title, parent: project.folder_id },
        target,
      );
      return;
    }
    if (item.id === target) return;
    if (target && isDescendant(target, item.id)) {
      toast.error("A folder can't be moved inside itself.");
      return;
    }
    const folder = allFolders.find((f) => f.id === item.id);
    if (!folder) return;
    applyMove({ kind: "folder", id: folder.id, name: folder.name, parent: folder.parent_id }, target);
  };

  const dropReorder = (beforeId: string) => {
    const item = dragRef.current;
    clearDrag();
    if (!item || item.mode !== "reorder" || item.id === beforeId) return;
    if (item.kind === "folder") {
      const ids = visibleFolders.map((f) => f.id).filter((id) => id !== item.id);
      const at = ids.indexOf(beforeId);
      ids.splice(at < 0 ? ids.length : at, 0, item.id);
      reorder.mutate({ table: "project_folders", ids });
    } else {
      const ids = visibleProjects.map((p) => p.id).filter((id) => id !== item.id);
      const at = ids.indexOf(beforeId);
      ids.splice(at < 0 ? ids.length : at, 0, item.id);
      reorder.mutate({ table: "projects", ids });
    }
  };

  const canReorder = sortKey === "custom" && !searching;
  const parentId = breadcrumbs[breadcrumbs.length - 1]?.parent_id ?? null;
  const canGoBack = router.history.canGoBack();

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

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Back"
            disabled={!canGoBack}
            onClick={() => {
              setForwardDepth((n) => n + 1);
              router.history.back();
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Forward"
            disabled={forwardDepth === 0}
            onClick={() => {
              setForwardDepth((n) => Math.max(0, n - 1));
              router.history.forward();
            }}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Up one level"
            disabled={!folderId}
            onClick={() => goTo({ folder: parentId })}
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
        </div>

        <nav className="flex flex-wrap items-center gap-1 font-secondary text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => goTo({ folder: null })}
            onDragOver={(e) => {
              e.preventDefault();
              setDropTarget("root");
            }}
            onDragLeave={() => setDropTarget(null)}
            onDrop={() => dropInto(null)}
            className={cn(
              "rounded px-2 py-1 hover:bg-secondary hover:text-foreground",
              !folderId && "text-foreground",
              dropTarget === "root" && "bg-primary/15 text-foreground ring-1 ring-primary",
            )}
          >
            {publishedOnly ? "All published" : "All projects"}
          </button>
          {breadcrumbs.map((crumb) => (
            <span key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="h-3 w-3" />
              <button
                type="button"
                onClick={() => goTo({ folder: crumb.id })}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDropTarget(`crumb-${crumb.id}`);
                }}
                onDragLeave={() =>
                  setDropTarget((v) => (v === `crumb-${crumb.id}` ? null : v))
                }
                onDrop={() => dropInto(crumb.id)}
                className={cn(
                  "rounded px-2 py-1 hover:bg-secondary hover:text-foreground",
                  dropTarget === `crumb-${crumb.id}` && "bg-primary/15 text-foreground ring-1 ring-primary",
                )}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </nav>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={publishedOnly ? "Search published maps" : "Search projects and folders"}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <Select
          value={`${sortKey}:${sortDir}`}
          onValueChange={(value) => {
            const [key, dir] = value.split(":") as [SortKey, "asc" | "desc"];
            goTo({ sort: key, dir });
          }}
        >
          <SelectTrigger className="w-52">
            <ArrowUpDown className="mr-2 h-4 w-4 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name:asc">{SORT_LABELS.name} (A–Z)</SelectItem>
            <SelectItem value="name:desc">{SORT_LABELS.name} (Z–A)</SelectItem>
            <SelectItem value="updated:desc">{SORT_LABELS.updated} (newest)</SelectItem>
            <SelectItem value="updated:asc">{SORT_LABELS.updated} (oldest)</SelectItem>
            <SelectItem value="created:desc">{SORT_LABELS.created} (newest)</SelectItem>
            <SelectItem value="created:asc">{SORT_LABELS.created} (oldest)</SelectItem>
            <SelectItem value="status:asc">{SORT_LABELS.status}</SelectItem>
            <SelectItem value="custom:asc">{SORT_LABELS.custom}</SelectItem>
          </SelectContent>
        </Select>
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

      {visibleFolders.length > 0 && (
        <>
          {searching && (
            <p className="mt-6 font-secondary text-xs uppercase tracking-wide text-muted-foreground">
              Folders
            </p>
          )}
          <ul
            className={cn(
              "divide-y divide-border overflow-hidden rounded-xl border border-border bg-card",
              searching ? "mt-2" : "mt-6",
            )}
          >
            {visibleFolders.map((folder) => (
              <li
                key={folder.id}
                draggable
                onDragStart={() => {
                  dragRef.current = { kind: "folder", id: folder.id, mode: "move" };
                }}
                onDragEnd={clearDrag}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragRef.current?.mode === "reorder") setInsertBefore(folder.id);
                  else setDropTarget(folder.id);
                }}
                onDragLeave={() => {
                  setDropTarget((v) => (v === folder.id ? null : v));
                  setInsertBefore((v) => (v === folder.id ? null : v));
                }}
                onDrop={() =>
                  dragRef.current?.mode === "reorder" ? dropReorder(folder.id) : dropInto(folder.id)
                }
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5",
                  dropTarget === folder.id && "bg-primary/10 ring-1 ring-inset ring-primary",
                  insertBefore === folder.id && "border-t-2 border-t-primary",
                )}
              >
                {canReorder && (
                  <span
                    draggable
                    onDragStart={(e) => {
                      e.stopPropagation();
                      dragRef.current = { kind: "folder", id: folder.id, mode: "reorder" };
                    }}
                    className="cursor-grab text-muted-foreground"
                    aria-hidden
                  >
                    <GripVertical className="h-4 w-4" />
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => goTo({ folder: folder.id })}
                  className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                >
                  <Folder className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate text-sm font-medium">{folder.name}</span>
                  <span className="font-secondary text-xs text-muted-foreground">
                    {describeFolder(folder.id)}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      aria-label="Folder actions"
                    >
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
                    <DropdownMenuItem
                      onSelect={() =>
                        setMoveTarget({
                          kind: "folder",
                          id: folder.id,
                          name: folder.name,
                          parent: folder.parent_id,
                        })
                      }
                    >
                      Move to folder…
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
        </>
      )}

      {isLoading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : visibleProjects.length === 0 ? (
        visibleFolders.length > 0 ? null : (
          <div className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
            {publishedOnly ? (
              <Globe2 className="mx-auto h-8 w-8 text-muted-foreground" />
            ) : (
              <MapIcon className="mx-auto h-8 w-8 text-muted-foreground" />
            )}
            <h2 className="mt-4 text-lg font-semibold">
              {searching
                ? "Nothing matches your search"
                : publishedOnly
                  ? "Nothing published here yet"
                  : "No projects here yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              {searching
                ? "Try a different word, or clear the search to browse your folders."
                : publishedOnly
                  ? "Publish a map from its Publish tab and it will show up here."
                  : "A project holds your datasets, styling and the map you publish."}
            </p>
            {!publishedOnly && !searching && (
              <Button className="mt-6" onClick={() => setOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                New project
              </Button>
            )}
          </div>
        )
      ) : (
        <>
          {searching && (
            <p className="mt-6 font-secondary text-xs uppercase tracking-wide text-muted-foreground">
              Projects
            </p>
          )}
          <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", searching ? "mt-2" : "mt-6")}>
            {visibleProjects.map((project) => (
              <div
                key={project.id}
                draggable
                onDragStart={() => {
                  dragRef.current = { kind: "project", id: project.id, mode: "move" };
                }}
                onDragEnd={clearDrag}
                onDragOver={(e) => {
                  if (dragRef.current?.mode !== "reorder") return;
                  e.preventDefault();
                  setInsertBefore(project.id);
                }}
                onDrop={() => {
                  if (dragRef.current?.mode === "reorder") dropReorder(project.id);
                }}
                className={cn(
                  "group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)]",
                  insertBefore === project.id && "ring-2 ring-primary",
                )}
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
                    <div className="flex min-w-0 items-start gap-2">
                      {canReorder && (
                        <span
                          draggable
                          onDragStart={(e) => {
                            e.stopPropagation();
                            dragRef.current = { kind: "project", id: project.id, mode: "reorder" };
                          }}
                          className="mt-0.5 cursor-grab text-muted-foreground"
                          aria-hidden
                        >
                          <GripVertical className="h-4 w-4" />
                        </span>
                      )}
                      <Link
                        to="/projects/$projectSlug"
                        params={{ projectSlug: project.slug }}
                        className="font-medium leading-tight hover:underline"
                      >
                        {project.title}
                      </Link>
                    </div>
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
                        <DropdownMenuItem
                          onSelect={() =>
                            setMoveTarget({
                              kind: "project",
                              id: project.id,
                              name: project.title,
                              parent: project.folder_id,
                            })
                          }
                        >
                          Move to folder…
                        </DropdownMenuItem>
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
        </>
      )}

      {moveTarget && (
        <MoveToFolderDialog
          open
          onOpenChange={(next) => {
            if (!next) setMoveTarget(null);
          }}
          folders={allFolders}
          currentParent={moveTarget.parent}
          movingFolderId={moveTarget.kind === "folder" ? moveTarget.id : null}
          itemName={moveTarget.name}
          onMove={(target) => applyMove(moveTarget, target)}
        />
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
