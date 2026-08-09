import { useEffect, useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { previewCsv } from "@/lib/datasets.functions";
import { parseLayerFields } from "@/lib/geo";
import type { LayerRow } from "./use-layer-data";
import type { SourcePatch } from "./use-layer-refresh";

type Props = {
  layer: LayerRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  onSave: (patch: SourcePatch) => void;
};

export function LayerSourceDialog({ layer, open, onOpenChange, saving, onSave }: Props) {
  const [url, setUrl] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [latField, setLatField] = useState("");
  const [lonField, setLonField] = useState("");
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    if (!layer || !open) return;
    const fields = parseLayerFields(layer.fields);
    setUrl(layer.source_url ?? "");
    setLatField(fields.latField ?? "");
    setLonField(fields.lonField ?? "");
    setHeaders(
      fields.latField && fields.lonField
        ? Array.from(new Set([fields.latField, fields.lonField]))
        : [],
    );
  }, [layer, open]);

  if (!layer) return null;

  const busy = saving || fetching;

  const fetchHeaders = async () => {
    setFetching(true);
    try {
      const preview = await previewCsv({ data: { url } });
      setHeaders(preview.headers);
      if (!preview.headers.includes(latField)) setLatField("");
      if (!preview.headers.includes(lonField)) setLonField("");
      toast.success(`Found ${preview.headers.length} columns and ${preview.rowCount} rows.`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setFetching(false);
    }
  };

  const handleFile = async (file: File) => {
    setFetching(true);
    try {
      const text = await file.text();
      onSave({ geojsonText: text });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setFetching(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Data source</DialogTitle>
          <DialogDescription>
            {layer.name} — styling, name and placement are kept when the source changes.
          </DialogDescription>
        </DialogHeader>

        {layer.source_type === "geojson_file" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Stored file</Label>
              <p className="break-all font-secondary text-xs text-muted-foreground">
                {layer.storage_path?.split("/").pop() ?? "—"}
              </p>
            </div>
            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) void handleFile(file);
              }}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center transition-colors hover:border-primary/60"
            >
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <UploadCloud className="h-5 w-5 text-muted-foreground" />
              )}
              <p className="mt-3 text-sm font-medium">Replace with a new .geojson file</p>
              <p className="mt-1 font-secondary text-xs text-muted-foreground">
                Extent, fields and feature count are recalculated
              </p>
              <input
                type="file"
                accept=".geojson,.json,application/geo+json,application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                  event.target.value = "";
                }}
              />
            </label>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="source-url">
                {layer.source_type === "csv_url" ? "CSV URL" : "Service layer URL"}
              </Label>
              <div className="flex gap-2">
                <Input id="source-url" value={url} onChange={(event) => setUrl(event.target.value)} />
                {layer.source_type === "csv_url" && (
                  <Button variant="outline" onClick={fetchHeaders} disabled={busy || !url.trim()}>
                    {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch columns"}
                  </Button>
                )}
              </div>
            </div>

            {layer.source_type === "csv_url" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Latitude column</Label>
                  <Select value={latField} onValueChange={setLatField}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Longitude column</Label>
                  <Select value={lonField} onValueChange={setLonField}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose" />
                    </SelectTrigger>
                    <SelectContent>
                      {headers.map((header) => (
                        <SelectItem key={header} value={header}>
                          {header}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button
                onClick={() =>
                  onSave({
                    sourceUrl: url.trim(),
                    ...(layer.source_type === "csv_url" ? { latField, lonField } : {}),
                  })
                }
                disabled={
                  busy || !url.trim() || (layer.source_type === "csv_url" && (!latField || !lonField))
                }
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save and refresh
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
