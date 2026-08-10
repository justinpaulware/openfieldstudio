# Dock the popup at the top, left of the zoom controls

The feature popup should sit at the very top of the map, left of the zoom (+/-) control, top-aligned with it, with the same gap the map controls use between each other.

## What changes

- Popup card top edge aligns with the top of the zoom control (same 10px inset from the top of the map).
- Popup sits to the left of the control column with a 10px gap, matching the spacing maplibre uses between control groups instead of the current tight 4px offset.
- Height cap adjusts to the new top position so tall popups scroll inside the map area.
- Width behavior unchanged (configured max width, capped at 420px).

## Technical notes

In `src/components/map/map-canvas.tsx`, change the popup overlay from `right-[43px] top-[146px]` to `top-[10px] right-[49px]` (10px control margin + 29px control width + 10px gap) and update `max-h` to `calc(100%-20px)`.
