import fs from "node:fs";
import path from "node:path";
import { buildChunks } from "./chunker.js";
import { upsertChunks } from "./db.js";
import { parseZipFallback } from "./zip-fallback.js";

async function main(): Promise<void> {
  const zipPath = process.argv[2];
  if (!zipPath) {
    console.error("Usage: npm run import:zip -- /absolute/path/to/notion-export.zip");
    process.exit(1);
  }

  const absPath = path.resolve(zipPath);
  if (!fs.existsSync(absPath)) {
    console.error(`ZIP file not found: ${absPath}`);
    process.exit(1);
  }

  const zipBase64 = fs.readFileSync(absPath).toString("base64");
  const lines = parseZipFallback(zipBase64);
  const chunks = buildChunks(lines);
  const inserted = await upsertChunks(chunks);
  console.log(`Imported lines=${lines.length}, chunks=${inserted}`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
