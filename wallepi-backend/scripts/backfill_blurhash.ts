/**
 * backfill_blurhash.ts — Generate BlurHash for existing wallpapers that have blurhash IS NULL
 *
 * Usage:
 *   npx tsx scripts/backfill_blurhash.ts
 *
 * What it does:
 *   1. Queries D1 for all wallpapers with blurhash IS NULL
 *   2. Downloads each thumbnail from R2 via the API
 *   3. Generates a BlurHash string from the thumbnail
 *   4. Updates the row in D1 with the blurhash value
 */

import { execSync } from "node:child_process";
import sharp from "sharp";
import { encode } from "blurhash";

const D1_DB = "wallpaper-manifest" as const;
const API_BASE = "https://wallpaper-api.sudo-dawood.workers.dev";

interface WallpaperRow {
  id: string;
  filename: string;
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

function runWrangler(args: string): boolean {
  try {
    execSync(`npx wrangler ${args}`, {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 60_000,
    });
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ wrangler command failed: ${message}`);
    return false;
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

async function main(): Promise<void> {
  console.log("\n🎨 Wallepi — BlurHash Backfill");
  console.log("─".repeat(50));

  // Fetch all wallpapers that don't have a blurhash yet
  const rows = queryD1Json("SELECT id, filename, r2_key_thumb FROM wallpapers WHERE blurhash IS NULL") as WallpaperRow[];

  if (rows.length === 0) {
    console.log("✅ All wallpapers already have BlurHash values. Nothing to do.\n");
    return;
  }

  console.log(`Found ${rows.length} wallpapers without BlurHash\n`);

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    console.log(`[${i + 1}/${rows.length}] ${row.filename}`);

    // Download thumbnail via the API proxy
    const thumbUrl = `${API_BASE}/api/images/${row.r2_key_thumb}`;
    const blurhash = await generateBlurhashFromUrl(thumbUrl);

    if (!blurhash) {
      console.log(`  ⚠️  Failed to generate BlurHash`);
      failed++;
      continue;
    }

    console.log(`  🎨 BlurHash: ${blurhash}`);

    // Update the row in D1
    const sql = `UPDATE wallpapers SET blurhash = '${escapeSQL(blurhash)}' WHERE id = '${escapeSQL(row.id)}';`;
    const success = runWrangler(
      `d1 execute ${D1_DB} --remote --command="${sql.replace(/"/g, '\\"')}"`
    );

    if (success) {
      console.log(`  ✅ Updated`);
      updated++;
    } else {
      console.log(`  ✗ D1 update failed`);
      failed++;
    }
  }

  console.log("\n" + "═".repeat(50));
  console.log("📊 Backfill Summary");
  console.log("═".repeat(50));
  console.log(`  ✅ Updated:  ${updated}`);
  console.log(`  ✗  Failed:   ${failed}`);
  console.log(`  📁 Total:    ${rows.length}`);
  console.log("═".repeat(50) + "\n");
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
