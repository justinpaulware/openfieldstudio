# Remove View navigation from the Engagement tab

## What
Hide the `ViewSwitcher` on the Engagement (`/comments`) tab, the same way it is already hidden on the Publish tab. The ViewSwitcher should remain visible only on the Map Editor tab.

## Why
The Publish tab already drops the ViewSwitcher because the Publish page manages all views together rather than one at a time. The Engagement tab has the same property — it's a project-level view, not a per-view tool — so the View selector is unnecessary there and inconsistent with the Publish tab's cleaner header.

## Change
File: `src/routes/_authenticated/projects.$projectSlug.tsx`

Currently:
```tsx
const isPublishTab = pathname.endsWith("/publish");
...
{!isPublishTab && (
  <ViewSwitcher ... />
)}
```

Replace the single `isPublishTab` guard with a check that hides the switcher on both the Publish and Engagement (comments) tabs. Concretely, derive `isEngagementTab = pathname.endsWith("/comments")` and render the ViewSwitcher only when neither flag is true:

```tsx
const isPublishTab = pathname.endsWith("/publish");
const isEngagementTab = pathname.endsWith("/comments");
...
{!isPublishTab && !isEngagementTab && (
  <ViewSwitcher ... />
)}
```

No data, routing, or styling changes. The ViewSwitcher will still appear on the Map Editor tab (and any future tab that isn't Publish or Engagement).

## Verification
- `bunx tsgo --noEmit` passes.
- Open the Engagement tab in the preview and confirm the ViewSwitcher no longer appears in the header next to the project name.
- Confirm the ViewSwitcher still appears on the Map Editor tab.
