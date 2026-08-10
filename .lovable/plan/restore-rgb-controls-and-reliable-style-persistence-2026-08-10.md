# Restore RGB controls and reliable style persistence

## Color selector

- Keep the compact two-row preset palette, but render both rows as fixed-size grids with the same horizontal and vertical gap used before the recent expansion.
- Add explicit **R**, **G**, and **B** number fields (0–255) to the custom color popover. Editing any channel updates the color immediately and stays synchronized with the visual picker and existing hex field.
- Preserve the current “no color” option and red-slash symbol.

## Style saving and reload

The backend is receiving the style writes. The reload request returns the one-to-one `layer_styles` relation as a single object, while the map editor currently treats it as an array and reads index `0`; after navigation or refresh that resolves to no style and the UI falls back to defaults.

- Normalize the joined style relation as a single style record, while tolerating either object or array responses so existing layers remain compatible.
- Use that normalized record everywhere styles are resolved: map rendering, legend, sidebar symbols, and the style panel.
- Keep live drafts during editing, but reconcile them with the confirmed saved row after a successful write so stale defaults or older values cannot replace the saved style.
- Make the explicit Save action await the write and report success only after the backend confirms it; keep the existing autosave behavior and visible dirty/saving/saved states.
- Retain pending edits when a write fails so the user can retry instead of silently losing them.

## Validation

- Change preset, RGB, opacity, stroke width, and marker/pattern values on multiple layers.
- Verify the map, legend, sidebar symbol, and style panel remain synchronized.
- Test explicit Save, autosave, switching away from the map editor and back, and a full browser refresh; each must reload the same saved values.
- Confirm backend errors leave the style marked unsaved and surface a useful message.

## Technical notes

- Update `src/components/map/color-field.tsx` for the fixed grid and synchronized RGB inputs.
- Update `src/routes/_authenticated/projects.$projectId.map.tsx` to normalize the one-to-one style relation and make save completion/error handling deterministic.
- Update the layer panel style-row typing only if needed to share the normalized relation shape; no database migration is required.