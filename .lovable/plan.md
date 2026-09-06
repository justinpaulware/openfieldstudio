# Change default label background padding to 1px

The label background `Padding` slider defaults to 3px for new layers. Change the default to 1px.

## Change

- `src/lib/layer-style.ts` — in `DEFAULT_LABELS`, change `bgPadding: 3` to `bgPadding: 1`.

The `parseLabels` fallback uses `DEFAULT_LABELS.bgPadding`, so this affects new layers and any label spec without a saved `bgPadding`. Existing layers that already saved a `bgPadding` value keep their value.

No UI, migration, or slider-range changes — the slider already allows 0.25px steps across 0–10px.

## Verification

- `bunx tsgo --noEmit` clean.
- Add a new layer, enable Label background, confirm the Padding slider starts at 1px.
