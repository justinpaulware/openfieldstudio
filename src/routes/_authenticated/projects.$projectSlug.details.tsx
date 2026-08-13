import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/projects/$projectSlug/details")({
  // Details merged into the Publish tab.
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/projects/$projectSlug/publish",
      params: { projectSlug: params.projectSlug },
      replace: true,
    });
  },
});
