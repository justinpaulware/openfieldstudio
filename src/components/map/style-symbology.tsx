import { ArrowLeftRight, Eye, EyeOff, RefreshCw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  CATEGORY_PALETTES,
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
  type LayerStyle,
  type LineCapStyle,
  type MarkerShape,
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

export function StyleSymbology(props: Props) {
  const { style, onChange } = props;
  const modes: { value: StyleMode | "graduated"; label: string; disabled?: boolean }[] = [
    { value: "single", label: "Single symbol" },
    { value: "categorized", label: "Categories" },
    { value: "graduated", label: "Graduated", disabled: true },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Style type</Label>
        <div className="flex gap-1">
          {modes.map((mode) => (
            <button
              key={mode.value}
              type="button"
              disabled={mode.disabled}
              title={mode.disabled ? "Coming next" : mode.label}
              onClick={() => onChange({ mode: mode.value as StyleMode })}
              className={cn(
                "flex-1 rounded-md border border-border px-2 py-1 text-[11px] transition-colors hover:bg-muted",
                style.mode === mode.value && "border-primary/60 bg-primary/15 text-foreground",
                mode.disabled && "cursor-not-allowed opacity-40 hover:bg-transparent",
              )}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {style.mode === "categorized" && (
        <CategoryEditor
          style={props.style}
          fields={props.fields}
          valuesFor={props.valuesFor}
          onChange={onChange}
        />
      )}

      <div className="space-y-4 border-t border-border pt-4">
        <GeometryControls
          {...props}
          showPrimaryColor={!categoryDrives(style, "fill")}
          showStrokeColor={!categoryDrives(style, "stroke")}
        />
      </div>
    </div>
  );
}
