# Fix: layer filters disappear and won't save

## What's happening

Confirmed in the database. When views were introduced, each layer got a per-view settings row that carries its own filter. Those rows were created empty, so an empty filter now overrides the real one:

- 14 layers still hold their original filter on the layer record.
- Only 3 of them have that filter copied onto their Main view row; the other 11 (Peekskill, NYS Quantum Ecosystem, Border Crossings, Architecture, Academic, Installation/Exhibition, Branding, Interboro Partners, Mapos, UN-Habitat, Planning) have an empty view filter that wins — so the map editor shows no filter.

And when you re-set a filter, the editor still writes it to the *layer* record only, never to the view row. The next reload re-applies the empty view override, so the change looks like it never saved.

## The fix

1. **Restore the lost filters** — a one-time data repair copying each layer's existing filter onto its Main view row wherever the view row is empty and the layer has one. Named views keep whatever they have.
2. **Save filters to the active view** — filter edits in the map editor write to the view's layer row (the same path visibility and opacity already use). While the Main view is active, the layer record stays mirrored so older reads and the trigger that seeds new views keep working.
3. **Keep new layers correct** — the trigger that adds a new layer to the Main view already copies the layer's filter, so nothing changes there.

After this, filters reappear on every affected map, and editing one persists across reloads, in the editor, the legend counts, the attribute table, and the published map.

## Technical notes

- Data repair: `UPDATE view_layers vl SET filter_config = l.filter_config FROM layers l, project_views pv WHERE vl.layer_id = l.id AND pv.id = vl.view_id AND pv.is_main AND vl.filter_config = '{}'::jsonb AND l.filter_config <> '{}'::jsonb`.
- `persistFilter` in `src/routes/_authenticated/projects.$projectSlug.map.tsx` currently updates `layers.filter_config`. It becomes an upsert on `view_layers` (`onConflict: 'view_id,layer_id'`) for the active view, plus the existing `layers` update only when the active view is Main; then invalidates both `["layers", projectId]` and `["view-layers", viewId]`.
- Reads need no change: `applyViewOverrides` already merges `view_layers.filter_config` over the layer row, and `filterFor` consumes the merged layer.
- Public viewer needs no change: `publish.server.ts` already reads the view override.
