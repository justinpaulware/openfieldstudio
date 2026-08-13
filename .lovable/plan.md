# URL architecture + Layer Editor with filtering

Two related steps. Step 1 formalizes URLs and usernames. Step 2 rebuilds the Style Editor as a full Layer Editor with a filter system.

---

## Step 1 — URL & routing strategy

### Usernames

Every account gets a unique, permanent public username (`justin`, `interboro`).

- Sign-up form gains a Username field with live availability checking and a format rule: lowercase letters, numbers and hyphens, 3–30 characters.
- Reserved names are blocked (`projects`, `settings`, `auth`, `maps`, `api`, `admin`, `openfield`, `reset-password`, etc.) so they can never collide with app routes.
- Existing accounts (yours) get a one-time "Choose your username" prompt: shown in Settings, and required before publishing a map. Until set, publishing is blocked with a link to Settings.

### Internal project URLs

```text
/projects                       dashboard, shows the signed-in user's projects
/projects/brooklyn-greenway     Map Editor
/projects/brooklyn-greenway/publish
/projects/brooklyn-greenway/comments
```

Projects keep their UUID internally; the slug is a readable pointer that resolves to it. Duplicate project titles are allowed — slugs auto-number (`brooklyn-greenway`, `brooklyn-greenway-2`) with no user action. Renaming a project does not silently change its URL; the slug is only regenerated on create or duplicate.

### Public published URLs

```text
/justin/brooklyn-greenway
/interboro/housing-opportunities
```

The published slug is separate from the internal slug and user-controlled from the Publish tab:

- Must be unique within that username's namespace; no auto-numbering.
- Taken slugs show "This URL is already in use. Please choose another slug."
- Defaults to the project's internal slug the first time you publish.

`/maps/[slug]` is retired with no redirect, per your call. Since only your own maps exist so far, published slugs carry over into your namespace on migration so the same slug word keeps working under the new prefix.

### Navigation

Already done in the last step: the Open Field dropdown is workspace navigation (Recent Projects, All Projects, Settings, Logout) and Published Maps / Comments are gone from global nav. This step just points every link at the new URLs.

### Organizations later

Because public URLs are `/[namespace]/[map-slug]` and namespaces live in their own table-agnostic lookup, adding organization accounts later means adding a namespace owner type — no URL migration.

---

## Step 2 — Layer Editor & filtering

The Style Editor becomes the **Layer Editor**, the single place to configure a layer, with five accordion sections in GIS order:

```text
Data → Filter → Symbology → Labels → Popups
```

### Data

Read-only-plus-name panel holding everything currently cluttering the sidebar:

- Layer name (editable)
- Source type (GeoJSON upload / CSV / ArcGIS Feature Service / MapServer)
- Geometry type
- Feature count, showing "24 of 150 features" when a filter is active
- Source detail: file name, CSV URL, or ArcGIS REST URL

Room is left for Refresh source, Replace dataset, View attributes and Download later.

### Layer sidebar simplification

Rows drop the GeoJSON / CSV / ArcGIS source chips and keep name, symbol, visibility, count, ordering and the `...` menu. A small "Filtered" badge appears on any layer with an active filter.

### Filter

Attribute filtering as a layer-level operation, not a styling one.

- Rules of `field` / `operator` / `value`, combined with AND (OR comes later).
- Operators: equals, not equal, contains, starts with, ends with, greater than, less than, between, is empty, is not empty.
- Value input adapts: a value picker for text fields with few distinct values, a number input for numeric fields.
- Live "24 of 150 features" readout as rules change, plus Clear all.
- Filters are saved with the layer and apply everywhere — editor, legend counts, and the published public map.
- The layer's `...` menu gets **Filter layer**, which opens the Layer Editor with the Filter section expanded (no separate modal).

### Symbology / Labels / Popups

Unchanged in behaviour, just re-homed into the new panel. Symbology keeps Single symbol, Categories, Graduated and Mask layer, with Proportional symbols and Heatmap still queued.

Very large layers (100k+ features) are not specially handled yet; filtering runs on the loaded features. If that ever feels slow we revisit it as its own step.

---

## Technical notes

**Database**

- `profiles.username` — text, unique (case-insensitive), nullable until backfilled; validation trigger for format and reserved words. Public SELECT already allowed on profiles, which the published-map lookup needs.
- `projects.published_slug` — text, unique per `owner_id`; backfilled from current `slug`. Internal `slug` becomes unique per owner instead of globally unique.
- `layers.filter_config` jsonb default `{}` — `{ combinator: "and", rules: [{ field, op, value, value2 }] }`.

**Routes**

- `projects.$projectSlug.tsx` replaces `projects.$projectId.tsx` (and its children); loader resolves slug → project row, `notFound()` on miss.
- New public `$username.$mapSlug.tsx`; static routes (`/projects`, `/auth`, `/settings`, `/reset-password`) still win over the two-segment dynamic route. `maps.$slug.tsx` is deleted.
- `publish.server.ts` / `publish.functions.ts` lookups switch from `slug` to `(username, published_slug)` joined through profiles.

**Filtering**

- `src/lib/layer-filter.ts`: `filterToExpression(config, fields)` → MapLibre filter expression, plus `matchesFilter` for counting and for the legend/attribute table.
- `map-canvas.tsx` applies the expression to each layer's fill/line/circle/label layers; mask geometry rebuilds from filtered features.
- Filter config is read on the published viewer the same way styles are, so public maps honour it.

**Components**

- `style-panel.tsx` → `layer-editor.tsx` with sections `LayerData`, `LayerFilter`, `StyleSymbology`, `StyleLabels`, `StylePopups`; existing autosave/dirty-state plumbing reused, with filter changes joining the same queue.
