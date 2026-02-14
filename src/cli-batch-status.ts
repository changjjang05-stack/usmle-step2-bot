import fs from "node:fs";
import path from "node:path";

type ManifestItem = {
  batch: string;
  expected_output_path: string;
  input_path: string;
  input_lines: number;
};

async function main(): Promise<void> {
  const batchDir = path.resolve(process.argv[2] ?? "/Users/kimhoechang/Documents/codex/data/curation_batches");
  const manifestPath = path.join(batchDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error(`Manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ManifestItem[];
  let done = 0;
  for (const item of manifest) {
    const ok = fs.existsSync(item.expected_output_path);
    if (ok) done += 1;
    console.log(`${ok ? "DONE" : "TODO"}\t${item.batch}\tlines=${item.input_lines}\t${item.expected_output_path}`);
  }
  console.log(`\nprogress: ${done}/${manifest.length} batches`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
