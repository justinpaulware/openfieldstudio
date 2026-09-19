# Left-side viewer cards to 272px

Published-map left overlay cards are 320px today, which crowds the map. Drop them to 272px (w-[17rem]); right-side popup/comments stay 320px (w-80). The 48px difference is clearly intentional asymmetry, and the search placeholder ("Search address, place or landmark") sits comfortably at 272px (measured: 186px text, ~24px slack).

## Changes

Three card components, width class swap only — no layout, data, or routing changes.

- **`src/components/map/map-legend.tsx`**
  - `MapLegend`: `w-80` → `w-[17rem]` (keep `max-w-[min(50vw,26rem)]`)
  - `MapTitleCard`: `min-w-80` → `min-w-[17rem]` (keep `w-fit` and `max-w-[min(50vw,26rem)]` so it still grows for long titles)

- **`src/components/public/view-switcher-card.tsx`**
  - Root card: `w-80` → `w-[17rem]` (keep `max-w-[min(50vw,26rem)]`)

- **`src/components/public/address-search-card.tsx`**
  - Root card: `w-80` → `w-[17rem]` (keep `max-w-[min(50vw,26rem)]`)

Right-side cards (`src/components/map/map-canvas.tsx` container at `w-80`) and comment panel are untouched.

## Verification

- `bunx tsgo --noEmit`
- Playwright screenshot of `justinpaulware/stlschools` (has Title + Search + 5 views + Legend) at 1280×900: confirm all four left cards share 272px width and align, placeholder not truncated, right cards still 320px.
