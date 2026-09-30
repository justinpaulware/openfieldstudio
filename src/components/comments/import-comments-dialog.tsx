import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { importComments } from "@/lib/comments.functions";
import { toFeatureCollection, type FeatureCollection, type GeoJSONFeature } from "@/lib/geo";
import { loadArcgisLayer, loadCsvLayer } from "@/lib/datasets.functions";
import { parseLayerFields } from "@/lib/geo";
import type { Tables } from "@/integrations/supabase/types";

type LayerRow = Tables<"layers">;

/** Column names commonly used for the comment itself. */
const BODY_HINTS = ["comment", "comments", "body", "text", "note", "notes", "description", "feedback"];
const DATE_HINTS = ["date", "created", "created_at", "timestamp", "day"];
const NAME_HINTS = ["name", "author", "author_name", "submitted_by", "participant"];
const CATEGORY_HINTS = ["category", "topic", "theme", "type"];

const NONE = "__none__";

function pick(columns: string[], hints: string[]) {
  for (const hint of hints) {
    const match = columns.find((c) => c.toLowerCase() === hint);
    if (match) return match;
  }
  for (const hint of hints) {
    const match = columns.find((c) => c.toLowerCase().includes(hint));
    if (match) return match;
  }
  return "";
}

/** Minimal quoted-CSV reader for uploaded spreadsheets. */
function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;
    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell || row.length) {
    row.push(cell.replace(/\r$/, ""));
    rows.push(row);
  }
  const headers = rows.shift() ?? [];
  return { headers: headers.map((h) => h.trim()), rows: rows.filter((r) => r.some((c) => c.trim())) };
}

/** Everything the dialog needs from a source: features plus their columns. */
type Parsed = { features: GeoJSONFeature[]; columns: string[]; label: string };

function parsedFrom(collection: FeatureCollection | null, label: string): Parsed {
  const features = (collection?.features ?? []).filter((f) => f.geometry);
  const columns = new Set<string>();
  features.slice(0, 200).forEach((f) => {
    Object.keys(f.properties ?? {}).forEach((key) => columns.add(key));
  });
  return { features, columns: [...columns], label };
}

async function fetchLayerFeatures(layer: LayerRow): Promise<FeatureCollection | null> {
  if (layer.source_type === "geojson_file") {
    if (!layer.storage_path) return null;
    const { data, error } = await supabase.storage
      .from("datasets")
      .createSignedUrl(layer.storage_path, 3600);
    if (error) throw error;
    const response = await fetch(data.signedUrl);
    if (!response.ok) throw new Error("Could not read that layer.");
    return toFeatureCollection(await response.json());
  }
  if (layer.source_type === "csv_url") {
    const fields = parseLayerFields(layer.fields);
    if (!layer.source_url || !fields.latField || !fields.lonField) return null;
    const result = await loadCsvLayer({
      data: { url: layer.source_url, latField: fields.latField, lonField: fields.lonField },
    });
    return result.featureCollection as FeatureCollection;
  }
  if (!layer.source_url) return null;
  const result = await loadArcgisLayer({ data: { url: layer.source_url } });
  return result.featureCollection as FeatureCollection;
}

/** Point / LineString / Polygon only; multi-parts collapse to their first part. */
function simplifyGeometry(
  geometry: GeoJSONFeature["geometry"],
): { type: "Point" | "LineString" | "Polygon"; coordinates: unknown } | null {
  if (!geometry) return null;
  const coords = geometry.coordinates as unknown;
  switch (geometry.type) {
    case "Point":
      return { type: "Point", coordinates: coords };
    case "MultiPoint":
      return { type: "Point", coordinates: (coords as unknown[])[0] };
    case "LineString":
      return { type: "LineString", coordinates: coords };
    case "MultiLineString":
      return { type: "LineString", coordinates: (coords as unknown[])[0] };
    case "Polygon":
      return { type: "Polygon", coordinates: coords };
    case "MultiPolygon":
      return { type: "Polygon", coordinates: (coords as unknown[])[0] };
    default:
      return null;
  }
}

export function ImportCommentsDialog({
  open,
  onOpenChange,
  projectId,
  categories,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  categories: string[];
  onImported: () => void;
}) {
  const [mode, setMode] = useState<"layer" | "file">("layer");
  const [layerId, setLayerId] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [loading, setLoading] = useState(false);
  const [bodyField, setBodyField] = useState("");
  const [dateField, setDateField] = useState("");
  const [nameField, setNameField] = useState("");
  const [categoryMode, setCategoryMode] = useState<"fixed" | "column">("fixed");
  const [category, setCategory] = useState("");
  const [categoryField, setCategoryField] = useState("");
  const [source, setSource] = useState("Public Workshops");
  const [fallbackDate, setFallbackDate] = useState("");
  const [deleteLayer, setDeleteLayer] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const { data: layers } = useQuery({
    queryKey: ["project-layers-for-import", projectId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("layers")
        .select("*")
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as LayerRow[];
    },
  });

  // Re-run the column guesses whenever a new source is loaded.
  useEffect(() => {
    if (!parsed) return;
    setBodyField(pick(parsed.columns, BODY_HINTS));
    setDateField(pick(parsed.columns, DATE_HINTS));
    setNameField(pick(parsed.columns, NAME_HINTS));
    setCategoryField(pick(parsed.columns, CATEGORY_HINTS));
  }, [parsed]);

  useEffect(() => {
    if (!open) return;
    setParsed(null);
    setLayerId("");
    setMode("layer");
  }, [open]);

  useEffect(() => {
    if (!category && categories.length) setCategory(categories[0]!);
  }, [categories, category]);

  async function loadLayer(id: string) {
    setLayerId(id);
    const layer = (layers ?? []).find((l) => l.id === id);
    if (!layer) return;
    setLoading(true);
    try {
      setParsed(parsedFrom(await fetchLayerFeatures(layer), layer.name));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read that layer.");
      setParsed(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadFile(file: File) {
    setLoading(true);
    try {
      const text = await file.text();
      if (file.name.toLowerCase().endsWith(".csv")) {
        const { headers, rows } = parseCsvText(text);
        const lat = pick(headers, ["latitude", "lat", "y"]);
        const lon = pick(headers, ["longitude", "lon", "lng", "long", "x"]);
        if (!lat || !lon) {
          toast.error("That spreadsheet needs latitude and longitude columns.");
          return;
        }
        const latIndex = headers.indexOf(lat);
        const lonIndex = headers.indexOf(lon);
        const features: GeoJSONFeature[] = [];
        for (const row of rows) {
          const y = Number(row[latIndex]);
          const x = Number(row[lonIndex]);
          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
          features.push({
            type: "Feature",
            geometry: { type: "Point", coordinates: [x, y] },
            properties: Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])),
          });
        }
        setParsed(parsedFrom({ type: "FeatureCollection", features }, file.name));
      } else {
        setParsed(parsedFrom(toFeatureCollection(JSON.parse(text)), file.name));
      }
    } catch {
      toast.error("That file could not be read.");
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => {
    const out = { Point: 0, LineString: 0, Polygon: 0 };
    (parsed?.features ?? []).forEach((f) => {
      const simple = simplifyGeometry(f.geometry);
      if (simple) out[simple.type] += 1;
    });
    return out;
  }, [parsed]);

  const usable = counts.Point + counts.LineString + counts.Polygon;

  const run = useServerFn(importComments);

  async function submit() {
    if (!parsed || !bodyField) return;
    const features = parsed.features
      .map((feature) => {
        const simple = simplifyGeometry(feature.geometry);
        if (!simple) return null;
        const props = feature.properties ?? {};
        const body = String(props[bodyField] ?? "").trim();
        if (!body) return null;
        const rawDate = dateField ? String(props[dateField] ?? "").trim() : "";
        return {
          body,
          category:
            categoryMode === "column"
              ? String(props[categoryField] ?? "").trim() || null
              : category || null,
          authorName: nameField ? String(props[nameField] ?? "").trim() || null : null,
          date: rawDate || fallbackDate || null,
          geometry: simple,
        };
      })
      .filter((f): f is NonNullable<typeof f> => f !== null);

    if (!features.length) {
      toast.error("No comments found — check the comment text column.");
      return;
    }

    setImporting(true);
    try {
      const result = await run({
        data: {
          projectId,
          source: source.trim() || "Public Workshops",
          features,
          deleteLayerId: mode === "layer" && deleteLayer && layerId ? layerId : null,
        },
      });
      toast.success(
        `Imported ${result.imported} comment${result.imported === 1 ? "" : "s"}${
          result.layerDeleted ? " and removed the original layer." : "."
        }`,
      );
      onImported();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  }

  const columnOptions = parsed?.columns ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import comments</DialogTitle>
          <DialogDescription>
            Bring feedback gathered offline onto the map as comments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-1 rounded-lg border border-border p-1">
            {(
              [
                { id: "layer", label: "From a layer" },
                { id: "file", label: "Upload a file" },
              ] as const
            ).map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant={mode === option.id ? "secondary" : "ghost"}
                className="h-7 flex-1 font-secondary text-xs"
                onClick={() => {
                  setMode(option.id);
                  setParsed(null);
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {mode === "layer" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Layer</Label>
              <Select value={layerId} onValueChange={(value) => void loadLayer(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a layer" />
                </SelectTrigger>
                <SelectContent>
                  {(layers ?? []).map((layer) => (
                    <SelectItem key={layer.id} value={layer.id}>
                      {layer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-xs">File</Label>
              <input
                ref={fileInput}
                type="file"
                accept=".geojson,.json,.csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void loadFile(file);
                }}
              />
              <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {parsed?.label ?? "Choose a GeoJSON or CSV file"}
              </Button>
            </div>
          )}

          {loading && (
            <p className="flex items-center gap-2 font-secondary text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading…
            </p>
          )}

          {parsed && !loading && (
            <>
              <p className="rounded-md border border-border bg-muted/40 px-3 py-2 font-secondary text-xs text-muted-foreground">
                {usable} feature{usable === 1 ? "" : "s"} found — {counts.Point} point
                {counts.Point === 1 ? "" : "s"}, {counts.LineString} line
                {counts.LineString === 1 ? "" : "s"}, {counts.Polygon} area
                {counts.Polygon === 1 ? "" : "s"}.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <FieldSelect
                  label="Comment text"
                  value={bodyField}
                  options={columnOptions}
                  onChange={setBodyField}
                />
                <FieldSelect
                  label="Date"
                  value={dateField}
                  options={columnOptions}
                  allowNone
                  onChange={setDateField}
                />
                <FieldSelect
                  label="Name"
                  value={nameField}
                  options={columnOptions}
                  allowNone
                  noneLabel="Anonymous"
                  onChange={setNameField}
                />
                <div className="space-y-1.5">
                  <Label className="text-xs">Source</Label>
                  <Input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="Public Workshops"
                    className="h-9 font-secondary text-xs"
                  />
                </div>
              </div>

              {!dateField && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Date for all comments</Label>
                  <Input
                    type="date"
                    value={fallbackDate}
                    onChange={(e) => setFallbackDate(e.target.value)}
                    className="h-9 font-secondary text-xs"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label className="text-xs">Category</Label>
                <div className="flex gap-2">
                  <Select
                    value={categoryMode}
                    onValueChange={(value) => setCategoryMode(value as "fixed" | "column")}
                  >
                    <SelectTrigger className="w-[9.5rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Same for all</SelectItem>
                      <SelectItem value="column">From a column</SelectItem>
                    </SelectContent>
                  </Select>
                  {categoryMode === "fixed" ? (
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choose a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={categoryField} onValueChange={setCategoryField}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choose a column" />
                      </SelectTrigger>
                      <SelectContent>
                        {columnOptions.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              {mode === "layer" && (
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <Label htmlFor="delete-layer" className="font-secondary text-xs">
                    Remove the original layer afterwards
                  </Label>
                  <Switch id="delete-layer" checked={deleteLayer} onCheckedChange={setDeleteLayer} />
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={!parsed || !bodyField || importing}>
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {usable ? `${usable} comment${usable === 1 ? "" : "s"}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
  allowNone = false,
  noneLabel = "None",
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  allowNone?: boolean;
  noneLabel?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Select
        value={value || (allowNone ? NONE : "")}
        onValueChange={(next) => onChange(next === NONE ? "" : next)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Choose a column" />
        </SelectTrigger>
        <SelectContent>
          {allowNone && <SelectItem value={NONE}>{noneLabel}</SelectItem>}
          {options.map((name) => (
            <SelectItem key={name} value={name}>
              {name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
