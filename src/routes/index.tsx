import { createFileRoute, Link } from "@tanstack/react-router";
import { Layers, Upload, Palette, Globe2, MessageSquare, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Open Field — Turn GIS data into interactive webmaps" },
      {
        name: "description",
        content:
          "Upload GeoJSON, connect CSV and ArcGIS services, style layers visually and publish shareable webmaps. Built for GIS professionals moving from QGIS to the web.",
      },
      { property: "og:title", content: "Open Field — Turn GIS data into interactive webmaps" },
      {
        property: "og:description",
        content: "QGIS to Upload to Style to Publish. No web development required.",
      },
    ],
  }),
  component: Landing,
});

const steps = [
  { icon: Upload, title: "Upload", body: "Drop in GeoJSON exports, or point at a CSV or ArcGIS REST service." },
  { icon: Palette, title: "Style", body: "Visual cartography controls for points, lines, polygons, labels and popups." },
  { icon: Globe2, title: "Publish", body: "A clean public map at its own URL, ready to share or embed anywhere." },
];

const features = [
  { icon: Layers, title: "Layer management", body: "Reorder, rename, toggle and zoom to layers in a panel that feels familiar." },
  { icon: MessageSquare, title: "Geolocated comments", body: "Let the public drop pins and give feedback, with moderation built in." },
  { icon: Code2, title: "Embeddable", body: "Copy an iframe snippet and place your map into any website." },
];

function Landing() {
  const { session, loading } = useSession();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Layers className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold">Open Field</span>
          </Link>
          <nav className="flex items-center gap-2">
            {!loading && session ? (
              <Button asChild size="sm">
                <Link to="/projects">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth" search={{ mode: "signup" }}>
                    Get started
                  </Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 md:pt-28">
          <p className="inline-flex items-center rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            Open-source GIS publishing
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-semibold leading-[1.05] md:text-6xl">
            From QGIS export to a live webmap, without writing code.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Open Field is the shortest path between your spatial data and an interactive public
            map. Create a project, bring in your data, style it properly, and publish.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>
                Create a free account
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>

          <div className="mt-16 grid gap-4 md:grid-cols-3">
            {steps.map((s, i) => (
              <div
                key={s.title}
                className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-foreground">
                    <s.icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="text-xs font-medium text-muted-foreground">Step {i + 1}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-border bg-secondary/50">
          <div className="mx-auto max-w-6xl px-6 py-16">
            <h2 className="text-2xl font-semibold md:text-3xl">Built for map makers, not developers</h2>
            <p className="mt-3 max-w-2xl text-muted-foreground">
              Cartographic quality and public engagement, without the hosting, tooling and
              front-end work that usually stands in the way.
            </p>
            <div className="mt-10 grid gap-8 md:grid-cols-3">
              {features.map((f) => (
                <div key={f.title}>
                  <f.icon className="h-5 w-5 text-violet" />
                  <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-2xl font-semibold md:text-3xl">Start your first project</h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Projects, data, styling and publishing all live in one place. Set one up in under a
            minute.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/auth" search={{ mode: "signup" }}>
              Get started
            </Link>
          </Button>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>Open Field — open-source GIS publishing.</span>
          <span>QGIS to Upload to Style to Publish.</span>
        </div>
      </footer>
    </div>
  );
}
