# Fix rename and folder drag-and-drop in the Layers panel

Two issues in the map editor's Layers sidebar: the "Rename" menu item flashes the edit box closed, and folders can't actually be reordered.

## 1. Rename from the ... menu stays open

Today the dropdown closes and returns focus to its trigger button. That fires the rename input's blur handler in the same instant, which cancels editing before you can type.

Fix:
- Start editing after the dropdown finishes closing (prevent the menu's default focus return, then set the editing target on the next frame).
- Ignore a blur that happens before the input has actually been focused, so a stray focus shift can't cancel a fresh rename.
- Keep current commit behavior: Enter or blur saves, Escape cancels.

## 2. Folder and layer reordering with a drop-indicator line

Replace the current "drop onto another row" logic with position-based dragging, like Adobe/QGIS layer lists.

- While dragging, compute whether the pointer is in the top or bottom half of the row under it, and show a thin horizontal accent line at that exact insertion point (above or below the row).
- Show the line for both layers and folders, including at the very top and very bottom of the list, so you can drop at the beginning or end.
- Dropping onto the middle of a folder row (not its top/bottom edge) still moves the dragged item *into* that folder, with the existing highlight to distinguish it from reordering.
- Folders can be reordered among their siblings, moved between top level and a parent folder, and moved to the end/beginning of the root list. Existing guard rails stay: no dropping a folder into itself or its own child, nesting stays one level deep.
- Layers keep working the same way, but now get the same precise insertion line, and dragging a layer next to a row inside a folder places it in that folder at that position.
- Clear the indicator on drag end/leave/drop so nothing lingers.

## Technical notes

All changes are in `src/components/map/layer-panel.tsx`:
- Extend the drag state with a drop target of the form `{ id, position: 'before' | 'after' | 'inside' }`, derived from `event.clientY` against the row's bounding box (top 25% = before, bottom 25% = after, middle = inside for folders, before/after split at midpoint for layers).
- Build a flattened, ordered render list so the insertion index is unambiguous, then emit the existing `onReorder` (layer id order), `onFolderReorder` (sibling folder id order), `onMoveToFolder`, and `onFolderMove` callbacks — no changes to the route, mutations, or database schema.
- Add a root-level trailing drop zone so the end of the list is always reachable.
