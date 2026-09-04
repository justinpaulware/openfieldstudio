# Around (auto-fit) labels: left/right only

## Change
The "Around (auto-fit)" label placement currently lets each label slide to `left`, `right`, `bottom`, or `top` of its point. The user wants it to place labels **only to the left or right** — never above or below the geometry.

## Edit
In `src/components/map/map-canvas.tsx` (line ~1211), change the `text-variable-anchor` value for the auto-fit case:

```ts
// before
variable ? ["left", "right", "bottom", "top"] : undefined,
// after
variable ? ["left", "right"] : undefined,
```

No other changes needed — `text-radial-offset`, `text-justify`, `text-anchor`, and `text-offset` already handle the auto-fit case correctly and only depend on whether `variable` is true, not on which anchors are in the list.
