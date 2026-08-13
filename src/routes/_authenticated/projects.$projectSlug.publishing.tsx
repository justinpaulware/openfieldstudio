import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/$projectSlug/publishing")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/projects/$projectId/publish",
      params: { projectId: params.projectId },
      replace: true,
    });
  },
});
