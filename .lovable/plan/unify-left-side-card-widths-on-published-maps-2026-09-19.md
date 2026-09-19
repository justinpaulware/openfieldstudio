# Unify left-side card widths on published maps

The published-map viewer has two overlay columns. The right column (popup + comments) is 320px wide (`w-80`). The left column cards are narrower and inconsistent: Title is `min-w-56` (224px, grows with content), Search is `w-64` (256px), Map Views and Legend are `w-56` (224px). Goal: make every left-side card the same 320px base width as the popup/comments cards, while the title card keeps its ability to grow for long titles.

## Changes

All four left-column cards get a **320px base width (`w-80`)** with a shared **`max-w-[min(50vw,26rem)]`** so they never blow out on narrow screens:

- **Title card** (`MapTitleCard` in `src/components/map/map-legend.tsx`): change `w-fit min-w-56` → `w-fit min-w-80`. Keeps `w-fit` + `max-w-[min(50vw,26rem)]` so it still grows with long titles, but its floor is now 320px instead of 224px.
- **Search card** (`AddressSearchCard` in `src/components/public/address-search-card.tsx`): change `w-64 max-w-[min(70vw,26rem)]` → `w-80 max-w-[min(50vw,26rem)]`.
- **Map Views card** (`ViewSwitcherCard` in `src/components/public/view-switcher-card.tsx`): change `w-56 max-w-[min(50vw,26rem)]` → `w-80 max-w-[min(50vw,26rem)]`.
- **Legend card** (`MapLegend` in `src/components/map/map-legend.tsx`): change `w-56` → `w-80 max-w-[min(50vw,26rem)]` (adds a max width it currently lacks).

No layout, routing, or data changes — pure width class swaps. After editing, verify with a Playwright screenshot of a published map that all four left cards share the same left/right edges and line up with the popup/comments cards on the right.

## Out of scope

- The title card's grow behavior and clamp/Show-more logic stay as-is.
- The right-column width (320px) is unchanged; left cards now match it.
