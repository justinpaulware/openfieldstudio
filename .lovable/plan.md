# Center the "i" inside its circle

The info icon image is 24px wide but its button is 22px, and the image is pinned to the top-left corner. That pushes the black dot about 1px down and to the right of the white circle's center.

## Fix
In the map stylesheet, on the info button:
- Center the icon image (`background-position: center`).
- Size it to fit the button (`background-size: 20px 20px`, `background-repeat: no-repeat`).

The button's position stays the same, so it still won't jump when clicked.

## Check
Open a published map, zoom into the "i" button, and confirm the dot is centered both closed and open.
