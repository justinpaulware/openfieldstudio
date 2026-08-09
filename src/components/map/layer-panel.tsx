import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Crosshair,
  Database,
  Eye,
  EyeOff,
  Folder,
  FolderPlus,
  GripVertical,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Table2,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import type { LayerRow } from "./use-layer-data";

export type FolderRow = Tables<"layer_folders">;

const SOURCE_LABEL: Record<string, string> = {
  geojson_file: "GeoJSON",
  csv_url: "CSV",
  arcgis_rest: "ArcGIS",
};

function relativeTime(iso: string | null): string | null {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diff)) return null;
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

type DragItem = { kind: "layer" | "folder"; id: string };

/** Inline rename field: local while typing, saves once on Enter or blur. */
function NameEditor({
  value,
  editing,
  onStartEdit,
  onCommit,
  onCancel,
  className,
}: {
  value: string;
  editing: boolean;
  onStartEdit: () => void;
  onCommit: (name: string) => void;
  onCancel: () => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(value);
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [editing, value]);

  if (!editing) {
    return (
      <button
        type="button"
        title="Click to rename"
        onClick={(event) => {
          event.stopPropagation();
          onStartEdit();
        }}
        className={cn(
          "w-full truncate rounded px-1 py-0.5 text-left outline-none hover:bg-muted/60",
          className,
        )}
      >
        {value}
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      value={draft}
      autoFocus
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = draft.trim();
        if (next && next !== value) onCommit(next);
        else onCancel();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === "Escape") {
          event.preventDefault();
          setDraft(value);
          onCancel();
        }
      }}
      className={cn(
        "w-full rounded border border-input bg-muted/70 px-1 py-0.5 outline-none ring-2 ring-ring/40",
        className,
      )}
    />
  );
}

type Props = {
  layers: LayerRow[];
  folders: FolderRow[];
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  refreshingId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleVisible: (layer: LayerRow) => void;
  onOpacity: (layer: LayerRow, opacity: number) => void;
  onZoomTo: (layer: LayerRow) => void;
  onRename: (layer: LayerRow, name: string) => void;
  onDelete: (layer: LayerRow) => void;
  onReorder: (orderedIds: string[]) => void;
  onOpenTable: (layer: LayerRow) => void;
  onRefresh: (layer: LayerRow) => void;
  onEditSource: (layer: LayerRow) => void;
  onMoveToFolder: (layer: LayerRow, folderId: string | null) => void;
  onFolderRename: (folder: FolderRow, name: string) => void;
  onFolderToggle: (folder: FolderRow) => void;
  onFolderDelete: (folder: FolderRow) => void;
  onFolderMove: (folder: FolderRow, parentId: string | null) => void;
  onFolderReorder: (orderedIds: string[]) => void;
  onCreateFolder: (parentId: string | null) => void;
};

export function LayerPanel({
  layers,
  folders,
  loading,
  errors,
  refreshingId,
  selectedId,
  onSelect,
  onToggleVisible,
  onOpacity,
  onZoomTo,
  onRename,
  onDelete,
  onReorder,
  onOpenTable,
  onRefresh,
  onEditSource,
  onMoveToFolder,
  onFolderRename,
  onFolderToggle,
  onFolderDelete,
  onFolderMove,
  onFolderReorder,
  onCreateFolder,
}: Props) {
  const [drag, setDrag] = useState<DragItem | null>(null);
  const [dropFolderId, setDropFolderId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const layersIn = (folderId: string | null) => layers.filter((l) => l.folder_id === folderId);
  const childFolders = (parentId: string | null) =>
    folders
      .filter((f) => f.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const reorderFolders = (dragged: FolderRow, target: FolderRow) => {
    const siblings = childFolders(dragged.parent_id);
    const ids = siblings.map((f) => f.id);
    const from = ids.indexOf(dragged.id);
    const to = ids.indexOf(target.id);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0] as string);
    onFolderReorder(ids);
  };

  const handleDropOnLayer = (target: LayerRow) => {
    if (!drag) return;
    if (drag.kind === "folder") {
      const dragged = folders.find((f) => f.id === drag.id);
      setDrag(null);
      if (dragged && dragged.parent_id !== target.folder_id) {
        onFolderMove(dragged, target.folder_id);
      }
      return;
    }
    if (drag.id === target.id) return;
    const dragged = layers.find((l) => l.id === drag.id);
    const ids = layers.map((l) => l.id);
    const from = ids.indexOf(drag.id);
    const to = ids.indexOf(target.id);
    setDrag(null);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0] as string);
    onReorder(ids);
    if (dragged && dragged.folder_id !== target.folder_id) {
      onMoveToFolder(dragged, target.folder_id);
    }
  };

  const handleDropOnFolder = (folderId: string | null) => {
    const current = drag;
    setDrag(null);
    setDropFolderId(null);
    if (!current) return;

    if (current.kind === "layer") {
      const dragged = layers.find((l) => l.id === current.id);
      if (!dragged || dragged.folder_id === folderId) return;
      onMoveToFolder(dragged, folderId);
      return;
    }

    const dragged = folders.find((f) => f.id === current.id);
    if (!dragged || dragged.id === folderId) return;
    const target = folderId ? folders.find((f) => f.id === folderId) : null;

    // Root drop: move to top level (or reorder if already there).
    if (!target) {
      if (dragged.parent_id !== null) onFolderMove(dragged, null);
      return;
    }
    // Never drop into own child.
    if (target.parent_id === dragged.id) return;

    const hasChildren = folders.some((f) => f.parent_id === dragged.id);
    const canNest = !hasChildren && target.parent_id === null;

    if (dragged.parent_id === target.parent_id && !canNest) {
      reorderFolders(dragged, target);
      return;
    }
    if (!canNest) return;
    if (dragged.parent_id === target.id) {
      reorderFolders(dragged, target);
      return;
    }
    onFolderMove(dragged, target.id);
  };

  const renderLayer = (layer: LayerRow, depth: number) => {
    const isSelected = layer.id === selectedId;
    const error = errors[layer.id];
    const updated = relativeTime(layer.last_refreshed_at);
    return (
      <li
        key={layer.id}
        draggable={editing !== layer.id}
        onDragStart={() => setDrag({ kind: "layer", id: layer.id })}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.stopPropagation();
          handleDropOnLayer(layer);
        }}
        onClick={() => onSelect(layer.id)}
        style={{ marginLeft: depth * 12 }}
        className={cn(
          "group cursor-pointer rounded-lg border border-transparent px-2 py-2 transition-colors",
          isSelected ? "border-border bg-muted/60" : "hover:bg-muted/40",
          drag?.kind === "layer" && drag.id === layer.id && "opacity-50",
        )}
      >
        <div className="flex items-center gap-1.5">
          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/60" />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleVisible(layer);
            }}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={layer.visible ? "Hide layer" : "Show layer"}
          >
            {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>

          <div className="min-w-0 flex-1">
            <NameEditor
              value={layer.name}
              editing={editing === layer.id}
              onStartEdit={() => setEditing(layer.id)}
              onCommit={(name) => {
                setEditing(null);
                onRename(layer, name);
              }}
              onCancel={() => setEditing(null)}
              className="text-sm font-medium"
            />
            <div className="mt-0.5 flex items-center gap-1.5 pl-1">
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                {SOURCE_LABEL[layer.source_type] ?? layer.source_type}
              </Badge>
              <span className="font-secondary text-[11px] text-muted-foreground">
                {layer.feature_count.toLocaleString()} features
              </span>
              {updated && (
                <span className="font-secondary text-[11px] text-muted-foreground/70">
                  · {updated}
                </span>
              )}
              {(loading[layer.id] || refreshingId === layer.id) && (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              )}
              {error && <TriangleAlert className="h-3 w-3 text-destructive" />}
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(layer.id)}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onZoomTo(layer)}>
                <Crosshair className="mr-2 h-4 w-4" />
                Zoom to layer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onOpenTable(layer)}>
                <Table2 className="mr-2 h-4 w-4" />
                Attribute table
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onRefresh(layer)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh from source
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEditSource(layer)}>
                <Database className="mr-2 h-4 w-4" />
                Data source…
              </DropdownMenuItem>
              {folders.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  {layer.folder_id && (
                    <DropdownMenuItem onClick={() => onMoveToFolder(layer, null)}>
                      <Folder className="mr-2 h-4 w-4" />
                      Move to top level
                    </DropdownMenuItem>
                  )}
                  {folders
                    .filter((folder) => folder.id !== layer.folder_id)
                    .map((folder) => (
                      <DropdownMenuItem
                        key={folder.id}
                        onClick={() => onMoveToFolder(layer, folder.id)}
                      >
                        <Folder className="mr-2 h-4 w-4" />
                        Move to {folder.name}
                      </DropdownMenuItem>
                    ))}
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(layer)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Remove layer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {isSelected && (
          <div className="mt-2 flex items-center gap-2 pl-6 pr-1">
            <span className="font-secondary text-[11px] text-muted-foreground">Opacity</span>
            <Slider
              value={[Math.round(layer.opacity * 100)]}
              min={0}
              max={100}
              step={5}
              onValueChange={([value]) => onOpacity(layer, (value ?? 100) / 100)}
              onClick={(event) => event.stopPropagation()}
              className="flex-1"
            />
            <span className="w-8 text-right font-secondary text-[11px] text-muted-foreground">
              {Math.round(layer.opacity * 100)}%
            </span>
          </div>
        )}

        {error && isSelected && <p className="mt-2 pl-6 text-xs text-destructive">{error}</p>}
      </li>
    );
  };

  const renderFolder = (folder: FolderRow, depth: number) => {
    const children = childFolders(folder.id);
    const inside = layersIn(folder.id);
    return (
      <li key={folder.id} style={{ marginLeft: depth * 12 }}>
        <div
          draggable={editing !== folder.id}
          onDragStart={(event) => {
            event.stopPropagation();
            setDrag({ kind: "folder", id: folder.id });
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setDropFolderId(folder.id);
          }}
          onDragLeave={() => setDropFolderId((id) => (id === folder.id ? null : id))}
          onDrop={(event) => {
            event.stopPropagation();
            handleDropOnFolder(folder.id);
          }}
          className={cn(
            "flex items-center gap-1 rounded-lg border border-transparent px-1 py-1.5",
            dropFolderId === folder.id ? "border-primary/60 bg-primary/10" : "hover:bg-muted/40",
            drag?.kind === "folder" && drag.id === folder.id && "opacity-50",
          )}
        >
          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/60" />
          <button
            type="button"
            onClick={() => onFolderToggle(folder)}
            className="rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={folder.collapsed ? "Expand folder" : "Collapse folder"}
          >
            {folder.collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </button>
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <NameEditor
              value={folder.name}
              editing={editing === folder.id}
              onStartEdit={() => setEditing(folder.id)}
              onCommit={(name) => {
                setEditing(null);
                onFolderRename(folder, name);
              }}
              onCancel={() => setEditing(null)}
              className="text-sm font-semibold"
            />
          </div>
          <span className="font-secondary text-[11px] text-muted-foreground">{inside.length}</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditing(folder.id)}>
                <Pencil className="mr-2 h-4 w-4" />
                Rename
              </DropdownMenuItem>
              {depth === 0 && (
                <DropdownMenuItem onClick={() => onCreateFolder(folder.id)}>
                  <FolderPlus className="mr-2 h-4 w-4" />
                  New subfolder
                </DropdownMenuItem>
              )}
              {folder.parent_id && (
                <DropdownMenuItem onClick={() => onFolderMove(folder, null)}>
                  <Folder className="mr-2 h-4 w-4" />
                  Move to top level
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onFolderDelete(folder)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {!folder.collapsed && (
          <ul className="space-y-1">
            {children.map((child) => renderFolder(child, depth + 1))}
            {inside.map((layer) => renderLayer(layer, depth + 1))}
            {!children.length && !inside.length && (
              <li
                style={{ marginLeft: (depth + 1) * 12 }}
                className="px-2 py-2 font-secondary text-[11px] text-muted-foreground"
              >
                Drag layers here
              </li>
            )}
          </ul>
        )}
      </li>
    );
  };

  const rootFolders = childFolders(null);
  const rootLayers = layersIn(null);

  if (!layers.length && !folders.length) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          No layers yet. Add a dataset to start building your map.
        </p>
      </div>
    );
  }

  return (
    <ul
      className="min-h-full space-y-1 p-2"
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => handleDropOnFolder(null)}
    >
      {rootFolders.map((folder) => renderFolder(folder, 0))}
      {rootLayers.map((layer) => renderLayer(layer, 0))}
    </ul>
  );
}
