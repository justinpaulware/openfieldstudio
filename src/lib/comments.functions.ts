import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Hidden covers the legacy rejected state; everything else counts as visible. */
const HIDDEN_STATUSES = ["hidden", "rejected"] as const;

const input = z.object({
  projectId: z.string().uuid(),
  format: z.enum(["csv", "geojson"]),
  status: z.enum(["all", "visible", "hidden"]).default("all"),
  search: z.string().default(""),
});

type Row = {
  id: string;
  project_id: string;
  body: string;
  category: string | null;
  status: string;
  source: string | null;
  author_name: string | null;
  author_email: string | null;
  created_at: string;
  updated_at: string;
  lng: number;
  lat: number;
  geometry: unknown;
  geometry_type: string;
};

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** WKT for non-point geometries so CSV keeps the shape rather than dropping it. */
function wkt(geometry: unknown, lng: number, lat: number): string {
  const geom = geometry as { type?: string; coordinates?: unknown } | null;
  if (!geom?.type || geom.type === "Point") return `POINT (${lng} ${lat})`;
  const coords = JSON.stringify(geom.coordinates ?? [])
    .replace(/\[/g, "(")
    .replace(/\]/g, ")")
    .replace(/,/g, " ")
    .replace(/\)\s\(/g, "), (");
  return `${geom.type.toUpperCase()} ${coords}`;
}

const HEADERS = [
  "id",
  "project_id",
  "project_name",
  "body",
  "category",
  "status",
  "source",
  "author_name",
  "author_email",
  "created_at",
  "updated_at",
  "lng",
  "lat",
  "geometry_type",
  "geometry_wkt",
];

export const exportComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, title, slug")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projectError) throw new Error(projectError.message);
    if (!project) throw new Error("Project not found.");

    let query = supabase
      .from("comments")
      .select(
        "id, project_id, body, category, status, source, author_name, author_email, created_at, updated_at, lng, lat, geometry, geometry_type",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });

    if (data.status === "hidden") query = query.in("status", [...HIDDEN_STATUSES]);
    if (data.status === "visible") query = query.not("status", "in", `(${HIDDEN_STATUSES.join(",")})`);
    if (data.search.trim()) query = query.ilike("body", `%${data.search.trim()}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const comments = (rows ?? []) as Row[];
    const stamp = new Date().toISOString().slice(0, 10);
    const base = `${project.slug ?? "comments"}-comments-${stamp}`;

    if (data.format === "geojson") {
      const featureCollection = {
        type: "FeatureCollection",
        features: comments.map((row) => ({
          type: "Feature",
          geometry:
            (row.geometry as { type?: string } | null)?.type != null
              ? row.geometry
              : { type: "Point", coordinates: [row.lng, row.lat] },
          properties: {
            id: row.id,
            project_id: row.project_id,
            project_name: project.title,
            body: row.body,
            category: row.category,
            status: row.status,
            source: row.source,
            author_name: row.author_name,
            author_email: row.author_email,
            created_at: row.created_at,
            updated_at: row.updated_at,
            geometry_type: row.geometry_type,
            lng: row.lng,
            lat: row.lat,
          },
        })),
      };
      return {
        filename: `${base}.geojson`,
        mimeType: "application/geo+json",
        content: JSON.stringify(featureCollection, null, 2),
        count: comments.length,
      };
    }

    const lines = [HEADERS.join(",")];
    for (const row of comments) {
      const geomType = row.geometry_type || (row.geometry as { type?: string } | null)?.type || "Point";
      lines.push(
        [
          row.id,
          row.project_id,
          project.title,
          row.body,
          row.category,
          row.status,
          row.source,
          row.author_name,
          row.author_email,
          row.created_at,
          row.updated_at,
          row.lng,
          row.lat,
          geomType,
          wkt(row.geometry, row.lng, row.lat),
        ]
          .map(csvCell)
          .join(","),
      );
    }

    return {
      filename: `${base}.csv`,
      mimeType: "text/csv",
      content: lines.join("\n"),
      count: comments.length,
    };
  });

/* ------------------------------------------------------------------ *
 * Importing comments collected offline (workshops, paper forms, …)    *
 * ------------------------------------------------------------------ */

/** Anything richer than these is flattened before it reaches the database. */
const geometrySchema = z.object({
  type: z.enum(["Point", "LineString", "Polygon"]),
  coordinates: z.any(),
});

const importInput = z.object({
  projectId: z.string().uuid(),
  /** Free-text provenance label, e.g. "Public Workshops". */
  source: z.string().trim().min(1).max(60).default("Public Workshops"),
  features: z
    .array(
      z.object({
        body: z.string().trim().min(1).max(2000),
        category: z.string().trim().max(120).nullable().default(null),
        authorName: z.string().trim().max(120).nullable().default(null),
        /** Calendar date from the source data, if any. */
        date: z.string().trim().nullable().default(null),
        geometry: geometrySchema,
      }),
    )
    .min(1)
    .max(2000),
  /** Layer to delete once the comments land, when converting a layer. */
  deleteLayerId: z.string().uuid().nullable().default(null),
});

type Pos = [number, number];

/** Flatten any nesting depth of coordinates down to [lng, lat] pairs. */
function flattenPositions(value: unknown, out: Pos[] = []): Pos[] {
  if (!Array.isArray(value)) return out;
  if (typeof value[0] === "number" && typeof value[1] === "number") {
    out.push([value[0] as number, value[1] as number]);
    return out;
  }
  for (const part of value) flattenPositions(part, out);
  return out;
}

/** Anchor point for the initialled pin: the point itself, or the shape's middle. */
function anchorFor(geometry: { type: string; coordinates: unknown }): Pos | null {
  const positions = flattenPositions(geometry.coordinates);
  if (!positions.length) return null;
  if (geometry.type === "Point") return positions[0]!;
  if (geometry.type === "LineString") return positions[Math.floor(positions.length / 2)]!;
  const sum = positions.reduce<Pos>((acc, p) => [acc[0] + p[0], acc[1] + p[1]], [0, 0]);
  return [sum[0] / positions.length, sum[1] / positions.length];
}

/**
 * Workshop notes carry a calendar date, never a clock time. Anchor each one at
 * noon UTC so timezone shifts can't roll it onto the day before or after, then
 * stagger the seconds so the original sheet order survives sorting.
 */
function timestampFor(date: string | null, index: number): string {
  const trimmed = (date ?? "").trim();
  let base: Date | null = null;
  if (trimmed) {
    const slash = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(trimmed);
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
    if (iso) {
      base = new Date(Date.UTC(+iso[1]!, +iso[2]! - 1, +iso[3]!, 12));
    } else if (slash) {
      const year = slash[3]!.length === 2 ? 2000 + +slash[3]! : +slash[3]!;
      base = new Date(Date.UTC(year, +slash[1]! - 1, +slash[2]!, 12));
    } else {
      const parsed = new Date(trimmed);
      if (!Number.isNaN(parsed.getTime())) {
        base = new Date(
          Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 12),
        );
      }
    }
  }
  if (!base || Number.isNaN(base.getTime())) base = new Date();
  return new Date(base.getTime() + index * 1000).toISOString();
}

/**
 * Bring offline feedback onto the map as ordinary comments: same cards, same
 * colors, same votes — only the source label says where it came from.
 */
export const importComments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => importInput.parse(data))
  .handler(async ({ data, context }) => {
    const supabase = context.supabase;

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, owner_id")
      .eq("id", data.projectId)
      .maybeSingle();
    if (projectError) throw new Error(projectError.message);
    if (!project || project.owner_id !== context.userId) {
      throw new Error("You can only import comments into your own map.");
    }

    const rows: TablesInsert<"comments">[] = [];
    let skipped = 0;
    data.features.forEach((feature, index) => {
      const anchor = anchorFor({
        type: feature.geometry.type,
        coordinates: feature.geometry.coordinates,
      });
      if (!anchor) {
        skipped += 1;
        return;
      }
      rows.push({
        project_id: data.projectId,
        lng: anchor[0],
        lat: anchor[1],
        geometry: feature.geometry as never,
        geometry_type: feature.geometry.type,
        body: feature.body.slice(0, 2000),
        category: feature.category || null,
        author_name: feature.authorName || null,
        source: data.source,
        status: "approved" as const,
        created_at: timestampFor(feature.date, index),
      });
    });
    if (!rows.length) throw new Error("None of those features had usable coordinates.");

    // Chunked so a large workshop batch doesn't hit statement limits.
    for (let start = 0; start < rows.length; start += 200) {
      const { error } = await supabase.from("comments").insert(rows.slice(start, start + 200));
      if (error) throw new Error(error.message);
    }

    let layerDeleted = false;
    if (data.deleteLayerId) {
      const { data: layer } = await supabase
        .from("layers")
        .select("id, storage_path, project_id")
        .eq("id", data.deleteLayerId)
        .eq("project_id", data.projectId)
        .maybeSingle();
      if (layer) {
        await supabase.from("layers").delete().eq("id", layer.id);
        layerDeleted = true;
      }
    }

    return { imported: rows.length, skipped, layerDeleted };
  });
