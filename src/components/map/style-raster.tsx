import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_RASTER_STYLE, type RasterStyle } from "@/lib/raster-style";

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <span className="font-secondary text-[11px] text-muted-foreground">
          {Math.round(value)}
          {suffix}
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

export function StyleRaster({
  style,
  onChange,
}: {
  style: RasterStyle;
  onChange: (patch: Partial<RasterStyle>) => void;
}) {
  return (
    <div className="space-y-4">
      <SliderRow
        label="Opacity"
        value={style.opacity * 100}
        min={0}
        max={100}
        suffix="%"
        onChange={(next) => onChange({ opacity: next / 100 })}
      />
      <SliderRow
        label="Brightness"
        value={style.brightness}
        min={-100}
        max={100}
        onChange={(next) => onChange({ brightness: next })}
      />
      <SliderRow
        label="Contrast"
        value={style.contrast}
        min={-100}
        max={100}
        onChange={(next) => onChange({ contrast: next })}
      />
      <SliderRow
        label="Saturation"
        value={style.saturation}
        min={-100}
        max={100}
        onChange={(next) => onChange({ saturation: next })}
      />
      <div className="flex items-center justify-between">
        <Label className="text-xs">Grayscale</Label>
        <Switch
          checked={style.grayscale}
          onCheckedChange={(checked) => onChange({ grayscale: checked })}
        />
      </div>
      <button
        type="button"
        className="font-secondary text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
        onClick={() => onChange({ ...DEFAULT_RASTER_STYLE })}
      >
        Reset appearance
      </button>
    </div>
  );
}
