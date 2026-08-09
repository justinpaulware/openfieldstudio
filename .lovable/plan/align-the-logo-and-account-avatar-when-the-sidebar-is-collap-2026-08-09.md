# Align the logo and account avatar when the sidebar is collapsed

In the collapsed icon rail, the Open Field logo tile at the top and the user avatar at the bottom sit slightly off-center and don't line up with the Projects / Published maps / Comments / Settings icons.

## Fix

- Collapsed state only: center the logo tile and the avatar horizontally in the rail, and match the 32px square footprint and horizontal insets the nav icons use, so all three columns share one vertical axis.
- Sizes stay the same in the expanded sidebar; nothing about the labels, links, or sign-out behavior changes.

## Technical notes

In `src/components/app-shell.tsx`:
- Header `<Link>`: add `group-data-[collapsible=icon]:justify-center` and `group-data-[collapsible=icon]:px-0` so the icon tile centers instead of keeping the expanded left padding.
- Footer row: same collapsed-only `justify-center` + `px-0`; keep the name block and sign-out button hidden when collapsed.
- Bump the logo tile and avatar to `h-8 w-8` (or keep 7 and add matching insets) so they equal the `size-8` the collapsed `SidebarMenuButton` renders, and confirm the surrounding `p-2` wrappers match the menu's own `p-2`.
- Verify visually in the collapsed rail that the three icon centers align.
