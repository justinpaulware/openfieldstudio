# Phase 5 — Publish tab and the public map viewer

Turn a project from an editing workspace into a shareable, embeddable public map. The "Details" tab is retired and its fields move into a renamed "Publish" tab.

## 1. Publish tab (replaces Details + Publishing)

Top project tabs become: **Map Editor** | **Publish**. `/projects/:id/details` and `/projects/:id/publishing` both resolve to the new `/projects/:id/publish` (old paths redirect).

The Publish tab is a single scrollable page of cards:

- **Status & link** — Draft / Published / Archived control, publish and unpublish buttons, the live URL `/maps/<slug>`, Copy link, and Open in new tab.
- **Project details** (moved from Details) — Title, Description, URL slug with availability/validation, Tags, created/updated dates, and Delete project.
- **Map metadata** — Author, Credits, Data sources, plus the auto "Last updated" date. These render in the public viewer's info panel.
- **Embed** — live preview of the iframe, Copy embed code, and settings: width/height presets (Small 400px, Medium 600px, Full width) or custom, Show sidebar, Show legend, Show header. Settings are encoded as URL params on the embed src so one published map can be embedded several ways.
- **Opening view** — reuses the view already saved in the Map Editor; shows the current saved center/zoom with a link back to the editor to re-save it.

Publishing validates first: needs a title, a unique slug, and at least one layer.

## 2. Public map viewer at `/maps/:slug`

A public, server-rendered route with no editor chrome. Only projects with status `published` resolve; anything else returns a clean not-found page.

```text
┌──────────────────────────────────────┐
│ Header: title · share · fullscreen   │
├───────────────┬──────────────────────┤
│ Sidebar       │ Map                  │
│ description   │  zoom / locate /     │
│ layers (on/off)│  reset extent       │
│ legend        │                      │
│ about+credits │                      │
└───────────────┴──────────────────────┘
```

- Sidebar is collapsible; on mobile it becomes a bottom sheet so the map stays primary.
- Layer list with visibility toggles; legend auto-generated from the same styling engine the editor uses (single symbol, categories, graduated), so it always matches.
- Popups and labels behave exactly as configured in the editor.
- Map controls: zoom, fullscreen, locate me, reset to the saved opening view. Basemap is the project's saved basemap.
- Info section carries description, author, credits, data sources, last updated.
- A reserved, currently-empty region below the info section for future comments/feedback.
- Query params `?sidebar=0&legend=0&header=0` drive the embed variants.
- Route `head()` sets title, description, canonical and og/twitter tags from the project.

Deferred to a later pass (per scope decision): feature/address search, comments, measure tool.

## 3. Technical notes

**Database migration**
- Add to `projects`: `author text`, `credits text`, `data_sources text`, `embed_config jsonb not null default '{}'` (width/height/show flags), `published_at timestamptz`.
- Public SELECT policies already exist on `projects`, `layers`, `layer_styles`, and `layer_folders` for published projects, so anonymous reads work.

**Data access for anonymous viewers**
Layer files live in the private `datasets` bucket and the editor signs URLs as the owner — anonymous visitors cannot do that. Add a public server function `getPublishedMap(slug)` that:
1. reads project + folders + layers + styles with a publishable-key server client (RLS enforces "published only"),
2. verifies the project is published, then mints short-lived signed URLs for that project's storage paths using the admin client loaded inside the handler,
3. returns everything the viewer needs in one payload.

Route-level: `/maps/$slug` is a public top-level route (SSR on, no auth gate) whose loader calls this public function — never a `requireSupabaseAuth` function.

**Frontend**
- Extract the shared rendering pieces (`MapCanvas` sync logic, `MapLegend`) so the viewer reuses them read-only rather than forking styling code.
- New: `src/routes/maps.$slug.tsx` (viewer), `src/components/map/public-viewer.tsx`, `src/components/publish/*` cards, `src/lib/publish.functions.ts`.
- Rewrite `projects.$projectId.publish.tsx`; delete the details and publishing routes; update the tab list, the projects list, and the Published page to link to `/maps/<slug>`.
