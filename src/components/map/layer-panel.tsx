import { useState } from "react";
import {
  Crosshair,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  MoreHorizontal,
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { LayerRow } from "./use-layer-data";

const SOURCE_LABEL: Record<string, string> = {
  geojson_file: "GeoJSON",
  csv_url: "CSV",
  arcgis_rest: "ArcGIS",
};

type Props = {
  layers: LayerRow[];
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleVisible: (layer: LayerRow) => void;
  onOpacity: (layer: LayerRow, opacity: number) => void;
  onZoomTo: (layer: LayerRow) => void;
  onRename: (layer: LayerRow, name: string) => void;
  onDelete: (layer: LayerRow) => void;
  onReorder: (orderedIds: string[]) => void;
  onOpenTable: (layer: LayerRow) => void;
};

export function LayerPanel({
  layers,
  loading,
  errors,
  selectedId,
  onSelect,
  onToggleVisible,
  onOpacity,
  onZoomTo,
  onRename,
  onDelete,
  onReorder,
  onOpenTable,
}: Props) {
  const [dragId, setDragId] = useState<string | null>(null);

  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const ids = layers.map((l) => l.id);
    const from = ids.indexOf(dragId);
    const to = ids.indexOf(targetId);
    if (from < 0 || to < 0) return;
    ids.splice(to, 0, ids.splice(from, 1)[0] as string);
    onReorder(ids);
    setDragId(null);
  };

  if (!layers.length) {
    return (
      <div className="px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          No layers yet. Add a dataset to start building your map.
        </p>
      </div>
    );
  }

  return (
    <ul className="space-y-1 p-2">
      {layers.map((layer) => {
        const isSelected = layer.id === selectedId;
        const error = errors[layer.id];
        return (
          <li
            key={layer.id}
            draggable
            onDragStart={() => setDragId(layer.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDrop(layer.id)}
            onClick={() => onSelect(layer.id)}
            className={cn(
              "group cursor-pointer rounded-lg border border-transparent px-2 py-2 transition-colors",
              isSelected ? "border-border bg-muted/60" : "hover:bg-muted/40",
              dragId === layer.id && "opacity-50",
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
                <input
                  value={layer.name}
                  onClick={(event) => event.stopPropagation()}
                  onChange={(event) => onRename(layer, event.target.value)}
                  className="w-full truncate bg-transparent text-sm font-medium outline-none focus:underline"
                />
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                    {SOURCE_LABEL[layer.source_type] ?? layer.source_type}
                  </Badge>
                  <span className="font-secondary text-[11px] text-muted-foreground">
                    {layer.feature_count.toLocaleString()} features
                  </span>
                  {loading[layer.id] && (
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
                  <DropdownMenuItem onClick={() => onZoomTo(layer)}>
                    <Crosshair className="mr-2 h-4 w-4" />
                    Zoom to layer
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onOpenTable(layer)}>
                    <Table2 className="mr-2 h-4 w-4" />
                    Attribute table
                  </DropdownMenuItem>
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

            {error && isSelected && (
              <p className="mt-2 pl-6 text-xs text-destructive">{error}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
