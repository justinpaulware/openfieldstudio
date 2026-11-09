# Resizable Layers panel (map editor)

## What changes
- The Layers panel on the left of the map editor keeps its current starting width (288px).
- A thin drag handle sits along its right edge; the cursor changes to a resize arrow on hover and the edge highlights.
- Drag to widen (up to ~560px) or narrow (no smaller than today's width).
- Double-click the handle to snap back to the default width.
- The chosen width is remembered in your browser, so it stays the same next time you open any map.
- The map resizes smoothly as the panel changes, so nothing gets cut off.
- Long layer names show their full text in a tooltip on hover, even when truncated.

## Technical details
- `src/routes/_authenticated/projects.$projectSlug.map.tsx`: replace `w-72` on the aside with inline `style={{ width }}`, `relative`; add pointer-drag handle (`absolute right-0 inset-y-0 w-1.5 cursor-ew-resize`), clamp 288–560, persist to localStorage (read in useEffect to avoid hydration mismatch), trigger map `resize()` via ResizeObserver/window resize event.
- `layer-panel.tsx`: add `title={layer.name}` on truncated names; ensure `min-w-0` so names use the extra width.
