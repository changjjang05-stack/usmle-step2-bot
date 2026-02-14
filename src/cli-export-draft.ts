import fs from "node:fs";
import path from "node:path";
import { buildChunks } from "./chunker.js";
import { parseZipFallback } from "./zip-fallback.js";

type DraftChunk = {
  chunk_type: "transcript_chunk" | "recap_summary" | "recap_quiz_seed";
  text: string;
  subject: string;
  focus_area: string;
  tags: string[];
  page_title: string;
  episode: string;
  section_path: string[];
  source_doc_id: string;
  source_page: number | null;
  source_anchor: string | null;
};

async function main(): Promise<void> {
  const zipPath = process.argv[2];
  const outPath = process.argv[3] ?? "/Users/kimhoechang/Documents/codex/data/draft_chunks.jsonl";
  if (!zipPath) {
    console.error("Usage: npm run export:draft -- /absolute/path/export.zip [/absolute/path/output.jsonl]");
    process.exit(1);
  }

  const absZip = path.resolve(zipPath);
  const absOut = path.resolve(outPath);
  if (!fs.existsSync(absZip)) {
    console.error(`ZIP not found: ${absZip}`);
    process.exit(1);
  }

  const zipBase64 = fs.readFileSync(absZip).toString("base64");
  const lines = parseZipFallback(zipBase64);
  const chunks = buildChunks(lines);
  const rows: DraftChunk[] = chunks.map((c) => ({
    chunk_type: c.chunkType,
    text: c.text,
    subject: c.subject,
    focus_area: c.focusArea,
    tags: c.tags,
    page_title: c.pageTitle,
    episode: c.episode,
    section_path: c.sectionPath,
    source_doc_id: c.sourceDocId,
    source_page: c.sourcePage,
    source_anchor: c.sourceAnchor
  }));
  fs.writeFileSync(absOut, rows.map((r) => JSON.stringify(r)).join("\n"), "utf8");
  console.log(`Draft exported: ${absOut} (${rows.length} chunks)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
