# Atlas-style comments: instant posting and a cleaner map layout

## 1. Comments post instantly

Public comments become visible to everyone the moment they're submitted — no waiting for review.

- Each project gets a "Require review before comments appear" switch in the Publish tab. Off by default; when on, the current pending/approve behavior applies.
- Comments already sitting in the queue are approved so they show up.
- The dashboard Comments page stays a management surface: the owner can see every comment on their maps, hide one, or delete it — but nothing is blocked from appearing.
- No up/down votes in this version.

## 2. Map overlay layout, Atlas-style

On both the published viewer and the editor map:

- Zoom / compass / locate controls move to the **bottom right**.
- The feature info popup card sits at the **top right**.
- The comments panel sits **below the info card** on the right, as its own card.
- Title and legend stay top left; scale bar and "Made with Open Field." stay bottom left.

## 3. Comments sidebar card

A compact card in the right-hand stack:

- Header: "Comments", with an eye toggle (show/hide comment pins on the map) and a **+** button to add one.
- Body: a scrollable list of comments — avatar initial, name (or "Anonymous"), relative time, then the comment text. Category shown as a small label when set.
- Clicking a comment flies the map to its pin and highlights it.
- Pressing **+** enters placement mode (crosshair cursor, hint bar); clicking the map drops the pin and opens the compact form inline in the card. Escape or Cancel exits.
- After submitting, the new comment appears immediately at the top of the list and as a pin on the map.

Comment pins render as their own map markers with the same purple treatment, toggled by the eye icon.

## Technical notes

**Database**
- `projects` gains `comments_require_approval boolean not null default false`.
- `force_pending_comment()` trigger updated: set status to `approved` on insert unless the parent project has `comments_require_approval = true` (owner-authored rows keep current behavior).
- Public SELECT policy on `comments` unchanged — it already exposes only `approved` rows on published maps with comments enabled.
- Data change: set existing `pending` comments to `approved`.

**Frontend**
- `src/components/map/map-canvas.tsx`: `NavigationControl` and `GeolocateControl` move to `bottom-right`; the docked popup card's absolute offsets shift to the top-right corner; scale bar / attribution offsets adjusted so nothing collides bottom-right.
- New `src/components/comments/comment-panel.tsx` — the list card with visibility toggle, add button, and the composer embedded in its add state. `comment-composer.tsx` is reused as the form body.
- `src/routes/maps.$slug.tsx`: right-hand column stacks info popup then comments panel; loads approved comments via the existing `listApprovedComments` and refetches after a submit; renders comment pins through the existing map marker path with a `commentsVisible` flag.
- `src/routes/_authenticated/projects.$projectId.publish.tsx`: add the approval switch to the Comments card.
- `src/routes/_authenticated/comments.tsx`: owner list with hide/delete, plus an "awaiting review" filter that only matters for projects with approval on.
