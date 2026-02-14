import fs from "node:fs";
import path from "node:path";

type Report = {
  batch: string;
  passed: boolean;
};

async function main(): Promise<void> {
  const batchDir = path.resolve(process.argv[2] ?? "/Users/kimhoechang/Documents/codex/data/llm_micro_batches");
  const manifestPath = path.join(batchDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error(`Missing manifest: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as Array<{ batch: string }>;
  const reportDir = path.join(batchDir, "qc_reports");
  let pass = 0;
  let done = 0;
  for (const item of manifest) {
    const rp = path.join(reportDir, `${item.batch}.qc.json`);
    if (!fs.existsSync(rp)) {
      console.log(`TODO\t${item.batch}\t(no qc report)`);
      continue;
    }
    done += 1;
    const r = JSON.parse(fs.readFileSync(rp, "utf8")) as Report;
    if (r.passed) {
      pass += 1;
      console.log(`PASS\t${item.batch}`);
    } else {
      console.log(`FAIL\t${item.batch}`);
    }
  }
  console.log(`\nqc_progress: ${done}/${manifest.length}, pass=${pass}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

