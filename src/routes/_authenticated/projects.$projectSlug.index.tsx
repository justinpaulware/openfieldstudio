import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/$projectSlug/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/projects/$projectSlug/map",
      params: { projectSlug: params.projectSlug },
      replace: true,
    });
  },
});
