/**
 * image-tagging.ts — Bulk tag wallpapers in S3 using AWS Rekognition
 *
 * Usage:
 *   npm run tag
 *
 * What it does:
 *   1. Lists all image objects in the S3 bucket (prefix: wallpapers/)
 *   2. Skips images that have already been tagged (reads existing JSONL)
 *   3. Calls Rekognition DetectLabels on each image directly in S3 (no download)
 *   4. Appends results to labels_output.jsonl (one JSON object per line)
 *

 */

import { RekognitionClient, DetectLabelsCommand } from "@aws-sdk/client-rekognition";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { existsSync, readFileSync, appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

// ── Config ──────────────────────────────────────────────────────────

const AWS_REGION = process.env["AWS_REGION"] ?? "us-east-1";
const S3_BUCKET = process.env["AWS_S3_BUCKET"];
const MIN_CONFIDENCE = 80;
const S3_PREFIX = "wallpapers/";
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// Delay between Rekognition calls (ms) to avoid throttling
const THROTTLE_DELAY_MS = 200;

const OUTPUT_FILE = join(process.cwd(), "labels_output.jsonl");


interface LabelResult {
  name: string;
  confidence: number;
}

interface ImageTagRecord {
  key: string;
  image_id: string;
  labels: LabelResult[];
}

// ── AWS Clients ─────────────────────────────────────────────────────

const rekognitionClient = new RekognitionClient({ region: AWS_REGION });
const s3Client = new S3Client({ region: AWS_REGION });

// ── Helpers ─────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract the image UUID from an S3 key like "wallpapers/{uuid}/full.png"
 */
function extractImageId(key: string): string | null {
  const match = key.match(/^wallpapers\/([0-9a-f-]+)\//);
  return match?.[1] ?? null;
}

/**
 * Check if an S3 key points to a full-size image (not a thumbnail)
 */
function isFullImage(key: string): boolean {
  const lower = key.toLowerCase();
  // Only process full images, skip thumbnails
  if (lower.includes("/thumb")) return false;
  // Check for supported image extensions
  const ext = "." + lower.split(".").pop();
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Load already-tagged image keys from the existing JSONL file.
 * Returns a Set of S3 keys that have already been processed.
 */
function loadExistingTags(): Set<string> {
  const tagged = new Set<string>();

  if (!existsSync(OUTPUT_FILE)) {
    return tagged;
  }

  const content = readFileSync(OUTPUT_FILE, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const record: ImageTagRecord = JSON.parse(trimmed);
      tagged.add(record.key);
    } catch {
      // Skip malformed lines
    }
  }

  return tagged;
}

/**
 * List all image objects in the S3 bucket under the given prefix.
 * Handles pagination automatically.
 */
async function listAllImages(): Promise<string[]> {
  const keys: string[] = [];
  let continuationToken: string | undefined;

  do {
    const command = new ListObjectsV2Command({
      Bucket: S3_BUCKET,
      Prefix: S3_PREFIX,
      ContinuationToken: continuationToken,
    });

    const response = await s3Client.send(command);

    if (response.Contents) {
      for (const obj of response.Contents) {
        if (obj.Key && isFullImage(obj.Key)) {
          keys.push(obj.Key);
        }
      }
    }

    continuationToken = response.IsTruncated
      ? response.NextContinuationToken
      : undefined;
  } while (continuationToken);

  return keys;
}

/**
 * Call Rekognition DetectLabels on an image in S3 (no download needed).
 * Returns an array of label results.
 */
async function tagImage(s3Key: string): Promise<LabelResult[]> {
  const command = new DetectLabelsCommand({
    Image: {
      S3Object: {
        Bucket: S3_BUCKET,
        Name: s3Key,
      },
    },
    MinConfidence: MIN_CONFIDENCE,
  });

  const response = await rekognitionClient.send(command);

  if (!response.Labels) {
    return [];
  }

  return response.Labels
    .filter((label) => label.Name && label.Confidence !== undefined)
    .map((label) => ({
      name: label.Name!,
      confidence: Math.round(label.Confidence! * 100) / 100,
    }));
}

/**
 * Append a single JSONL record to the output file.
 */
function appendResult(record: ImageTagRecord): void {
  appendFileSync(OUTPUT_FILE, JSON.stringify(record) + "\n", "utf-8");
}

function printSummary(stats: {
  total: number;
  tagged: number;
  skipped: number;
  errors: number;
}): void {
  console.log("\n" + "═".repeat(50));
  console.log("📊 Tagging Summary");
  console.log("═".repeat(50));
  console.log(`  🏷️  Tagged:           ${stats.tagged}`);
  console.log(`  ⏭️  Skipped (exists): ${stats.skipped}`);
  console.log(`  ✗  Errors:           ${stats.errors}`);
  console.log(`  📁 Total images:     ${stats.total}`);
  console.log("═".repeat(50) + "\n");
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Validate env
  if (!S3_BUCKET) {
    console.error("❌ AWS_S3_BUCKET is not set in .env.local");
    process.exit(1);
  }

  console.log("\n🏷️  Wallepi — Image Tagger (AWS Rekognition)");
  console.log("─".repeat(50));
  console.log(`📦 S3 Bucket:       ${S3_BUCKET}`);
  console.log(`🌎 Region:          ${AWS_REGION}`);
  console.log(`🎯 Min Confidence:  ${MIN_CONFIDENCE}%`);
  console.log(`📄 Output:          ${OUTPUT_FILE}\n`);

  // 1. Load already-tagged images for resume support
  const alreadyTagged = loadExistingTags();
  if (alreadyTagged.size > 0) {
    console.log(`📋 Found ${alreadyTagged.size} already-tagged images (will skip)\n`);
  }

  // 2. List all images in S3
  console.log("🔍 Listing images in S3 bucket...");
  const allKeys = await listAllImages();
  console.log(`   Found ${allKeys.length} full-size images\n`);

  if (allKeys.length === 0) {
    console.log("⚠️  No images found in the bucket. Nothing to do.");
    return;
  }

  // 3. Filter out already-tagged images
  const keysToTag = allKeys.filter((key) => !alreadyTagged.has(key));
  console.log(`🏷️  Images to tag: ${keysToTag.length} (${allKeys.length - keysToTag.length} already done)\n`);

  if (keysToTag.length === 0) {
    console.log("✅ All images are already tagged. Nothing to do.");
    printSummary({
      total: allKeys.length,
      tagged: 0,
      skipped: allKeys.length,
      errors: 0,
    });
    return;
  }

  // 4. Tag each image
  const stats = {
    total: allKeys.length,
    tagged: 0,
    skipped: alreadyTagged.size,
    errors: 0,
  };

  for (let i = 0; i < keysToTag.length; i++) {
    const key = keysToTag[i]!;
    const imageId = extractImageId(key);
    const progress = `[${i + 1}/${keysToTag.length}]`;

    if (!imageId) {
      console.log(`${progress} ⏭️  Skipping (no valid UUID): ${key}`);
      stats.errors++;
      continue;
    }

    console.log(`${progress} ${key}`);

    try {
      const labels = await tagImage(key);

      const record: ImageTagRecord = {
        key,
        image_id: imageId,
        labels,
      };

      appendResult(record);
      stats.tagged++;

      const labelSummary = labels
        .slice(0, 3)
        .map((l) => l.name)
        .join(", ");
      console.log(`       ✅ ${labels.length} labels: ${labelSummary}${labels.length > 3 ? "..." : ""}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`       ✗  Error: ${message}`);
      stats.errors++;
    }

    // Throttle to avoid Rekognition rate limits
    if (i < keysToTag.length - 1) {
      await sleep(THROTTLE_DELAY_MS);
    }
  }

  // 5. Print summary
  printSummary(stats);
}

main().catch((err: unknown) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
