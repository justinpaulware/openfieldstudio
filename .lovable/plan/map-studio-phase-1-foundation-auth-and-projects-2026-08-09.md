# Map Studio — Phase 1: Foundation, Auth, and Projects

Build the stable base of Map Studio: account access, a dashboard, and full project management. No map canvas or data ingestion yet — those come in Phase 2, on top of a schema designed to accept them.

## What you get in this step

**Design system (Felt/Atlas-inspired)**
- Light, neutral, low-chrome canvas: near-white background, soft grey borders, generous whitespace, small radii, subtle shadows.
- One confident accent color used sparingly (buttons, active states, focus rings), plus a muted secondary palette for status chips.
- Clean geometric sans typography, tight headings, calm body text. Dark mode tokens included from the start.
- All colors as semantic tokens — no hardcoded utilities.

**Authentication**
- Email + password sign up, sign in, sign out.
- Password reset: request email + a dedicated reset-password page.
- Profiles table (display name, avatar) created automatically on signup.
- Marketing-lite landing page at `/` explaining the QGIS → Upload → Style → Publish promise, with sign-in CTA. Header reflects session state (sign in vs. account menu).

**Dashboard**
- Collapsible app sidebar: Projects, Published Maps, Comments, Settings. Published Maps and Comments render clear "coming in a later phase" empty states so the IA is in place.
- Projects list at `/dashboard/projects`: grid of project cards with thumbnail placeholder, title, status chip (Draft / Published / Archived), tags, updated date.
- Search by title, filter by status, sort by recently updated.
- Empty state that invites creating the first project.

**Project management**
- Create project: title, description, tags, auto-generated URL slug (editable, uniqueness-checked).
- Project detail/settings page: edit fields, see metadata, and placeholder tabs for Layers / Styling / Publishing that state what arrives in later phases.
- Duplicate, archive/unarchive, delete (with confirmation).
- Every project owned by its creator; users only see their own.

**Settings**
- Profile: display name, avatar upload, email shown read-only.
- Change password.

## Technical notes

- Enable Lovable Cloud (Postgres, auth, storage) for this phase.
- Tables: `profiles` (id → auth.users, display_name, avatar_url) and `projects` (id, owner_id, title, description, slug unique, tags text[], thumbnail_url, status enum draft/published/archived, created_at, updated_at). RLS on both: owners full access to their own rows; a narrow public SELECT on published projects so Phase 4's public viewer needs no schema rewrite.
- Schema is forward-designed for Phase 2: a `layers` table will carry `project_id`, `name`, `source_type` (geojson_file | csv_url | arcgis_rest), `storage_path` / `source_url`, `geometry_type`, `bbox`, `feature_count`, plus a separate `layer_styles` row. GeoJSON stays as files in storage with metadata only in Postgres; nothing here forecloses adding database-backed layers later.
- Storage buckets: public `avatars`, public `thumbnails`. A private/appropriate `datasets` bucket is created in Phase 2.
- Routing: TanStack Router. Public routes at top level (`/`, `/auth`, `/reset-password`); everything else under the `_authenticated` gate.
- Per-route SEO metadata on landing, auth, and dashboard routes.
- MapLibre is not installed yet — it lands in Phase 2 so this step stays small and verifiable.

## Roadmap after this step

- **Phase 2** — Datasets: GeoJSON upload + validation, CSV-by-URL with lat/lon, ArcGIS REST (FeatureServer/MapServer) connection, MapLibre map editor with a draggable layer panel (toggle, rename, duplicate, delete, opacity, zoom-to-layer), OpenFreeMap basemaps.
- **Phase 3** — Cartography: point/line/polygon styling, categorical and graduated data-driven styling, label engine with halos and zoom range, popup builder with `{Field}` syntax and live preview.
- **Phase 4** — Publish: draft → published, public `/maps/{slug}` viewer with layer toggles, auto legend, attribute search, map controls, and configurable iframe embed.
- **Phase 5** — Engagement: geolocated public comments, moderation queue (approve/hide/delete), CSV export.
