# Styling pass: legend placement, panel cleanup, color controls

## 1. Remove the Styling tab

Styling now lives inside the Map Editor, so the header nav becomes Map Editor / Details / Publishing. The `/styling` URL keeps redirecting into the map editor with the panel open, so old links still work.

## 2 & 3. Map title + legend, top right of the map

A stacked card group in the map's top-right corner: the project title on top, the legend directly beneath it. Both sit above the existing map controls column and shift down as needed so they don't collide with the navigation/basemap buttons. The legend keeps its collapse toggle and the header Legend on/off switch.

## 4. Light legend

The legend (and the title card above it) render on a white / very light gray surface with dark text, regardless of the dark app theme — a printed-map look. Adds a dedicated "map overlay" surface token so it stays themable rather than hardcoded.

## 5. Opacity moves into the Style panel

- The opacity slider is removed from the layer row in the Layers sidebar.
- The Style panel gains two sliders: **Fill opacity** and **Outline opacity** (for lines, this is line opacity). Points get fill and stroke opacity too.
- The layer's overall opacity value stays in the data model for now but is no longer a user control; the two new sliders drive rendering.

## 6. American spelling

"Fill colour" → "Fill color", plus "Line colour", "Stroke color", "Outline color" and the picker aria-labels.

## 7 & 8. Better default swatches

The palette gains a grayscale ramp (white, 20/40/60/80% gray, near-black) alongside the existing hues, and a dedicated **No fill / transparent** swatch rendered as a checkerboard tile with a slash. Choosing it sets the color to transparent; the legend swatch and map render accordingly.

## 9. Consistent custom color picker

The native `<input type="color">` swatch is replaced with a popover in the app's own styling: a saturation/value gradient area, a hue slider, the palette grid, and the hex field — same border, radius, shadow and typography as the rest of the panels.

## Technical notes

- `src/lib/layer-style.ts`: add `strokeOpacity` (stored in `style_config`), extend `STYLE_PALETTE` with the grayscale ramp, and add a transparent sentinel plus a helper for "is transparent".
- `src/components/map/map-canvas.tsx`: paint properties read `fillOpacity` / `strokeOpacity` instead of multiplying by layer opacity; transparent fill maps to opacity 0.
- `src/components/map/style-panel.tsx`: new opacity sliders, renamed labels, new `ColorPicker` popover component (built on the existing popover primitive; no new dependency).
- `src/components/map/map-legend.tsx` + `map.tsx` route: legend and a new title card move into a top-right overlay stack with the light surface token; add the token in `src/styles.css`.
- `src/components/map/layer-panel.tsx`: drop the opacity slider and its `onOpacity` prop; legend swatch honors transparent fill.
- `src/routes/_authenticated/projects.$projectId.tsx`: remove the Styling tab entry.

## Not in this pass

Legend title editing, per-entry legend labels, and data-driven symbology remain later work.
