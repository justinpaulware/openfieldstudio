import { useState } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { supabase } from "@/integrations/supabase/client";
import { arcgisRasterTileUrl } from "@/lib/raster-style";
import {
  describeArcgisService,
  loadArcgisLayer,
  loadCsvLayer,
  previewCsv,
} from "@/lib/datasets.functions";


type ArcgisDescription =
  | {
      kind: "service";
      serverType: string;
      url: string;
      layers: {
        id: number;
        name: string;
        geometryType: string | null;
        url: string;
        raster: boolean;
      }[];
    }
  | {
      kind: "layer";
      serverType: string;
      url: string;
      name: string;
      geometryType: string | null;
      raster: boolean;
      description: string | null;
      layerType: string | null;
    };



import {
  collectFields,
  computeBbox,
  detectGeometryType,
  toFeatureCollection,
  type Bbox,
  type FieldDef,
  type SimpleGeometryType,
} from "@/lib/geo";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  nextSortOrder: number;
  onCreated: (bbox: Bbox | null) => void;
};

type InsertArgs = {
  name: string;
  sourceType: "geojson_file" | "csv_url" | "arcgis_rest" | "raster_arcgis";
  sourceUrl?: string | null;
  storagePath?: string | null;
  geometryType: SimpleGeometryType | "raster";
  featureCount: number;
  bbox: Bbox | null;
  fields: FieldDef[];
  latField?: string | null;
  lonField?: string | null;
};


export function AddLayerDialog({ open, onOpenChange, projectId, nextSortOrder, onCreated }: Props) {
  const [busy, setBusy] = useState(false);

  // CSV state
  const [csvUrl, setCsvUrl] = useState("");
  const [csvName, setCsvName] = useState("");
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [latField, setLatField] = useState("");
  const [lonField, setLonField] = useState("");

  // ArcGIS state
  const [arcgisUrl, setArcgisUrl] = useState("");
  const [arcgisName, setArcgisName] = useState("");
  const [arcgisInfo, setArcgisInfo] = useState<ArcgisDescription | null>(null);
  const [arcgisLayerUrl, setArcgisLayerUrl] = useState("");

  const effectiveArcgisUrl =
    arcgisInfo?.kind === "service"
      ? arcgisLayerUrl
      : arcgisInfo?.kind === "layer"
        ? arcgisInfo.url
        : arcgisUrl.trim();

  const reset = () => {
    setCsvUrl("");
    setCsvName("");
    setCsvHeaders([]);
    setLatField("");
    setLonField("");
    setArcgisUrl("");
    setArcgisName("");
    setArcgisInfo(null);
    setArcgisLayerUrl("");
  };


  const insertLayer = async (args: InsertArgs) => {
    const { data: layer, error } = await supabase
      .from("layers")
      .insert({
        project_id: projectId,
        name: args.name,
        source_type: args.sourceType,
        source_url: args.sourceUrl ?? null,
        storage_path: args.storagePath ?? null,
        geometry_type: args.geometryType,
        feature_count: args.featureCount,
        bbox: args.bbox,
        sort_order: nextSortOrder,
        fields: {
          list: args.fields,
          latField: args.latField ?? null,
          lonField: args.lonField ?? null,
        },
      })
      .select("id")
      .single();
    if (error) throw error;

    const { error: styleError } = await supabase
      .from("layer_styles")
      .insert({ layer_id: layer.id });
    if (styleError) throw styleError;
  };

  const handleGeoJSONFile = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const parsed = toFeatureCollection(JSON.parse(text));
      if (!parsed) throw new Error("That file isn't valid GeoJSON.");
      if (!parsed.features.length) throw new Error("That GeoJSON has no features.");

      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Your session expired — sign in again.");

      const path = `${userId}/${projectId}/${crypto.randomUUID()}.geojson`;
      const { error: uploadError } = await supabase.storage
        .from("datasets")
        .upload(path, new Blob([text], { type: "application/geo+json" }), {
          contentType: "application/geo+json",
        });
      if (uploadError) throw uploadError;

      const bbox = computeBbox(parsed);
      await insertLayer({
        name: file.name.replace(/\.(geo)?json$/i, ""),
        sourceType: "geojson_file",
        storagePath: path,
        geometryType: detectGeometryType(parsed),
        featureCount: parsed.features.length,
        bbox,
        fields: collectFields(parsed),
      });

      toast.success("Layer added.");
      reset();
      onOpenChange(false);
      onCreated(bbox);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCsvPreview = async () => {
    setBusy(true);
    try {
      const preview = await previewCsv({ data: { url: csvUrl } });
      setCsvHeaders(preview.headers);
      const guess = (candidates: string[]) =>
        preview.headers.find((h) => candidates.includes(h.trim().toLowerCase())) ?? "";
      setLatField(guess(["lat", "latitude", "y", "lat_dd"]));
      setLonField(guess(["lon", "lng", "long", "longitude", "x", "lon_dd"]));
      if (!csvName) setCsvName(decodeURIComponent(csvUrl.split("/").pop() ?? "CSV layer"));
      toast.success(`Found ${preview.headers.length} columns and ${preview.rowCount} rows.`);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleCsvAdd = async () => {
    setBusy(true);
    try {
      const { summary } = await loadCsvLayer({ data: { url: csvUrl, latField, lonField } });
      await insertLayer({
        name: csvName.trim() || "CSV layer",
        sourceType: "csv_url",
        sourceUrl: csvUrl.trim(),
        geometryType: "point",
        featureCount: summary.featureCount,
        bbox: summary.bbox,
        fields: summary.fields,
        latField,
        lonField,
      });
      toast.success("Layer connected.");
      reset();
      onOpenChange(false);
      onCreated(summary.bbox);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleArcgisFetch = async () => {
    setBusy(true);
    try {
      const info = await describeArcgisService({ data: { url: arcgisUrl } });
      setArcgisInfo(info);
      if (info.kind === "service") {
        setArcgisLayerUrl(info.layers[0]?.url ?? "");
        toast.success(`Found ${info.layers.length} layers in this ${info.serverType}.`);
      } else {
        if (!arcgisName) setArcgisName(info.name);
        toast.success(`${info.serverType} layer ready: ${info.name}`);
      }
    } catch (error) {
      setArcgisInfo(null);
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /** The chosen ArcGIS layer serves imagery rather than features. */
  const selectedArcgisLayer =
    arcgisInfo?.kind === "service"
      ? arcgisInfo.layers.find((layer) => layer.url === arcgisLayerUrl)
      : null;
  const arcgisIsRaster =
    arcgisInfo?.kind === "layer" ? arcgisInfo.raster : (selectedArcgisLayer?.raster ?? false);

  const handleArcgisAdd = async () => {
    const url = effectiveArcgisUrl;
    if (!url) return;
    setBusy(true);
    const loading = toast.loading(
      `Loading ArcGIS ${arcgisInfo?.serverType ?? "REST"} layer…`,
    );
    try {
      if (arcgisIsRaster) {
        if (!arcgisRasterTileUrl(url)) {
          throw new Error("Raster layers need an ArcGIS MapServer URL, e.g. …/MapServer/0.");
        }
        const fallbackName =
          arcgisInfo?.kind === "layer" ? arcgisInfo.name : (selectedArcgisLayer?.name ?? "Raster layer");
        await insertLayer({
          name: arcgisName.trim() || fallbackName,
          sourceType: "raster_arcgis",
          sourceUrl: url,
          geometryType: "raster",
          featureCount: 0,
          bbox: null,
          fields: [],
        });
        toast.success("Raster layer added.");
        reset();
        onOpenChange(false);
        onCreated(null);
        return;
      }
      const { summary, truncated } = await loadArcgisLayer({ data: { url } });

      await insertLayer({
        name: arcgisName.trim() || summary.name,
        sourceType: "arcgis_rest",
        sourceUrl: url,
        geometryType: summary.geometryType,
        featureCount: summary.featureCount,
        bbox: summary.bbox,
        fields: summary.fields,
      });
      if (truncated) {
        toast.warning(
          `Service connected, but only the first ${summary.featureCount.toLocaleString()} features were imported. Filter at the source for the rest.`,
        );
      } else {
        toast.success("Service connected.");
      }

      reset();
      onOpenChange(false);
      onCreated(summary.bbox);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      toast.dismiss(loading);
      setBusy(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add data</DialogTitle>
          <DialogDescription>
            Upload a GeoJSON file, or connect a public CSV or ArcGIS REST service.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="geojson">
          <TabsList className="w-full">
            <TabsTrigger value="geojson" className="flex-1">
              GeoJSON
            </TabsTrigger>
            <TabsTrigger value="csv" className="flex-1">
              CSV
            </TabsTrigger>
            <TabsTrigger value="arcgis" className="flex-1">
              ArcGIS
            </TabsTrigger>
          </TabsList>

          <TabsContent value="geojson" className="mt-4">
            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file) void handleGeoJSONFile(file);
              }}
              className="flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-12 text-center transition-colors hover:border-primary/60"
            >
              {busy ? (
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              ) : (
                <UploadCloud className="h-6 w-6 text-muted-foreground" />
              )}
              <p className="mt-3 text-sm font-medium">Drop a .geojson file here</p>
              <p className="mt-1 font-secondary text-xs text-muted-foreground">
                or click to browse — up to 50 MB, WGS84 coordinates
              </p>
              <input
                type="file"
                accept=".geojson,.json,application/geo+json,application/json"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleGeoJSONFile(file);
                  event.target.value = "";
                }}
              />
            </label>
          </TabsContent>

          <TabsContent value="csv" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="csv-url">CSV URL</Label>
              <div className="flex gap-2">
                <Input
                  id="csv-url"
                  placeholder="https://example.com/points.csv"
                  value={csvUrl}
                  onChange={(event) => setCsvUrl(event.target.value)}
                />
                <Button
                  variant="outline"
                  onClick={handleCsvPreview}
                  disabled={busy || !csvUrl.trim()}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
                </Button>
              </div>
            </div>

            {csvHeaders.length > 0 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="csv-name">Layer name</Label>
                  <Input
                    id="csv-name"
                    value={csvName}
                    onChange={(event) => setCsvName(event.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Latitude column</Label>
                    <Select value={latField} onValueChange={setLatField}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose" />
                      </SelectTrigger>
                      <SelectContent>
                        {csvHeaders.map((header) => (
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
                        {csvHeaders.map((header) => (
                          <SelectItem key={header} value={header}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleCsvAdd}
                  disabled={busy || !latField || !lonField}
                >
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add CSV layer
                </Button>
              </>
            )}
          </TabsContent>

          <TabsContent value="arcgis" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="arcgis-url">Service or layer URL</Label>
              <div className="flex gap-2">
                <Input
                  id="arcgis-url"
                  placeholder="https://server.example.com/arcgis/rest/services/.../MapServer/0"
                  value={arcgisUrl}
                  onChange={(event) => {
                    setArcgisUrl(event.target.value);
                    setArcgisInfo(null);
                  }}
                />
                <Button
                  variant="outline"
                  onClick={handleArcgisFetch}
                  disabled={busy || !arcgisUrl.trim()}
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch"}
                </Button>
              </div>
              <p className="font-secondary text-xs text-muted-foreground">
                FeatureServer and MapServer are both supported — paste a layer
                (…/MapServer/0) or a service root to pick a layer.
              </p>
            </div>

            {arcgisInfo?.kind === "service" && (
              <div className="space-y-2">
                <Label>Layer</Label>
                <Select value={arcgisLayerUrl} onValueChange={setArcgisLayerUrl}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a layer" />
                  </SelectTrigger>
                  <SelectContent>
                    {arcgisInfo.layers.map((layer) => (
                      <SelectItem key={layer.url} value={layer.url}>
                        {layer.name}
                        {layer.geometryType ? ` · ${layer.geometryType.replace("esriGeometry", "")}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {arcgisInfo?.kind === "layer" && (
              <p className="font-secondary text-xs text-muted-foreground">
                {arcgisInfo.serverType} layer · {arcgisInfo.name}
                {arcgisInfo.geometryType
                  ? ` · ${arcgisInfo.geometryType.replace("esriGeometry", "")}`
                  : ""}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="arcgis-name">Layer name (optional)</Label>
              <Input
                id="arcgis-name"
                value={arcgisName}
                onChange={(event) => setArcgisName(event.target.value)}
              />
            </div>
            <Button
              className="w-full"
              onClick={handleArcgisAdd}
              disabled={busy || !effectiveArcgisUrl}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect service
            </Button>
          </TabsContent>

        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
