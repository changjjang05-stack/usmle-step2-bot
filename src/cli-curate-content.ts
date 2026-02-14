import fs from "node:fs";
import path from "node:path";

type Row = {
  id?: string;
  chunk_type: "transcript_chunk" | "recap_summary" | "recap_quiz_seed";
  text: string;
  subject: string;
  page_title: string;
  episode: string;
  section_path: string[];
  source_doc_id: string;
  source_page?: number | null;
  source_anchor?: string | null;
};

function normalizeBreaks(lines: string[]): string[] {
  const out: string[] = [];
  let prevBlank = false;
  for (const raw of lines) {
    const line = raw.replace(/\s+$/g, "");
    const blank = line.trim() === "";
    if (blank && prevBlank) continue;
    out.push(line);
    prevBlank = blank;
  }
  return out;
}

function removeMetaLines(lines: string[]): string[] {
  const out: string[] = [];
  let skipQuoteBlock = false;
  for (const line of lines) {
    const t = line.trim();
    const lower = t.toLowerCase();

    if (
      /verification/.test(lower) ||
      /dictation/.test(lower) ||
      /welcome back to the deep dive/.test(lower) ||
      /good luck with the prep/.test(lower)
    ) {
      skipQuoteBlock = true;
      continue;
    }

    if (skipQuoteBlock) {
      if (t.startsWith(">") || t === "" || t === "---") continue;
      skipQuoteBlock = false;
    }

    if (/logic tree/.test(lower) && /^#{1,6}\s/.test(t)) continue;
    if (/mental scaffold/.test(lower)) continue;
    if (/junk drawer/.test(lower)) continue;

    out.push(line);
  }
  return out;
}

function trimRecapTail(lines: string[]): string[] {
  const idx = lines.findIndex((v) => /rapid fire recap/i.test(v));
  if (idx < 0) return lines;
  const kept = lines.slice(idx);
  const out: string[] = [];
  let seenRecapContent = false;
  for (const line of kept) {
    const t = line.trim();
    if (/^[-*]\s/.test(t) || /^\d+\./.test(t)) seenRecapContent = true;
    if (seenRecapContent && /^#\s+/.test(t)) break;
    if (seenRecapContent && /^##\s+/.test(t) && !/rapid fire recap/i.test(t)) break;
    out.push(line);
  }
  return out.length ? out : lines;
}

function cleanText(row: Row): string {
  let lines = row.text.split("\n");
  lines = removeMetaLines(lines);
  if (row.chunk_type === "recap_summary" || row.chunk_type === "recap_quiz_seed") {
    lines = trimRecapTail(lines);
  }
  lines = normalizeBreaks(lines);
  return lines.join("\n").trim();
}

async function main(): Promise<void> {
  const inPath = path.resolve(
    process.argv[2] ?? "/Users/kimhoechang/Documents/codex/data/curated_chunks.jsonl"
  );
  const outPath = path.resolve(
    process.argv[3] ?? "/Users/kimhoechang/Documents/codex/data/curated_chunks.jsonl"
  );
  if (!fs.existsSync(inPath)) throw new Error(`Input not found: ${inPath}`);
  const raw = fs.readFileSync(inPath, "utf8");
  const rows = raw
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Row);

  let changed = 0;
  const cleaned = rows.map((row) => {
    const next = { ...row, text: cleanText(row) };
    if (next.text !== row.text) changed += 1;
    return next;
  });

  fs.writeFileSync(outPath, `${cleaned.map((v) => JSON.stringify(v)).join("\n")}\n`, "utf8");
  console.log(`Curated cleaned: ${outPath}, rows=${cleaned.length}, changed=${changed}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
