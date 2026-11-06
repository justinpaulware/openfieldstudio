# Info button: circle, centered, no layout shift

## What changes
1. **Info "i" becomes a circle centered under the buttons above.** Same light gray surface, border and shadow, but fully round (24px) and horizontally centered on the 29px column — so its right gap is slightly larger than the buttons', by design.
2. **Opening the info line no longer moves anything.** The attribution text opens as a floating strip that extends to the left of the "i", on the same baseline, laid over the map. The zoom, location and basemap buttons stay exactly where they are, so nothing collides with the basemap picker. Closing it (tap "i" again, or tap the map) works as today.

## Technical details
- `src/styles.css`: make the compact attribution control `position: absolute; right: 10px; bottom: 10px` within `.maplibregl-ctrl-bottom-right`, so it no longer participates in the stacked flow; give the nav group a fixed bottom margin reserving the circle's footprint (bottom stack unchanged in height whether open or closed).
- Closed state: 24×24px, `border-radius: 9999px`, right offset `12.5px` to center on the 29px column; icon centered.
- Open state: anchored at the right/bottom of the circle, grows leftward (`max-width: calc(100vw - 80px)`), single-line with wrap allowed upward only, pill radius, same surface/shadow; icon stays pinned at right.
- Verify with Playwright on a published map: control positions identical before/after toggling info; circle center x matches the zoom group's center x.
