import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/$projectId/styling")({
  // Styling lives inside the Map Editor so edits preview live on the map.
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/projects/$projectId/map",
      params: { projectId: params.projectId },
      search: { style: true },
    });
  },
});
