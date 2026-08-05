import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

// ── Cloudflare Worker Env Bindings ──────────────────────────────────

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
  WORKER_URL: string;
}


// ── Database Row (what D1 returns) ──────────────────────────────────

export interface WallpaperRow {
  id: string;
  filename: string;
  r2_key_full: string;
  r2_key_thumb: string;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
  category: string;
  is_active: number;
  created_at: string;
  blurhash: string | null;
}

// ── API Response Types ──────────────────────────────────────────────

export interface WallpaperResponse {
  id: string;
  filename: string;
  url_full: string;
  url_thumb: string;
  width: number;
  height: number;
  file_size: number;
  mime_type: string;
  created_at: string;
  blurhash: string | null;
  categories: string[];
  primary_category: string | null;
  tags: Array<{ name: string; confidence: number }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    has_more: boolean;
  };
}

export interface ErrorResponse {
  error: string;
  status: number;
}
