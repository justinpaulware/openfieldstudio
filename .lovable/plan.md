# Publish Page Simplification

## Goals
1. Right-justify the top Save button so it aligns with the bottom Save button.
2. Hide the ViewSwitcher dropdown in the project header while on the Publish tab.
3. Merge the **Project**, **Public project URL**, and **Attribution** sections into a single card, with the project URL copy field placed directly below the project address (slug) field.

## Changes

### 1. Top Save button right-justified — `src/routes/_authenticated/projects.$projectSlug.publish.tsx`
The current header layout is `flex items-center gap-3` with the title on the left and Save button next to it.
- Change the header row to `flex items-center justify-between` so the title sits left and the Save button (+ "Unsaved changes" indicator) sits right, mirroring the footer's right-aligned Save button.

### 2. Hide ViewSwitcher on Publish tab — `src/routes/_authenticated/projects.$projectSlug.tsx`
The project layout always renders `<ViewSwitcher>` in the header. The ViewSwitcher only navigates to the Map Editor, so it has no purpose on Publish.
- Compute whether the current path ends with `/publish` (same pattern already used for `/map` via `isMapTab`).
- Conditionally render `<ViewSwitcher>` only when **not** on the publish tab.

### 3. Merge Project + Public URL + Attribution into one card — `src/routes/_authenticated/projects.$projectSlug.publish.tsx`
Replace the three separate `<Section>` blocks (Project, Public project URL, Attribution) with a single `<Section>` titled **Project**.

Layout inside the merged card, top to bottom:
1. **Title** (label + input)
2. **Description** (label + textarea)
3. **Project address / slug** (label + input + `openfield.nu/...` hint) — same as today
4. **Public project URL** copy field — the existing `<CopyField>` for `publicUrl`, placed directly below the project address field, keeping its copy button and the "Publish the Main view to make this link work" / "Anyone with this link can view the project" description text, plus the "Last published" timestamp
5. **Tags** (label + input) — same as today
6. **Author** (label + input)
7. **Data sources** (label + textarea)
8. **Credits** (label + textarea)

The slug and tags remain in a 2-column grid on `sm:` as today; the URL copy field spans full width between the address grid row and the tags grid row.

The standalone "Public project URL" and "Attribution" `<Section>` blocks are removed. The "Views" section and per-view cards below are unchanged.

## Verification
- `bunx tsgo --noEmit` clean.
- Playwright: load `/projects/stlchools/publish`, confirm the top Save button is right-aligned with the title on the left, no ViewSwitcher dropdown appears in the project header, and the merged card shows title → description → address → URL copy → tags → author → data sources → credits in one card.
