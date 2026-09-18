# Projects library: drag handles, drop lines, simpler navigation

## Part 1 — drag like the map editor

Today the grab handle and reordering only appear when the list is sorted by Custom order, and the drop feedback is a whole-row highlight. Match the layers list in the map editor instead:

- **Grab handle on every row, always.** A grip symbol sits on the far left of each folder row, left of the folder icon, and on each project card, with the grab cursor.
- **Highlight line shows where it lands.** While dragging, a thin accent line appears between rows at the exact insertion point — above a row when hovering its top half, below when hovering its bottom half.
- **Dropping into a folder still works.** Hovering the middle of a folder row highlights that row instead of showing a line, meaning "put it inside this folder". Breadcrumbs keep their existing highlight-to-move-into behavior.
- **Order saving.** A new manual order is only saved when the list is sorted by Custom order. If someone drags to reorder in another sort, a short notice explains that, with a one-click switch to Custom order.
- Moves between folders keep the existing undo notification and the circular-move guard.

## Part 2 — drop the Up arrow

Back and Up do overlap almost all the time: when you got into a folder by clicking into it, Back and Up go to the same place. Up is only different after arriving from a bookmark, a reload, or a jump between unrelated folders — and in those cases the breadcrumb right next to the buttons already gets you to the parent in one click.

So: remove the Up arrow, keep Back and Forward. Parent navigation stays available through the breadcrumb trail, which also shows where you are.

## Technical notes

- Mirror `src/components/map/layer-panel.tsx`: a `DropTarget = { kind, id, position: "before" | "after" | "inside" }` state, a `positionFrom(event)` helper based on the pointer's Y offset within the row (top 30% / bottom 30% / middle for folders; halves for projects), and an absolutely positioned `DropLine` inside each relatively positioned row.
- In `src/components/projects/project-gallery.tsx`:
  - Replace `dropTarget: string | null` + `insertBefore: string | null` with the single `DropTarget` object; keep `dragRef` for the dragged item.
  - Merge `dropInto` and `dropReorder`: `inside` -> `applyMove`; `before`/`after` -> splice the id into the visible sibling list and call the existing `reorder` mutation (`sort_order`), plus `applyMove` when the parent folder also changed.
  - Render the grip unconditionally; `draggable` stays on the row so the grip reads as an affordance.
  - Remove the Up button and its `parentId` computation; leave Back (`router.history.canGoBack()`) and Forward untouched.
