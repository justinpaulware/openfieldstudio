# Unify Viewer Card Headers + Fix Stacked-Card Shadow

## 1. Fix the shadow spanning the top-left cards

Each of the title, Map Views, and Legend cards casts `shadow-lift` (a 30px drop shadow), and with only 8px gaps each card's shadow falls across the card below — reading as one big weird container shadow.

- Stacked cards in the viewer columns (title, Map Views, Legend, Comments) use the lighter `shadow-soft` instead of `shadow-lift`.
- The feature popup keeps `shadow-lift` so it still reads as floating above everything.

## 2. One shared card header

Introduce a single `MapCardHeader` component modeled on the current Legend header (the preferred style), used by Map Views, Legend, and Comments:

- Icon (h-3.5) + title in `text-xs font-semibold`, full-width clickable row, `px-3 py-2`.
- Collapse chevron on the right (ChevronUp/Down); body separated by a top border when open.
- Optional right-side actions slot (for the Comments eye/+ buttons, which stay but shrink to h-3.5 icons to match).

Applied per card:

- **Legend:** unchanged behavior, just re-built on the shared header.
- **Map Views:** becomes collapsible like Legend — header row with Layers icon, "Map views" title (matching case/type), chevron; the view list sits in the bordered body. Active view name shows in the header when collapsed on all screen sizes (replaces the current mobile-only collapsed row).
- **Comments:** header gains the same icon size, font, and weight, plus a collapse chevron after the existing eye and + buttons.
- **Popup:** left as-is (it's a feature detail card, not a panel header).

## Technical notes

- New `MapCardHeader` in `src/components/map/map-card-header.tsx` (props: `icon`, `title`, `open`, `onToggle`, `actions?`, `subtitle?`).
- Edits: `src/components/map/map-legend.tsx`, `src/components/public/view-switcher-card.tsx`, `src/components/comments/comment-panel.tsx`, `src/components/public/public-map.tsx` (nothing structural — shadow swap happens inside each card).
- View-switcher collapse state is local to the card; switching views still works from the expanded list.
- No database or routing changes.
