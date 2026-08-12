import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/comments")({
  // Comments are now a per-project tab.
  beforeLoad: () => {
    throw redirect({ to: "/projects", replace: true });
  },
});
