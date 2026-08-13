import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = join(import.meta.dirname, "..", "labels_output.jsonl");
const lines = readFileSync(file, "utf-8").split("\n").filter(Boolean);

const FEMALE_LABELS = new Set(["woman", "girl", "female", "lady"]);

let count = 0;
for (const line of lines) {
  const { image_id, labels } = JSON.parse(line);
  const hits = labels.filter((l: any) => FEMALE_LABELS.has(l.name.toLowerCase()));
  if (hits.length) {
    count++;
    const detail = hits.map((l: any) => `${l.name} (${l.confidence})`).join(", ");
    console.log(`  ${image_id}  →  ${detail}`);
  }
}

console.log(`\nTotal images: ${lines.length}`);
console.log(`Images with female labels: ${count}`);
