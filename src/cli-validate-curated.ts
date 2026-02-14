import fs from "node:fs";
import path from "node:path";

type Row = {
  chunk_type: string;
  text: string;
  subject: string;
  page_title: string;
  episode: string;
  section_path: string[];
  source_doc_id: string;
  source_page?: number | null;
  source_anchor?: string | null;
};

function parseJsonl(filePath: string): Row[] {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  return raw
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((line, i) => {
      try {
        return JSON.parse(line) as Row;
      } catch {
        throw new Error(`Invalid JSON at line ${i + 1} in ${filePath}`);
      }
    });
}

function keyOf(row: Row): string {
  return `${row.source_doc_id}::${row.source_anchor ?? ""}::${row.chunk_type}`;
}

function addCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

async function main(): Promise<void> {
  const draftPath = path.resolve(
    process.argv[2] ?? "/Users/kimhoechang/Documents/codex/data/draft_chunks.jsonl"
  );
  const curatedPath = path.resolve(
    process.argv[3] ?? "/Users/kimhoechang/Documents/codex/data/curated_chunks.jsonl"
  );

  if (!fs.existsSync(draftPath)) {
    throw new Error(`Draft file not found: ${draftPath}`);
  }
  if (!fs.existsSync(curatedPath)) {
    throw new Error(`Curated file not found: ${curatedPath}`);
  }

  const draft = parseJsonl(draftPath);
  const curated = parseJsonl(curatedPath);

  if (draft.length !== curated.length) {
    throw new Error(`Line count mismatch: draft=${draft.length}, curated=${curated.length}`);
  }

  const requiredFields = [
    "chunk_type",
    "text",
    "subject",
    "focus_area",
    "tags",
    "page_title",
    "episode",
    "section_path",
    "source_doc_id"
  ] as const;

  for (let i = 0; i < curated.length; i += 1) {
    const row = curated[i] as any;
    for (const f of requiredFields) {
      if (row[f] === undefined || row[f] === null || row[f] === "") {
        throw new Error(`Missing required field '${f}' at curated line ${i + 1}`);
      }
    }
    if (!Array.isArray(row.section_path)) {
      throw new Error(`section_path must be array at curated line ${i + 1}`);
    }
    if (!Array.isArray(row.tags) || row.tags.length === 0) {
      throw new Error(`tags must be non-empty array at curated line ${i + 1}`);
    }
  }

  const draftMap = new Map<string, number>();
  const curatedMap = new Map<string, number>();
  for (const row of draft) addCount(draftMap, keyOf(row));
  for (const row of curated) addCount(curatedMap, keyOf(row));

  const missingKeys: string[] = [];
  const extraKeys: string[] = [];
  for (const [k, v] of draftMap.entries()) {
    if ((curatedMap.get(k) ?? 0) !== v) missingKeys.push(k);
  }
  for (const [k, v] of curatedMap.entries()) {
    if ((draftMap.get(k) ?? 0) !== v) extraKeys.push(k);
  }
  if (missingKeys.length || extraKeys.length) {
    throw new Error(
      `Key mismatch (missing=${missingKeys.length}, extra=${extraKeys.length}). ` +
        `Ensure source_doc_id/source_anchor/chunk_type are preserved 1:1.`
    );
  }

  let draftChars = 0;
  let curatedChars = 0;
  for (let i = 0; i < draft.length; i += 1) {
    draftChars += String(draft[i].text ?? "").length;
    curatedChars += String(curated[i].text ?? "").length;
  }
  const ratio = draftChars === 0 ? 1 : curatedChars / draftChars;
  // Length ratio is informative only for LLM-driven rewriting.
  // Structural integrity (line count + key preservation + required fields) is the hard gate.

  console.log(
    JSON.stringify(
      {
        ok: true,
        draft_lines: draft.length,
        curated_lines: curated.length,
        text_ratio_percent: Number((ratio * 100).toFixed(2))
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
