import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

type Row = {
  chunk_type: string;
  text: string;
  subject: string;
  focus_area?: string;
  tags?: string[];
  source_doc_id: string;
  source_anchor?: string | null;
};

type ManualReviewMarker = {
  batch: string;
  line_count: number;
  lines_reviewed: number[];
  review_mode: string;
  reviewed_at: string;
  started_at?: string;
  finished_at?: string;
  input_sha256?: string;
  output_sha256?: string;
  notes_sha256?: string;
};

type ReviewNote = {
  line_no: number;
  decision: string;
  rationale: string;
  input_sha256: string;
  output_sha256: string;
};

function readLines(filePath: string): string[] {
  const raw = fs.readFileSync(filePath, "utf8");
  if (!raw.trim()) return [];
  return raw.trimEnd().split("\n");
}

function sha256(text: string): string {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

function safeParseDate(v?: string): number | null {
  if (!v) return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

function parse(filePath: string): Row[] {
  const raw = fs.readFileSync(filePath, "utf8").trim();
  if (!raw) return [];
  return raw.split("\n").map((v) => JSON.parse(v) as Row);
}

function keyOf(r: Row): string {
  return `${r.source_doc_id}::${r.source_anchor ?? ""}::${r.chunk_type}`;
}

function hasTable(text: string): boolean {
  return /\|\s*---\s*\|/.test(text);
}

function hasImageMdLine(text: string): boolean {
  return text.split("\n").some((v) => /^!\[[^\]]*\]\([^)]+\)\s*$/i.test(v.trim()));
}

function hasForbiddenNarration(text: string): boolean {
  return /welcome back to the deep dive|dictation|verification|confidence score/i.test(text);
}

function isContiguousOneToN(values: number[], n: number): boolean {
  if (values.length !== n) return false;
  for (let i = 0; i < n; i += 1) {
    if (values[i] !== i + 1) return false;
  }
  return true;
}

async function main(): Promise<void> {
  const batchDir = path.resolve(process.argv[2] ?? "/Users/kimhoechang/Documents/codex/data/llm_micro_batches");
  const batchId = process.argv[3];
  if (!batchId) throw new Error("Usage: npm run qc:batch -- <batch_dir> <batch_XX>");
  const inputPath = path.join(batchDir, `${batchId}.input.jsonl`);
  const outputPath = path.join(batchDir, `${batchId}.curated.jsonl`);
  if (!fs.existsSync(inputPath)) throw new Error(`Missing input: ${inputPath}`);
  if (!fs.existsSync(outputPath)) throw new Error(`Missing output: ${outputPath}`);

  const inputRaw = fs.readFileSync(inputPath, "utf8");
  const outputRaw = fs.readFileSync(outputPath, "utf8");
  const inputLinesRaw = readLines(inputPath);
  const outputLinesRaw = readLines(outputPath);

  const input = parse(inputPath);
  const output = parse(outputPath);

  const checks: Record<string, boolean> = {};
  checks.line_count_match = input.length === output.length;

  const inKeys = input.map(keyOf).sort();
  const outKeys = output.map(keyOf).sort();
  checks.key_identity_preserved = JSON.stringify(inKeys) === JSON.stringify(outKeys);

  checks.required_fields_present = output.every(
    (r) =>
      Boolean(r.text?.trim()) &&
      Boolean(r.focus_area?.trim()) &&
      Array.isArray(r.tags)
  );
  checks.nonempty_text = output.every((r) => Boolean(r.text?.trim()));
  checks.tags_min2 = output.every((r) => Array.isArray(r.tags) && r.tags.length >= 2);
  checks.forbidden_narration_removed = output.every((r) => !hasForbiddenNarration(r.text ?? ""));
  checks.image_markdown_removed = output.every((r) => !hasImageMdLine(r.text ?? ""));

  const tablePairs = input.map((r, i) => [r, output[i]] as const).filter(([r]) => hasTable(r.text ?? ""));
  checks.table_structure_preserved = tablePairs.every(([, out]) => hasTable(out.text ?? ""));
  const reviewedMarker = path.join(batchDir, "reviewed_markers", `${batchId}.reviewed`);
  checks.llm_manual_reviewed = fs.existsSync(reviewedMarker);
  const lineByLineMarkerPath = path.join(batchDir, "reviewed_markers", `${batchId}.line_review.json`);
  const reviewNotesPath = path.join(batchDir, "review_notes", `${batchId}.notes.jsonl`);
  let lineByLineOk = false;
  let reviewNotesPresent = false;
  let reviewNotesLineComplete = false;
  let reviewPerLineHashesMatch = false;
  let reviewBundleHashesMatch = false;
  let reviewTimingPlausible = false;
  let reviewTimestampNotDefault = false;
  if (fs.existsSync(lineByLineMarkerPath)) {
    try {
      const marker = JSON.parse(fs.readFileSync(lineByLineMarkerPath, "utf8")) as ManualReviewMarker;
      const sorted = [...(marker.lines_reviewed ?? [])].sort((a, b) => a - b);
      lineByLineOk =
        marker.batch === batchId &&
        marker.line_count === input.length &&
        marker.review_mode === "llm_manual_line_by_line" &&
        isContiguousOneToN(sorted, input.length);

      reviewTimestampNotDefault = marker.reviewed_at !== "2026-02-14T00:00:00Z";

      const started = safeParseDate(marker.started_at);
      const finished = safeParseDate(marker.finished_at);
      if (started !== null && finished !== null && finished > started) {
        const durationSec = (finished - started) / 1000;
        reviewTimingPlausible = durationSec >= input.length * 2;
      }

      if (fs.existsSync(reviewNotesPath)) {
        reviewNotesPresent = true;
        const noteLines = readLines(reviewNotesPath);
        const notes = noteLines.map((v) => JSON.parse(v) as ReviewNote);
        const sortedNos = [...notes.map((v) => v.line_no)].sort((a, b) => a - b);
        reviewNotesLineComplete =
          notes.length === input.length &&
          isContiguousOneToN(sortedNos, input.length) &&
          notes.every((n) => Boolean(n.decision?.trim()) && Boolean(n.rationale?.trim()));

        if (notes.length === input.length && inputLinesRaw.length === outputLinesRaw.length && inputLinesRaw.length === input.length) {
          reviewPerLineHashesMatch = notes.every((n, idx) => {
            const inHash = sha256(inputLinesRaw[idx] ?? "");
            const outHash = sha256(outputLinesRaw[idx] ?? "");
            return n.line_no === idx + 1 && n.input_sha256 === inHash && n.output_sha256 === outHash;
          });
        }

        const notesRaw = fs.readFileSync(reviewNotesPath, "utf8");
        reviewBundleHashesMatch =
          marker.input_sha256 === sha256(inputRaw) &&
          marker.output_sha256 === sha256(outputRaw) &&
          marker.notes_sha256 === sha256(notesRaw);
      }
    } catch {
      lineByLineOk = false;
    }
  }
  checks.llm_line_by_line_manual_reviewed = lineByLineOk;
  checks.review_notes_present = reviewNotesPresent;
  checks.review_notes_line_complete = reviewNotesLineComplete;
  checks.review_per_line_hashes_match = reviewPerLineHashesMatch;
  checks.review_bundle_hashes_match = reviewBundleHashesMatch;
  checks.review_timing_plausible = reviewTimingPlausible;
  checks.review_timestamp_not_default = reviewTimestampNotDefault;

  const passed = Object.values(checks).every(Boolean);
  const report = {
    batch: batchId,
    passed,
    input_lines: input.length,
    output_lines: output.length,
    checks,
    reviewed_marker: reviewedMarker,
    line_review_marker: lineByLineMarkerPath,
    review_notes_path: reviewNotesPath,
    generated_at: new Date().toISOString()
  };

  const reportDir = path.join(batchDir, "qc_reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `${batchId}.qc.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  console.log(JSON.stringify({ reportPath, ...report }, null, 2));
  if (!passed) process.exit(2);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
