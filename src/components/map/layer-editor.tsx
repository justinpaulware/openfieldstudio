import { useEffect, useState, type ReactNode } from "react";
import { Check, ChevronDown, Loader2, RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  activeCategories,
  activeGraduated,
  activeMask,
  type LayerStyle,
  type SimpleKind,
} from "@/lib/layer-style";
import { isFilterActive, type FilterConfig } from "@/lib/layer-filter";
import { CategoryChip, LegendSwatch, categoryRows } from "./map-legend";
import { StyleSymbology, type FieldValue } from "./style-symbology";
import { StyleLabels } from "./style-labels";
import { StylePopups } from "./style-popups";
import { LayerFilter } from "./layer-filter";

export type StyleSaveState = "idle" | "dirty" | "saving" | "saved";

export type EditorSection = "data" | "filter" | "symbology" | "labels" | "popups" | "raster";

export type LayerSourceInfo = {
  sourceType: string;
  geometryType: string;
  storagePath: string | null;
  sourceUrl: string | null;
};

const SOURCE_LABEL: Record<string, string> = {
  geojson_file: "GeoJSON upload",
  csv_url: "CSV",
  arcgis_rest: "ArcGIS REST Service",
  raster_arcgis: "ArcGIS Raster MapServer",
};


type Props = {
  layerName: string;
  kind: SimpleKind;
  style: LayerStyle;
  filter: FilterConfig;
  source: LayerSourceInfo;
  featureCount: number;
  filteredCount: number;
  saveState: StyleSaveState;
  fields: string[];
  valuesFor: (field: string) => FieldValue[];
  numericFields: string[];
  numbersFor: (field: string) => number[];
  initialSection?: EditorSection;
  /** Present for raster layers: replaces every vector styling section. */
  raster?: { style: RasterStyle; onChange: (patch: Partial<RasterStyle>) => void } | null;
  onChange: (patch: Partial<LayerStyle>) => void;
  onFilterChange: (config: FilterConfig) => void;
  onRename: (name: string) => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
};


function Section({
  title,
  hint,
  open,
  onToggle,
  children,
}: {
  title: string;
  hint?: string | undefined;
  open: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-border">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-semibold hover:bg-muted/50"
      >
        <span className="flex items-center gap-2">
          {title}
          {hint && (
            <span className="font-secondary text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
              {hint}
            </span>
          )}
        </span>
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && children && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1">
      <span className="font-secondary text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="min-w-0 break-words text-right font-secondary text-xs">{value}</span>
    </div>
  );
}

export function LayerEditor({
  layerName,
  kind,
  style,
  filter,
  source,
  featureCount,
  filteredCount,
  saveState,
  fields,
  valuesFor,
  numericFields,
  numbersFor,
  initialSection = "symbology",
  onChange,
  onFilterChange,
  onRename,
  onSave,
  onReset,
  onClose,
}: Props) {
  const [openSection, setOpenSection] = useState<EditorSection | null>(initialSection);
  useEffect(() => setOpenSection(initialSection), [initialSection, layerName]);

  const [nameDraft, setNameDraft] = useState(layerName);
  useEffect(() => setNameDraft(layerName), [layerName]);

  const toggle = (section: EditorSection) =>
    setOpenSection((current) => (current === section ? null : section));

  const rows = categoryRows(style);
  const categorized = !!activeCategories(style);
  const graduated = !!activeGraduated(style);
  const masked = !!activeMask(style);
  const filtered = isFilterActive(filter);

  const sourceDetail = source.storagePath
    ? source.storagePath.split("/").pop()
    : (source.sourceUrl ?? "—");

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-card/40 lg:flex">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {rows.length ? (
            <CategoryChip colors={rows.map((row) => row.color)} />
          ) : (
            <LegendSwatch kind={kind} style={style} />
          )}
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{layerName}</h2>
            <p className="font-secondary text-[11px] capitalize text-muted-foreground">
              {kind} ·{" "}
              {categorized
                ? "categories"
                : graduated
                  ? "graduated"
                  : masked
                    ? "mask layer"
                    : "single symbol"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close layer editor"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Data" open={openSection === "data"} onToggle={() => toggle("data")}>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="layer-name" className="text-xs">
                Layer name
              </Label>
              <Input
                id="layer-name"
                className="h-8 text-xs"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => {
                  const next = nameDraft.trim();
                  if (next && next !== layerName) onRename(next);
                  else setNameDraft(layerName);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            </div>
            <div className="divide-y divide-border/60">
              <DataRow label="Source" value={SOURCE_LABEL[source.sourceType] ?? source.sourceType} />
              <DataRow
                label="Geometry"
                value={<span className="capitalize">{source.geometryType}</span>}
              />
              <DataRow
                label="Features"
                value={
                  filtered
                    ? `${filteredCount.toLocaleString()} of ${featureCount.toLocaleString()}`
                    : featureCount.toLocaleString()
                }
              />
              <DataRow label="Detail" value={sourceDetail} />
            </div>
          </div>
        </Section>

        <Section
          title="Filter"
          hint={filtered ? "On" : undefined}
          open={openSection === "filter"}
          onToggle={() => toggle("filter")}
        >
          <LayerFilter
            config={filter}
            fields={fields}
            numericFields={numericFields}
            valuesFor={valuesFor}
            matched={filteredCount}
            total={featureCount}
            onChange={onFilterChange}
          />
        </Section>

        <Section
          title="Symbology"
          open={openSection === "symbology"}
          onToggle={() => toggle("symbology")}
        >
          <StyleSymbology
            kind={kind}
            style={style}
            fields={fields}
            valuesFor={valuesFor}
            numericFields={numericFields}
            numbersFor={numbersFor}
            onChange={onChange}
          />
        </Section>
        <Section
          title="Labels"
          hint={style.labels?.enabled ? "On" : "Off"}
          open={openSection === "labels"}
          onToggle={() => toggle("labels")}
        >
          <StyleLabels kind={kind} style={style} fields={fields} onChange={onChange} />
        </Section>
        <Section
          title="Popups"
          hint={style.popup?.enabled ? "On" : "Off"}
          open={openSection === "popups"}
          onToggle={() => toggle("popups")}
        >
          <StylePopups style={style} fields={fields} onChange={onChange} />
        </Section>
      </div>

      <div className="space-y-1.5 border-t border-border px-4 py-3">
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1"
            onClick={onSave}
            disabled={saveState === "saving" || saveState === "idle" || saveState === "saved"}
          >
            {saveState === "saving" ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : saveState === "saved" ? (
              <Check className="mr-1.5 h-3.5 w-3.5" />
            ) : (
              <Save className="mr-1.5 h-3.5 w-3.5" />
            )}
            {saveState === "saving" ? "Saving" : saveState === "saved" ? "Saved" : "Save"}
          </Button>
          <Button variant="outline" size="sm" className="flex-1" onClick={onReset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Reset to default
          </Button>
        </div>
        <p className="font-secondary text-[11px] text-muted-foreground">
          {saveState === "dirty"
            ? "Unsaved changes"
            : saveState === "saving"
              ? "Saving changes…"
              : "All changes saved"}
        </p>
      </div>
    </aside>
  );
}
