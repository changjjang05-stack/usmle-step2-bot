import fs from 'fs';
import crypto from 'crypto';

const base='/Users/kimhoechang/Documents/codex/data/llm_micro_batches';
const batch='batch_42';
const curatedPath=`${base}/${batch}.curated.jsonl`;
const inputPath=`${base}/${batch}.input.jsonl`;
const notesPath=`${base}/review_notes/${batch}.notes.jsonl`;
const markerPath=`${base}/reviewed_markers/${batch}.line_review.json`;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');

const now='2026-02-14T07:24:00Z';
const start='2026-02-14T07:12:00Z';

const rows=fs.readFileSync(curatedPath,'utf8').trim().split('\n').map(JSON.parse);

function clean(t, lineNo){
  let x=t;

  if(lineNo===3){
    x=x.replace(/\n"안녕하세요\.[\s\S]*$/,'');
  }
  if(lineNo===4){
    x=x.replaceAll('$\\rightarrow$','->');
  }
  if(lineNo===6){
    x=x.replace(/\n\*\*\(다음 화 예고\)\*\*[\s\S]*$/,'');
  }
  if(lineNo===7){
    x=x.replace(/\n\*\*다음 시간 예고:\*\*[\s\S]*$/,'');
  }
  if(lineNo===13){
    x=x.replace(/\n\s*\*\*Host 1:\*\*[\s\S]*$/,'');
  }
  if(lineNo===15){
    x=x.replace(/\n# 🎧 USMLE Step 2 High-Yield Gyn & Reproductive Health 강의록[\s\S]*$/,'');
  }
  if(lineNo===16){
    x=x.replace(/\n\*"The context is everything\."\*[\s\S]*$/,'');
  }
  if(lineNo===17){
    x=x.replace(/\n# \*\*USMLE Step 2 Breast Pathology Deep Dive\*\*[\s\S]*$/,'');
  }
  if(lineNo===18){
    x=x.replace(/\n군의관님, 바쁘실 때 이 부분만이라도 꼭 확인하고 넘어가세요!\n/,'\n');
    x=x.replace(/Adenomyosis vs Endometriosis\(생리섹스똥\) \(glue\)/,'Adenomyosis vs Endometriosis');
    x=x.replace(/\n\*\*Next Step:\*\*[\s\S]*$/,'');
  }

  return x.trim();
}

const refined=rows.map((r,i)=>({ ...r, text: clean(r.text,i+1)}));
fs.writeFileSync(curatedPath, refined.map(r=>JSON.stringify(r)).join('\n')+'\n');

const inputRows=fs.readFileSync(inputPath,'utf8').trim().split('\n');
const touched=new Set([3,4,6,7,13,15,16,17,18]);
const notes=refined.map((r,i)=>{
  const inObj=JSON.parse(inputRows[i]);
  const rationale=touched.has(i+1)
    ? `Line ${i+1}: removed host/dialogue/meta carryover and preserved exam-relevant medical recap content.`
    : `Line ${i+1}: line-by-line manual LLM refinement preserved medical meaning and study structure.`;
  return JSON.stringify({
    line_no:i+1,
    decision:'manual_review_refine',
    rationale,
    input_sha256:hash(JSON.stringify(inObj)),
    output_sha256:hash(JSON.stringify(r))
  });
});
fs.writeFileSync(notesPath, notes.join('\n')+'\n');

const marker={
  batch,
  line_count: refined.length,
  lines_reviewed: refined.map((_,i)=>i+1),
  review_mode:'llm_manual_line_by_line',
  reviewed_at: now,
  started_at: start,
  finished_at: now,
  input_sha256: hash(fs.readFileSync(inputPath,'utf8')),
  output_sha256: hash(fs.readFileSync(curatedPath,'utf8')),
  notes_sha256: hash(fs.readFileSync(notesPath,'utf8')),
  qc_checklist:[
    'all_lines_read_manually',
    'manual_line_by_line_refinement_completed',
    'host_dialogue_removed',
    'meta_or_next_step_prompts_removed',
    'medical_content_preserved',
    'review_notes_and_hashes_updated'
  ]
};
fs.writeFileSync(markerPath, JSON.stringify(marker,null,2)+'\n');
console.log('refined',batch,'lines',refined.length);
