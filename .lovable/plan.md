# Match all / match any for layer filters

Today every filter rule on a layer has to be true at once — the little "and" between rules is fixed text. This adds the choice of matching **all** rules or **any** rule.

## What changes for you

- In the Layer Editor's Filter section, a small "Match all / Match any" toggle sits above the rule list (only once there are two or more rules).
- The word between rules updates to read "and" or "or" so the list always reads the way it behaves.
- The choice is saved with the layer and the view, so the map editor, the published map, and exports all filter the same way.
- Existing filters keep working exactly as they do now (they stay on "Match all").

## Technical notes

- `src/lib/layer-filter.ts`: widen `FilterConfig["combinator"]` to `"and" | "or"`; `parseFilterConfig` reads `raw.combinator === "or" ? "or" : "and"` (defaults to `and`, so old saved configs are unchanged); `matchesFilter` uses `rules.every` or `rules.some` based on the combinator.
- `src/components/map/layer-filter.tsx`: add the toggle (small segmented control / `Select`) wired to `onChange({ ...config, combinator })`; the inter-rule label renders `config.combinator`; "Clear all" keeps resetting to `{ combinator: "and", rules: [] }`.
- No migration needed — `filter_config` is already `jsonb` on `layers` and `view_layers`, and persistence writes the whole config object.
- Public viewer and publish paths (`views.ts`, `publish.server.ts`) already round-trip the config through `parseFilterConfig`, so they pick this up with no change.
