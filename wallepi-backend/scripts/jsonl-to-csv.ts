/**
 * jsonl-to-csv.ts — Convert labels_output.jsonl into CSV format
 *
 * Usage:
 *   npx tsx scripts/jsonl-to-csv.ts
 *
 * Outputs:
 *   - labels_output.csv   (1 row per image with summarized labels)
 *   - labels_flat.csv     (1 row per label entry for detailed analytics)
 */

import { existsSync, createReadStream, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as readline from "node:readline";

interface LabelItem {
  name: string;
  confidence: number;
}

interface ImageTagRecord {
  key: string;
  image_id: string;
  labels: LabelItem[];
}

function escapeCsvField(field: string | number): string {
  const str = String(field);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

async function main(): Promise<void> {
  const jsonlPath = join(process.cwd(), "labels_output.jsonl");
  const summaryCsvPath = join(process.cwd(), "labels_output.csv");
  const flatCsvPath = join(process.cwd(), "labels_flat.csv");

  if (!existsSync(jsonlPath)) {
    console.error(`❌ File not found: ${jsonlPath}`);
    process.exit(1);
  }

  console.log(`📄 Converting ${jsonlPath} to CSV...`);

  const summaryRows: string[] = [
    ["image_id", "key", "label_count", "top_label", "labels"].map(escapeCsvField).join(",")
  ];

  const flatRows: string[] = [
    ["image_id", "key", "label_name", "confidence"].map(escapeCsvField).join(",")
  ];

  const fileStream = createReadStream(jsonlPath);
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let count = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const record: ImageTagRecord = JSON.parse(trimmed);
      count++;

      const imageId = record.image_id || "";
      const key = record.key || "";
      const labels = record.labels || [];

      // Sort labels by confidence descending
      const sortedLabels = [...labels].sort((a, b) => b.confidence - a.confidence);

      const labelCount = sortedLabels.length;
      const topLabel = sortedLabels[0]?.name || "";
      const formattedLabels = sortedLabels
        .map((l) => `${l.name} (${l.confidence}%)`)
        .join(" | ");

      // Add to summary CSV (1 row per wallpaper)
      summaryRows.push(
        [imageId, key, labelCount, topLabel, formattedLabels]
          .map(escapeCsvField)
          .join(",")
      );

      // Add to flat CSV (1 row per label)
      for (const l of sortedLabels) {
        flatRows.push(
          [imageId, key, l.name, l.confidence]
            .map(escapeCsvField)
            .join(",")
        );
      }
    } catch {
      // Ignore malformed lines
    }
  }

  writeFileSync(summaryCsvPath, summaryRows.join("\n"), "utf-8");
  writeFileSync(flatCsvPath, flatRows.join("\n"), "utf-8");

  console.log(`✅ Successfully converted ${count} JSONL records!`);
  console.log(`📊 Summary CSV: ${summaryCsvPath} (${summaryRows.length - 1} rows)`);
  console.log(`📊 Exploded CSV: ${flatCsvPath} (${flatRows.length - 1} rows)\n`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
