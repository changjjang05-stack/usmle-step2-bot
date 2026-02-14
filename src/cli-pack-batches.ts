import fs from "node:fs";
import path from "node:path";

type LineObj = {
  chunk_type: string;
  text: string;
  source_doc_id: string;
  source_anchor?: string | null;
};

type Group = {
  index: number;
  lines: string[];
  estTokens: number;
  estOutTokens: number;
};

const STRICT_PROMPT = `너는 USMLE Step 2 학습 데이터 큐레이터다.
입력은 JSONL이며 한 줄이 하나의 chunk다.
출력은 반드시 JSONL만 출력한다. 설명문/코드블록/마크다운 금지.

절대 규칙:
1) 요약 금지
2) 생략 금지
3) 누락 금지
4) 입력 1줄 -> 출력 1줄을 정확히 유지
5) source_doc_id + source_anchor + chunk_type 조합 보존
6) 의학적 사실/조건/예외를 한 줄도 잃지 말 것
7) 각 줄에 focus_area(문자열)와 tags(배열, 최소 2개) 필수
8) 확신이 부족한 부분은 임의 보정 금지, 원문 표현 보존

허용되는 편집:
- 표현 다듬기
- 중복 표현 정리(정보 손실 없이)
- 문장 가독성 개선

출력 줄 수는 입력 줄 수와 반드시 같아야 한다.`;

function estTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

function parseJsonLines(raw: string): string[] {
  return raw
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean);
}

function assertValidLine(line: string, idx: number): void {
  let obj: LineObj;
  try {
    obj = JSON.parse(line) as LineObj;
  } catch {
    throw new Error(`Invalid JSONL at line ${idx + 1}`);
  }
  if (!obj.source_doc_id || !obj.chunk_type) {
    throw new Error(`Missing key fields at line ${idx + 1}`);
  }
}

async function main(): Promise<void> {
  const draftPath = path.resolve(process.argv[2] ?? "/Users/kimhoechang/Documents/codex/data/draft_chunks.jsonl");
  const outDir = path.resolve(process.argv[3] ?? "/Users/kimhoechang/Documents/codex/data/curation_batches");
  const maxInputTokens = Number(process.argv[4] ?? "45000");
  const estOutRatio = Number(process.argv[5] ?? "1.05");

  if (!fs.existsSync(draftPath)) throw new Error(`Draft file not found: ${draftPath}`);
  fs.mkdirSync(outDir, { recursive: true });

  const raw = fs.readFileSync(draftPath, "utf8").trim();
  const lines = parseJsonLines(raw);
  lines.forEach(assertValidLine);

  const groups: Group[] = [];
  let current: Group = { index: 1, lines: [], estTokens: 0, estOutTokens: 0 };

  for (const line of lines) {
    const t = estTokens(line);
    if (current.lines.length > 0 && current.estTokens + t > maxInputTokens) {
      groups.push(current);
      current = { index: groups.length + 1, lines: [], estTokens: 0, estOutTokens: 0 };
    }
    current.lines.push(line);
    current.estTokens += t;
    current.estOutTokens = Math.ceil(current.estTokens * estOutRatio);
  }
  if (current.lines.length > 0) groups.push(current);

  const manifest = groups.map((g) => {
    const id = String(g.index).padStart(2, "0");
    const inputPath = path.join(outDir, `batch_${id}.input.jsonl`);
    const promptPath = path.join(outDir, `batch_${id}.prompt.txt`);
    const outputPath = path.join(outDir, `batch_${id}.curated.jsonl`);
    fs.writeFileSync(inputPath, `${g.lines.join("\n")}\n`, "utf8");
    fs.writeFileSync(
      promptPath,
      `${STRICT_PROMPT}

작업 지시:
- 첨부한 JSONL 파일 내용을 정제하라.
- 결과는 파일 형태로 제공하고, 파일명은 batch_${id}.curated.jsonl 로 하라.
- 응답 본문에는 파일 생성 완료 여부만 짧게 말하라.
`,
      "utf8"
    );
    return {
      batch: `batch_${id}`,
      input_path: inputPath,
      prompt_path: promptPath,
      expected_output_path: outputPath,
      input_lines: g.lines.length,
      est_input_tokens: g.estTokens,
      est_output_tokens: g.estOutTokens
    };
  });

  const manifestPath = path.join(outDir, "manifest.json");
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf8");
  console.log(`Created ${manifest.length} batches`);
  console.log(`Manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
