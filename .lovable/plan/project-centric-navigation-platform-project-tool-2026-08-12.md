# Project-centric navigation: Platform → Project → Tool

Published Maps and Comments stop being platform destinations. Everything map-specific lives inside the project, and the Open Field dropdown becomes a workspace hub.

## Navigation

**Open Field dropdown (top-left)**
- Recent Projects — up to 5 most recently updated projects, click to jump straight into that project's Map Editor
- All Projects →
- Settings →
- Sign out

The account avatar on the right keeps the profile summary; Settings and Sign out appear in both places so either path works.

**Project header (breadcrumb)**
Replaces the current "← Projects" back link with an explicit hierarchy:

```text
Open Field ▼   Projects / St. Louis Schools ▼        [ Map Editor | Publish | Comments ]
```

The project name is a dropdown: recent projects to switch between, plus "All Projects →".

**Project tabs:** Map Editor · Publish · Comments

## Comments tab

A per-project comments workspace at `/projects/:id/comments`:
- List of every comment on the project (newest first) with author, time, category and body
- Clicking a comment flies the mini map to its pin and highlights it
- Per-comment actions: hide / restore, delete
- Comment settings (enable commenting, categories) move here from the Publish tab, since they belong with comments
- Empty state when the project has no comments yet, with a note if commenting is off

## Removals

- `/published` and `/comments` top-level routes are removed. Both redirect: `/published` → `/projects`, `/comments` → `/projects`.
- The Projects gallery gains a status filter (All / Draft / Published) so the "published maps" view is still reachable in one click.

## Technical notes

- `src/components/app-shell.tsx`: `BrandMenu` fetches recent projects (`projects` ordered by `updated_at`, limit 5) and renders Recent / All Projects / Settings / Sign out. `navItems` drops Published maps and Comments.
- New `src/components/projects/project-switcher.tsx` for the project-name dropdown, reused in the project header.
- `src/routes/_authenticated/projects.$projectId.tsx`: breadcrumb + three tabs (Map Editor, Publish, Comments).
- New route `projects.$projectId.comments.tsx`; reuses `MapCanvas` with `commentPins` and the existing comment row styling from `src/components/comments/comment-panel.tsx`.
- Owner-side comment reads/moderation go through the authenticated client against the `comments` table (RLS by project owner); status updates set `hidden` / `approved`.
- `published.tsx` and `comments.tsx` become redirect-only routes so existing links keep working. `ProjectGallery` keeps its `mode` prop but `published` is driven by the new filter instead of a separate page.
- No schema changes.
