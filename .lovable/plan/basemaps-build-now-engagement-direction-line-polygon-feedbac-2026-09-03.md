# Basemaps (build now) + Engagement direction (line & polygon feedback)

## 1. Basemaps — Positron (No Labels) — build now

Confirmed scope: a single new basemap, "Positron (no labels)," available to map
creators and public viewers exactly like the existing four. No basemap editor,
no per-user customization, no other no-labels variants. Authoring further Open
Field standard basemaps stays a developer-side (code) task.

### How it works

The existing four basemaps load from `https://tiles.openfreemap.org/styles/<id>`.
The no-labels option is the OpenFreeMap Positron style with its text label
layers removed. Verified against the real style: it has 55 layers, 19 of which
are `symbol` layers, and all 19 carry a `layout.text-field` (place names, road
names, water names, highway shields, airport). Dropping every symbol layer
that has a `text-field` removes every visible label and nothing else — the
base land/water/road fills stay. The stripped style is ~15 KB.

### Serving it

A public server route transforms the style at request time so the existing
`map.setStyle(url)` flow is untouched and the unauthenticated published viewer
can load it the same way as the other four.

- New route `src/routes/api/public/styles/positron-nolabels.ts`:
  `createFileRoute` with a `server.handlers.GET`. Handler fetches
  `https://tiles.openfreemap.org/styles/positron`, parses JSON, filters
  `layers` to drop any `type === "symbol"` layer whose `layout` has a
  `text-field` (string or expression), returns the JSON with
  `Content-Type: application/json` and `Cache-Control: public, max-age=86400`.
  No secrets, fully public, edge-cacheable. The sprite/glyphs/source URLs
  inside the style are absolute OpenFreeMap URLs, so they keep working.
- `src/components/map/map-canvas.tsx`: add
  `{ id: "positron-nolabels", label: "Positron (no labels)" }` to `BASEMAPS`. In
  `basemapUrl`, return `"/api/public/styles/positron-nolabels"` for that id.
  Nothing else changes — `map.setStyle(basemapUrl(...))` already fetches a URL,
  so the editor and the public viewer both pick it up automatically, and the
  in-map basemap switcher lists it like the others.
- No migration: `projects.basemap` is a text column; saving
  `positron-nolabels` as the project default works as-is.

### Verification

- `bunx tsgo --noEmit` clean.
- Playwright on the map editor: switch to "Positron (no labels)" and screenshot
  — no place/road labels visible, base map intact. Switch back to Positron —
  labels return. Then check the published viewer loads the same style.

## 2. Engagement — Line & polygon feedback (direction, build when run credits return)

Goal: let visitors leave line and polygon feedback, not just point pins. This
is the first real engagement build; upvoting, sentiment, and surveys stay
parked. Owner-enabled per project: a separate project setting turns spatial
drawing on, off by default, so existing maps are unaffected.

### Schema

- `public.projects`: add `comments_allow_shapes boolean not null default false`.
  Existing table, so a GRANT-free `ALTER TABLE ... ADD COLUMN` is enough.
- `public.comments`: add `geometry_type text not null default 'Point'`
  (`'Point' | 'LineString' | 'Polygon'`). The existing `geometry` jsonb column
  already holds a GeoJSON geometry; today the `force_pending_comment` trigger
  overwrites it with a Point built from `lng`/`lat`. Change that trigger so a
  client-provided geometry is preserved (Point, LineString, or Polygon), and
  `lng`/`lat` are derived from the geometry's centroid for point-only, so the
  comment list and index stay consistent. Backfill is not needed — every
  existing row is already a Point.

### The gate

`comments_allow_shapes` is enforced in the `submitComment` server function,
not in RLS: before insert, look up the project; if the submitted geometry is
not a Point and `comments_allow_shapes` is false, reject with a clear error.
The existing anon-insert RLS policy still governs who can comment; the shape
gate only decides *what shape* is allowed on a given project. This keeps the
gate logic in one auditable place and avoids a fragile geometry-aware policy.

### Drawing UX (public viewer)

- The comment composer currently has one "drop a pin" mode (`pickMode`).
  Extend it with a small mode toggle — Point / Line / Polygon — shown only when
  the project has `comments_allow_shapes` on. Point keeps today's click-to-drop
  behaviour. Line and Polygon use a lightweight hand-rolled draw: click to add
  vertices, double-click or Enter to finish, Esc to cancel. No new draw
  dependency — MapLibre GL doesn't bundle drawing, and `maplibre-gl-draw` is a
  heavy add for an MVP; a few dozen lines of vertex tracking + a GeoJSON source
  covers the three geometry types and matches the Atlas-simple feel.
- The drawn shape is shown live as a temporary GeoJSON source (the existing
  `pin` prop generalizes to `pendingGeometry`). On submit, the full geometry is
  sent; the composer body/name/category flow is unchanged.

### Rendering approved shape comments

- Approved shape comments render as their own GeoJSON layer on the map, styled
  to match the existing purple comment markers (stroke + translucent fill for
  polygons, stroke for lines). Point comments keep the current markers. The
  Comments tab list and export already work off `geometry`/`lng`/`lat`, so the
  export (Tab 13) picks up shapes once the trigger preserves them.

### Open decisions for the engagement build

- Drawing library vs hand-rolled: recommending hand-rolled (above) — confirm
  when we build.
- Whether polygon/line comments get a distinct comment-list row treatment (a
  small geometry chip + mini-thumbnail) or just show as text rows like points:
  recommend a small "Line"/"Area" chip next to the category chip, no thumbnail.

## Technical notes

- Basemaps build touches: one new server route, one small edit to
  `map-canvas.tsx` (BASEMAPS + basemapUrl). No migration, no type regeneration.
- Engagement build touches: one migration (two columns + trigger rewrite), the
  `submitComment` server function (geometry + gate), `comment-composer.tsx`
  (mode toggle + draw), `public-map.tsx` (pendingGeometry + shape rendering),
  `comment-panel.tsx` (chip), and `map-canvas.tsx` (approved-shape source).
  Regenerate Supabase types after the migration.
