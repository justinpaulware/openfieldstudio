# Move the popup card beside the map controls

Right now the feature popup stacks underneath the navigation/basemap buttons in the top-right corner. Instead it should sit to the left of that control stack, aligned with the top of the controls and separated by the same gap used between the existing buttons.

## What changes

- The popup card is pulled out of the vertical control stack and rendered as its own overlay.
- It anchors to the top-right area but is offset horizontally so it sits immediately left of the button column, using the same spacing rhythm as the buttons.
- Its top edge lines up with the top of the basemap/zoom control stack.
- Height stays capped to the visible map area with internal scrolling; width still follows the configured popup max width (capped at 420px).
- Opening the basemap picker no longer pushes the popup down, since they are no longer in the same stack.

## Technical notes

In `src/components/map/map-canvas.tsx`, move the `popupHit` block out of the `absolute right-2.5 top-[146px] flex-col` container into a sibling absolute-positioned element. Use a right offset equal to control column width plus the existing gap (29px button + ~4px gap, so roughly `right-[calc(0.625rem+33px)]`), top aligned with the control stack, and `max-h`/`overflow-y-auto` for tall content.
