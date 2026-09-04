import { createFileRoute, notFound, Outlet, useMatches } from "@tanstack/react-router";

import {
  PublicMapViewer,
  ViewerMessage,
  off,
  type PublishedMapData,
  type ViewerSearch,
} from "@/components/public/public-map";
import { getPublishedMap } from "@/lib/publish.functions";

const SITE = "https://openfield.nu";

export const Route = createFileRoute("/$username/$mapSlug")({
  validateSearch: (search: Record<string, unknown>): ViewerSearch => ({
    ...(off(search["legend"]) ? { legend: false as const } : {}),
    ...(off(search["title"]) ? { title: false as const } : {}),
    ...(off(search["views"]) ? { views: false as const } : {}),
  }),
  loader: async ({ params }) => {
    const data = await getPublishedMap({
      data: { username: params.username, slug: params.mapSlug },
    });
    if (!data) throw notFound();
    return data;
  },
  head: ({ params, loaderData }) => {
    const title = loaderData?.project.title
      ? `${loaderData.project.title} — Open Field`
      : "Map — Open Field";
    const description =
      loaderData?.project.description?.slice(0, 155) ??
      "An interactive webmap published with Open Field.";
    const url = `${SITE}/${params.username}/${params.mapSlug}`;
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
  errorComponent: () => <ViewerMessage title="This map could not be loaded." />,
  notFoundComponent: () => <ViewerMessage title="This map is not published." />,
  component: MainViewRoute,
});

/**
 * Single mount point for the public viewer. When a named-view child route is
 * matched we render the same viewer with the child's payload, so MapLibre is
 * never torn down while switching views.
 */
function MainViewRoute() {
  const { username, mapSlug } = Route.useParams();
  const search = Route.useSearch();
  const data = Route.useLoaderData() as PublishedMapData;
  const matches = useMatches();
  const child = matches.find((match) => match.routeId === "/$username/$mapSlug/$viewSlug");
  const active = (child?.loaderData as PublishedMapData | undefined) ?? data;
  // A missing/unpublished view slug renders the child's message on its own.
  if (child && !child.loaderData) return <Outlet />;


  return (
    <>
      <Outlet />
      <PublicMapViewer username={username} slug={mapSlug} search={search} data={active} />
    </>
  );
}
