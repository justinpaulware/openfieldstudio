# Folder rename inline + Publish page restructure

## Part 1 — Click-to-rename folders in the Projects library

Today renaming a folder requires the "..." menu and a browser prompt. Replace it with the same inline editing used for layer names in the Map Editor.

- Clicking the folder name turns it into a text field, pre-selected.
- Typing only changes local text; the new name is saved when you click away or press Enter.
- Escape cancels and restores the previous name.
- Clicking the name no longer opens the folder; the rest of the row still does.
- Keep "Rename" in the "..." menu as a secondary path (it now starts inline editing instead of showing a prompt), so keyboard and touch users keep access.

## Part 2 — Publish page reorganized around Project → Views

Rebuild the Publish tab so project-level settings and view-level settings are clearly separated.

### New page order

1. **Header** — "Publish" + status, with a **Save changes** button right under the title (same action as the bottom one; both show unsaved-changes state and disable when nothing changed).
2. **Project** — title, description, project slug, tags.
3. **Public project URL** — the project address (openfield.nu/username/project-slug) with a copy button. No embed code here.
4. **Attribution** — data sources and credits, in their own section.
5. **Views** — short explanation, plus the two project-wide view settings: Enable view navigation, Default view.
6. **View cards** — one collapsible card per view, listed with Main first.

### Each view card contains

- View name, MAIN badge where relevant, and published/draft status.
- Editable view slug (Main's slug stays fixed, since it is the project URL), with the resulting address previewed.
- Public URL with copy and Open buttons.
- Show view navigation toggle.
- Embed settings for that view: legend, title card, height, and generated embed code pointing at that view's URL.
- Publish / Unpublish button.

The single global Embed section is removed; embeds now live inside each view.

7. **Footer** — Delete project (left) and Save changes (right), as today.

### Also included

- Leaving the page with unsaved edits prompts a confirmation.

## Technical notes

- Inline rename: reuse the `NameEditor` pattern from `src/components/map/layer-panel.tsx` (local draft, commit on outside pointerdown/Enter, cancel on Escape) inside the folder rows of `src/components/projects/project-gallery.tsx`, wired to the existing `renameFolder` mutation. Guard the drag handle and row-click navigation while editing.
- Publish page (`src/routes/_authenticated/projects.$projectSlug.publish.tsx`) is restructured; per-view state persists to `project_views` (`slug`, `show_view_nav`, `embed_config`, `status`) through the existing `useUpdateView` hook, while project fields keep writing to `projects`. Main view stays synchronized with the project record as it does now.
- View slug edits validate uniqueness within the project and lowercase/hyphenate input.
- Unsaved-changes prompt uses a router `beforeLoad`/blocker plus `beforeunload`.
