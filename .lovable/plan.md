# Add the Proxima Nova Adobe Fonts kit

Wire your Adobe Fonts (Typekit) web project into Open Field so Proxima Nova renders everywhere instead of the Montserrat fallback.

Kit provided: `https://use.typekit.net/ehj6ipl.css` (project ID `ehj6ipl`).

## One thing to check on your side

Adobe Fonts kits are domain-locked. In the web project settings, make sure these domains are listed, or the preview will silently fall back:

- `id-preview--32718663-a6d0-4df5-9653-e6ad4bfb7e0e.lovable.app`
- your published `.lovable.app` domain (and any custom domain later)
- `localhost` (for internal checks)


## What I'll change

- Add the Typekit stylesheet plus a `preconnect` to `use.typekit.net` in the app's root head, alongside the existing font links.
- Drop Montserrat from the Google Fonts request (Cantarell stays — it's still used for select secondary text), keeping Montserrat only as a CSS fallback name in case the kit fails to load.
- Confirm the font stack in the theme still reads `"proxima-nova", "Montserrat", ...` — Adobe serves the family under the lowercase-hyphenated name `proxima-nova`, so I'll make sure that exact string is first in `--font-sans` and `--font-display`.
- Verify in the live preview that rendered text resolves to Proxima Nova rather than the fallback.

## Technical notes

- Font links live in `head().links` in `src/routes/__root.tsx`; the family tokens live in the `@theme` block of `src/styles.css`. Remote font stylesheets must be loaded via `<link>`, never `@import` in the CSS file.
- Adobe Fonts kits are domain-locked, so the font will only render on domains added in step 3 — if the preview shows the fallback, that list is usually the cause.
- No fonts are self-hosted, so nothing is added to the repo and licensing stays with your Adobe account.
