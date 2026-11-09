Replace the "Filtered" text tag in the Layers panel with a small funnel icon.

- In the layer row, swap the "Filtered" badge for a muted funnel icon (lucide `Filter`, 12px) in the same spot.
- Keep the hover tooltip "This layer has an active filter" and add a screen-reader label.
- No other changes.

Technical: edit `src/components/map/layer-panel.tsx` around the `filteredFor?.(layer)` badge.
