# Flexible "Around" label placement + kill the background edge fade

## 1. New placement option: Around

Add "Around point" as a placement choice alongside Center / Above / Below / Left / Right for point and polygon layers.

With it selected, each label is allowed to sit in whichever position around its feature is free — center, above, below, left or right — so the map fits far more labels at once without collisions. The existing Offset slider controls how far out the label sits when it can't stay centered.

Technical: add `"around"` to `LabelPlacement`; in the map canvas, when placement is `around` set `text-variable-anchor` to `["center","top","bottom","left","right"]`, `text-radial-offset` to the offset value, `text-justify: "auto"`, and clear the fixed `text-anchor`/`text-offset`. For every other placement, explicitly clear `text-variable-anchor`/`text-radial-offset` so switching back restores fixed placement. Label backgrounds keep working since `icon-text-fit` follows the chosen anchor.

## 2. Background rectangle still feathers at the edges

The previous fix (narrow interior stretch zones) did not remove it, so the cause is not the stretch band. The remaining suspect is how the background image sits in the icon atlas: the outermost pixel row/column of an added image borders transparent atlas padding, and the renderer's smoothing samples across that boundary, producing a soft one-pixel rim that reads as a fade at the label ends.

Approach, in order, verifying each with a zoomed screenshot of a real label before moving on:

1. Confirm the fade with a close-up capture so the remedy is judged against actual pixels, not assumption.
2. Register the background image with the outer edge pixels duplicated inward and the stretch/content zones inset a couple of pixels, and register it at device pixel ratio 2 so the drawn edge lands on a whole pixel.
3. If a rim survives, drop `icon-text-fit` entirely and instead build the background per label as a plain solid image sized in the shader-free path — that is, keep the symbol icon but stop the runtime scaling that forces smoothing.
4. If MapLibre cannot draw a hard-edged fitted icon at all, replace the image-based background with a text halo of matching color set wide enough to read as a solid block, which is the one label-background mechanism with no texture sampling involved.

The chosen route must show a hard edge at both 100% and roughly 50% background opacity.

## Files

- `src/lib/layer-style.ts` — extend `LabelPlacement`.
- `src/components/map/style-labels.tsx` — new dropdown entry.
- `src/components/map/map-canvas.tsx` — variable-anchor placement branch and the background image work.
