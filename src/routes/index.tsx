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
  ThumbsUp,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";

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
    title: "Brooklyn County Committee",
    body: "Search an address to find your Election District and its County Committee members — and see where seats sit vacant.",
    href: "/justinpaulware/new-york-city-elections",
  },
  {
    tag: "Community engagement",
    title: "The Peekskill Plan",
    body: "Residents and workshop participants share categorized, geolocated feedback on streets, places and mobility.",
    href: "/justinpaulware/the-peekskill-plan",
  },
  {
    tag: "Planning & scenarios",
    title: "St. Louis Schools",
    body: "Multiple Views compare existing school facilities with future planning models.",
    href: "/justinpaulware/stlchools",
  },
  {
    tag: "Research & thematic mapping",
    title: "Mid-Hudson Innovation Ring",
    body: "A regional look at community colleges, institutions and economic corridors across the Mid-Hudson Valley.",
    href: "/justinpaulware/community-college-innovation-ring",
  },
];

function MapBackdrop() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <rect width="400" height="260" className="fill-muted" />
      <g className="stroke-border" strokeWidth="1" fill="none">
        <path d="M0 60 Q120 40 200 90 T400 70" />
        <path d="M0 160 Q140 130 230 180 T400 150" />
        <path d="M90 0 L130 260" />
        <path d="M280 0 L250 260" />
      </g>
      <g className="fill-primary/25 stroke-primary" strokeWidth="1.2">
        <path d="M140 70 L210 60 L235 120 L170 140 Z" />
        <path d="M235 120 L300 110 L310 175 L250 185 Z" className="fill-primary/45" />
        <path d="M80 140 L170 140 L180 205 L95 215 Z" className="fill-primary/10" />
      </g>
    </svg>
  );
}

function Mock({ kind }: { kind: "editor" | "viewer" | "comments" }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-soft)]">
      <MapBackdrop />
      {kind === "editor" && (
        <div className="absolute inset-y-3 left-3 w-[38%] space-y-1.5 rounded-lg border border-border bg-card/95 p-3 text-[11px]">
          <p className="font-semibold">Layers</p>
          {["Election Districts", "Assembly Districts", "Polling Sites", "Parks"].map((l, i) => (
            <div key={l} className="flex items-center gap-2 rounded px-1.5 py-1 data-[a=true]:bg-primary/15" data-a={i === 0}>
              <span className="h-2.5 w-2.5 rounded-sm bg-primary" style={{ opacity: 1 - i * 0.2 }} />
              <span className="truncate">{l}</span>
            </div>
          ))}
          <p className="pt-2 font-semibold">Symbology</p>
          <div className="flex h-2 overflow-hidden rounded">
            {[0.15, 0.35, 0.55, 0.75, 0.95].map((o) => (
              <span key={o} className="flex-1 bg-primary" style={{ opacity: o }} />
            ))}
          </div>
          <p className="text-muted-foreground">Graduated · 5 classes</p>
        </div>
      )}
      {kind === "viewer" && (
        <>
          <div className="absolute left-3 top-3 w-[42%] space-y-2">
            <div className="rounded-lg border border-border bg-card/95 p-2.5 text-[11px]">
              <p className="font-semibold">County Committee</p>
              <p className="text-muted-foreground">Find who represents your district.</p>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-border bg-card/95 p-2 text-[11px] text-muted-foreground">
              <Search className="h-3 w-3" /> 383 Macon Street
            </div>
            <div className="rounded-lg border border-border bg-card/95 p-2 text-[11px]">
              <p className="font-semibold">Views</p>
              <p className="text-muted-foreground">Main · Vacancies</p>
            </div>
          </div>
          <div className="absolute right-3 top-10 w-[36%] rounded-lg border border-border bg-card/95 p-2.5 text-[11px]">
            <p className="font-semibold">ED 56 / AD 56</p>
            <p className="mt-1 text-muted-foreground">Committee members</p>
            <p>2 of 4 seats filled</p>
          </div>
        </>
      )}
      {kind === "comments" && (
        <>
          {[
            [30, 40],
            [55, 62],
            [70, 30],
          ].map(([x, y], i) => (
            <span
              key={i}
              className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-card bg-primary text-[9px] font-bold text-primary-foreground"
              style={{ left: `${x}%`, top: `${y}%` }}
            >
              {["AN", "JR", "MK"][i]}
            </span>
          ))}
          <div className="absolute bottom-3 right-3 w-[48%] rounded-lg border border-border bg-card/95 p-2.5 text-[11px]">
            <div className="flex gap-1.5">
              <span className="rounded-full bg-primary/20 px-1.5">Mobility</span>
              <span className="rounded-full bg-muted px-1.5 text-muted-foreground">Line</span>
            </div>
            <p className="mt-1.5">This crossing needs a safer signal for kids walking to school.</p>
            <div className="mt-1.5 flex items-center gap-1 text-muted-foreground">
              <ThumbsUp className="h-3 w-3" /> 12 · Public Workshops
            </div>
          </div>
        </>
      )}
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
            <Mock kind="editor" />
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
                className="group flex flex-col rounded-xl border border-border bg-card p-6 transition-colors hover:border-primary"
              >
                <span className="flex items-center gap-1.5 font-secondary text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {e.tag}
                </span>
                <h3 className="mt-3 text-lg font-semibold">{e.title}</h3>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{e.body}</p>
                <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium">
                  Open map <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
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
