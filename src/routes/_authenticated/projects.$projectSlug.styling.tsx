import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/$projectSlug/styling")({
  // Styling lives inside the Map Editor so edits preview live on the map.
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/projects/$projectSlug/map",
      params: { projectSlug: params.projectSlug },
      search: { style: true },
    });
  },
});
