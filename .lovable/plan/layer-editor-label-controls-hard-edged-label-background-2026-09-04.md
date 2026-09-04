# Layer editor: label controls + hard-edged label background

Four changes, all in the Labels area of the layer editor plus the label background drawing.

## 1. Wrap width: bigger range, plus a "no wrapping" default

- Add a checkbox/toggle "Wrap long labels" above the Wrap width slider. When off, labels render on one line regardless of length.
- Off is the default for new layers, and for existing layers whose saved settings predate this option.
- When on, the Wrap width slider range grows from 4–30 to 4–80 characters.
- Stored as a new `wrap` flag alongside the existing character count; when wrapping is off the map draws with an effectively unlimited width so no break occurs.

## 2. Placement becomes a dropdown

Replace the wrapped row of Placement buttons (Center / Above / Below / Left / Right, and Along line / Horizontal for line layers) with a single dropdown styled like the existing "Label field" select.

## 3. Text case and Weight become dropdowns

Same treatment: Weight (Regular / Bold) and Text case (Original / UPPER / lower) become selects matching the Label field control. The button-group helper is no longer used in the Labels panel.

## 4. Remove the remaining fade at the background's left/right edges

The background rectangle is a solid image stretched to fit the text. It is currently registered with stretch zones that cover the entire image, so the outermost pixel column and row get stretched and sampled with smoothing, which is what still reads as a soft fade at the ends.

Fix: keep a few unstretched solid pixels of margin at each edge and stretch only a small interior band, so the extents are drawn 1:1 and stay hard. Verify in the browser at full and partial background opacity that the left and right ends are crisp.

## Technical notes

- `src/lib/layer-style.ts`: add `wrapEnabled: boolean` to `LabelSpec`, default `false`; parse with a default of `false` so older saved labels stop wrapping too; bump `maxWidth` slider ceiling usage only in UI.
- `src/components/map/style-labels.tsx`: add the wrap switch; swap `Choice` usages for a small `SelectField` (native `select`, same classes as the Label field control).
- `src/components/map/map-canvas.tsx`: `text-max-width` uses `spec.wrapEnabled ? spec.maxWidth : 512`; `labelBackgroundImage` uses `stretchX`/`stretchY` of `[[size/2 - 1, size/2 + 1]]` with `content` inset by the same margin.
- No database migration: label settings live inside the existing style JSON.
