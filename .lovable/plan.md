# Add the Proxima Nova Adobe Fonts kit

Wire your Adobe Fonts (Typekit) web project into Open Field so Proxima Nova renders everywhere instead of the Montserrat fallback.

## What you need to do first (in Adobe Fonts)

1. Go to Adobe Fonts, open Proxima Nova, and click "Add to Web Project".
2. Create (or pick) a web project, select the weights you want — 400, 500, 600, 700 covers the app.
3. In the web project settings, add these domains so the kit is allowed to load:
   - `id-preview--32718663-a6d0-4df5-9653-e6ad4bfb7e0e.lovable.app`
   - your published `.lovable.app` domain (and any custom domain later)
4. Copy the kit ID from the embed code — it looks like `https://use.typekit.net/abc1def.css`.

Then paste that kit ID (or the whole URL) into chat and I'll apply the change.

## What I'll change

- Add the Typekit stylesheet plus a `preconnect` to `use.typekit.net` in the app's root head, alongside the existing font links.
- Drop Montserrat from the Google Fonts request (Cantarell stays — it's still used for select secondary text), keeping Montserrat only as a CSS fallback name in case the kit fails to load.
- Confirm the font stack in the theme still reads `"proxima-nova", "Montserrat", ...` — Adobe serves the family under the lowercase-hyphenated name `proxima-nova`, so I'll make sure that exact string is first in `--font-sans` and `--font-display`.
- Verify in the live preview that rendered text resolves to Proxima Nova rather than the fallback.

## Technical notes

- Font links live in `head().links` in `src/routes/__root.tsx`; the family tokens live in the `@theme` block of `src/styles.css`. Remote font stylesheets must be loaded via `<link>`, never `@import` in the CSS file.
- Adobe Fonts kits are domain-locked, so the font will only render on domains added in step 3 — if the preview shows the fallback, that list is usually the cause.
- No fonts are self-hosted, so nothing is added to the repo and licensing stays with your Adobe account.
