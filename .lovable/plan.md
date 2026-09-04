# Tab 18 — Published Map View Switcher

Let a published project present several of its views inside one map page, with a "Map Views" card between the title and the legend. Switching is instant, the map never reloads, and the address bar updates so links stay shareable.

## Behaviour

- **One published view (or navigation turned off):** the published map looks exactly as it does today. No extra card.
- **Two or more published views and navigation enabled:** a card appears under the title card:

```text
┌────────────────────┐
│ Title              │
└────────────────────┘
┌────────────────────┐
│ MAP VIEWS          │
│ ● Overview         │
│ ○ Opportunity Sites│
│ ○ Research Partners│
└────────────────────┘
┌────────────────────┐
│ Legend             │
└────────────────────┘
```

- Views are listed in their saved order, main view first, active row highlighted with the accent treatment already used elsewhere.
- Picking a view swaps layer visibility, order, opacity, filters, style overrides, map extent, basemap and legend — with a smooth camera move, no page reload, no map flash.
- The URL updates as you switch: main view is `openfield.nu/user/project`, a named view is `openfield.nu/user/project/view-slug`. Back and forward buttons move between views.
- Direct links to a named view keep working and open on that view.
- On narrow screens the card collapses to a single "Map Views ▾" row that expands to the same list.
- `?legend=0` / `?title=0` keep working; a new `?views=0` hides the switcher in embeds.

## Publish settings

A new **Views** block on the Publish tab, above the existing per-view list:

- **Enable view navigation** — off by default for existing projects so nothing changes unexpectedly; turning it on shows the card on every published view of the project.
- **Default view** — which view loads at the 2-segment project URL. Defaults to Main.
- Each row in the view list gains a small **Show navigation on this view's link** switch, so a view can be shared as a standalone, focused map even while the rest of the project shows the switcher.

## Technical notes

**Database**
- `projects`: add `view_nav_enabled boolean not null default false`, `default_view_id uuid references project_views(id) on delete set null`.
- `project_views`: add `show_view_nav boolean not null default true` (per-view override consulted only when the project-level flag is on).

**Loader (`src/lib/publish.server.ts`)**
- `loadPublishedMap` also returns `views: [{ id, name, slug, is_main, sort_order }]` — the project's published views, ordered — plus `viewNav: boolean` resolved from `projects.view_nav_enabled && view.show_view_nav && views.length > 1`.
- When no `viewSlug` is given, resolve `projects.default_view_id` first and fall back to the main view.

**Routing / no-remount switching**
- `src/routes/$username.$mapSlug.tsx` becomes the single mount point: it always renders `PublicMapViewer` and derives the active view slug from the child match params (`/$username/$mapSlug/$viewSlug`). The child route keeps its own loader purely for SSR head/meta and seeds the react-query cache; it renders `null`.
- The viewer holds `activeSlug` state; changing it runs `navigate({ to, replace: false })` for the URL and fetches the target payload with `useQuery(["published-map", username, slug, viewSlug])` backed by the existing `getPublishedMap` server function. Because the map component stays mounted across both routes, MapLibre is never torn down; the camera moves via the existing `MapHandle` fly/`setView`.
- Payload for the initially rendered view comes from the loader, so first paint and SEO are unchanged.

**Components**
- New `src/components/public/view-switcher-card.tsx` using the shared overlay card shell (same radius, border, shadow and 12px padding as title/legend), radio-style rows, and a collapsed dropdown variant under the mobile breakpoint.
- `public-map.tsx`: render the card between `MapTitleCard` and `MapLegend`, reset per-session UI state (hidden layers, hidden categories, selected comment) on view change, keep comments project-level and unchanged.
- `projects.$projectSlug.publish.tsx`: new Views settings block and the per-row navigation switch, saved through the existing project/view mutations.
