import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, PaginatedResponse, WallpaperResponse, WallpaperRow } from "./types.js";

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

function folderNormalize(val: string): string {
  return val.trim().toLowerCase();
}

function toResponse(row: WallpaperRow, base: string): WallpaperResponse {
  return {
    id: row.id,
    filename: row.filename,
    url_full: `${base}/api/images/${row.r2_key_full}`,
    url_thumb: `${base}/api/images/${row.r2_key_thumb}`,
    width: row.width,
    height: row.height,
    file_size: row.file_size,
    mime_type: row.mime_type,
    created_at: row.created_at,
  };
}

app.get("/api/health", (c) => c.json({ ok: true, timestamp: new Date().toISOString() }));

// List wallpapers — two D1 queries batched into one round trip
app.get("/api/wallpapers", async (c) => {
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit")) || 20));
  const offset = (page - 1) * limit;
  const category = c.req.query("category");

  let countStmt = c.env.DB.prepare("SELECT COUNT(*) as count FROM wallpapers WHERE is_active = 1");
  let listStmt = c.env.DB.prepare("SELECT * FROM wallpapers WHERE is_active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(limit, offset);

  if (category) {
    countStmt = c.env.DB.prepare("SELECT COUNT(*) as count FROM wallpapers WHERE is_active = 1 AND category = ?").bind(folderNormalize(category));
    listStmt = c.env.DB.prepare("SELECT * FROM wallpapers WHERE is_active = 1 AND category = ? ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(folderNormalize(category), limit, offset);
  }

  const [countRes, listRes] = await c.env.DB.batch<WallpaperRow | { count: number }>([countStmt, listStmt]);

  const total = (countRes?.results[0] as { count: number } | undefined)?.count ?? 0;
  const data: WallpaperResponse[] = ((listRes?.results ?? []) as WallpaperRow[]).map((r) =>
    toResponse(r, c.env.WORKER_URL)
  );

  const body: PaginatedResponse<WallpaperResponse> = {
    data,
    meta: { page, limit, total, total_pages: Math.ceil(total / limit) },
  };

  // ponytail: 60s CDN cache — bump if wallpapers upload rate drops further
  return c.json(body, 200, { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" });
});

// Single wallpaper
app.get("/api/wallpapers/:id", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT * FROM wallpapers WHERE id = ? AND is_active = 1"
  ).bind(c.req.param("id")).first<WallpaperRow>();

  if (!row) return c.json({ error: "Wallpaper not found" }, 404);

  return c.json({ data: toResponse(row, c.env.WORKER_URL) }, 200, {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  });
});

// Image proxy — no public R2 access needed
app.get("/api/images/*", async (c) => {
  const r2Key = c.req.path.replace("/api/images/", "");
  if (!r2Key) return c.json({ error: "Missing image key" }, 400);

  const object = await c.env.BUCKET.get(r2Key);
  if (!object) return c.json({ error: "Image not found" }, 404);

  return new Response(object.body as unknown as ReadableStream, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
      "ETag": object.httpEtag,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
