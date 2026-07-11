import { Hono } from "hono";
import { cors } from "hono/cors";
import type {
  Env,
  WallpaperRow,
  WallpaperResponse,
  PaginatedResponse,
} from "./types.js";

// ── App Setup ───────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

// Enable CORS so the Expo app can call from any origin
app.use("/*", cors());

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Converts a D1 row into an API response, building image URLs
 * that point to our own worker's image proxy route.
 */
function toResponse(row: WallpaperRow, baseUrl: string): WallpaperResponse {
  return {
    id: row.id,
    filename: row.filename,
    url_full: `${baseUrl}/api/images/${row.r2_key_full}`,
    url_thumb: `${baseUrl}/api/images/${row.r2_key_thumb}`,
    width: row.width,
    height: row.height,
    file_size: row.file_size,
    mime_type: row.mime_type,
    created_at: row.created_at,
  };
}

function getBaseUrl(c: { req: { url: string } }): string {
  const url = new URL(c.req.url);
  return `${url.protocol}//${url.host}`;
}

// ── Routes ──────────────────────────────────────────────────────────

// Health check
app.get("/api/health", (c) => {
  return c.json({ ok: true, timestamp: new Date().toISOString() });
});

// List wallpapers (paginated)
app.get("/api/wallpapers", async (c) => {
  const page = Math.max(1, Number(c.req.query("page")) || 1);
  const limit = Math.min(50, Math.max(1, Number(c.req.query("limit")) || 20));
  const offset = (page - 1) * limit;
  const baseUrl = getBaseUrl(c);

  // Get total count
  const countResult = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM wallpapers WHERE is_active = 1"
  ).first<{ count: number }>();

  const total = countResult?.count ?? 0;

  // Get paginated rows
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM wallpapers WHERE is_active = 1 ORDER BY created_at DESC LIMIT ? OFFSET ?"
  )
    .bind(limit, offset)
    .all<WallpaperRow>();

  const data: WallpaperResponse[] = (results ?? []).map((row) =>
    toResponse(row, baseUrl)
  );

  const response: PaginatedResponse<WallpaperResponse> = {
    data,
    meta: {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    },
  };

  return c.json(response);
});

// Get single wallpaper by ID
app.get("/api/wallpapers/:id", async (c) => {
  const id = c.req.param("id");
  const baseUrl = getBaseUrl(c);

  const row = await c.env.DB.prepare(
    "SELECT * FROM wallpapers WHERE id = ? AND is_active = 1"
  )
    .bind(id)
    .first<WallpaperRow>();

  if (!row) {
    return c.json({ error: "Wallpaper not found", status: 404 }, 404);
  }

  return c.json({ data: toResponse(row, baseUrl) });
});

// ── Image Proxy (serves images from R2) ─────────────────────────────
// This means R2 doesn't need public access enabled.
// URL pattern: /api/images/wallpapers/{id}/full.jpg
//              /api/images/wallpapers/{id}/thumb.webp

app.get("/api/images/*", async (c) => {
  const r2Key = c.req.path.replace("/api/images/", "");

  if (!r2Key) {
    return c.json({ error: "Missing image key", status: 400 }, 400);
  }

  const object = await c.env.BUCKET.get(r2Key);

  if (!object) {
    return c.json({ error: "Image not found", status: 404 }, 404);
  }

  // Build response headers using R2's built-in metadata
  const headers = new Headers() as unknown as import("@cloudflare/workers-types").Headers;
  object.writeHttpMetadata(headers);
  (headers as unknown as Headers).set("etag", object.httpEtag);
  (headers as unknown as Headers).set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body as unknown as ReadableStream, {
    headers: headers as unknown as Headers,
  });
});

// ── 404 fallback ────────────────────────────────────────────────────

app.notFound((c) => {
  return c.json({ error: "Not found", status: 404 }, 404);
});

// ── Export ───────────────────────────────────────────────────────────

export default app;
