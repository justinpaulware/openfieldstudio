# Design refresh: dark cool-gray theme, yellow primary, new type, softer marketing copy

## Theme

Flip the app to a dark-first look instead of the current warm paper canvas.

- Background: deep cool gray (blue-leaning neutral), with slightly lighter cards and panels so surfaces separate without borders shouting.
- Text: near-white for headings and primary text, light gray for secondary/muted text.
- Primary: shift from orange to a true warm yellow, used for buttons, active nav, focus rings. Foreground on yellow stays near-black for contrast.
- Keep purple and green as the secondary accents, retuned for legibility on dark.
- Dark becomes the default (`dark` applied at the document root); the light token set stays in the stylesheet but is no longer the default surface.

## Typography

- Primary font: Proxima Nova. It's a licensed font not available on Google Fonts, so unless you have a webfont kit / license to drop in, the plan uses **Montserrat** as the closest free stand-in for headings and UI, with the stack written as `"Proxima Nova", Montserrat, ...` so your licensed copy takes over automatically the moment it's added.
- Secondary font: **Cantarell** (Google Fonts) used sparingly — eyebrow labels, step markers, captions, footer, status chips. Not body copy.
- Body copy runs in the primary stack; the display/heading font is the same family at heavier weights rather than a separate display face.

## Marketing copy

Title: change for now to "Open Field"  


Rewrite the landing page so it's about the product, not a QGIS migration story.

- Hero: creating, managing, styling and publishing simple, beautiful webmaps. Drop "From QGIS export to…" and "without writing code" framing.
- Steps section: Create → Style → Publish (data sources mentioned as capability, not as a QGIS export path).
- Features section heading moves off "Built for map makers, not developers".
- Footer tagline and the "Open-source GIS publishing" eyebrow get neutral replacements.
- Page title / meta description / OG tags updated to match, keeping them unique and under length limits.
- Same copy cleanup applied anywhere else QGIS appears in UI text.

## Technical notes

- Token edits live in `src/styles.css` (`:root`, `.dark`, `@theme inline`) — all values stay oklch semantic tokens; no hardcoded color utilities in components.
- Font loading via `<link>` tags in `src/routes/__root.tsx` head (Montserrat + Cantarell), never a CSS `@import` URL.
- `--font-sans` / `--font-display` remapped; a `--font-secondary` token added for Cantarell so it can be applied with a utility class.
- Copy changes are confined to `src/routes/index.tsx` and the route `head()` meta.
- No schema, auth, or data changes.