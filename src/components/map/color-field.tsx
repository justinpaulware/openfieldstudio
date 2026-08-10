import { useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PALETTE_HUES, PALETTE_NEUTRALS, TRANSPARENT, isTransparent } from "@/lib/layer-style";

/** Clear box with a red slash — the "no color" marker. */
export function NoColorMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 12 12" preserveAspectRatio="none" className={cn("block", className)} aria-hidden="true">
      <line x1="1" y1="11" x2="11" y2="1" stroke="#e0533d" strokeWidth="1.25" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}


function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value.slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("")}`;
}

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rd = r / 255;
  const gd = g / 255;
  const bd = b / 255;
  const max = Math.max(rd, gd, bd);
  const min = Math.min(rd, gd, bd);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rd) h = ((gd - bd) / d) % 6;
    else if (max === gd) h = (bd - rd) / d + 2;
    else h = (rd - gd) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

export function Swatch({
  color,
  className,
}: {
  color: string;
  className?: string;
}) {
  const clear = isTransparent(color);
  return (
    <span
      className={cn("relative block overflow-hidden rounded border border-border/80", className)}
      style={clear ? { backgroundColor: "#ffffff" } : { backgroundColor: color }}
    >
      {clear && <NoColorMark className="h-full w-full" />}
    </span>
  );
}

/**
 * Color control: palette grid, saturation/value area and hue slider,
 * styled with the app's own tokens instead of the browser's native picker.
 */
export function ColorField({
  label,
  value,
  allowTransparent = true,
  onChange,
}: {
  label: string;
  value: string;
  allowTransparent?: boolean;
  onChange: (color: string) => void;
}) {
  const clear = isTransparent(value);
  const [red, green, blue] = useMemo(() => {
    const hex = /^#[0-9a-f]{3,8}$/i.test(value) ? value : "#000000";
    return hexToRgb(hex);
  }, [value]);
  const [h, s, v] = useMemo(() => {
    const hex = /^#[0-9a-f]{3,8}$/i.test(value) ? value : "#000000";
    return rgbToHsv(...hexToRgb(hex));
  }, [value]);

  const neutrals = allowTransparent
    ? PALETTE_NEUTRALS
    : PALETTE_NEUTRALS.filter((hex) => !isTransparent(hex));

  const renderSwatch = (hex: string) => {
    const isClear = isTransparent(hex);
    return (
      <button
        key={hex}
        type="button"
        aria-label={isClear ? "No color" : hex}
        title={isClear ? "No color" : hex}
        onClick={() => onChange(hex)}
        className={cn(
          "relative h-5 w-5 shrink-0 overflow-hidden rounded border border-border/80",
          value.toLowerCase() === hex.toLowerCase() &&
            "ring-2 ring-ring ring-offset-1 ring-offset-card",
        )}
        style={isClear ? { backgroundColor: "#ffffff" } : { backgroundColor: hex }}
      >
        {isClear && <NoColorMark className="h-full w-full" />}
      </button>
    );
  };

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="space-y-1">
        <div className="grid w-fit grid-cols-9 gap-1">{PALETTE_HUES.map(renderSwatch)}</div>
        <div className="grid w-fit grid-cols-9 gap-1">{neutrals.map(renderSwatch)}</div>
      </div>

      <div className="flex items-center gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`${label} picker`}
              className="h-7 w-8 rounded-md border border-border p-0.5"
            >
              <Swatch color={value} className="h-full w-full" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 space-y-3 p-3">
            <div
              role="presentation"
              className="relative h-28 w-full cursor-crosshair rounded-md border border-border"
              style={{
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, ${hsvToHex(h, 1, 1)})`,
              }}
              onPointerDown={(event) => {
                const target = event.currentTarget;
                target.setPointerCapture(event.pointerId);
                const apply = (clientX: number, clientY: number) => {
                  const rect = target.getBoundingClientRect();
                  const nx = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
                  const ny = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
                  onChange(hsvToHex(h, nx, 1 - ny));
                };
                apply(event.clientX, event.clientY);
                const move = (e: PointerEvent) => apply(e.clientX, e.clientY);
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
              }}
            >
              {!clear && (
                <span
                  className="pointer-events-none absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
                  style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] text-muted-foreground">Hue</Label>
              <Slider
                value={[Math.round(h)]}
                min={0}
                max={359}
                step={1}
                onValueChange={([next]) => onChange(hsvToHex(next ?? h, s || 1, v || 1))}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {([
                { channel: "R", value: red },
                { channel: "G", value: green },
                { channel: "B", value: blue },
              ] as const).map(({ channel, value: channelValue }) => (
                <div key={channel} className="space-y-1">
                  <Label htmlFor={`${label}-${channel}`} className="text-[11px] text-muted-foreground">
                    {channel}
                  </Label>
                  <Input
                    id={`${label}-${channel}`}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={255}
                    value={channelValue}
                    onChange={(event) => {
                      const next = Number(event.target.value);
                      if (!Number.isFinite(next)) return;
                      if (channel === "R") onChange(rgbToHex(next, green, blue));
                      else if (channel === "G") onChange(rgbToHex(red, next, blue));
                      else onChange(rgbToHex(red, green, next));
                    }}
                    className="h-7 px-2 font-secondary text-xs"
                    aria-label={`${channel} channel`}
                  />
                </div>
              ))}
            </div>
            {allowTransparent && (
              <button
                type="button"
                onClick={() => onChange(TRANSPARENT)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted",
                  clear && "border-primary/60 bg-primary/15",
                )}
              >
                <Swatch color={TRANSPARENT} className="h-4 w-4" />
                No color
              </button>
            )}
          </PopoverContent>
        </Popover>
        <Input
          value={clear ? "none" : value}
          onChange={(event) => {
            const next = event.target.value.trim();
            onChange(next === "none" || next === "" ? TRANSPARENT : next);
          }}
          className="h-7 flex-1 font-secondary text-xs"
          spellCheck={false}
        />
      </div>
    </div>
  );
}
