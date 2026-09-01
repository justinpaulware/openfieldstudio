# Planning review: Tabs 13-16

No build this round. This is the sequencing and scoping pass for comment export (13), engagement (14), basemaps (15), and advanced labels (16), grounded in what the code already supports.

## What the code already gives us

- `comments` already stores a real GeoJSON `geometry` jsonb column alongside `lng`/`lat`, plus `category`, `status`, `attributes jsonb`. Tab 13's "geometry as source of truth" model is already half-built; no migration is needed for point export, and lines/polygons need only a `geometry_type` column plus a drawing UI.
- Basemaps are a 4-item hardcoded list (`positron`, `bright`, `dark`, `liberty`) pointing at OpenFreeMap style URLs. There is no style-cloning layer, no project default beyond the stored id, and no view-level basemap.
- `LabelSpec` already has field, size, bold, color, halo color/width, placement, offset, overlap, min/max zoom, uppercase, max width. Tab 16 Phase 1 mostly means: replace `bold` with a weight scale, replace `uppercase` with a transform enum, and add a background block. No background, no text opacity, no halo opacity today.

## Recommended build order

Cheapest-to-highest-value first, and each one ships alone.

### 1. Tab 16 Phase 1 — Label background and typography (build next)
Highest visual payoff per unit of work, no schema change (`label_config` is jsonb).

- `textTransform`: original / UPPERCASE / lowercase / Title Case (replaces the `uppercase` boolean, migrated on read).
- `fontWeight`: light / regular / medium / bold (replaces `bold`, migrated on read).
- Label background: enable toggle, color, opacity, padding 0-10px, rectangle only.
- `textOpacity`.

Technical note: MapLibre has no native text background. The rectangle comes from a 1x1 white SDF-tintable image used as `icon-image` with `icon-text-fit: both` and `icon-text-fit-padding`, tinted by `icon-color`/`icon-opacity`, drawn in the same symbol layer as the text so it moves and collides with the label. Borders (Phase 2) need a second stretched image with a border baked in, or a second symbol layer beneath — worth prototyping before promising it.

### 2. Tab 13 — Comment export (build after)
Small, self-contained, immediately useful.

- Export menu in the project Comments tab: CSV and GeoJSON.
- Filters carried from the current table view: status, categories, date range.
- Fields: comment id, project id/name, view, body, category, status, author name, email (owner only), created/updated, lng/lat. GeoJSON uses the stored `geometry` directly, all other fields as properties.
- Generated in a `requireSupabaseAuth` server function so email is never exposed client-side to non-owners; returned as a download.
- Add `geometry_type` to `comments` now (defaulting to `Point`) so line/polygon feedback later needs no migration, and export WKT for non-point rows in CSV.

### 3. Tab 15 — Basemap system (medium)
Turn the hardcoded list into a registry.

- A `src/lib/basemaps.ts` registry: id, label, group (Vector / Satellite / Terrain), base style URL, and an optional style transform function.
- Open Field Light and Open Field Light (No Labels) are produced by fetching the OpenFreeMap style JSON once and filtering/recoloring layers — label suppression is just dropping symbol layers whose source-layer is place/poi/transportation_name. Open Field Dark same approach. This keeps one provider and no tile costs.
- Project-level default basemap (already stored), then view-level override reusing the existing view-settings resolver.
- Publish setting "Allow viewer basemap switching" and a viewer control: later, once the registry exists.

Open question for this tab: whether Basemap becomes its own project tab or a "Map settings" panel inside the editor. Recommendation is a panel in the editor — a whole tab for one setting is heavy, and view-level overrides belong next to the view switcher.

### 4. Tab 14 — Engagement (direction, not a build)
Tab 14 is a product thesis rather than a feature spec. The parts that are concretely buildable next, in order:

1. Line and polygon feedback — the drawing UI is the work; the data model is nearly ready.
2. Sentiment category rollup (counts by category on the Comments tab and optionally on the published map).
3. Upvoting — one small `comment_votes` table, anonymous-keyed, plus a sort-by-support option.
4. Priority mapping ("place 3 pins") — a per-project prompt with a submission budget; reuses comments plus a heatmap style that already exists.
5. Spatial surveys and scenario feedback tied to Views — real projects in their own right; not to be scoped until 1-4 land.

Explicitly parked: discussion threads, layer/feature-attached feedback, full participatory toolkit.

### Also noted from the doc
Tab X (QML import) stays a V2 item. It slots naturally after Tab 16, because a richer label model plus the existing categorized/graduated specs are what a `.qml` parser would need to map into.

## What I'd like your call on

- Confirm the order above (labels → export → basemaps → engagement), or reshuffle.
- Basemap as its own tab vs. a map-settings panel in the editor.
- Whether comment export should include author email by default or behind a "include contact details" checkbox.
