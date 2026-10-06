import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Layers,
  Palette,
  Globe2,
  MessageSquare,
  Search,
  Download,
  Code2,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import brooklynShot from "@/assets/home/brooklyn.jpg.asset.json";
import peekskillShot from "@/assets/home/peekskill.jpg.asset.json";
import stlShot from "@/assets/home/stl.jpg.asset.json";
import midhudsonShot from "@/assets/home/midhudson.jpg.asset.json";

const TITLE = "Open Field — Create maps, share information, engage communities";
const DESC =
  "Open Field is a free, easy-to-use platform for building interactive maps, publishing spatial information, and gathering community feedback. No coding required.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

const themes = [
  {
    icon: Palette,
    step: "01",
    title: "Build & Style Maps",
    body: "Turn spatial data into clear, interactive maps with a visual workflow designed for GIS users and newcomers alike.",
    points: [
      "Import GeoJSON and CSV, or connect ArcGIS REST services",
      "Categories, graduated styles, proportional symbols, heatmaps and masks",
      "Labels, popups, images and filters",
      "Multiple Views from shared layers and data",
    ],
    mock: "editor" as const,
  },
  {
    icon: Globe2,
    step: "02",
    title: "Publish & Share",
    body: "Transform projects into polished public maps that can be linked directly or embedded on other websites.",
    points: [
      "Clean public URLs for maps and individual Views",
      "Title, legend, popup and attribution cards",
      "Optional address search and address-to-feature lookup",
      "Embed codes, on desktop and mobile",
    ],
    mock: "viewer" as const,
  },
  {
    icon: MessageSquare,
    step: "03",
    title: "Engage Communities",
    body: "Use maps not only to present information, but to invite participation and gather local knowledge.",
    points: [
      "Geolocated comments as points, lines and areas",
      "Moderation, categories, voting and replies",
      "Export comments as CSV and GIS-ready data",
      "Import workshop feedback alongside online input",
    ],
    mock: "comments" as const,
  },
];

const spotlight = [
  { icon: MessageSquare, title: "Map-based comments and moderation" },
  { icon: Search, title: "Address and district lookup" },
  { icon: Layers, title: "Multiple Views and scenarios" },
  { icon: Download, title: "Downloadable engagement data" },
  { icon: Code2, title: "Reusable public links and embeds" },
];

const examples = [
  {
    tag: "Civic transparency",
    title: "Brooklyn (Kings) County Democratic County Committee",
    body: "Search an address to find your Election District and its County Committee members — and see where seats sit vacant.",
    href: "/justinpaulware/bkcc",
    img: brooklynShot.url,
  },
  {
    tag: "Community engagement",
    title: "The Peekskill Plan",
    body: "Residents and workshop participants share categorized, geolocated feedback on streets, places and mobility.",
    href: "/justinpaulware/the-peekskill-plan",
    img: peekskillShot.url,
  },
  {
    tag: "Planning & scenarios",
    title: "St. Louis Schools",
    body: "Multiple Views compare existing school facilities with future planning models.",
    href: "/justinpaulware/stlschools",
    img: stlShot.url,
  },
  {
    tag: "Research & thematic mapping",
    title: "Mid-Hudson Innovation Ring",
    body: "A regional look at community colleges, institutions and economic corridors across the Mid-Hudson Valley.",
    href: "/justinpaulware/midhudson-innovation-ring",
    img: midhudsonShot.url,
  },
];

const shots = {
  editor: { src: stlShot.url, alt: "St. Louis Schools map with a categorized legend and multiple Views" },
  viewer: { src: brooklynShot.url, alt: "Brooklyn County Committee public map with address search and legend" },
  comments: { src: peekskillShot.url, alt: "The Peekskill Plan map with geolocated community comments" },
};

function Mock({ kind }: { kind: keyof typeof shots }) {
  const s = shots[kind];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
      <img src={s.src} alt={s.alt} loading="lazy" className="aspect-[16/10] w-full object-cover" />
    </div>
  );
}

function Landing() {
  const { session, loading } = useSession();
  const signedIn = !loading && !!session;
  const Start = ({ size = "lg" as const }) => (
    <Button asChild size={size}>
      {signedIn ? (
        <Link to="/projects">Open dashboard</Link>
      ) : (
        <Link to="/auth" search={{ mode: "signup" }}>
          Start mapping
        </Link>
      )}
    </Button>
  );
  const Explore = () => (
    <Button asChild size="lg" variant="outline">
      <a href="#examples">Explore example maps</a>
    </Button>
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
          <Link to="/" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Layers className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-semibold">Open Field</span>
          </Link>
          <nav className="hidden items-center gap-6 font-secondary text-sm text-muted-foreground md:flex">
            <a href="#workflow" className="hover:text-foreground">Workflow</a>
            <a href="#engagement" className="hover:text-foreground">Engagement</a>
            <a href="#examples" className="hover:text-foreground">Examples</a>
            <a href="#about" className="hover:text-foreground">About</a>
          </nav>
          <div className="flex items-center gap-2">
            {signedIn ? (
              <Button asChild size="sm">
                <Link to="/projects">Open dashboard</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/auth">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/auth" search={{ mode: "signup" }}>Start mapping</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 md:pt-24">
          <p className="font-secondary text-xs uppercase tracking-widest text-muted-foreground">
            Build & Style · Publish & Share · Engage Communities
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[1.05] md:text-6xl">
            Create Maps. Share Information. Engage Communities.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Open Field is a free platform for building and styling interactive maps, publishing
            spatial information, and gathering community feedback. No coding required.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Start />
            <Explore />
          </div>
          <div className="mt-14">
            <Mock kind="viewer" />
          </div>
        </section>

        <section id="workflow" className="border-t border-border">
          <div className="mx-auto max-w-6xl space-y-20 px-6 py-20">
            {themes.map((t, i) => (
              <div key={t.title} className="grid items-center gap-10 md:grid-cols-2">
                <div className={i % 2 ? "md:order-2" : ""}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
                      <t.icon className="h-4 w-4" />
                    </span>
                    <span className="font-secondary text-xs text-muted-foreground">{t.step}</span>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold md:text-3xl">{t.title}</h2>
                  <p className="mt-3 text-muted-foreground">{t.body}</p>
                  <ul className="mt-5 space-y-2 text-sm">
                    {t.points.map((p) => (
                      <li key={p} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                <Mock kind={t.mock} />
              </div>
            ))}
          </div>
        </section>

        <section id="engagement" className="border-y border-border bg-secondary/50">
          <div className="mx-auto max-w-6xl px-6 py-20">
            <h2 className="text-2xl font-semibold md:text-3xl">Maps that invite participation</h2>
            <p className="mt-4 max-w-3xl text-muted-foreground">
              Open Field is designed to help people understand places and participate in the
              decisions that shape them. Publish information clearly, help visitors find what
              applies to them, and gather feedback directly on the map — for neighborhood plans,
              civic information, public-realm studies, advocacy, research and community-led
              planning.
            </p>
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {spotlight.map((s) => (
                <li key={s.title} className="flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-sm">
                  <s.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  {s.title}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="examples" className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-2xl font-semibold md:text-3xl">Example maps</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">Real projects published with Open Field.</p>
          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {examples.map((e) => (
              <a
                key={e.title}
                href={e.href}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-primary"
              >
                <div className="overflow-hidden border-b border-border">
                  <img src={e.img} alt={`${e.title} map preview`} loading="lazy" className="aspect-[16/9] w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]" />
                </div>
                <div className="flex flex-1 flex-col p-6">
                <span className="flex items-center gap-1.5 font-secondary text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {e.tag}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{e.title}</h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{e.body}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium">
                  Open map <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section className="border-t border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-20 md:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold md:text-3xl">Why Open Field?</h2>
              <p className="mt-4 text-xl text-primary">
                Make mapping, transparency, and participation more accessible.
              </p>
            </div>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Many mapping and engagement tools are expensive, difficult to access, or built
                primarily for technical specialists. Open Field was created as a free and
                approachable alternative.
              </p>
              <p>
                Spatial information should be easier to understand, and the tools used to gather
                public input should be available to more people. Better access to information can
                support better conversations, stronger participation, and more transparent
                decisions.
              </p>
            </div>
          </div>
        </section>

        <section id="about" className="border-t border-border bg-secondary/50">
          <div className="mx-auto max-w-3xl px-6 py-16 text-center">
            <h2 className="text-xl font-semibold">About Open Field</h2>
            <p className="mt-4 text-muted-foreground">
              Open Field is free to use and available to anyone. It is an independent project
              created by{" "}
              <a href="https://justinpaulware.com/" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4" aria-label="Justin Paul Ware (opens in a new tab)">
                Justin Paul Ware
              </a>{" "}
              and{" "}
              <a href="https://spatialpolitics.com/" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-4" aria-label="Spatial Politics (opens in a new tab)">
                Spatial Politics
              </a>{" "}
              to support more accessible mapping, stronger public engagement, and more transparent
              approaches to planning and civic decision-making.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-20 text-center">
          <h2 className="text-3xl font-semibold md:text-4xl">Make your map public.</h2>
          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Build an interactive map, share spatial information, and create new ways for
            communities to participate. Open Field is free to use.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Start />
            <Explore />
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 font-secondary text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <span>Open Field — free mapping, publishing and engagement.</span>
          <span>
            Created by{" "}
            <a href="https://justinpaulware.com/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline underline-offset-4">Justin Paul Ware</a>
            {" · "}
            <a href="https://spatialpolitics.com/" target="_blank" rel="noopener noreferrer" className="hover:text-foreground underline underline-offset-4">Spatial Politics</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
