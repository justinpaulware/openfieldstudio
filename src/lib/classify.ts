/** Numeric classification helpers and color ramps for graduated styling. */

export type ClassifyMethod = "quantile" | "equal" | "jenks" | "manual";

export const CLASS_METHODS: { value: ClassifyMethod; label: string }[] = [
  { value: "quantile", label: "Quantile" },
  { value: "equal", label: "Equal interval" },
  { value: "jenks", label: "Natural breaks" },
  { value: "manual", label: "Manual" },
];

export type ColorRamp = { id: string; label: string; stops: string[] };

export const COLOR_RAMPS: ColorRamp[] = [
  { id: "viridis", label: "Viridis", stops: ["#440154", "#3b528b", "#21918c", "#5ec962", "#fde725"] },
  { id: "blues", label: "Blues", stops: ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"] },
  { id: "greens", label: "Greens", stops: ["#edf8e9", "#bae4b3", "#74c476", "#31a354", "#006d2c"] },
  { id: "oranges", label: "Oranges", stops: ["#feedde", "#fdbe85", "#fd8d3c", "#e6550d", "#a63603"] },
  { id: "magma", label: "Magma", stops: ["#000004", "#51127c", "#b73779", "#fc8961", "#fcfdbf"] },
  { id: "grey", label: "Grey", stops: ["#f7f7f7", "#cccccc", "#969696", "#636363", "#252525"] },
  { id: "redblue", label: "Red–Blue", stops: ["#b2182b", "#ef8a62", "#f7f7f7", "#67a9cf", "#2166ac"] },
  { id: "brownteal", label: "Brown–Teal", stops: ["#8c510a", "#d8b365", "#f6e8c3", "#5ab4ac", "#01665e"] },
];

export function ramp(id: string): ColorRamp {
  return COLOR_RAMPS.find((r) => r.id === id) ?? COLOR_RAMPS[0]!;
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")).join("")}`;
}

/** Sample `count` evenly spaced colors from a ramp. */
export function rampColors(rampId: string, count: number, reversed = false): string[] {
  const stops = ramp(rampId).stops;
  const source = reversed ? [...stops].reverse() : stops;
  if (count <= 1) return [source[0]!];
  const out: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = (i / (count - 1)) * (source.length - 1);
    const low = Math.floor(t);
    const high = Math.min(source.length - 1, low + 1);
    const f = t - low;
    const a = hexToRgb(source[low]!);
    const b = hexToRgb(source[high]!);
    out.push(rgbToHex([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]));
  }
  return out;
}

/** CSS gradient preview for a ramp chip. */
export function rampGradient(rampId: string, reversed = false): string {
  const stops = reversed ? [...ramp(rampId).stops].reverse() : ramp(rampId).stops;
  return `linear-gradient(to right, ${stops.join(", ")})`;
}

function quantileBreaks(sorted: number[], classes: number): number[] {
  const breaks: number[] = [];
  for (let i = 1; i < classes; i += 1) {
    const pos = (sorted.length - 1) * (i / classes);
    const low = Math.floor(pos);
    const high = Math.min(sorted.length - 1, low + 1);
    breaks.push(sorted[low]! + (sorted[high]! - sorted[low]!) * (pos - low));
  }
  return breaks;
}

function equalBreaks(min: number, max: number, classes: number): number[] {
  const step = (max - min) / classes;
  return Array.from({ length: classes - 1 }, (_, i) => min + step * (i + 1));
}

/** Jenks natural breaks on a sample (capped for performance). */
function jenksBreaks(sorted: number[], classes: number): number[] {
  const MAX = 800;
  const data =
    sorted.length <= MAX
      ? sorted
      : Array.from({ length: MAX }, (_, i) => sorted[Math.floor((i * (sorted.length - 1)) / (MAX - 1))]!);
  const n = data.length;
  if (n <= classes) return quantileBreaks(sorted, classes);

  const mat1: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(classes + 1).fill(0));
  const mat2: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(classes + 1).fill(Number.POSITIVE_INFINITY),
  );
  for (let j = 1; j <= classes; j += 1) {
    mat1[1]![j] = 1;
    mat2[1]![j] = 0;
  }
  for (let l = 2; l <= n; l += 1) {
    let sum = 0;
    let sumSq = 0;
    let count = 0;
    for (let m = 1; m <= l; m += 1) {
      const lower = l - m + 1;
      const value = data[lower - 1]!;
      count += 1;
      sum += value;
      sumSq += value * value;
      const variance = sumSq - (sum * sum) / count;
      if (lower !== 1) {
        for (let j = 2; j <= classes; j += 1) {
          const candidate = variance + mat2[lower - 1]![j - 1]!;
          if (mat2[l]![j]! >= candidate) {
            mat1[l]![j] = lower;
            mat2[l]![j] = candidate;
          }
        }
      }
    }
    mat1[l]![1] = 1;
    mat2[l]![1] = sumSq - (sum * sum) / count;
  }

  const breaks: number[] = [];
  let k = n;
  for (let j = classes; j >= 2; j -= 1) {
    const idx = mat1[k]![j]! - 1;
    breaks.unshift(data[idx]!);
    k = idx;
  }
  return breaks;
}

/** Class ranges [min, max] for the chosen method. */
export function computeBreaks(
  values: number[],
  classes: number,
  method: ClassifyMethod,
): { min: number; max: number }[] {
  const clean = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!clean.length) return [];
  const min = clean[0]!;
  const max = clean[clean.length - 1]!;
  if (min === max) return [{ min, max }];
  const count = Math.max(1, Math.min(classes, clean.length));
  const inner =
    method === "equal"
      ? equalBreaks(min, max, count)
      : method === "jenks"
        ? jenksBreaks(clean, count)
        : quantileBreaks(clean, count);
  const edges = [min, ...inner.map((n) => round(n)), max];
  const ranges: { min: number; max: number }[] = [];
  for (let i = 0; i < edges.length - 1; i += 1) {
    ranges.push({ min: edges[i]!, max: edges[i + 1]! });
  }
  return ranges;
}

function round(value: number): number {
  const abs = Math.abs(value);
  const digits = abs >= 100 ? 1 : abs >= 1 ? 2 : 4;
  return Number(value.toFixed(digits));
}

/** Compact number label for legends and class rows. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 10000) return value.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (abs >= 100) return value.toLocaleString(undefined, { maximumFractionDigits: 1 });
  return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
}
