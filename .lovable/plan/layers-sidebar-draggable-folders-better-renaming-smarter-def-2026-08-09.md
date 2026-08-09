# Layers sidebar: draggable folders, better renaming, smarter default extent

## 1. Drag and drop for folders

Folder rows become draggable, just like layers:

- Drag a folder over another folder to nest it inside (still one level of nesting — dropping a folder that already has a subfolder inside another folder is refused with a short toast).
- Drag a folder over the empty area of the list, or over a top-level row, to move it back out to the top level and reorder it among its siblings.
- Drop targets highlight the same way they do today, and a folder can't be dropped into itself or its own child.
- Sibling order is saved to the folder's sort order, so the arrangement persists.

## 2. Rename that behaves like a proper rename

Today the name is a permanently editable input that writes to the database on every keystroke, which is why typing lags and why there is no visual cue.

New behaviour for both layers and folders:

- The name renders as plain text. A single click on the name (or "Rename" in the "..." menu) enters edit mode.
- In edit mode the name sits in a light bordered box with a visible focus ring and the text pre-selected, so it is obvious you're editing.
- Typing is local and instant — nothing is saved while you type.
- Enter or clicking away commits and saves once. Escape cancels and restores the previous name.
- Clicking the name no longer selects/deselects the layer, so entering rename mode doesn't collapse the opacity controls.

## 3. Default map extent follows the current layers

- When the editor opens and the project has no saved view, the map fits the combined extent of all visible layers rather than the world view.
- When the project has a saved view that predates the current data, that stale frame is still what you get on open (it is your saved choice) — so a **Zoom to all layers** button goes in the map toolbar next to Save view. One click frames everything, then Save view stores it.
- If no layer has a usable extent, the map falls back to today's default world view.

## Technical notes

- `src/components/map/layer-panel.tsx`: add `draggable` to folder rows with a drag payload discriminating layer vs folder; local `editingId` + `draftName` state driving an inline `Input` with commit/cancel handlers; new `onFolderReorder(orderedIds)` and folder-into-folder move via the existing `onFolderRename`-style mutation shape.
- `src/routes/_authenticated/projects.$projectId_.map.tsx`: wire `onFolderMove` / `onFolderReorder` to the existing `updateFolder` mutation (patching `parent_id` and `sort_order`); rename callbacks now fire once on commit instead of per keystroke.
- Combined extent: derive a union bbox from `layers[].bbox` in a memo; pass as `initialBbox` to `MapCanvas` when the project has no `map_center`, and use it for the new toolbar button through the existing `mapHandle.fitBbox`.
- No database migration needed — `layer_folders.parent_id` and `sort_order` already exist.
