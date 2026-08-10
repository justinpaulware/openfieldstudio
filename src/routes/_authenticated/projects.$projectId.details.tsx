import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/$projectId/details")({
  // Details merged into the Publish tab.
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/projects/$projectId/publish",
      params: { projectId: params.projectId },
      replace: true,
    });
  },
});
