# Smooth out the layer Filter experience

## What's happening today

Every filter edit saves to the database ~0.4s after you touch a control. That save
rewrites the layer record, and the app treats *any* change to that record as "the data
source changed" — so it throws away the downloaded dataset and re-downloads it.

While that re-download runs:

- the layer briefly vanishes from the map,
- the "x of y features" counts blank out,
- the value dropdown loses its list of choices and re-populates,
- the panel re-renders and controls shift under the cursor.

That's why each step feels like a reload and you end up clicking a moving target.

## The fix

1. **Stop re-downloading data on settings changes.** Cache the downloaded features
   against what actually defines the source (source type, file path, service URL,
   lat/lon columns, last refresh time) instead of the record's generic
   "last modified" timestamp. Filters, styles, labels and popups then never discard
   the data.
2. **Don't refetch the layer list after a filter save.** The screen already shows the
   new filter from local state; update the cached record in place instead of
   re-querying, so nothing re-mounts or flickers.
3. **Keep counts and dropdowns stable.** Compute field values and numeric fields from
   the unfiltered dataset once per layer (memoised), so the value picker options stay
   put while you edit, and hold the previous feature count during any transition
   rather than showing a blank.
4. **Reduce twitch while typing.** Free-text and number value inputs commit on a short
   pause (or blur/Enter) instead of on each keystroke, so the map recalculates once
   per value rather than per character.

Filters still save exactly as they do now (per view, mirrored to the layer for Main),
and the map still updates instantly from local state.

## Technical notes

- `src/components/map/use-layer-data.ts`: replace `queryKey: ["layer-data", id, updated_at]`
  with a source-identity key (`source_type`, `storage_path`, `source_url`,
  `fields.latField/lonField`, `last_refreshed_at`); add `placeholderData: keepPreviousData`.
- `projects.$projectSlug.map.tsx` `persistFilter`: drop the two `invalidateQueries`
  calls; instead `queryClient.setQueryData(["layers", projectId], ...)` and the
  `["view-layers", viewId]` cache to merge the saved `filter_config`.
- Memoise `fieldValues`/`numericFields` per layer id via `useMemo` keyed on
  `byId[styleLayer.id]`, passed to `LayerFilter` instead of being recomputed inline.
- `layer-filter.tsx`: local input state for `value`/`value2` with a ~250ms debounce
  plus commit on blur/Enter; selects stay immediate.
- `useLayerRefresh` keeps its explicit invalidation — a real source refresh should
  reload data.

## Out of scope

Changing filter semantics, adding OR combinators, or server-side filtering.
