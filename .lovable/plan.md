# Projects library: drag handles and drop lines like the map editor

Bring the Projects library drag experience in line with the layers list in the map editor.

## What changes

- **Grab handle on every row.** A grip symbol sits on the far left of each folder row, left of the folder icon, and on each project card. It is always visible (not only in Custom order) and shows the grab cursor.
- **Highlight line shows where it lands.** While dragging, a thin accent line appears between rows at the exact insertion point — above a row when hovering its top half, below when hovering its bottom half. This replaces today's whole-row border/ring flash.
- **Dropping into a folder still works.** Hovering the middle of a folder row highlights that row instead of showing a line, meaning "put it inside this folder". Breadcrumbs and the "All projects" crumb keep their existing highlight-to-move-into behavior.
- **Order saving stays as it is.** Reordering only persists a new manual order when the list is sorted by Custom order; in any other sort, dragging still moves items into folders but does not claim to reorder them. If someone drags to reorder while sorted by name or date, a short notice explains that Custom order is needed, with a one-click switch.
- **Undo notice unchanged.** Moves between folders keep the existing undo notification.

## Technical notes

- Mirror the pattern in `src/components/map/layer-panel.tsx`: a `DropTarget = { kind, id, position: "before" | "after" | "inside" }` state, a `positionFrom(event)` helper using the pointer's Y offset within the row (top 30% / bottom 30% / middle for folders; halves for projects), and an absolutely positioned `DropLine` element rendered inside each relatively positioned row.
- Rework `src/components/projects/project-gallery.tsx`:
  - Replace `dropTarget: string | null` + `insertBefore: string | null` with the single `DropTarget` object; keep `dragRef` for the dragged item.
  - Drop handling merges the current `dropInto` and `dropReorder` paths: `inside` -> `applyMove`, `before`/`after` -> splice the id into the visible sibling list and call the existing `reorder` mutation (`sort_order` writes), plus `applyMove` when the parent folder also changed.
  - Always render the grip; set `draggable` on the row itself so the grip is an affordance, matching the layers panel.
  - Keep circular-move guards (`isDescendant`) and the existing `MoveToFolderDialog` command intact.
