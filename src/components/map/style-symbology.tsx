import { ArrowLeftRight, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CATEGORY_PALETTES,
  HEATMAP_RAMPS,
  buildCategories,
  buildGraduated,
  categoryDrives,
  classLabel,
  recolorCategories,
  recolorGraduated,
  type CategorySpec,
  type CategoryTarget,
  type DashPattern,
  type GraduatedSpec,
  type HeatmapSpec,
  type LayerStyle,
  type LineCapStyle,
  type MarkerShape,
  type ProportionalSpec,
  type SimpleKind,
  type StyleMode,
} from "@/lib/layer-style";
import { CLASS_METHODS, COLOR_RAMPS, rampGradient, type ClassifyMethod } from "@/lib/classify";
import { ColorField, Swatch } from "./color-field";

export type FieldValue = { value: string; count: number };

type Props = {
  kind: SimpleKind;
  style: LayerStyle;
  fields: string[];
  valuesFor: (field: string) => FieldValue[];
  numericFields: string[];
  numbersFor: (field: string) => number[];
  onChange: (patch: Partial<LayerStyle>) => void;
};


export function SliderField({
  label,
  value,
  min,
  max,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <span className="font-secondary text-[11px] text-muted-foreground">
          {value}
          {suffix ?? ""}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([next]) => onChange(next ?? value)}
      />
    </div>
  );
}

function OptionRow<T extends string>({
  label,
  options,
  value,
  onChange,
  disabledValues,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  disabledValues?: T[];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-1">
        {options.map((option) => {
          const disabled = disabledValues?.includes(option.value) ?? false;
          return (
            <button
              key={option.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "flex-1 rounded-md border border-border px-2 py-1 text-xs capitalize transition-colors hover:bg-muted",
                option.value === value && "border-primary/60 bg-primary/15 text-foreground",
                disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Fill / stroke controls shared by both style modes. */
function GeometryControls({
  kind,
  style,
  onChange,
  showPrimaryColor,
  showStrokeColor,
}: Props & { showPrimaryColor: boolean; showStrokeColor: boolean }) {
  const pct = (n: number) => Math.round(n * 100);

  if (kind === "point") {
    return (
      <>
        <OptionRow<MarkerShape>
          label="Marker"
          value={style.markerShape}
          onChange={(markerShape) => onChange({ markerShape })}
          options={[
            { value: "circle", label: "Circle" },
            { value: "ring", label: "Ring" },
            { value: "square", label: "Square" },
            { value: "triangle", label: "Triangle" },
          ]}
          {...(showPrimaryColor
            ? {}
            : { disabledValues: ["ring", "square", "triangle"] as MarkerShape[] })}
        />
        {showPrimaryColor && (
          <ColorField
            label="Fill color"
            value={style.fillColor}
            onChange={(fillColor) => onChange({ fillColor })}
          />
        )}
        <SliderField
          label="Fill opacity"
          value={pct(style.fillOpacity)}
          min={0}
          max={100}
          step={5}
          suffix="%"
          onChange={(value) => onChange({ fillOpacity: value / 100 })}
        />
        <SliderField
          label="Radius"
          value={style.circleRadius}
          min={1}
          max={24}
          step={1}
          suffix="px"
          onChange={(circleRadius) => onChange({ circleRadius })}
        />
        {showStrokeColor ? (
          <ColorField
            label="Stroke color"
            value={style.strokeColor}
            onChange={(strokeColor) => onChange({ strokeColor })}
          />
        ) : (
          <CategoryColorNote label="Stroke color" />
        )}
        <SliderField
          label="Stroke width"
          value={style.strokeWidth}
          min={0}
          max={8}
          step={0.25}
          suffix="px"
          onChange={(strokeWidth) => onChange({ strokeWidth })}
        />
        <SliderField
          label="Stroke opacity"
          value={pct(style.strokeOpacity)}
          min={0}
          max={100}
          step={5}
          suffix="%"
          onChange={(value) => onChange({ strokeOpacity: value / 100 })}
        />
      </>
    );
  }

  if (kind === "line") {
    return (
      <>
        {showPrimaryColor && (
          <ColorField
            label="Line color"
            value={style.fillColor}
            onChange={(fillColor) => onChange({ fillColor })}
          />
        )}
        <SliderField
          label="Line width"
          value={style.strokeWidth}
          min={0.25}
          max={12}
          step={0.25}
          suffix="px"
          onChange={(strokeWidth) => onChange({ strokeWidth })}
        />
        <SliderField
          label="Line opacity"
          value={pct(style.strokeOpacity)}
          min={0}
          max={100}
          step={5}
          suffix="%"
          onChange={(value) => onChange({ strokeOpacity: value / 100 })}
        />
        <OptionRow<DashPattern>
          label="Dash pattern"
          value={style.dashPattern}
          onChange={(dashPattern) => onChange({ dashPattern })}
          options={[
            { value: "solid", label: "Solid" },
            { value: "dashed", label: "Dashed" },
            { value: "dotted", label: "Dotted" },
          ]}
        />
        <OptionRow<LineCapStyle>
          label="Line cap"
          value={style.lineCap}
          onChange={(lineCap) => onChange({ lineCap })}
          options={[
            { value: "butt", label: "Flat" },
            { value: "round", label: "Round" },
            { value: "square", label: "Square" },
          ]}
        />
      </>
    );
  }

  return (
    <>
      {showPrimaryColor && (
        <ColorField
          label="Fill color"
          value={style.fillColor}
          onChange={(fillColor) => onChange({ fillColor })}
        />
      )}
      <SliderField
        label="Fill opacity"
        value={pct(style.fillOpacity)}
        min={0}
        max={100}
        step={5}
        suffix="%"
        onChange={(value) => onChange({ fillOpacity: value / 100 })}
      />
      {showStrokeColor ? (
        <ColorField
          label="Outline color"
          value={style.strokeColor}
          onChange={(strokeColor) => onChange({ strokeColor })}
        />
      ) : (
        <CategoryColorNote label="Outline color" />
      )}
      <SliderField
        label="Outline width"
        value={style.strokeWidth}
        min={0}
        max={8}
        step={0.25}
        suffix="px"
        onChange={(strokeWidth) => onChange({ strokeWidth })}
      />
      <SliderField
        label="Outline opacity"
        value={pct(style.strokeOpacity)}
        min={0}
        max={100}
        step={5}
        suffix="%"
        onChange={(value) => onChange({ strokeOpacity: value / 100 })}
      />
      <OptionRow<DashPattern>
        label="Outline pattern"
        value={style.dashPattern}
        onChange={(dashPattern) => onChange({ dashPattern })}
        options={[
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashed" },
          { value: "dotted", label: "Dotted" },
        ]}
      />
    </>
  );
}

function CategoryColorNote({ label }: { label: string }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="font-secondary text-[11px] text-muted-foreground">Set by the categories above.</p>
    </div>
  );
}

function CategoryEditor({
  style,
  fields,
  valuesFor,
  onChange,
}: Omit<Props, "kind">) {
  const spec = style.categories;
  const field = spec?.field ?? "";
  const counts = new Map(field ? valuesFor(field).map((v) => [v.value, v.count]) : []);

  const setSpec = (next: CategorySpec) => onChange({ categories: next, mode: "categorized" });

  const chooseField = (nextField: string) => {
    if (!nextField) {
      onChange({ categories: null });
      return;
    }
    const values = valuesFor(nextField).map((v) => v.value);
    const palette = spec?.palette ?? CATEGORY_PALETTES[0]!.id;
    setSpec(buildCategories(nextField, values, palette, spec?.field === nextField ? spec : null));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Field</Label>
        <select
          value={field}
          onChange={(event) => chooseField(event.target.value)}
          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="">Choose a field…</option>
          {fields.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      {!spec ? (
        <p className="font-secondary text-[11px] text-muted-foreground">
          Pick a field and Open Field will generate one color per unique value.
        </p>
      ) : (
        <>
          <OptionRow<CategoryTarget>
            label="Apply colors to"
            value={spec.target}
            onChange={(target) => setSpec({ ...spec, target })}
            options={[
              { value: "fill", label: "Fill" },
              { value: "stroke", label: "Stroke" },
              { value: "both", label: "Fill + stroke" },
            ]}
          />

          <div className="space-y-1.5">
            <PaletteHeader
              label="Palette"
              reversed={spec.reversed}
              onReverse={() => setSpec(recolorCategories(spec, spec.palette, !spec.reversed))}
            />
            <div className="grid grid-cols-4 gap-1">
              {CATEGORY_PALETTES.map((palette) => (
                <button
                  key={palette.id}
                  type="button"
                  title={palette.label}
                  onClick={() => setSpec(recolorCategories(spec, palette.id))}
                  className={cn(
                    "flex overflow-hidden rounded border border-border",
                    palette.id === spec.palette && "ring-2 ring-ring ring-offset-1 ring-offset-card",
                  )}
                >
                  {(spec.reversed ? [...palette.colors].reverse() : palette.colors)
                    .slice(0, 5)
                    .map((color) => (
                      <span key={color} className="h-5 flex-1" style={{ backgroundColor: color }} />
                    ))}
                </button>
              ))}
            </div>
          </div>


          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">
              {spec.entries.length} categories
            </Label>
            <button
              type="button"
              onClick={() => chooseField(spec.field)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
            >
              <RefreshCw className="h-3 w-3" />
              Regenerate
            </button>
          </div>

          <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {spec.entries.map((entry, index) => (
              <li key={entry.value} className="flex items-center gap-2">
                <CategoryColor
                  color={entry.color}
                  onChange={(color) => {
                    const entries = [...spec.entries];
                    entries[index] = { ...entry, color };
                    setSpec({ ...spec, entries });
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-xs" title={entry.value}>
                  {entry.value === "" ? "(blank)" : entry.value}
                </span>
                <span className="font-secondary text-[11px] text-muted-foreground">
                  {counts.get(entry.value) ?? 0}
                </span>
                <button
                  type="button"
                  aria-label={entry.visible ? "Hide category" : "Show category"}
                  onClick={() => {
                    const entries = [...spec.entries];
                    entries[index] = { ...entry, visible: !entry.visible };
                    setSpec({ ...spec, entries });
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {entry.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
            <li className="flex items-center gap-2 border-t border-border pt-1">
              <CategoryColor
                color={spec.otherColor}
                onChange={(otherColor) => setSpec({ ...spec, otherColor })}
              />
              <span className="min-w-0 flex-1 truncate text-xs italic text-muted-foreground">
                Other / blank
              </span>
              <button
                type="button"
                aria-label={spec.otherVisible ? "Hide other" : "Show other"}
                onClick={() => setSpec({ ...spec, otherVisible: !spec.otherVisible })}
                className="text-muted-foreground hover:text-foreground"
              >
                {spec.otherVisible ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
              </button>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}

/** Compact swatch that opens the shared color control. */
function CategoryColor({ color, onChange }: { color: string; onChange: (color: string) => void }) {
  return (
    <details className="relative shrink-0">
      <summary
        className="flex h-5 w-5 cursor-pointer list-none items-center justify-center"
        aria-label="Category color"
      >
        <Swatch color={color} className="h-5 w-5" />
      </summary>
      <div className="absolute left-0 top-6 z-30 w-56 rounded-md border border-border bg-card p-2 shadow-[var(--shadow-soft)]">
        <ColorField label="Color" value={color} allowTransparent={false} onChange={onChange} />
      </div>
    </details>
  );
}

/** Palette label with a reverse-order toggle. */
function PaletteHeader({
  label,
  reversed,
  onReverse,
}: {
  label: string;
  reversed: boolean;
  onReverse: () => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <button
        type="button"
        onClick={onReverse}
        title="Reverse color order"
        aria-label="Reverse color order"
        aria-pressed={reversed}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
          reversed && "border-primary/60 bg-primary/15 text-foreground",
        )}
      >
        <ArrowLeftRight className="h-3 w-3" />
        Reverse
      </button>
    </div>
  );
}

function GraduatedEditor({
  style,
  numericFields,
  numbersFor,
  onChange,
  kind,
}: Omit<Props, "fields" | "valuesFor">) {
  const spec = style.graduated;
  const field = spec?.field ?? "";

  const setSpec = (next: GraduatedSpec) => onChange({ graduated: next, mode: "graduated" });

  const rebuild = (nextField: string, patch?: Partial<GraduatedSpec>) => {
    if (!nextField) {
      onChange({ graduated: null });
      return;
    }
    const base = spec?.field === nextField ? { ...spec, ...patch } : { ...(patch ?? {}) };
    setSpec(buildGraduated(nextField, numbersFor(nextField), base));
  };

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Numeric field</Label>
        <select
          value={field}
          onChange={(event) => rebuild(event.target.value)}
          className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
        >
          <option value="">Choose a field…</option>
          {numericFields.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {!numericFields.length && (
          <p className="font-secondary text-[11px] text-muted-foreground">
            No numeric attributes were found in this layer.
          </p>
        )}
      </div>

      {!spec ? (
        <p className="font-secondary text-[11px] text-muted-foreground">
          Pick a numeric field and Open Field will classify it into colored ranges.
        </p>
      ) : (
        <>
          <OptionRow<CategoryTarget>
            label="Apply colors to"
            value={spec.target}
            onChange={(target) => setSpec({ ...spec, target })}
            options={[
              { value: "fill", label: "Fill" },
              { value: "stroke", label: "Stroke" },
              { value: "both", label: "Fill + stroke" },
            ]}
          />

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Classification</Label>
            <select
              value={spec.method}
              onChange={(event) =>
                rebuild(spec.field, { method: event.target.value as ClassifyMethod })
              }
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            >
              {CLASS_METHODS.map((method) => (
                <option key={method.value} value={method.value}>
                  {method.label}
                </option>
              ))}
            </select>
          </div>

          <SliderField
            label="Classes"
            value={spec.classes.length}
            min={2}
            max={9}
            step={1}
            onChange={(classCount) => rebuild(spec.field, { classCount, method: spec.method === "manual" ? "quantile" : spec.method })}
          />

          <div className="space-y-1.5">
            <PaletteHeader
              label="Color ramp"
              reversed={spec.reversed}
              onReverse={() => setSpec(recolorGraduated(spec, spec.ramp, !spec.reversed))}
            />
            <div className="grid grid-cols-4 gap-1">
              {COLOR_RAMPS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => setSpec(recolorGraduated(spec, item.id))}
                  className={cn(
                    "h-5 overflow-hidden rounded border border-border",
                    item.id === spec.ramp && "ring-2 ring-ring ring-offset-1 ring-offset-card",
                  )}
                  style={{ backgroundImage: rampGradient(item.id, spec.reversed) }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">{spec.classes.length} classes</Label>
            <button
              type="button"
              onClick={() => rebuild(spec.field, { method: spec.method === "manual" ? "quantile" : spec.method })}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
            >
              <RefreshCw className="h-3 w-3" />
              Recalculate
            </button>
          </div>

          <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {spec.classes.map((cls, index) => (
              <li key={`${cls.min}-${cls.max}-${index}`} className="flex items-center gap-2">
                <CategoryColor
                  color={cls.color}
                  onChange={(color) => {
                    const classes = [...spec.classes];
                    classes[index] = { ...cls, color };
                    setSpec({ ...spec, classes });
                  }}
                />
                <span className="min-w-0 flex-1 truncate text-xs">{classLabel(cls)}</span>
                <button
                  type="button"
                  aria-label={cls.visible ? "Hide class" : "Show class"}
                  onClick={() => {
                    const classes = [...spec.classes];
                    classes[index] = { ...cls, visible: !cls.visible };
                    setSpec({ ...spec, classes });
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {cls.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
              </li>
            ))}
            <li className="flex items-center gap-2 border-t border-border pt-1">
              <CategoryColor
                color={spec.otherColor}
                onChange={(otherColor) => setSpec({ ...spec, otherColor })}
              />
              <span className="min-w-0 flex-1 truncate text-xs italic text-muted-foreground">
                No value
              </span>
              <button
                type="button"
                aria-label={spec.otherVisible ? "Hide no-value features" : "Show no-value features"}
                onClick={() => setSpec({ ...spec, otherVisible: !spec.otherVisible })}
                className="text-muted-foreground hover:text-foreground"
              >
                {spec.otherVisible ? (
                  <Eye className="h-3.5 w-3.5" />
                ) : (
                  <EyeOff className="h-3.5 w-3.5" />
                )}
              </button>
            </li>
          </ul>

          {kind === "point" && (
            <div className="space-y-2 rounded-md border border-border p-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Graduated size</Label>
                <Switch
                  checked={spec.sizeEnabled}
                  onCheckedChange={(sizeEnabled) => setSpec({ ...spec, sizeEnabled })}
                />
              </div>
              {spec.sizeEnabled && (
                <>
                  <SliderField
                    label="Smallest radius"
                    value={spec.minRadius}
                    min={1}
                    max={30}
                    step={1}
                    suffix="px"
                    onChange={(minRadius) =>
                      setSpec({ ...spec, minRadius, maxRadius: Math.max(minRadius, spec.maxRadius) })
                    }
                  />
                  <SliderField
                    label="Largest radius"
                    value={spec.maxRadius}
                    min={1}
                    max={40}
                    step={1}
                    suffix="px"
                    onChange={(maxRadius) =>
                      setSpec({ ...spec, maxRadius, minRadius: Math.min(maxRadius, spec.minRadius) })
                    }
                  />
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Mask (inverted polygon) controls. */
function MaskEditor({
  style,
  onChange,
}: {
  style: LayerStyle;
  onChange: (patch: Partial<LayerStyle>) => void;
}) {
  const spec = style.mask;
  const set = (patch: Partial<typeof spec>) => onChange({ mask: { ...spec, ...patch } });

  return (
    <div className="space-y-4">
      <p className="font-secondary text-[11px] leading-snug text-muted-foreground">
        Everything inside the polygons stays visible; everything outside is covered.
      </p>
      <ColorField label="Mask color" value={spec.color} onChange={(color) => set({ color })} />
      <SliderField
        label="Mask opacity"
        value={Math.round(spec.opacity * 100)}
        min={0}
        max={100}
        step={5}
        suffix="%"
        onChange={(value) => set({ opacity: value / 100 })}
      />
      <ColorField
        label="Boundary color"
        value={spec.boundaryColor}
        onChange={(boundaryColor) => set({ boundaryColor })}
      />
      <SliderField
        label="Boundary width"
        value={spec.boundaryWidth}
        min={0}
        max={8}
        step={0.25}
        suffix="px"
        onChange={(boundaryWidth) => set({ boundaryWidth })}
      />
      <OptionRow<DashPattern>
        label="Boundary pattern"
        value={spec.boundaryDash}
        onChange={(boundaryDash) => set({ boundaryDash })}
        options={[
          { value: "solid", label: "Solid" },
          { value: "dashed", label: "Dashed" },
          { value: "dotted", label: "Dotted" },
        ]}
      />
      <OptionRow<"all" | "basemap">
        label="Mask scope"
        value={spec.scope}
        onChange={(scope) => set({ scope })}
        options={[
          { value: "all", label: "Entire map" },
          { value: "basemap", label: "Basemap only" },
        ]}
      />
    </div>
  );
}

function ProportionalEditor({
  style,
  numericFields,
  numbersFor,
  onChange,
}: {
  style: LayerStyle;
  numericFields: string[];
  numbersFor: (field: string) => number[];
  onChange: (patch: Partial<LayerStyle>) => void;
}) {
  const spec: ProportionalSpec = style.proportional ?? {
    field: "",
    minSize: 4,
    maxSize: 28,
    scale: "sqrt",
    dataMin: 0,
    dataMax: 1,
    hideNoValue: false,
  };
  const set = (patch: Partial<ProportionalSpec>) =>
    onChange({ proportional: { ...spec, ...patch } });

  const pickField = (field: string) => {
    const values = numbersFor(field).filter((n) => Number.isFinite(n));
    const dataMin = values.length ? Math.min(...values) : 0;
    const dataMax = values.length ? Math.max(...values) : 1;
    set({ field, dataMin, dataMax });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Size field</Label>
        <Select value={spec.field} onValueChange={pickField}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Choose a numeric field" />
          </SelectTrigger>
          <SelectContent>
            {numericFields.map((field) => (
              <SelectItem key={field} value={field} className="text-xs">
                {field}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!numericFields.length && (
          <p className="font-secondary text-[11px] text-muted-foreground">
            This layer has no numeric fields to size by.
          </p>
        )}
      </div>

      {spec.field && (
        <>
          <div className="flex items-center justify-between gap-2">
            <p className="font-secondary text-[11px] text-muted-foreground">
              Range {spec.dataMin.toLocaleString()} – {spec.dataMax.toLocaleString()}
            </p>
            <button
              type="button"
              onClick={() => pickField(spec.field)}
              className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] hover:bg-muted"
            >
              <RefreshCw className="h-3 w-3" />
              Rescan
            </button>
          </div>

          <OptionRow<"linear" | "sqrt">
            label="Scaling"
            value={spec.scale}
            onChange={(scale) => set({ scale })}
            options={[
              { value: "sqrt", label: "Square root" },
              { value: "linear", label: "Linear" },
            ]}
          />
          <SliderField
            label="Smallest symbol"
            value={spec.minSize}
            min={1}
            max={Math.max(2, spec.maxSize - 1)}
            step={0.5}
            suffix="px"
            onChange={(minSize) => set({ minSize })}
          />
          <SliderField
            label="Largest symbol"
            value={spec.maxSize}
            min={spec.minSize + 1}
            max={80}
            step={0.5}
            suffix="px"
            onChange={(maxSize) => set({ maxSize })}
          />
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">Hide features with no value</Label>
            <Switch
              checked={spec.hideNoValue}
              onCheckedChange={(hideNoValue) => set({ hideNoValue })}
            />
          </div>
        </>
      )}
    </div>
  );
}

function HeatmapEditor({
  style,
  numericFields,
  numbersFor,
  onChange,
}: {
  style: LayerStyle;
  numericFields: string[];
  numbersFor: (field: string) => number[];
  onChange: (patch: Partial<LayerStyle>) => void;
}) {
  const spec = style.heatmap;
  const set = (patch: Partial<HeatmapSpec>) => onChange({ heatmap: { ...spec, ...patch } });

  const pickWeight = (value: string) => {
    if (value === "__count__") {
      set({ weightField: "", weightMax: 1 });
      return;
    }
    const values = numbersFor(value).filter((n) => Number.isFinite(n));
    set({ weightField: value, weightMax: values.length ? Math.max(...values) : 1 });
  };

  return (
    <div className="space-y-4">
      <p className="font-secondary text-[11px] leading-snug text-muted-foreground">
        Points blend into a density surface. Zoom in for finer detail.
      </p>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Weight by</Label>
        <Select value={spec.weightField || "__count__"} onValueChange={pickWeight}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__count__" className="text-xs">
              Point count
            </SelectItem>
            {numericFields.map((field) => (
              <SelectItem key={field} value={field} className="text-xs">
                {field}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Color ramp</Label>
        <Select value={spec.ramp} onValueChange={(ramp) => set({ ramp })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(HEATMAP_RAMPS).map((id) => (
              <SelectItem key={id} value={id} className="text-xs">
                <span className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-12 rounded-sm"
                    style={{
                      background: `linear-gradient(to right, ${(HEATMAP_RAMPS[id] ?? []).join(", ")})`,
                    }}
                  />
                  <span className="capitalize">{id}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <SliderField
        label="Radius"
        value={spec.radius}
        min={4}
        max={80}
        step={1}
        suffix="px"
        onChange={(radius) => set({ radius })}
      />
      <SliderField
        label="Intensity"
        value={spec.intensity}
        min={0.1}
        max={5}
        step={0.1}
        onChange={(intensity) => set({ intensity })}
      />
      <SliderField
        label="Blur"
        value={spec.blur}
        min={0}
        max={1}
        step={0.05}
        onChange={(blur) => set({ blur })}
      />
      <SliderField
        label="Opacity"
        value={Math.round(spec.opacity * 100)}
        min={0}
        max={100}
        step={5}
        suffix="%"
        onChange={(value) => set({ opacity: value / 100 })}
      />
    </div>
  );
}

export function StyleSymbology(props: Props) {
  const { style, onChange, kind } = props;
  const polygonal = kind === "polygon";
  const modes: { value: StyleMode; label: string; disabled?: boolean; note?: string }[] = [
    { value: "single", label: "Single symbol" },
    { value: "categorized", label: "Categories" },
    { value: "graduated", label: "Graduated" },
    { value: "proportional", label: "Proportional", disabled: true, note: "Coming next" },
    { value: "heatmap", label: "Heatmap", disabled: true, note: "Coming next" },
    {
      value: "mask",
      label: "Mask layer",
      disabled: !polygonal,
      ...(polygonal ? {} : { note: "Polygons only" }),
    },
  ];
  const masked = style.mode === "mask";

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Style type</Label>
        <Select value={style.mode} onValueChange={(mode) => onChange({ mode: mode as StyleMode })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {modes.map((mode) => (
              <SelectItem
                key={mode.value}
                value={mode.value}
                disabled={mode.disabled ?? false}
                className="text-xs"
              >
                <span className="flex items-center gap-2">
                  {mode.label}
                  {mode.note && (
                    <span className="font-secondary text-[10px] uppercase tracking-wide text-muted-foreground">
                      {mode.note}
                    </span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {style.mode === "categorized" && (
        <CategoryEditor
          style={props.style}
          fields={props.fields}
          valuesFor={props.valuesFor}
          numericFields={props.numericFields}
          numbersFor={props.numbersFor}
          onChange={onChange}
        />
      )}

      {style.mode === "graduated" && (
        <GraduatedEditor
          kind={props.kind}
          style={props.style}
          numericFields={props.numericFields}
          numbersFor={props.numbersFor}
          onChange={onChange}
        />
      )}

      {masked ? (
        <div className="space-y-4 border-t border-border pt-4">
          <MaskEditor style={style} onChange={onChange} />
        </div>
      ) : (
        <div className="space-y-4 border-t border-border pt-4">
          <GeometryControls
            {...props}
            showPrimaryColor={!categoryDrives(style, "fill")}
            showStrokeColor={!categoryDrives(style, "stroke")}
          />
        </div>
      )}
    </div>
  );
}

