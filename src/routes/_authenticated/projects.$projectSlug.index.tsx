import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/$projectSlug/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/projects/$projectId/map",
      params: { projectId: params.projectId },
      replace: true,
    });
  },
});
