# Save button + reliable style autosave

## What's happening

Layer styles are saved to the backend, and the three styled layers in this project do have their custom colors stored. The loss happens between the moment you move a slider and 0.4 seconds later: style edits are queued on a short delay before writing, and that queue is thrown away without being written whenever the map editor unmounts — closing the project, switching tabs in the project header, navigating to the dashboard, or the page reloading after a platform update. Any tweak made in the last fraction of a second before leaving is silently dropped, and the panel then shows the older stored values (or defaults for a never-saved layer), which reads as "it reverted to default".

## The fix

1. **Flush pending saves instead of discarding them.** When the map editor unmounts, or the browser tab is hidden/closed, write any queued style change immediately rather than cancelling the timer.
2. **Add an explicit Save button** in the style panel footer, to the left of "Reset to default" (two buttons side by side). It writes the current style right away, bypassing the delay.
3. **Save state feedback.** The button reflects status: "Save" when there are unsaved edits, a spinner while writing, and a brief "Saved" checkmark plus a subtle "All changes saved" line once the write lands, so autosave is visible rather than invisible.
4. **Keep autosave.** Nothing about the existing debounce-and-save behavior is removed; it just becomes reliable.
5. **Stop stale-value flicker.** Once a style write succeeds and the layer list refetches, keep the panel showing the confirmed saved values, so re-opening a layer never briefly shows defaults.

## Technical notes

- `src/routes/_authenticated/projects.$projectId.map.tsx`: replace the timer map in `persistStyle` with a pending-style map plus timers; add `flushStyle(layerId)` / `flushAllStyles()` that clear the timer and perform the upsert immediately. Call `flushAllStyles()` in the unmount cleanup and on a `visibilitychange`/`pagehide` listener. Track per-layer save state (`idle | dirty | saving | saved`) in component state and pass the active layer's state plus an `onSave` handler into `StylePanel`.
- `src/components/map/style-panel.tsx`: footer becomes a two-button row — `Save` (primary, disabled when clean, spinner/check per state) and `Reset to default` (outline) — plus a small status line under it.
- No database or schema changes: `layer_styles` already has a unique constraint on `layer_id`, and the upsert path is correct.
