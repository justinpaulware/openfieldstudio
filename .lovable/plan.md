# Account avatar in the header + a one-click style editor

Two changes: move account actions out of the Open Field menu into an avatar at the far right of the top band, tighten the header alignment, and make the style editor reachable in one click from the Layers sidebar.

## 1. Account avatar, top-right

- A circular avatar (initials, or profile image when set) sits at the far right of the top header band, after the Publishing tab.
- Clicking it opens a dropdown with the signed-in name/email, **Settings**, and **Sign out**.
- The Open Field brand dropdown keeps only navigation: Projects, Published maps, Comments. Account block, Settings and Sign out move out of it.

## 2. Header alignment

- Both header bands get the same horizontal padding and a fixed 48px height, so the brand tile, tabs, avatar, back link, project title and map buttons all sit on shared left/right edges and consistent baselines.
- The brand dropdown panel opens flush with the left edge of the brand tile and just below the band border; the avatar menu opens flush with the right edge. No more floating offset.

## 3. Style editor in one click

- A paintbrush button is added to the Layers sidebar header, immediately left of the New folder button, with New folder and Add data following it.
- Clicking it opens the style editor panel for the currently selected layer (or the first visible layer if nothing is selected). Clicking it again closes the panel.
- While the panel is open, clicking any layer row in the sidebar switches the panel to that layer, so you can move between layers without reopening anything.
- The panel still starts closed on load and still has its own X to close.
- **Edit style** stays in each layer's `...` menu and behaves as it does today.

## Technical notes

- `src/components/app-shell.tsx`: split `BrandMenu` into brand navigation and a new `AccountMenu` (avatar trigger, `align="end"`, Settings link + sign out). Render `AccountMenu` in the header after the `AppHeaderSlot` target div. Header becomes `h-12 px-4` with matching padding in the project band.
- `src/routes/_authenticated/projects.$projectId.tsx`: match the band to `h-12 px-4` so both bands align.
- `src/routes/_authenticated/projects.$projectId.map.tsx`: add the Brush toggle button to the sidebar header (toggles `styleLayerId` using `selectedId ?? first visible layer`); in `onSelect`, when the style panel is open, set `styleLayerId` to the clicked layer instead of toggling selection off.
- No data, query, or styling-persistence changes.
