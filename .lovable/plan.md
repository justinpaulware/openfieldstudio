# Reclaim map editor space: brand dropdown + two header bands

Today the editor stacks three bands (app header with the sidebar toggle, project header with tabs, map action bar). This collapses it to two and replaces the left sidebar with a dropdown under the Open Field brand.

## 1. Sidebar becomes a brand dropdown

- Remove the persistent left sidebar and its collapse toggle.
- Top-left of the app header: the Open Field logo tile + "Open Field" title, with a small chevron to its right — the whole thing is a dropdown trigger.
- The dropdown holds: Projects, Published maps, Comments, Settings, then a separator, the signed-in account (name/email), and Sign out.
- Active route is marked in the menu so you always know where you are.

## 2. Two header bands instead of three

```text
Band 1:  [Open Field v]                    Map Editor | Details | Publishing
Band 2:  < Projects   Project title  [status]      Legend  Zoom to all layers  Save view
```

- Band 1: brand dropdown on the left, project tabs (Map Editor, Details, Publishing) right-aligned on the same row.
- Band 2: back link to Projects, project title and status chip on the left; Legend, Zoom to all layers, and Save view right-aligned on the same row.
- The map action bar row is gone; the map canvas and layers sidebar grow by roughly one band height.
- On non-project pages (Projects list, Published, Comments, Settings) band 1 shows just the brand dropdown and band 2 is not rendered, so those pages gain space too.
- Below ~768px the tabs and map actions wrap as they do now; no functional change to any button.

## Technical notes

- `src/components/app-shell.tsx`: drop `SidebarProvider`/`Sidebar`/`SidebarTrigger` usage; render a single sticky header with a `DropdownMenu` brand trigger (existing `items` array plus profile + sign out from the current footer). Add a right-side slot rendered from a small React context (`AppHeaderSlot` provider + `useHeaderSlot` portal target) so route-level content can inject into band 1.
- `src/routes/_authenticated/projects.$projectId.tsx`: portal the `TABS` nav into the app header slot instead of rendering its own tab row; keep its own band (back link + title + status) and expose a second slot (`ProjectHeaderActions` context/portal) for leaf routes.
- `src/routes/_authenticated/projects.$projectId.map.tsx`: delete the local `<header>` (lines ~507-543) and render those three buttons into the project header slot; container height math changes from `h-[calc(100vh-4rem)]` accordingly (one less band).
- Keep `src/components/ui/sidebar.tsx` in place (unused by the shell) — the layers panel is its own markup and is unaffected.
- No data, query, or mutation changes.
