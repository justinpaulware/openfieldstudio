# Popups default to off for new layers

## Goal
Newly added layers start with popups turned off. The user turns them on per layer in the Layer Editor's Popups section. Existing layers that already have popups on keep working unchanged.

## Change

**`src/lib/layer-style.ts`** — flip one value:
- `DEFAULT_POPUP.enabled`: `true` → `false` (line 225).

Every new layer falls back to `DEFAULT_POPUP` until its Popups section is edited, so this single change makes popups opt-in for all layers added from now on (GeoJSON upload, CSV, ArcGIS — they all share this default).

## Why existing layers are unaffected
`parsePopup` (same file, line 536) reads a stored popup config with `enabled: raw["enabled"] !== false` — any layer whose popup config was saved keeps its current on/off state regardless of the new default. Only layers with no popup config at all fall back to `DEFAULT_POPUP`.

## Known side effect (accepted)
Layers added earlier that *never* had their Popups section touched (no popup config saved) will also flip to off — they currently show popups only by default, not by an explicit choice. If any published map relies on that implicit behavior, re-enable popups for that layer in the Layer Editor (one toggle). Layers where popups were explicitly configured are untouched.

## Verification
- Add a new layer → Popups toggle in the Layer Editor shows off; clicking features on the map shows no popup.
- Open an existing layer with popups enabled → still on, popups still work on the public map.
