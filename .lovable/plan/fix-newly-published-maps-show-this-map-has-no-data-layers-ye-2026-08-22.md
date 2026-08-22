# Fix: newly published maps show "This map has no data layers yet"

## What's happening

Confirmed in the database. The views migration widened the public read rules for layers so a layer is visible to anonymous visitors only when the project has a **published view**. Existing maps were migrated with their Main view already marked published, so they still work. But the Publish button only flips the *project* to published — it never touches the Main view — so every map published since the migration has a Main view still sitting in "draft", and anonymous visitors get zero layers.

Verified state:

```text
The Peekskill Plan       project: published   main view: draft   -> broken
ICE Detention Facilities project: published   main view: draft   -> broken
Parks Not Parks          project: published   main view: published -> fine
St. Louis Schools        project: published   main view: published -> fine
```

So yes — it is a side effect of the views work, and the fix is to keep the Main view in lockstep with the project until the per-view publishing UI lands.

## The fix

1. **Publish/unpublish syncs the Main view.** When the Publish tab sets a project to published or draft, it also updates that project's Main view's `status` and `published_at` to match. Same for the layer set: the Main view keeps mirroring what's toggled visible in the Map Editor.
2. **Backfill existing mismatches.** A migration sets every Main view's status/published_at to its project's, so The Peekskill Plan and ICE Detention Facilities go live immediately.
3. **Keep it from recurring.** A database trigger on `projects` mirrors status/published_at onto the Main view on every update, so any other code path that publishes a project (now or later) can't reintroduce the split.
4. **Verify** the two affected maps load with layers as an anonymous visitor.

## Technical notes

- `src/routes/_authenticated/projects.$projectSlug.publish.tsx` — `setStatus` mutation additionally updates `project_views` where `project_id = projectId and is_main`.
- Migration: one-time `UPDATE project_views ... FROM projects` backfill for `is_main` rows, plus a `BEFORE/AFTER UPDATE` trigger function on `projects` mirroring `status`/`published_at` to the Main view.
- No change to the public loaders or RLS policies; the policies are correct, the data was out of sync.
