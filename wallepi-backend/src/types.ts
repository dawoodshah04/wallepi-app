import type { D1Database, R2Bucket } from "@cloudflare/workers-types";

// ── Cloudflare Worker Env Bindings ──────────────────────────────────

export interface Env {
  DB: D1Database;
  BUCKET: R2Bucket;
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
  is_active: number;
  created_at: string;
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
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface ErrorResponse {
  error: string;
  status: number;
}
