/** Import the existing Rekognition JSONL output into D1.
 *
 * Usage: npm run import-tags [path/to/labels_output.jsonl]
 * This script only reads the JSONL file and writes D1; it never calls AWS or R2.
 */
import { existsSync, readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { deriveCategories, normalizeLabels, type RekognitionLabel } from "../src/tagging.js";

const DB = "wallpaper-manifest";
const inputFile = process.argv[2] ?? join(process.cwd(), "labels_output.jsonl");

interface RecordShape { image_id?: unknown; key?: unknown; labels?: unknown; }
interface Stats { records: number; imported: number; skipped: number; missing: number; malformed: number; duplicates: number; }

function sql(value: string): string { return `'${value.replace(/'/g, "''")}'`; }
function runD1(args: string[]): string {
  // Wrap each argument in double-quotes so space-containing values (e.g. SQL
  // commands) are not split by the Windows shell into multiple arguments.
  const quoted = args.map((a) => `"${a.replace(/"/g, '\\"')}"`);
  const cmd = `npx wrangler d1 execute "${DB}" --remote ${quoted.join(" ")}`;
  return execSync(cmd, { encoding: "utf8", timeout: 120_000 });
}
function queryIds(): Set<string> {
  const raw = runD1(["--json", "--command", "SELECT id FROM wallpapers"]);
  const parsed = JSON.parse(raw) as Array<{ results?: Array<{ id?: string }> }>;
  return new Set((parsed[0]?.results ?? []).map((row) => row.id).filter((id): id is string => typeof id === "string"));
}
function idFromRecord(record: RecordShape): string | null {
  if (typeof record.image_id === "string" && record.image_id.trim()) return record.image_id.trim();
  if (typeof record.key === "string") return record.key.match(/^wallpapers\/([^/]+)\//)?.[1] ?? null;
  return null;
}

function main(): void {
  if (!existsSync(inputFile)) throw new Error(`JSONL file not found: ${inputFile}`);
  const wallpaperIds = queryIds();
  const stats: Stats = { records: 0, imported: 0, skipped: 0, missing: 0, malformed: 0, duplicates: 0 };
  const seen = new Set<string>();
  const statements: string[] = [];
  const missingIds: string[] = [];
  const lines = readFileSync(inputFile, "utf8").split(/\r?\n/);

  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const line = lines[lineNumber]?.trim() ?? "";
    if (!line) continue;
    stats.records++;
    let record: RecordShape;
    try { record = JSON.parse(line) as RecordShape; } catch { stats.malformed++; console.warn(`Malformed JSONL line ${lineNumber + 1}`); continue; }
    const id = idFromRecord(record);
    if (!id || !Array.isArray(record.labels)) { stats.malformed++; console.warn(`Malformed record at line ${lineNumber + 1}`); continue; }
    if (!wallpaperIds.has(id)) { stats.missing++; missingIds.push(id); continue; }
    if (seen.has(id)) { stats.duplicates++; continue; }
    seen.add(id);
    const labels = record.labels.filter((label): label is RekognitionLabel => {
      if (!label || typeof label !== "object") return false;
      const candidate = label as Partial<RekognitionLabel>;
      return typeof candidate.name === "string" && typeof candidate.confidence === "number";
    });
    const tags = normalizeLabels(labels);
    const { categories, primaryCategory } = deriveCategories(tags);
    statements.push(`DELETE FROM wallpaper_tags WHERE wallpaper_id = ${sql(id)};`);
    statements.push(`DELETE FROM wallpaper_categories WHERE wallpaper_id = ${sql(id)};`);
    for (const tag of tags) statements.push(`INSERT INTO wallpaper_tags (wallpaper_id, tag, original_label, confidence) VALUES (${sql(id)}, ${sql(tag.name)}, ${sql(tag.originalLabel)}, ${tag.confidence});`);
    for (const category of categories) statements.push(`INSERT INTO wallpaper_categories (wallpaper_id, category, is_primary, category_score) VALUES (${sql(id)}, ${sql(category.name)}, ${category.name === primaryCategory ? 1 : 0}, ${category.score});`);
    statements.push(`UPDATE wallpapers SET category = ${sql(primaryCategory ?? "uncategorized")} WHERE id = ${sql(id)};`);
    stats.imported++;
  }

  if (statements.length) {
    // D1 remote does NOT support BEGIN/COMMIT transaction statements via the
    // CLI — it throws CommandLineArgsError. Send raw statements instead.
    // Batch in chunks of 500 to avoid payload-size limits.
    const BATCH = 500;
    const dir = mkdtempSync(join(tmpdir(), "wallepi-tags-"));
    try {
      for (let i = 0; i < statements.length; i += BATCH) {
        const chunk = statements.slice(i, i + BATCH);
        const file = join(dir, `import-${i}.sql`);
        writeFileSync(file, `PRAGMA foreign_keys = ON;\n${chunk.join("\n")}\n`);
        console.log(`Executing batch ${Math.floor(i / BATCH) + 1} (${chunk.length} statements)…`);
        runD1(["--file", file]);
      }
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
  console.log(`Records: ${stats.records}`);
  console.log(`Imported: ${stats.imported}`);
  console.log(`Skipped: ${stats.skipped}`);
  console.log(`Missing wallpapers: ${stats.missing}`);
  console.log(`Malformed: ${stats.malformed}`);
  console.log(`Duplicate records: ${stats.duplicates}`);
  if (missingIds.length) console.log(`Missing IDs: ${[...new Set(missingIds)].join(", ")}`);
}

main();
