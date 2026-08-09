# Map controls: basemap button placement and a metric/imperial scale bar

## 1. Basemap control moves off the attribution button

The basemap control currently sits bottom-right, overlapping the map's "i" attribution button.

- It moves to the top-right, directly under the zoom/compass controls, so it reads as part of the same control stack.
- The button becomes icon-only (the layers symbol) at the same size as the other map controls, with an accessible label and tooltip so it's still obvious what it does.
- Clicking it opens the same style list (Positron, Bright, Dark, Liberty), now anchored below the button and aligned to the right edge.
- Behaviour is unchanged: in the editor, picking a style saves the project's default starting basemap; a viewer's pick is local only.

## 2. Scale bar: miles or kilometers, clickable, with a saved default

- The scale bar becomes clickable: one click toggles between imperial (miles/feet) and metric (km/m). The switch is instant and local to whoever is viewing.
- The project stores a default scale unit, set in the map editor the same way the basemap default is set: whatever the editor picks becomes what a visitor sees first.
- New US-facing projects default to imperial; existing projects keep metric unless changed.

## Technical notes

- Migration: add `scale_units text not null default 'imperial'` to `public.projects` with a check constraint of `('imperial','metric')`. No new grants or policies needed — it's an existing table.
- `src/components/map/map-canvas.tsx`:
  - Move the basemap control container from `bottom-8 right-2` to a top-right stack positioned below MapLibre's `NavigationControl`, icon-only with `aria-label="Basemap"`; dropdown opens downward.
  - Accept `scaleUnits` prop plus optional `onScaleUnitsChange`, mirroring the basemap prop/callback pattern with a `localScaleUnits` fallback so read-only viewers can toggle without persisting.
  - Keep a ref to the `ScaleControl`; on unit change, remove and re-add the control with the new `unit` (MapLibre has no live setter), or call its internal `setUnit` when available.
  - Attach a click handler to the rendered `.maplibregl-ctrl-scale` element that flips units, with `cursor-pointer` and a title attribute.
- `src/routes/_authenticated/projects.$projectId_.map.tsx`: track `scaleUnits` state like `basemap` (`scaleUnits ?? project?.scale_units ?? 'imperial'`), pass it to `MapCanvas`, and extend the `saveView` mutation to persist the chosen unit alongside `basemap`.
- Regenerate Supabase types after the migration so `scale_units` is typed on `projects`.
