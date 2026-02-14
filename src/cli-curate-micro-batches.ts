import fs from "node:fs";
import path from "node:path";

type Row = {
  chunk_type: "transcript_chunk" | "recap_summary" | "recap_quiz_seed";
  text: string;
  subject: string;
  page_title: string;
  episode: string;
  section_path: string[];
  source_doc_id: string;
  source_page?: number | null;
  source_anchor?: string | null;
  focus_area?: string;
  tags?: string[];
};

type ManifestItem = {
  batch: string;
  input_path: string;
  expected_output_path: string;
};

const MEDICAL_KEYWORDS = [
  "diagnosis",
  "treatment",
  "management",
  "hypoxemia",
  "hyponatremia",
  "hypernatremia",
  "acid",
  "alkalosis",
  "syndrome",
  "pneumonia",
  "asthma",
  "copd",
  "ards",
  "pft",
  "dlco",
  "ecg",
  "ekg",
  "fever",
  "pain",
  "bleeding",
  "algorithm",
  "next step",
  "biopsy",
  "insulin",
  "potassium",
  "renal",
  "nephro",
  "cardio",
  "neuro",
  "pulmo",
  "obgyn"
];

function normalize(lines: string[]): string[] {
  const out: string[] = [];
  let prevBlank = false;
  for (const l of lines) {
    const v = l.replace(/\s+$/g, "");
    const isBlank = v.trim() === "";
    if (isBlank && prevBlank) continue;
    out.push(v);
    prevBlank = isBlank;
  }
  return out;
}

function stripVerification(lines: string[]): string[] {
  const out: string[] = [];
  let skip = false;
  for (const line of lines) {
    const t = line.trim();
    const lower = t.toLowerCase();
    if (/verification|dictation/.test(lower)) {
      skip = true;
      continue;
    }
    if (skip) {
      if (t.startsWith(">") || t === "" || t === "---") continue;
      skip = false;
    }
    out.push(line);
  }
  return out;
}

function stripNarration(lines: string[]): string[] {
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    const lower = t.toLowerCase();
    if (
      /welcome back to the deep dive/.test(lower) ||
      /grab your white coat/.test(lower) ||
      /double espresso/.test(lower) ||
      /step 1 is done/.test(lower) ||
      /good luck with the prep/.test(lower) ||
      /confidence score/.test(lower) ||
      /key caveats/.test(lower) ||
      /verify\s*\(/.test(lower) ||
      /verification/.test(lower) ||
      /dictation/.test(lower)
    ) {
      continue;
    }
    out.push(line);
  }
  return out;
}

function stripQuoteOnlyBlocks(lines: string[]): string[] {
  const out: string[] = [];
  let quoteRun = 0;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith(">")) {
      quoteRun += 1;
      continue;
    }
    if (quoteRun > 0 && (t === "" || t === "---")) {
      continue;
    }
    quoteRun = 0;
    out.push(line);
  }
  return out;
}

function stripImageMarkdown(lines: string[]): string[] {
  return lines.filter((line) => !/^!\[[^\]]*\]\([^)]+\)\s*$/i.test(line.trim()));
}

function mostlyIndex(text: string): boolean {
  const lines = text.split("\n").map((v) => v.trim()).filter(Boolean);
  if (!lines.length) return true;
  const linkLines = lines.filter((v) => /^\[.*\]\(.*\)$/.test(v)).length;
  const imageLines = lines.filter((v) => /^!\[.*\]\(.*\)$/.test(v)).length;
  const headingOnly = lines.filter((v) => /^#{1,6}\s+/.test(v)).length;
  const proseLines = lines.filter((v) => !/^\[.*\]\(.*\)$/.test(v) && !/^!\[.*\]\(.*\)$/.test(v)).length;
  const ratio = (linkLines + imageLines + headingOnly) / lines.length;
  return ratio > 0.8 || (linkLines >= 6 && proseLines <= 3);
}

function hasMedicalSignal(text: string): boolean {
  const lower = text.toLowerCase();
  if (/^\s*(\[[^\]]+\]\([^)]+\)\s*)+$/m.test(lower)) return false;
  return MEDICAL_KEYWORDS.some((k) => lower.includes(k));
}

function detectFocusArea(row: Row, text: string): string {
  const fromSection = row.section_path?.[row.section_path.length - 1];
  if (fromSection && fromSection.trim()) return fromSection.trim();
  const heading = text.split("\n").find((v) => /^#{1,3}\s+/.test(v.trim()));
  if (heading) return heading.replace(/^#{1,3}\s+/, "").trim().slice(0, 80);
  const lower = text.toLowerCase();
  if (lower.includes("hyponatremia")) return "Hyponatremia";
  if (lower.includes("hypernatremia")) return "Hypernatremia/DI";
  if (lower.includes("ards")) return "ARDS Ventilation";
  if (lower.includes("capnography")) return "Capnography";
  if (lower.includes("pft") || lower.includes("dlco")) return "PFT/DLCO";
  return row.page_title;
}

function detectTags(row: Row, text: string, excludeFeed: boolean): string[] {
  const tags = new Set<string>();
  const lower = text.toLowerCase();
  tags.add("usmle-step2");
  tags.add("core");
  if (row.chunk_type === "recap_summary") tags.add("recap");
  if (row.chunk_type === "recap_quiz_seed") tags.add("quiz-seed");
  if (/diagnosis|dx|workup|algorithm|next step/.test(lower)) tags.add("diagnosis");
  if (/treatment|management|tx|therapy|dose|fluid|insulin/.test(lower)) tags.add("treatment");
  if (/pathophysiology|mechanism|vegf|adh|compliance|resistance/.test(lower)) tags.add("pathophysiology");
  if (/mnemonic|memory|비유|비유:|analogy|mental model|baby lung|댐|치즈|레몬/.test(lower)) tags.add("mnemonic");
  if (/tree|flow|algorithm/.test(lower)) tags.add("tree");
  if (excludeFeed) tags.add("exclude-feed");
  if (tags.size < 2) tags.add("review");
  return [...tags];
}

function curate(row: Row): Row {
  let lines = row.text.split("\n");
  lines = stripVerification(lines);
  lines = stripNarration(lines);
  lines = stripQuoteOnlyBlocks(lines);
  lines = stripImageMarkdown(lines);
  lines = normalize(lines);
  const cleaned = lines.join("\n").trim();
  const excludeFeed = mostlyIndex(cleaned) && !hasMedicalSignal(cleaned);
  return {
    ...row,
    text: cleaned || row.text.trim(),
    focus_area: detectFocusArea(row, cleaned || row.text),
    tags: detectTags(row, cleaned || row.text, excludeFeed)
  };
}

async function main(): Promise<void> {
  const batchDir = path.resolve(
    process.argv[2] ?? "/Users/kimhoechang/Documents/codex/data/curation_micro_batches"
  );
  const manifestPath = path.join(batchDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error(`Manifest not found: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ManifestItem[];

  let total = 0;
  for (const item of manifest) {
    const raw = fs.readFileSync(item.input_path, "utf8").trim();
    const rows = raw
      .split("\n")
      .map((v) => v.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Row);
    const curated = rows.map(curate);
    fs.writeFileSync(item.expected_output_path, `${curated.map((r) => JSON.stringify(r)).join("\n")}\n`, "utf8");
    total += curated.length;
  }
  console.log(`Curated micro batches complete. rows=${total}, batches=${manifest.length}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
