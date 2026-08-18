/**
 * backfill_blurhash.ts — Fast, batched BlurHash generation for wallpapers
 *
 * Usage:
 *   npx tsx scripts/backfill_blurhash.ts
 */

import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { encode } from "blurhash";

const D1_DB = "wallpaper-manifest" as const;
const API_BASE = "https://wallpaper-api.sudo-dawood.workers.dev";
const BATCH_SIZE = 50;
const CONCURRENCY = 5;

interface WallpaperRow {
  id: string;
  filename: string;
  r2_key_full: string;
  r2_key_thumb: string;
}

function queryD1Json(sql: string): any[] {
  try {
    const raw = execSync(
      `npx wrangler d1 execute ${D1_DB} --remote --json --command="${sql.replace(/"/g, '\\"')}"`,
      { cwd: process.cwd(), timeout: 30_000 }
    ).toString();
    return JSON.parse(raw)[0]?.results ?? [];
  } catch {
    return [];
  }
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

function executeSqlBatch(statements: string[]): boolean {
  if (statements.length === 0) return true;
  const tempFile = join(process.cwd(), `.batch-${Date.now()}.sql`);
  try {
    writeFileSync(tempFile, statements.join("\n"), "utf-8");
    execSync(`npx wrangler d1 execute ${D1_DB} --remote --file="${tempFile}"`, {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 60_000,
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ Batch update failed: ${message}`);
    return false;
  } finally {
    try {
      unlinkSync(tempFile);
    } catch {}
  }
}

async function generateBlurhashFromUrl(imageUrl: string): Promise<string | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const { data, info } = await sharp(buffer)
      .resize(32)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    return encode(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      4,
      3
    );
  } catch {
    return null;
  }
}

async function processRow(row: WallpaperRow): Promise<{ id: string; blurhash: string | null; filename: string }> {
  // Try thumbnail first, fallback to full image if thumbnail is 404/missing
  let blurhash = await generateBlurhashFromUrl(`${API_BASE}/api/images/${row.r2_key_thumb}`);
  if (!blurhash && row.r2_key_full) {
    blurhash = await generateBlurhashFromUrl(`${API_BASE}/api/images/${row.r2_key_full}`);
  }
  return { id: row.id, blurhash, filename: row.filename };
}

async function main(): Promise<void> {
  console.log("\n🎨 Wallepi — BlurHash Backfill (Fast Batched)");
  console.log("─".repeat(50));

  const rows = queryD1Json(
    "SELECT id, filename, r2_key_full, r2_key_thumb FROM wallpapers WHERE blurhash IS NULL"
  ) as WallpaperRow[];

  if (rows.length === 0) {
    console.log("✅ All wallpapers already have BlurHash values.\n");
    return;
  }

  console.log(`Found ${rows.length} wallpapers without BlurHash\n`);

  let updated = 0;
  let missing = 0;
  const pendingUpdates: string[] = [];

  // Process in chunks with concurrency
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(chunk.map(processRow));

    for (const res of results) {
      if (res.blurhash) {
        console.log(`  ✅ [${res.id.slice(0, 8)}] ${res.filename} -> ${res.blurhash}`);
        pendingUpdates.push(
          `UPDATE wallpapers SET blurhash = '${escapeSQL(res.blurhash)}' WHERE id = '${escapeSQL(res.id)}';`
        );
        updated++;
      } else {
        console.log(`  ⚠️  [${res.id.slice(0, 8)}] ${res.filename} (missing in R2 / 404)`);
        missing++;
      }
    }

    // Flush batch to D1 if size threshold reached
    if (pendingUpdates.length >= BATCH_SIZE) {
      console.log(`\n💾 Flushing batch of ${pendingUpdates.length} updates to D1...`);
      executeSqlBatch(pendingUpdates);
      pendingUpdates.length = 0;
    }
  }

  // Flush remaining updates
  if (pendingUpdates.length > 0) {
    console.log(`\n💾 Flushing final batch of ${pendingUpdates.length} updates to D1...`);
    executeSqlBatch(pendingUpdates);
  }

  console.log("\n" + "═".repeat(50));
  console.log("📊 Backfill Summary");
  console.log("═".repeat(50));
  console.log(`  ✅ Updated:      ${updated}`);
  console.log(`  ⚠️  Missing in R2: ${missing}`);
  console.log(`  📁 Total:        ${rows.length}`);
  console.log("═".repeat(50) + "\n");
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
