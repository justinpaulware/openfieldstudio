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

/**
 * Flatten layers into the exact top-to-bottom order the sidebar renders:
 * root folders (with their subfolders and layers) first, then top-level layers.
 * The map uses this so draw order always matches the sidebar.
 */
export function flattenLayerOrder(layers: LayerRow[], folders: FolderRow[]): LayerRow[] {
  const sortedFolders = (parentId: string | null) =>
    folders
      .filter((f) => f.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));
  const layersIn = (folderId: string | null) => layers.filter((l) => l.folder_id === folderId);

  const out: LayerRow[] = [];
  const walk = (folderId: string) => {
    for (const child of sortedFolders(folderId)) walk(child.id);
    out.push(...layersIn(folderId));
  };
  for (const folder of sortedFolders(null)) walk(folder.id);
  out.push(...layersIn(null));

  const seen = new Set(out.map((l) => l.id));
  for (const layer of layers) if (!seen.has(layer.id)) out.push(layer);
  return out;
}

const SOURCE_LABEL: Record<string, string> = {
  geojson_file: "GeoJSON",
  csv_url: "CSV",
  arcgis_rest: "ArcGIS",
};

type StyleRow = Tables<"layer_styles">;
export type PanelLayer = LayerRow & { layer_styles?: StyleRow[] | null };

const SYMBOL_DEFAULTS = {
  fillColor: "#f5c518",
  strokeColor: "#1b1d22",
  strokeWidth: 1,
  fillOpacity: 0.55,
};

/** Legend swatch mirroring how the layer draws on the map. */
function LayerSymbol({ layer }: { layer: PanelLayer }) {
  const style = layer.layer_styles?.[0];
  const fill = style?.fill_color ?? SYMBOL_DEFAULTS.fillColor;
  const stroke = style?.stroke_color ?? SYMBOL_DEFAULTS.strokeColor;
  const strokeWidth = style?.stroke_width ?? SYMBOL_DEFAULTS.strokeWidth;
  const fillOpacity = style?.fill_opacity ?? SYMBOL_DEFAULTS.fillOpacity;
  const geom = (layer.geometry_type ?? "").toLowerCase();
  const kind = geom.includes("point") ? "point" : geom.includes("line") ? "line" : "polygon";

  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center"
      style={{ opacity: layer.opacity }}
      aria-hidden="true"
    >
      <svg width="16" height="16" viewBox="0 0 16 16">
        {kind === "point" && (
          <circle
            cx="8"
            cy="8"
            r="4.5"
            fill={fill}
            fillOpacity={1}
            stroke={stroke}
            strokeWidth={Math.min(strokeWidth, 2)}
          />
        )}
        {kind === "line" && (
          <path
            d="M1.5 11.5 L6 5.5 L10 10 L14.5 4.5"
            fill="none"
            stroke={stroke}
            strokeWidth={Math.max(1.5, Math.min(strokeWidth, 3))}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {kind === "polygon" && (
          <rect
            x="2"
            y="3.5"
            width="12"
            height="9"
            rx="2"
            fill={fill}
            fillOpacity={fillOpacity}
            stroke={stroke}
            strokeWidth={Math.min(strokeWidth, 2)}
          />
        )}
      </svg>
    </span>
  );
}

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
type DropPos = "before" | "after" | "inside";
type DropTarget = { kind: "layer" | "folder" | "root"; id: string | null; position: DropPos };

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
  const openedAtRef = useRef(0);
  const draftRef = useRef(value);
  draftRef.current = draft;

  const finish = () => {
    const next = draftRef.current.trim();
    if (next && next !== value) onCommit(next);
    else onCancel();
  };
  const finishRef = useRef(finish);
  finishRef.current = finish;

  useEffect(() => {
    if (!editing) return undefined;
    openedAtRef.current = Date.now();
    setDraft(value);
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    const onPointerDown = (event: PointerEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        finishRef.current();
      }
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown, true);
    };
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
      onClick={(event) => event.stopPropagation()}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        // Ignore the focus bounce that happens right as the dropdown closes.
        if (Date.now() - openedAtRef.current < 250) return;
        finish();
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
  layers: PanelLayer[];
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
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const beginEdit = (id: string) => {
    // Wait for the dropdown to finish closing before focusing the input.
    requestAnimationFrame(() => requestAnimationFrame(() => setEditing(id)));
  };

  const clearDrag = () => {
    setDrag(null);
    setDropTarget(null);
  };

  const layersIn = (folderId: string | null) => layers.filter((l) => l.folder_id === folderId);
  const childFolders = (parentId: string | null) =>
    folders
      .filter((f) => f.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name));

  const isDescendant = (folderId: string, maybeAncestorId: string): boolean => {
    let current = folders.find((f) => f.id === folderId);
    while (current?.parent_id) {
      if (current.parent_id === maybeAncestorId) return true;
      current = folders.find((f) => f.id === current!.parent_id);
    }
    return false;
  };

  const positionFrom = (event: React.DragEvent, allowInside: boolean): DropPos => {
    const rect = event.currentTarget.getBoundingClientRect();
    const offset = event.clientY - rect.top;
    if (allowInside) {
      if (offset < rect.height * 0.3) return "before";
      if (offset > rect.height * 0.7) return "after";
      return "inside";
    }
    return offset < rect.height / 2 ? "before" : "after";
  };

  const showLine = (kind: "layer" | "folder" | "root", id: string | null, position: DropPos) =>
    !!drag &&
    !!dropTarget &&
    dropTarget.kind === kind &&
    dropTarget.id === id &&
    dropTarget.position === position;

  const DropLine = ({ visible, side }: { visible: boolean; side: "top" | "bottom" }) =>
    visible ? (
      <div
        className={cn(
          "pointer-events-none absolute left-1 right-1 z-10 h-0.5 rounded-full bg-primary",
          side === "top" ? "-top-px" : "-bottom-px",
        )}
      />
    ) : null;

  /** Place a layer next to `target` (or at the end of `container` when null). */
  const placeLayer = (
    dragged: LayerRow,
    container: string | null,
    target: LayerRow | null,
    position: DropPos,
  ) => {
    const ids = layers.map((l) => l.id);
    const from = ids.indexOf(dragged.id);
    if (from < 0) return;
    ids.splice(from, 1);
    let to = target ? ids.indexOf(target.id) : ids.length;
    if (to < 0) to = ids.length;
    else if (position === "after") to += 1;
    ids.splice(to, 0, dragged.id);
    onReorder(ids);
    if (dragged.folder_id !== container) onMoveToFolder(dragged, container);
  };

  /** Place a folder among the children of `parentId`. */
  const placeFolder = (
    dragged: FolderRow,
    parentId: string | null,
    target: FolderRow | null,
    position: DropPos,
  ) => {
    if (dragged.id === parentId) return;
    if (parentId && isDescendant(parentId, dragged.id)) return;
    // Nesting stays one level deep.
    if (parentId) {
      const parent = folders.find((f) => f.id === parentId);
      if (!parent || parent.parent_id !== null) return;
      if (folders.some((f) => f.parent_id === dragged.id)) return;
    }
    if (dragged.parent_id !== parentId) onFolderMove(dragged, parentId);
    const siblings = childFolders(parentId)
      .map((f) => f.id)
      .filter((id) => id !== dragged.id);
    let to = target && target.id !== dragged.id ? siblings.indexOf(target.id) : siblings.length;
    if (to < 0) to = siblings.length;
    else if (position === "after") to += 1;
    siblings.splice(to, 0, dragged.id);
    onFolderReorder(siblings);
  };

  const commitDrop = (target: DropTarget) => {
    const current = drag;
    clearDrag();
    if (!current) return;

    if (current.kind === "layer") {
      const dragged = layers.find((l) => l.id === current.id);
      if (!dragged) return;
      if (target.kind === "layer") {
        const row = layers.find((l) => l.id === target.id);
        if (!row || row.id === dragged.id) return;
        placeLayer(dragged, row.folder_id, row, target.position);
        return;
      }
      if (target.kind === "folder") {
        const folder = folders.find((f) => f.id === target.id);
        if (!folder) return;
        if (target.position === "inside") {
          if (dragged.folder_id !== folder.id) onMoveToFolder(dragged, folder.id);
          return;
        }
        placeLayer(dragged, folder.parent_id, null, target.position);
        return;
      }
      placeLayer(dragged, null, null, "after");
      return;
    }

    const dragged = folders.find((f) => f.id === current.id);
    if (!dragged) return;
    if (target.kind === "layer") {
      const row = layers.find((l) => l.id === target.id);
      if (!row) return;
      placeFolder(dragged, row.folder_id, null, "after");
      return;
    }
    if (target.kind === "folder") {
      const folder = folders.find((f) => f.id === target.id);
      if (!folder || folder.id === dragged.id) return;
      if (target.position === "inside") {
        placeFolder(dragged, folder.id, null, "after");
        return;
      }
      placeFolder(dragged, folder.parent_id, folder, target.position);
      return;
    }
    placeFolder(dragged, null, null, "after");
  };

  const renderLayer = (layer: PanelLayer, depth: number) => {
    const isSelected = layer.id === selectedId;
    const error = errors[layer.id];
    const updated = relativeTime(layer.last_refreshed_at);
    return (
      <li
        key={layer.id}
        draggable={editing !== layer.id}
        onDragStart={(event) => {
          event.stopPropagation();
          setDrag({ kind: "layer", id: layer.id });
        }}
        onDragEnd={clearDrag}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!drag) return;
          setDropTarget({
            kind: "layer",
            id: layer.id,
            position: positionFrom(event, false),
          });
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          commitDrop({ kind: "layer", id: layer.id, position: positionFrom(event, false) });
        }}
        onClick={() => onSelect(layer.id)}
        style={{ marginLeft: depth * 12 }}
        className={cn(
          "group relative cursor-pointer rounded-lg border border-transparent px-2 py-1.5 transition-colors",
          isSelected ? "border-border bg-muted/60" : "hover:bg-muted/40",
          drag?.kind === "layer" && drag.id === layer.id && "opacity-50",
        )}
      >
        <DropLine visible={showLine("layer", layer.id, "before")} side="top" />
        <div className="flex items-center gap-1.5">
          <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-muted-foreground/60" />
          {loading[layer.id] || refreshingId === layer.id ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
          ) : error ? (
            <TriangleAlert className="h-4 w-4 shrink-0 text-destructive" />
          ) : (
            <LayerSymbol layer={layer} />
          )}

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
          </div>

          <span className="shrink-0 font-secondary text-[11px] text-muted-foreground">
            ({layer.feature_count.toLocaleString()})
          </span>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleVisible(layer);
            }}
            className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
            aria-label={layer.visible ? "Hide layer" : "Show layer"}
          >
            {layer.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>


          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(event) => event.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  beginEdit(layer.id);
                }}
              >
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
              <div className="px-2 pb-1 pl-8 font-secondary text-[11px] text-muted-foreground/70">
                {updated ? `Updated ${updated}` : "Never refreshed"}
              </div>
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
        <DropLine visible={showLine("layer", layer.id, "after")} side="bottom" />
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
          onDragEnd={clearDrag}
          onDragOver={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (!drag) return;
            setDropTarget({
              kind: "folder",
              id: folder.id,
              position: positionFrom(event, true),
            });
          }}
          onDrop={(event) => {
            event.preventDefault();
            event.stopPropagation();
            commitDrop({ kind: "folder", id: folder.id, position: positionFrom(event, true) });
          }}
          className={cn(
            "relative flex items-center gap-1 rounded-lg border border-transparent px-1 py-1.5",
            showLine("folder", folder.id, "inside")
              ? "border-primary/60 bg-primary/10"
              : "hover:bg-muted/40",
            drag?.kind === "folder" && drag.id === folder.id && "opacity-50",
          )}
        >
          <DropLine visible={showLine("folder", folder.id, "before")} side="top" />
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
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  beginEdit(folder.id);
                }}
              >
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
          <DropLine visible={showLine("folder", folder.id, "after")} side="bottom" />
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
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDropTarget(null);
      }}
      onDrop={(event) => event.preventDefault()}
    >
      {rootFolders.map((folder) => renderFolder(folder, 0))}
      {rootLayers.map((layer) => renderLayer(layer, 0))}
      <li
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!drag) return;
          setDropTarget({ kind: "root", id: null, position: "after" });
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          commitDrop({ kind: "root", id: null, position: "after" });
        }}
        className="relative h-10"
      >
        <DropLine visible={showLine("root", null, "after")} side="top" />
      </li>
    </ul>
  );
}

