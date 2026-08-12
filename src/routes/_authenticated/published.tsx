import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/published")({
  // Publishing now lives inside each project's Publish tab.
  beforeLoad: () => {
    throw redirect({ to: "/projects", replace: true });
  },
});
