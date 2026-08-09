# Rename field should close on any click outside

Right now the rename input can stay open after you click elsewhere. The "ignore blur until focused" guard added to stop the dropdown from snapping it shut is too broad, so some clicks outside don't end editing.

## Change

- Keep the rename box open only until you click outside it (or press Enter/Escape). Clicking anywhere else in the sidebar, the map, or the page commits the typed name and closes the field.
- Preserve the fix for opening from the ... menu: it still opens and waits for you to type.
- Escape still cancels without saving; Enter still saves and closes.

## Technical notes

In `src/components/map/layer-panel.tsx` (`NameEditor`):
- Replace the blanket blur guard with a short-lived one: ignore blur only within a few frames of opening (a timestamp check), then treat blur normally.
- Add a document-level `pointerdown` listener while editing: if the click target is outside the input, commit and close immediately, so editing ends even when blur doesn't fire.
- Remove the `focusedRef` gate that could keep the field open indefinitely.
