import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUSES = ["pending", "approved", "hidden", "rejected"] as const;

const input = z.object({
  projectId: z.string().uuid(),
  format: z.enum(["csv", "geojson"]),
  status: z.enum(["all", ...STATUSES]).default("all"),
  search: z.string().default(""),
});

type Row = {
  id: string;
  project_id: string;
  body: string;
  category: string | null;
  status: string;
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
        "id, project_id, body, category, status, author_name, author_email, created_at, updated_at, lng, lat, geometry, geometry_type",
      )
      .eq("project_id", data.projectId)
      .order("created_at", { ascending: false });

    if (data.status !== "all") query = query.eq("status", data.status);
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
