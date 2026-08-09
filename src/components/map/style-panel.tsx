import { Check, Loader2, RotateCcw, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import {
  type DashPattern,
  type LayerStyle,
  type LineCapStyle,
  type MarkerShape,
  type SimpleKind,
} from "@/lib/layer-style";
import { ColorField } from "./color-field";
import { LegendSwatch } from "./map-legend";

export type StyleSaveState = "idle" | "dirty" | "saving" | "saved";

type Props = {
  layerName: string;
  kind: SimpleKind;
  style: LayerStyle;
  saveState: StyleSaveState;
  onChange: (patch: Partial<LayerStyle>) => void;
  onSave: () => void;
  onReset: () => void;
  onClose: () => void;
};


function SliderField({
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
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-md border border-border px-2 py-1 text-xs capitalize transition-colors hover:bg-muted",
              option.value === value && "border-primary/60 bg-primary/15 text-foreground",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function StylePanel({ layerName, kind, style, onChange, onReset, onClose }: Props) {
  const pct = (n: number) => Math.round(n * 100);

  return (
    <aside className="hidden w-72 shrink-0 flex-col border-l border-border bg-card/40 lg:flex">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <LegendSwatch kind={kind} style={style} />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{layerName}</h2>
            <p className="font-secondary text-[11px] capitalize text-muted-foreground">
              {kind} style
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close style panel"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4">
        {kind === "point" && (
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
            />
            <ColorField
              label="Fill color"
              value={style.fillColor}
              onChange={(fillColor) => onChange({ fillColor })}
            />
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
            <ColorField
              label="Stroke color"
              value={style.strokeColor}
              onChange={(strokeColor) => onChange({ strokeColor })}
            />
            <SliderField
              label="Stroke width"
              value={style.strokeWidth}
              min={0}
              max={8}
              step={0.5}
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
        )}

        {kind === "line" && (
          <>
            <ColorField
              label="Line color"
              value={style.fillColor}
              onChange={(fillColor) => onChange({ fillColor })}
            />
            <SliderField
              label="Line width"
              value={style.strokeWidth}
              min={0.5}
              max={12}
              step={0.5}
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
        )}

        {kind === "polygon" && (
          <>
            <ColorField
              label="Fill color"
              value={style.fillColor}
              onChange={(fillColor) => onChange({ fillColor })}
            />
            <SliderField
              label="Fill opacity"
              value={pct(style.fillOpacity)}
              min={0}
              max={100}
              step={5}
              suffix="%"
              onChange={(value) => onChange({ fillOpacity: value / 100 })}
            />
            <ColorField
              label="Outline color"
              value={style.strokeColor}
              onChange={(strokeColor) => onChange({ strokeColor })}
            />
            <SliderField
              label="Outline width"
              value={style.strokeWidth}
              min={0}
              max={8}
              step={0.5}
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
        )}
      </div>

      <div className="border-t border-border px-4 py-3">
        <Button variant="outline" size="sm" className="w-full" onClick={onReset}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Reset to default
        </Button>
      </div>
    </aside>
  );
}
