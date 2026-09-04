# Next step: Engagement — line & polygon feedback (incremental)

The roadmap's only open feature is engagement: letting visitors draw lines and
areas, not just drop pins. Good news from checking the database — half the
groundwork already exists:

- `comments.geometry_type` column is there (defaults to `Point`).
- The insert trigger already **preserves** a client-supplied LineString or
  Polygon geometry and only rewrites geometry for points.
- Export already reads `geometry_type` and writes WKT.

So this is mostly a front-end build. To keep credit usage tight, it ships in
three small slices, each independently checkable in the preview.

## Slice 0 — Rename the tab + breadcrumb fix (quick)

- The "Comments" project tab becomes **Engagement** (label and page heading).
  The URL stays `/projects/:slug/comments` so existing links keep working —
  renaming the route file is a bigger, riskier change for no user benefit; say
  the word if you'd rather have `/engagement` too.
- Breadcrumb status badge: the publish mutation invalidates the project query
  so the badge flips to "Published" immediately instead of on reload.

## Slice 1 — Owner setting + server acceptance (small)

- Migration: add `projects.comments_allow_shapes boolean not null default false`
  (existing table, no new grants needed). Regenerate types.

- `submitComment` accepts an optional `geometry` (GeoJSON Point/LineString/
  Polygon, Zod-validated). If the geometry is not a Point and the project has
  `comments_allow_shapes = false`, reject with a clear message. `lng`/`lat` are
  derived from the shape's centroid so the existing list, map pin and export
  paths keep working.
- Comments tab sidebar: a "Allow drawn lines and areas" switch next to the
  existing comment settings, saved with the same Save button.

Check: toggle the setting, save, reload — it sticks. No visitor-facing change
yet.

## Slice 2 — Drawing in the public viewer (the main slice)

- Composer gets a Point / Line / Area mode toggle, shown only when the project
  allows shapes. Point behaves exactly as today.
- Hand-rolled drawing (no new dependency): click to add vertices, double-click
  or Enter to finish, Esc to cancel, with the in-progress shape drawn live from
  a temporary GeoJSON source. A short hint line tells the visitor what to do.
- Submit sends the full geometry; body/name/email/category flow unchanged.

Check: draw a line and an area on the published map, submit both, confirm they
save and the shapes appear.

## Slice 3 — Rendering and moderation polish (small)

- Approved line/area comments render as a GeoJSON layer styled to match the
  existing purple comment markers (stroke for lines, stroke + translucent fill
  for areas); clicking one opens the same comment card. Points unchanged.
- Comments list (public panel and the owner's Comments tab) shows a small
  "Line" / "Area" chip beside the category chip.
- The owner's Comments tab map shows shapes too, and selecting a row zooms to
  the shape rather than a single point.

Check: the shapes are visible, clickable, and moderatable from the Engagement tab.

## Technical notes

- Touches: one migration + type regen, `src/lib/publish.functions.ts`
  (`submitComment`), `src/components/comments/comment-composer.tsx`,
  `src/components/comments/comment-panel.tsx`,
  `src/components/public/public-map.tsx`, `src/components/map/map-canvas.tsx`
  (approved-shape source), the Engagement route sidebar, the project tab list
  in `projects.$projectSlug.tsx`, and the publish mutation's cache
  invalidation.
- No new npm packages; MapLibre has no built-in draw tool and a draw library is
  heavy for three geometry types.
- Existing rows are all Points, so no backfill.
- `roadmap.md` gets the rename and breadcrumb fix recorded as tasks.

