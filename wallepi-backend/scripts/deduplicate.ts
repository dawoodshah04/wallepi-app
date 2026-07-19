/**
 * deduplicate.ts — One-time cleanup of duplicate wallpapers in D1 + R2
 *
 * Usage:  npx tsx scripts/deduplicate.ts
 *
 * Keeps the oldest row per filename, deletes the rest + their R2 objects.
 */

import { execSync } from "node:child_process";

const D1_DB = "wallpaper-manifest";
const R2_BUCKET = "wallpapers";

interface DupeRow {
  id: string;
  filename: string;
  r2_key_full: string;
  r2_key_thumb: string;
  created_at: string;
}

function queryD1(sql: string): any[] {
  const raw = execSync(
    `npx wrangler d1 execute ${D1_DB} --remote --json --command="${sql.replace(/"/g, '\\"')}"`,
    { cwd: process.cwd(), timeout: 30_000 }
  ).toString();
  return JSON.parse(raw)[0]?.results ?? [];
}

function deleteR2(key: string): void {
  try {
    execSync(`npx wrangler r2 object delete "${R2_BUCKET}/${key}" --remote`, {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30_000,
    });
  } catch {
    // Object may already be gone — fine
  }
}

async function main() {
  const dupes: { filename: string; cnt: number }[] = queryD1(
    "SELECT filename, COUNT(*) as cnt FROM wallpapers GROUP BY filename HAVING cnt > 1"
  );

  if (dupes.length === 0) {
    console.log("✅ No duplicates found.");
    return;
  }

  console.log(`Found ${dupes.length} filenames with duplicates\n`);
  let deleted = 0;

  for (const { filename } of dupes) {
    const rows: DupeRow[] = queryD1(
      `SELECT id, filename, r2_key_full, r2_key_thumb, created_at FROM wallpapers WHERE filename = '${filename.replace(/'/g, "''")}' ORDER BY created_at ASC`
    );

    const toDelete = rows.slice(1); // keep oldest
    console.log(`"${filename}": keeping 1, removing ${toDelete.length}`);

    for (const row of toDelete) {
      deleteR2(row.r2_key_full);
      deleteR2(row.r2_key_thumb);
      queryD1(`DELETE FROM wallpapers WHERE id = '${row.id}'`);
      deleted++;
    }
  }

  console.log(`\n✅ Removed ${deleted} duplicate rows + R2 objects.`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
