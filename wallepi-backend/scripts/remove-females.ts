/**
 * remove-females.ts — Removes all wallpapers with female labels from D1, R2, and JSONL files.
 * Fast batched execution.
 */

import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";

const D1_DB = "wallpaper-manifest";
const R2_BUCKET = "wallpapers";
const JSONL_FILE = join(import.meta.dirname, "..", "labels_output.jsonl");

const FEMALE_TERMS = new Set([
  "woman", "women", "girl", "girls", "female", "females",
  "lady", "ladies", "bride", "actress", "mother", "daughter"
]);

function runD1File(filePath: string): void {
  try {
    execSync(
      `npx wrangler d1 execute "${D1_DB}" --remote --file="${filePath}"`,
      { cwd: join(import.meta.dirname, ".."), timeout: 60_000, stdio: "inherit" }
    );
  } catch (err: any) {
    console.error("D1 File Execution Error:", err?.message || err);
  }
}

function deleteR2(key: string): void {
  if (!key) return;
  try {
    execSync(`npx wrangler r2 object delete "${R2_BUCKET}/${key}" --remote`, {
      cwd: join(import.meta.dirname, ".."),
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10_000,
    });
  } catch {
    // Ignore if missing
  }
}

async function main() {
  console.log("🔍 Finding wallpapers with female labels...");
  const targetIds = new Set<string>();

  // 1. Scan JSONL
  if (existsSync(JSONL_FILE)) {
    const lines = readFileSync(JSONL_FILE, "utf-8").split("\n").filter(Boolean);
    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        const id = data.image_id || (typeof data.key === "string" ? data.key.match(/^wallpapers\/([^/]+)\//)?.[1] : null);
        if (!id || !Array.isArray(data.labels)) continue;
        const matches = data.labels.filter((l: any) =>
          l && l.name && FEMALE_TERMS.has(l.name.toLowerCase().trim())
        );
        if (matches.length > 0) {
          targetIds.add(id);
        }
      } catch {
        // ignore
      }
    }
  }

  const idsArray = Array.from(targetIds);
  console.log(`Found ${idsArray.length} wallpapers with female labels.`);

  if (idsArray.length === 0) {
    console.log("✅ No female wallpapers found.");
    return;
  }

  console.log("\nWallpaper IDs to remove:", idsArray);

  // 2. Generate batch SQL file
  const formattedIds = idsArray.map(id => `'${id.replace(/'/g, "''")}'`).join(", ");
  const sqlContent = [
    `PRAGMA foreign_keys = ON;`,
    `DELETE FROM wallpaper_tags WHERE wallpaper_id IN (${formattedIds});`,
    `DELETE FROM wallpaper_categories WHERE wallpaper_id IN (${formattedIds});`,
    `DELETE FROM wallpapers WHERE id IN (${formattedIds});`
  ].join("\n");

  const tempDir = mkdtempSync(join(tmpdir(), "wallepi-remove-"));
  const tempSqlFile = join(tempDir, "remove.sql");
  writeFileSync(tempSqlFile, sqlContent);

  console.log("\n⚡ Deleting from D1 database in 1 batch query...");
  runD1File(tempSqlFile);
  rmSync(tempDir, { recursive: true, force: true });

  // 3. Delete from R2 asynchronously/parallel
  console.log("\n🗑️ Cleaning R2 storage...");
  for (const id of idsArray) {
    deleteR2(`wallpapers/${id}/full.jpg`);
    deleteR2(`wallpapers/${id}/thumb.jpg`);
    deleteR2(`wallpapers/${id}/full.webp`);
    deleteR2(`wallpapers/${id}/thumb.webp`);
  }

  // 4. Clean JSONL file
  if (existsSync(JSONL_FILE)) {
    console.log("\n📝 Updating local labels_output.jsonl...");
    const lines = readFileSync(JSONL_FILE, "utf-8").split("\n");
    const newLines = lines.filter(line => {
      if (!line.trim()) return false;
      try {
        const data = JSON.parse(line);
        const id = data.image_id || (typeof data.key === "string" ? data.key.match(/^wallpapers\/([^/]+)\//)?.[1] : null);
        return !id || !targetIds.has(id);
      } catch {
        return true;
      }
    });
    writeFileSync(JSONL_FILE, newLines.join("\n"));
    console.log(`Updated JSONL file. Kept ${newLines.length} records.`);
  }

  console.log("\n✨ Removal complete!");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
