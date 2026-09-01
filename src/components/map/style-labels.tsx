import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  DEFAULT_LABELS,
  type LabelLinePlacement,
  type LabelPlacement,
  type LabelSpec,
  type LayerStyle,
  type SimpleKind,
} from "@/lib/layer-style";
import { ColorField } from "./color-field";
import { SliderField } from "./style-symbology";

type Props = {
  kind: SimpleKind;
  style: LayerStyle;
  fields: string[];
  onChange: (patch: Partial<LayerStyle>) => void;
};

/** First field that looks like a name, so switching labels on shows something useful. */
function defaultField(fields: string[]): string {
  const nameish = fields.find((field) => /name|title|label|id$/i.test(field));
  return nameish ?? fields[0] ?? "";
}

function Choice<T extends string>({
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
      <div className="flex flex-wrap gap-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "flex-1 rounded-md border border-border px-2 py-1 text-xs transition-colors hover:bg-muted",
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

export function StyleLabels({ kind, style, fields, onChange }: Props) {
  const spec = style.labels ?? DEFAULT_LABELS;
  const set = (patch: Partial<LabelSpec>) => onChange({ labels: { ...spec, ...patch } });

  return (
    <div className="space-y-4 pt-1">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground">Show labels</Label>
        <Switch
          checked={spec.enabled}
          onCheckedChange={(enabled) =>
            set({ enabled, field: spec.field || (enabled ? defaultField(fields) : "") })
          }
        />
      </div>

      {spec.enabled && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Label field</Label>
            <select
              value={spec.field}
              onChange={(event) => set({ field: event.target.value })}
              className="h-8 w-full rounded-md border border-border bg-background px-2 text-xs"
            >
              <option value="">Select a field…</option>
              {fields.map((field) => (
                <option key={field} value={field}>
                  {field}
                </option>
              ))}
            </select>
            {!fields.length && (
              <p className="font-secondary text-[11px] text-muted-foreground">
                No attributes found on this layer yet.
              </p>
            )}
          </div>

          <SliderField
            label="Text size"
            value={spec.size}
            min={8}
            max={28}
            step={1}
            suffix="px"
            onChange={(size) => set({ size })}
          />

          <Choice<"regular" | "bold">
            label="Weight"
            value={spec.bold ? "bold" : "regular"}
            onChange={(weight) => set({ bold: weight === "bold" })}
            options={[
              { value: "regular", label: "Regular" },
              { value: "bold", label: "Bold" },
            ]}
          />

          <Choice<LabelTransform>
            label="Text case"
            value={spec.textTransform}
            onChange={(textTransform) => set({ textTransform })}
            options={[
              { value: "none", label: "Original" },
              { value: "upper", label: "UPPER" },
              { value: "lower", label: "lower" },
            ]}
          />

          <ColorField label="Text color" value={spec.color} onChange={(color) => set({ color })} />
          <SliderField
            label="Text opacity"
            value={spec.textOpacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(textOpacity) => set({ textOpacity })}
          />

          <div className="space-y-3 rounded-md border border-border p-2.5">
            <div className="flex items-center justify-between gap-2">
              <Label className="text-xs text-muted-foreground">Label background</Label>
              <Switch
                checked={spec.bgEnabled}
                onCheckedChange={(bgEnabled) =>
                  // A halo under a solid background just muddies the edge.
                  set(bgEnabled ? { bgEnabled, haloWidth: 0 } : { bgEnabled })
                }
              />
            </div>
            {spec.bgEnabled && (
              <>
                <ColorField
                  label="Background color"
                  value={spec.bgColor}
                  onChange={(bgColor) => set({ bgColor })}
                />
                <SliderField
                  label="Background opacity"
                  value={spec.bgOpacity}
                  min={0}
                  max={1}
                  step={0.05}
                  onChange={(bgOpacity) => set({ bgOpacity })}
                />
                <SliderField
                  label="Padding"
                  value={spec.bgPadding}
                  min={0}
                  max={10}
                  step={1}
                  suffix="px"
                  onChange={(bgPadding) => set({ bgPadding })}
                />
                {kind === "line" && spec.linePlacement === "line" && (
                  <p className="font-secondary text-[11px] text-muted-foreground">
                    Backgrounds need horizontal labels — switch placement to Horizontal.
                  </p>
                )}
              </>
            )}
          </div>

          <ColorField
            label="Halo color"
            value={spec.haloColor}
            onChange={(haloColor) => set({ haloColor })}
          />
          <SliderField
            label="Halo width"
            value={spec.haloWidth}
            min={0}
            max={4}
            step={0.2}
            suffix="px"
            onChange={(haloWidth) => set({ haloWidth })}
          />
          <SliderField
            label="Halo opacity"
            value={spec.haloOpacity}
            min={0}
            max={1}
            step={0.05}
            onChange={(haloOpacity) => set({ haloOpacity })}
          />


          {kind === "line" ? (
            <Choice<LabelLinePlacement>
              label="Placement"
              value={spec.linePlacement}
              onChange={(linePlacement) => set({ linePlacement })}
              options={[
                { value: "line", label: "Along line" },
                { value: "horizontal", label: "Horizontal" },
              ]}
            />
          ) : (
            <>
              <Choice<LabelPlacement>
                label="Placement"
                value={spec.placement}
                onChange={(placement) => set({ placement })}
                options={[
                  { value: "center", label: "Center" },
                  { value: "above", label: "Above" },
                  { value: "below", label: "Below" },
                  { value: "left", label: "Left" },
                  { value: "right", label: "Right" },
                ]}
              />
              {spec.placement !== "center" && (
                <SliderField
                  label="Offset"
                  value={spec.offset}
                  min={0}
                  max={3}
                  step={0.1}
                  suffix="em"
                  onChange={(offset) => set({ offset })}
                />
              )}
            </>
          )}

          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">Allow overlap</Label>
            <Switch
              checked={spec.allowOverlap}
              onCheckedChange={(allowOverlap) => set({ allowOverlap })}
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Visible zoom range</Label>
              <span className="font-secondary text-[11px] text-muted-foreground">
                z{spec.minZoom} – z{spec.maxZoom}
              </span>
            </div>
            <SliderField
              label="From zoom"
              value={spec.minZoom}
              min={0}
              max={22}
              step={1}
              onChange={(minZoom) => set({ minZoom: Math.min(minZoom, spec.maxZoom - 1) })}
            />
            <SliderField
              label="To zoom"
              value={spec.maxZoom}
              min={1}
              max={22}
              step={1}
              onChange={(maxZoom) => set({ maxZoom: Math.max(maxZoom, spec.minZoom + 1) })}
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground">Uppercase</Label>
            <Switch checked={spec.uppercase} onCheckedChange={(uppercase) => set({ uppercase })} />
          </div>

          <SliderField
            label="Wrap width"
            value={spec.maxWidth}
            min={4}
            max={30}
            step={1}
            suffix=" chars"
            onChange={(maxWidth) => set({ maxWidth })}
          />
        </>
      )}
    </div>
  );
}
