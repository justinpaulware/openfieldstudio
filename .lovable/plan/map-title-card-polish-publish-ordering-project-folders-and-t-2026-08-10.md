# Map title card polish, Publish ordering, project folders and thumbnails

## 1. Title card sizes to its text

The title card is a fixed 256px wide. It becomes fluid: it shrinks to fit short titles but never gets narrower than the legend card below it, and never grows past a comfortable stopping point that leaves room for the popup card on the right.

- Minimum width matches the legend card exactly, so short titles still line up.
- Maximum width is capped so the title never crowds the right-hand controls/popup; longer titles truncate with an ellipsis as they do today.

## 2. Even padding around the logo mark

In the title card the space to the left/right of the mark differs from the space above/below. Padding becomes uniform so the mark sits in visually balanced white space, with the title text vertically centered against it.

## 3. Publish tab order

"Project details" moves to the top of the Publish page, above "Public link". Attribution and Embed follow, and the Publish/Unpublish action row stays in the header.

## 4. Folders in the projects gallery

- A "New folder" button sits next to "New project".
- Folders render as rows/cards above the project grid; clicking one opens it, with a breadcrumb back to the top level.
- Drag and drop mirrors the layers sidebar: drag a project onto a folder to move it in, drag folders to reorder or nest them, with the same horizontal drop-line indicator.
- Folder row menu: rename, delete (projects inside move back to the top level).

## 5. Map thumbnails

The empty preview area on each project card becomes a real snapshot of the map.

- The thumbnail is captured automatically whenever you save the map view in the editor (and on publish), from the current map canvas.
- Cards show the saved image, falling back to today's placeholder icon when a project has never had its view saved.

## 6. Published maps page matches Projects

The Published page is rebuilt to be the same experience as Projects: same card grid with thumbnails, status, tags and updated time, same search/filter row, and the same folder tree (one shared set of folders — Published just shows the published maps inside them). Cards link to the live `/maps/<slug>` URL with a link back into the editor.

## Technical notes

**Database**
- New `project_folders` table (owner_id, parent_id, name, sort_order, collapsed) with owner-scoped RLS and grants, mirroring `layer_folders`.
- Add `folder_id uuid references project_folders` and `sort_order int` to `projects`. `thumbnail_url` already exists and gets reused.
- New public `project-thumbnails` storage bucket with owner-write / public-read policies.

**Thumbnails**
- MapLibre needs `preserveDrawingBuffer: true` on the map constructor in `src/components/map/map-canvas.tsx` for `canvas.toDataURL()` to work; expose a `captureThumbnail()` via the existing map ref.
- On "Save view" in `projects.$projectId.map.tsx` (and on publish), downscale the canvas to ~800x450 JPEG, upload to the bucket at `<projectId>.jpg`, and store the public URL on `projects.thumbnail_url` with a cache-busting query param.

**Frontend**
- Extract the shared gallery into `src/components/projects/project-gallery.tsx` (cards, folder tree, DnD, search/filter) and have both `projects.index.tsx` and `published.tsx` render it with a different filter and card link target.
- Reuse the drop-line/DnD approach from `src/components/map/layer-panel.tsx`.
- `src/components/map/map-legend.tsx`: `MapTitleCard` swaps `w-64` for `min-w`/`max-w` with even padding around `BrandMark`.
- `src/routes/_authenticated/projects.$projectId.publish.tsx`: reorder sections only.
