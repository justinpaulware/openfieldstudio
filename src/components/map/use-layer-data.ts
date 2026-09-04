import { keepPreviousData, useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadArcgisLayer, loadCsvLayer } from "@/lib/datasets.functions";
import { parseLayerFields, toFeatureCollection, type FeatureCollection } from "@/lib/geo";
import type { Tables } from "@/integrations/supabase/types";

export type LayerRow = Tables<"layers">;

async function fetchLayerData(layer: LayerRow): Promise<FeatureCollection | null> {
  // Raster layers are drawn straight from the service as tiles — nothing to fetch.
  if (layer.source_type === "raster_arcgis" || layer.geometry_type === "raster") return null;

  if (layer.source_type === "geojson_file") {

    if (!layer.storage_path) return null;
    const { data, error } = await supabase.storage
      .from("datasets")
      .createSignedUrl(layer.storage_path, 3600);
    if (error) throw error;
    const response = await fetch(data.signedUrl);
    if (!response.ok) throw new Error("Could not download that dataset.");
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

/** Only source-defining fields belong in the key: style/filter edits must not refetch. */
function sourceKey(layer: LayerRow) {
  const fields = parseLayerFields(layer.fields);
  return {
    sourceType: layer.source_type,
    storagePath: layer.storage_path ?? null,
    sourceUrl: layer.source_url ?? null,
    latField: fields.latField ?? null,
    lonField: fields.lonField ?? null,
    lastRefreshedAt: layer.last_refreshed_at ?? null,
  };
}

export function useLayerData(layers: LayerRow[]) {
  const results = useQueries({
    queries: layers.map((layer) => ({
      queryKey: ["layer-data", layer.id, sourceKey(layer)],
      queryFn: () => fetchLayerData(layer),
      staleTime: 5 * 60 * 1000,
      placeholderData: keepPreviousData,
      retry: 0,
    })),
  });


  const byId: Record<string, FeatureCollection | null> = {};
  const loading: Record<string, boolean> = {};
  const errors: Record<string, string | null> = {};
  layers.forEach((layer, index) => {
    const result = results[index];
    byId[layer.id] = (result?.data as FeatureCollection | null) ?? null;
    loading[layer.id] = result?.isLoading ?? false;
    errors[layer.id] = result?.error ? (result.error as Error).message : null;
  });

  return { byId, loading, errors };
}
