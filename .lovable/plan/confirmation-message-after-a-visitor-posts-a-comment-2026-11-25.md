# Confirmation message after a visitor posts a comment

## What's wrong today
A thank-you message already exists, but the comment form closes the instant a comment is posted, so visitors never see it.

## What visitors will see
After posting, a clear confirmation card appears over the map (desktop and phone) and stays until they close it or tap "Done":

- **Review is on:** "Comment received — Thanks! Your comment has been submitted and is being reviewed by the map creator. It will appear on the public map once approved."
- **Review is off:** "Comment posted — Thanks! Your comment is now on the map."

It has a check icon, a close X, and a "Done" button, and fades away on its own after about 10 seconds. The map and pin layout stay the same.

## Technical details
- `comment-composer.tsx`: pass `pending` to `onSubmitted(pending)` instead of only setting local state.
- `public-map.tsx`: both `onSubmitted` handlers store `submitNotice: "pending" | "posted"`, then reset the draft as now; render a small fixed confirmation card (top-center on desktop, above the chip row on mobile) using map-overlay tokens; auto-dismiss timer.
- `comment-panel.tsx`: update the `onSubmitted` type.
