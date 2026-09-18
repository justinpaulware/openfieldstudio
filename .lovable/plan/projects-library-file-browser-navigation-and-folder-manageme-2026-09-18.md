# Projects Library — file-browser navigation and folder management

Turn the Projects library into a familiar file browser (Explorer / Dropbox style), built in phases.

## Phase 1 — Navigation and accurate counts

- Each folder gets its own web address, so browser Back and Forward move through the folder history exactly as expected, and a folder can be bookmarked or shared.
- Add Back, Forward, and Up buttons beside the breadcrumb trail. Up goes to the parent folder; Back/Forward follow browser history and disable when there is nowhere to go.
- Replace the ambiguous `(0)` counts with a plain-language summary of what the folder directly contains: `2 folders`, `3 projects`, `2 folders · 3 projects`, or `Empty` only when both are zero.
- Search field becomes "Search projects and folders": it matches folder names as well as project titles/descriptions, with folder results shown in their own group above the project cards.
- Fix empty states: "No projects here yet" only appears when the folder truly has no folders and no projects; a folder that holds only subfolders no longer shows the empty prompt.

## Phase 2 — Sorting

- A Sort control with: Name, Date updated, Date created, Status, Custom order (ascending/descending where it makes sense).
- Sorting applies to folders and projects independently, folders always listed first.
- The chosen sort is remembered per person (stored locally) and reflected in the address so a shared link opens the same arrangement.

## Phase 3 — Moving and reordering

- Drag a project or folder onto a folder row (or onto the breadcrumb, including "All projects") to move it there.
- Clear drop feedback: the target row highlights, invalid targets are rejected, and a folder can never be dropped into itself or into one of its own subfolders.
- Manual reordering by dragging within the current list is enabled only while Custom order is selected.
- Every move is also available without dragging: a "Move to folder…" command in each row's menu opens a folder picker that works with keyboard and on touch devices.
- Moves save immediately and show a notification with Undo that restores the previous location.

## Technical notes

- Route: new `src/routes/_authenticated/projects.$.tsx`-style addressing is avoided; instead the folder is carried as a validated search param (`?folder=<id>`, plus `sort`/`dir`) on `/projects` and `/published`, using `validateSearch` + `fallback` and `navigate({ search })`. This gives real history entries for Back/Forward without adding folder slug columns. (If you'd prefer human-readable paths like `/projects/interboro/mhredc`, that needs a new unique `slug` column on folders — say the word and I'll fold it into Phase 1.)
- `project-gallery.tsx` (678 lines) is split into: `use-library-navigation.ts` (search params, history, up/back/forward), `folder-row.tsx`, `project-card.tsx`, `move-to-folder-dialog.tsx`, and a slim gallery shell. Existing queries/mutations are reused.
- Counts: derive `{ folders, projects }` per folder id from the already-fetched folder and project lists — no extra queries.
- Custom order uses the existing `sort_order` columns on `projects` and `project_folders`; reordering writes a compacted sequence for the affected sibling set in one batched update.
- Undo: keep the previous `folder_id` / `parent_id` in the toast action and issue the reverse update; optimistic cache updates via `setQueryData`, invalidate on settle.
- Circular-move guard reuses/extends the existing `isDescendant` check, applied to both drag-and-drop and the Move dialog (invalid targets disabled).
- Drag-and-drop stays on native HTML5 drag events (as today) with pointer-based fallback for the reorder handle; no new dependency unless reordering proves unreliable, in which case `@dnd-kit/core` is added in Phase 3 only.
