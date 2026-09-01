# Tab 16 Phase 1 (labels), then Tab 13 (comment export)

Order confirmed: labels → comment export → basemaps (scoped down) → engagement.

## 1. Tab 16 Phase 1 — Label typography and background (build now)

No schema change; `label_config` is jsonb and unknown keys are parsed with fallbacks already.

New controls in the Labels section of the layer editor:

- **Text transform**: Original / UPPERCASE / lowercase / Title Case. Replaces the existing `uppercase` boolean, migrated on read (`uppercase: true` → `UPPERCASE`).
- **Font weight**: Light / Regular / Medium / Bold. Replaces `bold`, migrated on read.
- **Text opacity**: 0-100%.
- **Halo opacity**: 0-100% (currently halo has color and width only).
- **Background**: enable toggle, fill color, opacity, padding 0-10px. Solid fill only — no border, no frame.

Live preview on the map as with every other style control, debounce-saved to `layer_styles.label_config`.

### The background technique, and whether it is safe

MapLibre has no `text-background-*` paint property. The standard, widely used
workaround is to draw a stretchable image behind the text in the *same* symbol
layer:

- Register a tiny white image once per map (`map.addImage`, SDF so it can be tinted).
- On the label layer set `icon-image` to that image, `icon-text-fit: "both"`, and
  `icon-text-fit-padding` from the padding control.
- Tint with `icon-color` and `icon-opacity` from the background color/opacity controls.

Because the icon lives in the same symbol layer as the text, it moves with the
label, participates in the same collision detection, and can never drift out of
register with the text. This is the technique Mapbox/MapLibre styles themselves
use for shields and callouts, so it is well-trodden rather than a hack.

Honest caveats, all of which we can live with or handle:

- **Along-line labels.** With `symbol-placement: "line"`, glyphs curve along the
  geometry and a fitted rectangle cannot follow that curve. Behaviour there is
  poor. Handling: when a layer uses along-line placement, the background control
  is disabled with a short note ("Backgrounds require horizontal labels"), or
  enabling the background switches that layer to horizontal placement. I lean
  toward disabling with the note — less surprising.
- **Point markers already use `icon-image`.** They are on a separate symbol
  layer from labels in `map-canvas.tsx`, so there is no collision between the two
  uses. Verified in the code.
- **Multi-line labels** (the existing max-width control) are fine —
  `icon-text-fit: both` sizes to the full wrapped text block.
- **Load cost** is one 1×1 image added at map init; no network request, no
  per-layer asset, nothing to lazy-load.
- **Halo + background together** can look muddy. Not a bug, but when a background
  is enabled the default halo width drops to 0 so the out-of-the-box result is the
  clean whiteout look you described.

So: comfortable with the approach, with the along-line case explicitly handled
rather than left to misbehave. Verification includes a point layer, a polygon
layer, a wrapped multi-line label, and a line layer in both placements.

## 2. Tab 13 — Comment export (build after)

- Export menu on the project Comments tab: CSV and GeoJSON.
- Exports exactly the current filtered set (status, categories, date range, search).
- Fields: comment id, project id and name, view, body, category, status, author
  name, author email, created, updated, lng, lat. Contact details included by
  default, since the export is owner-only.
- GeoJSON uses the stored `geometry` column directly, everything else as
  properties. CSV writes WKT for any non-point geometry.
- Generated in a `requireSupabaseAuth` server function and returned as a download,
  so nothing is exposed to non-owners.
- Add `geometry_type` to `comments` (default `Point`) in the same migration so
  line/polygon feedback later needs no schema change.

## 3. Tab 15 — Basemaps, scoped down

Dropping the registry/power-user direction. The actual need is one thing: **a
clean, label-free basemap option**.

- Add "Positron (No Labels)" alongside the existing four. Produced by fetching the
  OpenFreeMap Positron style JSON once and dropping symbol layers sourced from
  place / poi / transportation_name — no new provider, no tile cost, no new UI
  surface.
- It appears in the existing basemap switcher for creators and viewers exactly
  like the current four. No basemap editor, no per-user customization.
- Authoring further Open Field standard basemaps stays a developer-side task
  (code-defined transforms), not a product feature, until there is a reason to
  expose it.

## 4. Tab 14 — Engagement

Unchanged from the previous pass, still direction rather than a build: line and
polygon feedback first, then sentiment rollup, upvoting, priority mapping,
then surveys. Threads, feature-attached feedback and the full participatory
toolkit stay parked.

## Technical notes

- Files touched in step 1: `src/lib/layer-style.ts` (LabelSpec fields, defaults,
  parser + migration of `bold`/`uppercase`), `src/components/map/style-labels.tsx`
  (controls), `src/components/map/map-canvas.tsx` (image registration, text
  transform expression, weight → `text-font` stack, opacity, icon-text-fit).
- Font weight maps to the glyph stacks available from the current provider; if a
  requested weight has no glyph stack it falls back to the nearest available one
  rather than rendering nothing.
- Step 2 is one migration plus `comments` export server function and a menu in the
  Comments tab; step 3 is a style-transform helper plus one entry in `BASEMAPS`.
