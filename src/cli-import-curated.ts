import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { upsertChunks } from "./db.js";
import { ContentChunk } from "./types.js";

type CuratedRow = {
  id?: string;
  chunk_type: "transcript_chunk" | "recap_summary" | "recap_quiz_seed";
  text: string;
  subject: string;
  focus_area?: string;
  tags?: string[];
  page_title: string;
  episode: string;
  section_path: string[];
  source_doc_id: string;
  source_page?: number | null;
  source_anchor?: string | null;
};

function makeId(row: CuratedRow): string {
  const raw = `${row.chunk_type}:${row.source_doc_id}:${row.source_anchor ?? ""}:${row.text}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 24);
}

function toChunk(row: CuratedRow): ContentChunk {
  return {
    id: row.id ?? makeId(row),
    chunkType: row.chunk_type,
    text: row.text.trim(),
    subject: row.subject.trim(),
    focusArea: (row.focus_area ?? row.page_title ?? row.subject).trim(),
    tags: Array.isArray(row.tags) ? row.tags.map((v) => String(v).trim()).filter(Boolean) : [],
    pageTitle: row.page_title.trim(),
    episode: row.episode.trim(),
    sectionPath: Array.isArray(row.section_path) ? row.section_path.map((v) => String(v).trim()) : [],
    sourceDocId: row.source_doc_id,
    sourcePage: row.source_page ?? null,
    sourceAnchor: row.source_anchor ?? null
  };
}

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: npm run import:curated -- /absolute/path/curated_chunks.jsonl");
    process.exit(1);
  }
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(absPath, "utf8");
  const rows = raw
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as CuratedRow);
  const chunks = rows.map(toChunk);
  const inserted = await upsertChunks(chunks);
  console.log(`Curated import complete: ${inserted} chunks`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
