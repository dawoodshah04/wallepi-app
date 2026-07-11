/**
 * upload.ts — Bulk upload local wallpapers to Cloudflare R2 + D1
 *
 * Usage:
 *   npm run upload -- "C:\path\to\wallpapers"
 *
 * What it does:
 *   1. Scans the folder for image files (jpg, jpeg, png, webp)
 *   2. Reads dimensions with sharp — SKIPS landscape/desktop images (width >= height)
 *   3. Generates a 400px-wide webp thumbnail
 *   4. Uploads full image + thumbnail to R2 via `npx wrangler r2 object put`
 *   5. Inserts metadata row into D1 via `npx wrangler d1 execute`
 *   6. Prints a summary at the end
 *
 * Requirements:
 *   - wrangler must be authenticated (`npx wrangler login`)
 *   - R2 bucket "wallpapers" must exist
 *   - D1 database "wallpaper-manifest" must exist with schema.sql applied
 *   - sharp must be installed
 */

import { readdir, stat, mkdir, rm } from "node:fs/promises";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import sharp from "sharp";

// ── Config ──────────────────────────────────────────────────────────

const R2_BUCKET = "wallpapers" as const;
const D1_DB = "wallpaper-manifest" as const;
const THUMB_WIDTH = 400;

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const MIME_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

// ── Types ───────────────────────────────────────────────────────────

interface UploadStats {
  uploaded: number;
  skippedLandscape: number;
  skippedError: number;
  total: number;
}

interface ImageInfo {
  width: number;
  height: number;
  fileSize: number;
}

// ── Helpers ─────────────────────────────────────────────────────────

function getMimeType(ext: string): string {
  return MIME_TYPES[ext.toLowerCase()] ?? "image/jpeg";
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

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

async function getImageInfo(filePath: string): Promise<ImageInfo | null> {
  try {
    const metadata = await sharp(filePath).metadata();
    const fileStat = await stat(filePath);

    if (!metadata.width || !metadata.height) {
      return null;
    }

    return {
      width: metadata.width,
      height: metadata.height,
      fileSize: fileStat.size,
    };
  } catch {
    return null;
  }
}

async function generateThumbnail(
  inputPath: string,
  outputPath: string
): Promise<void> {
  await sharp(inputPath)
    .resize(THUMB_WIDTH)
    .webp({ quality: 80 })
    .toFile(outputPath);
}

function uploadToR2(key: string, filePath: string, contentType: string): boolean {
  return runWrangler(
    `r2 object put "${R2_BUCKET}/${key}" --file="${filePath}" --content-type="${contentType}" --remote`
  );
}

function insertIntoD1(
  id: string,
  filename: string,
  r2KeyFull: string,
  r2KeyThumb: string,
  info: ImageInfo,
  mimeType: string
): boolean {
  const sql = `INSERT INTO wallpapers (id, filename, r2_key_full, r2_key_thumb, width, height, file_size, mime_type) VALUES ('${escapeSQL(id)}', '${escapeSQL(filename)}', '${escapeSQL(r2KeyFull)}', '${escapeSQL(r2KeyThumb)}', ${info.width}, ${info.height}, ${info.fileSize}, '${escapeSQL(mimeType)}');`;

  return runWrangler(
    `d1 execute ${D1_DB} --remote --command="${sql.replace(/"/g, '\\"')}"`
  );
}

function printSummary(stats: UploadStats): void {
  console.log("\n" + "═".repeat(50));
  console.log("📊 Upload Summary");
  console.log("═".repeat(50));
  console.log(`  ✅ Uploaded:          ${stats.uploaded}`);
  console.log(`  ⏭️  Skipped (desktop): ${stats.skippedLandscape}`);
  console.log(`  ✗  Skipped (errors):  ${stats.skippedError}`);
  console.log(`  📁 Total scanned:     ${stats.total}`);
  console.log("═".repeat(50) + "\n");
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const inputDir: string | undefined = process.argv[2];

  if (!inputDir) {
    console.error(
      'Usage: npm run upload -- "C:\\path\\to\\wallpapers-folder"'
    );
    process.exit(1);
  }

  console.log("\n🖼️  Wallepi — Bulk Uploader");
  console.log("─".repeat(50));
  console.log(`📂 Source folder: ${inputDir}`);
  console.log(`📦 R2 bucket:     ${R2_BUCKET}`);
  console.log(`🗄️  D1 database:   ${D1_DB}\n`);

  // Create a temp directory for thumbnails
  const tmpDir: string = join(process.cwd(), ".tmp-thumbs");
  await mkdir(tmpDir, { recursive: true });

  // Scan for image files
  const files: string[] = await readdir(inputDir);
  const imageFiles: string[] = files.filter((f) =>
    SUPPORTED_EXTENSIONS.has(extname(f).toLowerCase())
  );

  console.log(`Found ${imageFiles.length} image files\n`);

  const stats: UploadStats = {
    uploaded: 0,
    skippedLandscape: 0,
    skippedError: 0,
    total: imageFiles.length,
  };

  for (let i = 0; i < imageFiles.length; i++) {
    const filename: string = imageFiles[i]!;
    const filePath: string = join(inputDir, filename);
    const ext: string = extname(filename).toLowerCase();

    console.log(`[${i + 1}/${imageFiles.length}] ${filename}`);

    // 1. Read image dimensions and file size
    const info: ImageInfo | null = await getImageInfo(filePath);

    if (!info) {
      console.log(`  ⏭️  Skipped — could not read image metadata`);
      stats.skippedError++;
      continue;
    }

    // 2. Skip landscape / desktop images (width >= height) or squarish portrait ones (ratio > 0.65)
    const ratio = info.width / info.height;
    if (info.width >= info.height || ratio > 0.65) {
      console.log(
        `  ⏭️  Skipped — landscape/desktop/squarish (${info.width}×${info.height}, ratio: ${ratio.toFixed(2)})`
      );
      stats.skippedLandscape++;
      continue;
    }

    console.log(`  📐 ${info.width}×${info.height} (portrait ✓)`);

    // 3. Generate unique ID and R2 keys
    const id: string = randomUUID();
    const r2KeyFull: string = `wallpapers/${id}/full${ext}`;
    const r2KeyThumb: string = `wallpapers/${id}/thumb.webp`;
    const mimeType: string = getMimeType(ext);

    // 4. Generate thumbnail
    const thumbPath: string = join(tmpDir, `${id}-thumb.webp`);

    try {
      await generateThumbnail(filePath, thumbPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`  ✗ Thumbnail failed: ${message}`);
      stats.skippedError++;
      continue;
    }

    // 5. Upload full image to R2
    console.log(`  ☁️  Uploading full image...`);
    if (!uploadToR2(r2KeyFull, filePath, mimeType)) {
      stats.skippedError++;
      continue;
    }

    // 6. Upload thumbnail to R2
    console.log(`  ☁️  Uploading thumbnail...`);
    if (!uploadToR2(r2KeyThumb, thumbPath, "image/webp")) {
      stats.skippedError++;
      continue;
    }

    // 7. Insert metadata into D1
    console.log(`  🗄️  Inserting into D1...`);
    if (!insertIntoD1(id, filename, r2KeyFull, r2KeyThumb, info, mimeType)) {
      stats.skippedError++;
      continue;
    }

    console.log(`  ✅ Done (ID: ${id})\n`);
    stats.uploaded++;
  }

  // Cleanup temp directory
  await rm(tmpDir, { recursive: true, force: true });

  // Print summary
  printSummary(stats);
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
