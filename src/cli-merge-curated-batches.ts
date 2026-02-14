import fs from "node:fs";
import path from "node:path";

type ManifestItem = {
  batch: string;
  expected_output_path: string;
};

function parseLines(filePath: string): string[] {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  return raw.split("\n").map((v) => v.trim()).filter(Boolean);
}

async function main(): Promise<void> {
  const batchDir = path.resolve(process.argv[2] ?? "/Users/kimhoechang/Documents/codex/data/curation_batches");
  const outPath = path.resolve(process.argv[3] ?? "/Users/kimhoechang/Documents/codex/data/curated_chunks.jsonl");
  const manifestPath = path.join(batchDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error(`Manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ManifestItem[];
  if (!Array.isArray(manifest) || manifest.length === 0) throw new Error("Empty manifest");

  const merged: string[] = [];
  for (const item of manifest) {
    const fp = item.expected_output_path;
    if (!fs.existsSync(fp)) throw new Error(`Missing curated batch file: ${fp}`);
    merged.push(...parseLines(fp));
  }
  fs.writeFileSync(outPath, `${merged.join("\n")}\n`, "utf8");
  console.log(`Merged ${manifest.length} batches into ${outPath} (${merged.length} lines)`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
