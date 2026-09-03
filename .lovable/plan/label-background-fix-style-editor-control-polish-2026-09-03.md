# Label background fix + style editor control polish

Three small fixes to the label/background styling controls and how label backgrounds render.

## 1. Label background: hard edges, no gradient fade

The background behind a label currently fades to transparent at the left and right ends. It's drawn as a tiny 8×8 solid image stretched to fit the text via MapLibre's `icon-text-fit`; the stretch sampling softens the edges.

Fix in `src/components/map/map-canvas.tsx` (`labelBackgroundImage`):
- Generate the solid rectangle at a larger, device-pixel-aware size (e.g. 64×64, registered with the right `pixelRatio`) so the stretch stays crisp, and confirm the image is registered as a plain (non-SDF) image.
- Verify in the browser that the rectangle renders with a hard, uniform opacity across its full width — no fade at either end — at both 100% and partial opacity settings.
- If the stretched-image path still can't guarantee hard edges, fall back to a solid fill behind the text using a slightly larger image with explicit `stretchX`/`stretchY` zones (`addImage` stretch options), which is MapLibre's intended mechanism for this.

## 2. Opacity sliders: 0–100% everywhere

All opacity controls in the style editors currently show 0–1 with a 0.05 step. Change the UI to read and edit 0–100% while keeping stored values at 0–1 (no data migration needed).

- Extend `SliderField` (in `style-symbology.tsx`) with a `percent` mode: displays `Math.round(value * 100)` with a `%` suffix, slider min 0 / max 100 / step 1, and converts back to 0–1 on change.
- Apply it to every opacity slider across the style editors:
  - `style-symbology.tsx` — fill opacity, stroke opacity, mask opacity, heatmap opacity
  - `style-labels.tsx` — text opacity, halo opacity, background opacity
  - any opacity control in `style-popups.tsx` if present
- Labels read "… opacity" and show e.g. "60%".

## 3. Label background padding: 0.25px steps

In `style-labels.tsx`, the background Padding slider changes from `step={1}` to `step={0.25}` (range stays 0–10px) so quarter-pixel padding is possible.

## Verification

- `bunx tsgo --noEmit` clean.
- Playwright check on a test project: label background with hard edges at 100% and ~50% opacity; sliders display percentages; padding accepts quarter steps.
