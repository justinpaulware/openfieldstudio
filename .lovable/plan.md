# Move shared settings to the Main view

On the Publish tab, these settings will appear only on the Main view card and apply to every view:

1. Show view navigation
2. Address search
3. Search behavior (locate only / find containing shape)
4. Embed (Legend, Title card, Height, Embed code)

Other view cards will keep only their own details: name, status, Open/Unpublish, View address and Public URL. A short note on them will say "Navigation, search and embed settings follow the Main view."

## What happens to existing maps
- Each view's own search and navigation choices are ignored from now on. Every view follows the Main view.
- If a map had search turned on for another view but off on the Main view, search will turn off there. You can switch it on once on the Main view.
- Embed code is offered once, for the Main view's address.

## Technical details
- `projects.$projectSlug.publish.tsx`: render the view-nav toggle, address search, search behavior and Embed block only when `view.is_main`; add the inherit note for other views. Labels drop "on this view".
- `publish.server.ts` (both the bundled `viewConfigs` and single-view loader): read `show_view_nav`, `addressSearch` and `addressLookup` from the Main view's row and apply them to every view.
- No database change; the Main view's existing fields act as the map-wide values.
- Check: publish a map with two views, turn search on in the Main view, confirm it appears on the second view's public page too.
