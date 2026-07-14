// scripts/categorize.ts
// Run this local script to tag wallpapers already in D1 based on local subfolder names:
// 1. Sort your local files into subfolders (e.g. "anime", "nature", "dark")
// 2. Run: npx tsx scripts/categorize.ts "C:\path\to\sorted\wallpapers"

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { execSync } from "node:child_process";

async function main() {
  const baseDir = process.argv[2];
  if (!baseDir) process.exit(1);

  const folders = (await readdir(baseDir, { withFileTypes: true }))
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const folder of folders) {
    const files = await readdir(join(baseDir, folder));
    const imageFiles = files.filter(f => /\.(jpe?g|png|webp)$/i.test(f));
    
    // Chunk updates into groups of 50 to avoid CLI limits
    for (let i = 0; i < imageFiles.length; i += 50) {
      const chunk = imageFiles.slice(i, i + 50);
      const sqlList = chunk.map(f => `'${f.replace(/'/g, "''")}'`).join(",");
      const query = `UPDATE wallpapers SET category = '${folder.toLowerCase()}' WHERE filename IN (${sqlList});`;
      
      execSync(`npx wrangler d1 execute wallpaper-manifest --remote --command="${query.replace(/"/g, '\\"')}"`, {
        stdio: "inherit"
      });
    }
  }
}
main();
