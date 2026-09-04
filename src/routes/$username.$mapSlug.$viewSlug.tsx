import { createFileRoute, notFound } from "@tanstack/react-router";

import { ViewerMessage, off, type ViewerSearch } from "@/components/public/public-map";
import { getPublishedMap } from "@/lib/publish.functions";

const SITE = "https://openfield.nu";

export const Route = createFileRoute("/$username/$mapSlug/$viewSlug")({
  validateSearch: (search: Record<string, unknown>): ViewerSearch => ({
    ...(off(search["legend"]) ? { legend: false as const } : {}),
    ...(off(search["title"]) ? { title: false as const } : {}),
    ...(off(search["views"]) ? { views: false as const } : {}),
  }),
  loader: async ({ params }) => {
    const data = await getPublishedMap({
      data: { username: params.username, slug: params.mapSlug, viewSlug: params.viewSlug },
    });
    if (!data) throw notFound();
    return data;
  },
  head: ({ params, loaderData }) => {
    const title = loaderData?.project.title
      ? `${loaderData.project.title} — Open Field`
      : "Map view — Open Field";
    const description =
      loaderData?.project.description?.slice(0, 155) ??
      "An interactive webmap view published with Open Field.";
    const url = `${SITE}/${params.username}/${params.mapSlug}/${params.viewSlug}`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  errorComponent: () => <ViewerMessage title="This view could not be loaded." />,
  notFoundComponent: () => <ViewerMessage title="This view is not published." />,
  // The viewer itself is rendered once by the parent route with this route's
  // loader payload, so the map never remounts when switching views.
  component: () => null,
});

