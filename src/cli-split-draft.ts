import fs from "node:fs";
import path from "node:path";

type Row = {
  subject: string;
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "unknown";
}

async function main(): Promise<void> {
  const input = process.argv[2] ?? "/Users/kimhoechang/Documents/codex/data/draft_chunks.jsonl";
  const outDir = process.argv[3] ?? "/Users/kimhoechang/Documents/codex/data/draft_split";
  const absIn = path.resolve(input);
  const absOut = path.resolve(outDir);
  if (!fs.existsSync(absIn)) {
    console.error(`Input not found: ${absIn}`);
    process.exit(1);
  }
  fs.mkdirSync(absOut, { recursive: true });
  const lines = fs.readFileSync(absIn, "utf8").split("\n").map((v) => v.trim()).filter(Boolean);
  const groups = new Map<string, string[]>();
  for (const line of lines) {
    const row = JSON.parse(line) as Row;
    const key = row.subject?.trim() || "Unknown";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(line);
  }

  const summary: Array<{ subject: string; rows: number; file: string }> = [];
  for (const [subject, rows] of groups.entries()) {
    const file = `${slug(subject)}.jsonl`;
    const outPath = path.join(absOut, file);
    fs.writeFileSync(outPath, rows.join("\n"), "utf8");
    summary.push({ subject, rows: rows.length, file: outPath });
  }

  summary.sort((a, b) => b.rows - a.rows);
  const manifestPath = path.join(absOut, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(summary, null, 2), "utf8");
  console.log(`Split complete: ${summary.length} files`);
  for (const item of summary) {
    console.log(`${item.rows}\t${item.subject}\t${item.file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
