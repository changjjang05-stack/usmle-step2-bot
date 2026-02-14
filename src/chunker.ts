import crypto from "node:crypto";
import { ContentChunk, NotionLine } from "./types.js";

const MIN_LINES = 10;
const MAX_LINES = 20;

function chunkId(text: string, pageId: string, anchor: string, type: string): string {
  const base = `${type}:${pageId}:${anchor}:${text}`;
  return crypto.createHash("sha256").update(base).digest("hex").slice(0, 24);
}

function isRecapSection(path: string[]): boolean {
  return path.some((s) => s.toLowerCase().includes("rapid fire recap"));
}

export function buildChunks(lines: NotionLine[]): ContentChunk[] {
  const output: ContentChunk[] = [];
  let buffer: NotionLine[] = [];

  const flush = (type: "transcript_chunk" | "recap_summary") => {
    if (!buffer.length) return;
    const first = buffer[0];
    const text = buffer.map((v) => v.text).join("\n");
    output.push({
      id: chunkId(text, first.pageId, first.sourceAnchor, type),
      chunkType: type,
      text,
      subject: first.subject,
      focusArea: first.sectionPath[first.sectionPath.length - 1] ?? first.pageTitle,
      tags: [],
      pageTitle: first.pageTitle,
      episode: first.episode,
      sectionPath: first.sectionPath,
      sourceDocId: first.pageId,
      sourcePage: null,
      sourceAnchor: first.sourceAnchor
    });
    buffer = [];
  };

  for (const line of lines) {
    const lineType = line.isRecap || isRecapSection(line.sectionPath) ? "recap_summary" : "transcript_chunk";
    if (!buffer.length) {
      buffer.push(line);
      continue;
    }

    const currentType = buffer[0].isRecap || isRecapSection(buffer[0].sectionPath) ? "recap_summary" : "transcript_chunk";
    const crossedType = currentType !== lineType;
    const crossedDoc = buffer[0].pageId !== line.pageId;
    const reachedMax = buffer.length >= MAX_LINES;
    const enoughToFlush = buffer.length >= MIN_LINES;

    if (crossedDoc || (crossedType && enoughToFlush) || reachedMax) {
      flush(currentType);
    }
    buffer.push(line);
  }
  if (buffer.length) {
    const bufferType = buffer[0].isRecap || isRecapSection(buffer[0].sectionPath) ? "recap_summary" : "transcript_chunk";
    flush(bufferType);
  }

  const quizSeeds = output
    .filter((chunk) => chunk.chunkType === "recap_summary")
    .map((chunk) => ({
      ...chunk,
      id: chunkId(chunk.text, chunk.sourceDocId, chunk.sourceAnchor ?? "", "recap_quiz_seed"),
      chunkType: "recap_quiz_seed" as const
    }));

  return [...output, ...quizSeeds];
}
