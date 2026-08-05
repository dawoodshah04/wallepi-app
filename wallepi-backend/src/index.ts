import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, PaginatedResponse, WallpaperResponse, WallpaperRow } from "./types.js";

// Cloudflare Workers Cache API global (not in @cloudflare/workers-types with types:[])
declare const caches: { default: Cache };

const app = new Hono<{ Bindings: Env }>();

app.use("/*", cors());

function folderNormalize(val: string): string {
  return val.trim().toLowerCase();
}

interface CategoryRow { wallpaper_id: string; category: string; is_primary: number; }
interface TagRow { wallpaper_id: string; tag: string; confidence: number; }

function toResponse(row: WallpaperRow, base: string, categories: CategoryRow[] = [], tags: TagRow[] = []): WallpaperResponse {
  const rowCategories = categories.filter((item) => item.wallpaper_id === row.id);
  const categoryNames = rowCategories.length ? rowCategories.slice().sort((a, b) => b.is_primary - a.is_primary || a.category.localeCompare(b.category)).map((item) => item.category) : (row.category === "uncategorized" ? [] : [row.category]);
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
    blurhash: row.blurhash ?? null,
    categories: categoryNames,
    primary_category: rowCategories.find((item) => item.is_primary === 1)?.category ?? (row.category === "uncategorized" ? null : row.category),
    tags: tags.filter((item) => item.wallpaper_id === row.id).map((item) => ({ name: item.tag, confidence: item.confidence })),
  };
}

async function relatedData(db: Env["DB"], rows: WallpaperRow[]): Promise<{ categories: CategoryRow[]; tags: TagRow[] }> {
  if (!rows.length) return { categories: [], tags: [] };
  const placeholders = rows.map(() => "?").join(",");
  const ids = rows.map((row) => row.id);
  const [categoryResult, tagResult] = await db.batch([
    db.prepare(`SELECT wallpaper_id, category, is_primary FROM wallpaper_categories WHERE wallpaper_id IN (${placeholders})`).bind(...ids),
    db.prepare(`SELECT wallpaper_id, tag, confidence FROM wallpaper_tags WHERE wallpaper_id IN (${placeholders}) ORDER BY tag`).bind(...ids),
  ]);
  return { categories: (categoryResult?.results ?? []) as unknown as CategoryRow[], tags: (tagResult?.results ?? []) as unknown as TagRow[] };
}

app.get("/api/health", (c) => c.json({ ok: true, timestamp: new Date().toISOString() }));

// List wallpapers — no COUNT(*) scan, uses has_more instead
app.get("/api/wallpapers", async (c) => {
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit")) || 20));
  const offset = (page - 1) * limit;
  const category = c.req.query("category");
  const tag = c.req.query("tag");
  const filters: string[] = ["w.is_active = 1"];
  const binds: string[] = [];
  if (category) { filters.push("(w.category = ? OR EXISTS (SELECT 1 FROM wallpaper_categories wc WHERE wc.wallpaper_id = w.id AND wc.category = ?))"); binds.push(folderNormalize(category), folderNormalize(category)); }
  if (tag) { filters.push("EXISTS (SELECT 1 FROM wallpaper_tags wt WHERE wt.wallpaper_id = w.id AND wt.tag = ?)"); binds.push(folderNormalize(tag)); }
  const where = filters.join(" AND ");

  // Fetch limit+1 rows to determine has_more without COUNT(*)
  const listStmt = c.env.DB.prepare(
    `SELECT w.* FROM wallpapers w WHERE ${where} ORDER BY w.created_at DESC LIMIT ? OFFSET ?`
  ).bind(...binds, limit + 1, offset);

  const listRes = await listStmt.all<WallpaperRow>();
  const allRows = listRes.results ?? [];
  const hasMore = allRows.length > limit;
  const rows = hasMore ? allRows.slice(0, limit) : allRows;

  const related = await relatedData(c.env.DB, rows);
  const data: WallpaperResponse[] = rows.map((r) => toResponse(r, c.env.WORKER_URL, related.categories, related.tags));

  const body: PaginatedResponse<WallpaperResponse> = {
    data,
    meta: { page, limit, has_more: hasMore },
  };

  // 60s CDN cache — bump if wallpapers upload rate drops further
  return c.json(body, 200, { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" });
});

// Single wallpaper
app.get("/api/wallpapers/:id", async (c) => {
  const row = await c.env.DB.prepare(
    "SELECT * FROM wallpapers WHERE id = ? AND is_active = 1"
  ).bind(c.req.param("id")).first<WallpaperRow>();

  if (!row) return c.json({ error: "Wallpaper not found" }, 404);

  const related = await relatedData(c.env.DB, [row]);
  return c.json({ data: toResponse(row, c.env.WORKER_URL, related.categories, related.tags) }, 200, {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
  });
});

// Image proxy — Edge Cached, no public R2 access needed
app.get("/api/images/*", async (c) => {
  const r2Key = c.req.path.replace("/api/images/", "");
  if (!r2Key) return c.json({ error: "Missing image key" }, 400);

  // Build a cache key from the full URL
  const cacheKey = new Request(c.req.url, { method: "GET" });
  const cache = caches.default;

  // Check Edge Cache first
  const cachedResponse = await cache.match(cacheKey);
  if (cachedResponse) {
    return cachedResponse;
  }

  // Cache miss — fetch from R2
  const object = await c.env.BUCKET.get(r2Key);
  if (!object) return c.json({ error: "Image not found" }, 404);

  const headers = new Headers({
    "Content-Type": object.httpMetadata?.contentType ?? "image/jpeg",
    "ETag": object.httpEtag,
    "Cache-Control": "public, max-age=2592000, immutable",
  });

  const response = new Response(object.body as unknown as ReadableStream, { headers });

  // Store in Edge Cache (non-blocking)
  c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));

  return response;
});

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
