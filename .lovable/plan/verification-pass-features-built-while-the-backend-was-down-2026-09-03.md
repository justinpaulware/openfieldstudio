# Verification pass: features built while the backend was down

The hosted backend is responding again and the current build is clean. Below is every feature shipped recently that was never confirmed end-to-end, and the exact check for each. I'll run them in a browser session against the live editor and report pass/fail per item, fixing anything that fails.

## 1. Label backgrounds and text controls (Tab 16, Phase 1)

Never seen rendering on a real map.

- Open a project with a point or polygon layer, enable labels.
- Turn on Label background; confirm a solid fill appears behind each label, sized to the text, with no border.
- Change background color, background opacity, and padding (0-10px); confirm each updates live.
- Confirm enabling a background zeroes halo width, and text opacity / halo opacity sliders behave.
- Switch Text case between Original / UPPER / lower.
- For a line layer with placement set to "Along line", confirm the background control shows the "switch placement to Horizontal" notice instead of rendering a broken background.
- Reload the page and confirm all label settings persisted.
- Publish the view and confirm the same labels render on the public map.

## 2. Label-free basemap (Tab 15)

Route responds 200 locally, but the style has never been rendered in MapLibre.

- Select "Positron (no labels)" from the basemap picker in the editor.
- Confirm the map redraws with no place, road, water, or airport labels and all base geometry intact.
- Confirm no console errors (missing sprite/glyphs) and tiles load at several zoom levels.
- Save it as the project default, reload, and confirm it sticks.
- Confirm the published public map renders it for a signed-out visitor.

## 3. Comment export (Tab 13)

Server function typechecks but has never actually run.

- On a project's Comments tab, export CSV: confirm the file downloads, opens cleanly, and includes contact details (author_name, author_email) plus geometry_wkt.
- Export GeoJSON: confirm valid FeatureCollection with point geometry and full properties.
- Apply a status filter and a search term, export again, and confirm the export honours both filters.
- Confirm export on a project with zero comments produces a header-only file rather than an error.

Note: the optional `geometry_type` column on comments was never added; export derives the type from the stored geometry, so no migration is needed. I'll leave it out unless you want the column.

## 4. Comments end-to-end on a published map

- As a signed-out visitor on a published map, drop a pin and submit a comment.
- With approval required off, confirm it appears immediately; with approval on, confirm it stays pending and only shows after the owner approves.
- Confirm category filter toggles and marker selection work.

## 5. ArcGIS REST service expansion (Tab 11)

- Add a layer from a FeatureServer layer URL, a MapServer layer URL, and a service root URL (confirm the layer picker appears).
- Confirm GeoJSON-first fetch with Esri JSON fallback, feature counts match the service, and paging works on a layer over 2000 features.
- Confirm a bad URL produces a readable error rather than a silent failure.

## 6. Publish tab views cleanup

- Confirm the header shows only title and status (no top-level View live map / Unpublish / Edit buttons).
- Confirm every view including Main lists with per-row Open and Publish/Unpublish.
- Publish and unpublish Main; confirm both the project and the Main view stay in sync and the public URL behaves accordingly.

## 7. Layer filters and view overrides (regression check)

- Set a filter on a layer, reload, and confirm it persists.
- Switch between views and confirm per-view filter/visibility overrides stay separate.
- Confirm the published viewer honours the active view's filters.

## 8. Add the `geometry_type` column on comments

Confirmed for build: a migration adding `geometry_type text NOT NULL DEFAULT 'Point'` to `public.comments`, backfilled from the stored geometry, and kept current by the existing comment trigger. The export then reads the column directly instead of deriving it — groundwork for line and polygon feedback (Tab 14).

## Test setup

All checks run against a new throwaway test project (sample point/line/polygon layers, comments enabled), published and unpublished as needed, then deleted at the end. Nothing in your existing projects is touched.
