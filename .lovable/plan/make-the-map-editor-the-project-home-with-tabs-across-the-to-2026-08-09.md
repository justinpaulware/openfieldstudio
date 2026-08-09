# Make the map editor the project home, with tabs across the top

Clicking a project in Projects now opens the map editor directly. Details, Styling and Publishing become tabs in the map editor's top bar, so you can move between them without leaving the project.

## Behavior

- Clicking a project card goes straight to the map editor.
- A tab strip sits in the project header, always visible: **Map Editor** (was "Layers"), **Details**, **Styling**, **Publishing**.
- The header also keeps the back link to Projects, the project title and its status chip.
- Map Editor tab: today's editor (layers sidebar, map, save view, zoom to all layers) unchanged.
- Details tab: the existing title / description / slug / tags form, with Save and Delete.
- Styling and Publishing tabs: keep the current "coming in a later phase" placeholders.
- Each tab has its own URL, so it can be bookmarked, refreshed and linked to.
- Any old link to the project detail page lands on the map editor.

## Technical notes

Routing (TanStack file routes under `src/routes/_authenticated/`):

```text
projects.$projectId.tsx            -> layout: header + tab strip + <Outlet />
projects.$projectId.index.tsx      -> redirects to .../map
projects.$projectId.map.tsx        -> current editor (renamed from projects.$projectId_.map.tsx)
projects.$projectId.details.tsx    -> details form moved out of the old detail page
projects.$projectId.styling.tsx    -> placeholder
projects.$projectId.publishing.tsx -> placeholder
```

- The layout fetches the project once (`["project", projectId]`) for the title/status and handles the loading and not-found states; children reuse the same cached query.
- Tabs render as `<Link>`s with `activeProps`, not shadcn `Tabs`, so each is a real route.
- Layout wraps in a `flex h-[calc(100vh-4rem)] flex-col` container; the map route becomes `min-h-0 flex-1` so the editor still fills the viewport, and the other tabs scroll inside a centered max-width container.
- The map route's own back-link header row is dropped since the layout supplies it; its `head()` metadata stays, and each new leaf route gets its own title/description/og tags.
- No database, mutation or layer-panel changes.
