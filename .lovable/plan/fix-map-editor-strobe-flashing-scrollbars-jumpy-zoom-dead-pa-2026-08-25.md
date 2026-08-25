# Fix: map editor strobe (flashing scrollbars, jumpy zoom, dead pan)

## What's happening

This is a layout feedback loop, not a bug in zoom-to-extent. The map editor is nested inside two scrolling containers while itself asking for full height:

- `src/components/app-shell.tsx:178` — `<main className="min-h-0 flex-1 overflow-y-auto">`
- `src/routes/_authenticated/projects.$projectSlug.tsx:98` — `<div className="min-h-0 flex-1 overflow-y-auto">` around `<Outlet />`
- `src/routes/_authenticated/projects.$projectSlug.map.tsx:815` — the editor itself is `h-full`, with the map in a `flex-1` main

When the content measures one pixel taller than its scroll box, a vertical scrollbar appears, which narrows the map by the scrollbar width. MapLibre observes its container and resizes the canvas; that re-measure removes the overflow, the scrollbar disappears, the map widens again — and the cycle repeats several times per second. That is exactly the observed symptom set: side and bottom scrollbars flickering on/off, the view appearing to zoom in and out, and panning dead because every frame the map is being resized mid-gesture. Refreshing sometimes lands on a size where the loop doesn't trigger, which is why it's intermittent and why zoom-to-layer doesn't help.

## The fix

1. **Take the map editor out of the scrolling containers.** The map tab must never be inside `overflow-y-auto`. Change the project-tab wrapper to `overflow-hidden` for the map route (and let the scrolling live inside each tab's own content pane, which Details/Publish/Comments already do), so nothing can oscillate between "scrollbar" and "no scrollbar".
2. **Make the shell non-scrolling for full-height tools.** The app shell's `<main>` keeps `min-h-0 flex-1` but stops owning the scrollbar for full-height routes; scrolling moves to the inner panels that actually need it (layer list, details forms).
3. **Reserve the scrollbar where scrolling remains.** Apply `scrollbar-gutter: stable` on the scrollable panels so a scrollbar appearing can never change the map's available width.
4. **Belt-and-braces on the map side.** In `map-canvas.tsx`, ignore sub-pixel/one-pixel container size changes and coalesce resizes into a single `requestAnimationFrame`, so any residual jitter cannot drive repeated canvas resizes.
5. **Verify with the real app.** Drive the editor in a headless browser at a few viewport sizes, sample the map container width over ~2 seconds to confirm it holds a single stable value (no oscillation), confirm no scrollbars appear on the map tab, and confirm drag-pan changes the center.

## Technical notes

- Files: `src/components/app-shell.tsx`, `src/routes/_authenticated/projects.$projectSlug.tsx`, `src/routes/_authenticated/projects.$projectSlug.map.tsx`, `src/components/map/map-canvas.tsx`.
- No changes to view/extent logic, `fitBbox`, `setView`, the auto-fit effect, or any data/persistence code — those are not the cause.
- Other tabs must keep working: they get their own `overflow-y-auto` pane instead of relying on the parent's.
