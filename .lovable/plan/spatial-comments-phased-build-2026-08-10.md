# Spatial comments — phased build

Plus one quick fix first.

## Quick fix: title card width

The title card caps at 22rem, so most real titles truncate. It will grow to fit the text up to roughly half the map width (with a sensible ceiling), keeping the legend width as its minimum. Truncation only happens for genuinely long titles.

---

# Phase 1 — Foundation and public submission

The part that makes the feature real: a visitor can drop a pin on a published map and leave feedback.

**Owner side**
- A "Comments" card in the Publish tab: turn commenting on/off for the project, and pick which categories are offered (defaults: General feedback, Question, Issue, Opportunity, Support, Concern, Idea).

**Visitor side (published map at `/maps/<slug>`)**
- A "Leave feedback" button on the map. Clicking it enters comment mode: the cursor changes and a hint bar explains "click the map to place your comment."
- Clicking places a temporary marker and opens a compact form card: Comment (required), Name (optional), Email (optional, never shown publicly), Category (optional).
- Submit → thank-you state explaining the comment is awaiting review. Escape / Cancel exits comment mode.
- Nothing submitted appears on the map yet — everything lands as **Pending**.

Light abuse protection: length limits, a per-visitor cooldown, and a server-side rate limit per project.

# Phase 2 — Moderation dashboard

Turns the placeholder Comments page into a real management center.

- Table of all comments across the owner's projects: Status, Comment, Category, Submitted by, Date, Project.
- Filters: project, status, category, date range, plus text search.
- Row actions: Approve, Hide, Reject, Delete. Bulk select for approve/hide/delete.
- Clicking a row opens a detail drawer with the full comment, the submitter's email (owner-only), and a small locator map showing the pin.
- A count badge on the sidebar nav for pending comments.

# Phase 3 — Comments on the published map

- Approved comments render as their own map layer, listed in the legend as "Public comments" with a visibility toggle, styled as a purple marker for now.
- Clicking a comment marker opens the existing docked card showing category, comment text, name (or "Anonymous") and date.
- A comments panel on the viewer listing approved comments, filterable by category; clicking an item flies to and highlights its pin.

# Phase 4 — Map view and export

- A map view in the dashboard: comment pins for a project alongside the list, so clusters are visible; selecting a pin selects the row.
- Export the current filtered set as CSV or GeoJSON (GeoJSON carries geometry plus all attributes, ready for QGIS).

---

## Technical notes

**Data model** — built as generic spatial annotations rather than a one-off comments table, so surveys, issue reporting and line/polygon feedback can reuse it later.

- `comments` table: `id`, `project_id`, `lng`, `lat`, `geometry jsonb` (GeoJSON geometry, point for now), `body text`, `category text`, `author_name`, `author_email`, `status` (`pending | approved | hidden | rejected` enum), `created_at`, `updated_at`, plus reserved `attributes jsonb` for future form answers.
- `projects` gains `comments_enabled boolean default false` and `comment_categories text[]`.
- RLS + grants: `anon`/`authenticated` may INSERT only when the parent project is published and `comments_enabled`; SELECT for `anon` limited to `status = 'approved'` on published projects; project owners get full SELECT/UPDATE/DELETE on their projects' comments. Status is forced to `pending` on insert by a trigger, so a client cannot self-approve. `set_updated_at` trigger as elsewhere.

**Server functions**
- Public: `submitComment` (validated with Zod, rate-limited, writes through the publishable-key client) and `listApprovedComments(slug)`, added alongside the existing `publish.functions.ts` / `publish.server.ts` pair so the public route loader stays bearer-free.
- Owner: `listComments`, `updateCommentStatus`, `deleteComments`, `exportComments` behind `requireSupabaseAuth`.

**Frontend**
- `src/components/map/comment-layer.tsx` feeds comment points through the existing `RenderLayer` pipeline in `map-canvas.tsx`, so hit-testing, legend and popups reuse current code rather than a parallel MapLibre setup.
- New `src/components/comments/*` for the form card, moderation table and detail drawer; `src/routes/_authenticated/comments.tsx` is rewritten in Phase 2.
- Title-card fix is a class change in `MapTitleCard` in `src/components/map/map-legend.tsx`.
