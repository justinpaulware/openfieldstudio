import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { loadArcgisLayer, loadCsvLayer } from "@/lib/datasets.functions";
import {
  collectFields,
  computeBbox,
  detectGeometryType,
  parseLayerFields,
  toFeatureCollection,
  type Bbox,
  type FieldDef,
  type SimpleGeometryType,
} from "@/lib/geo";
import type { LayerRow } from "./use-layer-data";

export type SourcePatch = {
  sourceUrl?: string;
  latField?: string;
  lonField?: string;
  /** Replacement GeoJSON text for file-backed layers. */
  geojsonText?: string;
};

type Summary = {
  geometryType: SimpleGeometryType;
  featureCount: number;
  bbox: Bbox | null;
  fields: FieldDef[];
};

async function refreshGeojsonFile(layer: LayerRow, patch: SourcePatch): Promise<Summary> {
  let text = patch.geojsonText;
  if (text == null) {
    if (!layer.storage_path) throw new Error("That layer has no stored file.");
    const { data, error } = await supabase.storage
      .from("datasets")
      .createSignedUrl(layer.storage_path, 3600);
    if (error) throw error;
    const response = await fetch(data.signedUrl);
    if (!response.ok) throw new Error("Could not download that dataset.");
    text = await response.text();
  }

  const parsed = toFeatureCollection(JSON.parse(text));
  if (!parsed) throw new Error("That file isn't valid GeoJSON.");
  if (!parsed.features.length) throw new Error("That GeoJSON has no features.");

  if (patch.geojsonText != null) {
    if (!layer.storage_path) throw new Error("That layer has no stored file to replace.");
    const { error } = await supabase.storage
      .from("datasets")
      .update(layer.storage_path, new Blob([text], { type: "application/geo+json" }), {
        contentType: "application/geo+json",
        upsert: true,
      });
    if (error) throw error;
  }

  return {
    geometryType: detectGeometryType(parsed),
    featureCount: parsed.features.length,
    bbox: computeBbox(parsed),
    fields: collectFields(parsed),
  };
}

async function buildSummary(layer: LayerRow, patch: SourcePatch) {
  const existing = parseLayerFields(layer.fields);

  if (layer.source_type === "geojson_file") {
    const summary = await refreshGeojsonFile(layer, patch);
    return { summary, url: layer.source_url, latField: null, lonField: null };
  }

  const url = (patch.sourceUrl ?? layer.source_url ?? "").trim();
  if (!url) throw new Error("That layer has no source URL.");

  if (layer.source_type === "csv_url") {
    const latField = patch.latField ?? existing.latField ?? "";
    const lonField = patch.lonField ?? existing.lonField ?? "";
    if (!latField || !lonField) throw new Error("Choose latitude and longitude columns first.");
    const { summary } = await loadCsvLayer({ data: { url, latField, lonField } });
    return {
      summary: { ...summary, geometryType: "point" as SimpleGeometryType },
      url,
      latField,
      lonField,
    };
  }

  const { summary } = await loadArcgisLayer({ data: { url } });
  return { summary, url, latField: null, lonField: null };
}

export function useLayerRefresh(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ layer, patch = {} }: { layer: LayerRow; patch?: SourcePatch }) => {
      const { summary, url, latField, lonField } = await buildSummary(layer, patch);

      const { error } = await supabase
        .from("layers")
        .update({
          source_url: url ?? null,
          geometry_type: summary.geometryType,
          feature_count: summary.featureCount,
          bbox: summary.bbox,
          fields: { list: summary.fields, latField, lonField },
          last_refreshed_at: new Date().toISOString(),
        })
        .eq("id", layer.id);
      if (error) throw error;

      return summary.bbox;
    },
    onSuccess: async (_bbox, { layer }) => {
      toast.success(`${layer.name} updated from source.`);
      await queryClient.invalidateQueries({ queryKey: ["layers", projectId] });
      await queryClient.invalidateQueries({ queryKey: ["layer-data", layer.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}
