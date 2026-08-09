# Fix: map editor renders a blank white canvas

## What I found

I inspected the live map instance in your editor. The map is not "missing" — it is running, but it never draws anything:

- The map container, canvas (622x786), zoom/scale/geolocate controls all exist, and the scale bar responds to zoom (2000 km -> 1000 km). So the map object is alive and interactive.
- The Positron style downloads fine (200), its sprite loads, and the basemap's tile index (`/planet`) resolves to a valid tile template. I fetched an actual vector tile from the browser: 200, 1.2 MB. Network is not the problem.
- The style's source object reports `loaded: true` with correct tile URLs — **but its tile manager holds zero tiles**. Neither the vector source nor the shaded-relief raster source has ever requested a single tile, at any zoom.
- No console errors, no map `error` events, even after forcing `resize()`, `triggerRepaint()` and a zoom change.

So: style loads, sources load, tiles are never requested, nothing paints. Positron's background layer is near-white, which is exactly the "white box" you see.

Zero tiles requested with zero errors points at the map's background worker pipeline being wedged, not at styling or data. The most likely cause is the editor mounting the map twice in development (React's double-invoked effects and hot reload): the first instance is created and then torn down with `map.remove()`, which releases the shared worker pool, and the second instance ends up with a worker connection that answers but never delivers tiles. A secondary suspect is the pinned `maplibre-gl@6.2.0` itself.

## The fix

1. **Make map creation double-mount safe.** Create the map instance in a way that survives React's dev double-invoke and hot reloads: guard initialization against a torn-down-then-recreated cycle, and avoid destroying the shared worker pool between the two mounts. Do not tear down and immediately recreate the instance in the same tick.
2. **Verify against a known-good version.** If a correctly single-mounted map still requests zero tiles, pin `maplibre-gl` to the current stable 5.x line, which is the widely deployed pairing with Vite and React 19, and re-verify tiles render.
3. **Stop failing silently.** Attach a map `error` handler that logs the failure and shows an inline message over the canvas ("Basemap failed to load — retry"), plus a short watchdog: if no tiles have loaded a few seconds after the style is ready, surface that state instead of showing a blank white rectangle.
4. **Verify with real tiles.** After the change, confirm from the running app that the basemap tile manager holds loaded tiles and the canvas paints roads/water, at both the default view and after switching basemaps.

Once the basemap is confirmed painting, I'll apply the CSV coordinate fix from the previous plan (blank cells being read as `0`, which drags the layer extent to null island) so "zoom to layer" frames your Hudson Valley points correctly.

## Technical notes

- Files involved: `src/components/map/map-canvas.tsx` (init effect, cleanup, error handling) and `package.json` if a version change is needed.
- Current init effect cleanup calls `map.remove()` unconditionally; under StrictMode this runs between the two mounts and releases MapLibre's global worker pool while a new map is being constructed.
- Options to evaluate in order: keep the instance alive across the dev double-invoke (ref-based singleton keyed to the container, cleanup only on real unmount), or call `maplibregl.prewarm()` so the worker pool is not released on `remove()`.
- Add `map.on("error", ...)` before the style loads so worker/tile failures are captured rather than swallowed.
