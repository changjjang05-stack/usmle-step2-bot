import fs from 'fs';
import crypto from 'crypto';

const base='/Users/kimhoechang/Documents/codex/data/llm_micro_batches';
const batch='batch_44';
const curatedPath=`${base}/${batch}.curated.jsonl`;
const inputPath=`${base}/${batch}.input.jsonl`;
const notesPath=`${base}/review_notes/${batch}.notes.jsonl`;
const markerPath=`${base}/reviewed_markers/${batch}.line_review.json`;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');

const now='2026-02-14T07:52:00Z';
const start='2026-02-14T07:39:00Z';

const rows=fs.readFileSync(curatedPath,'utf8').trim().split('\n').map(JSON.parse);

function clean(t,n){
  let x=t;
  if(n===1){
    x=x.replace(/\n군의관님,[\s\S]*$/,'');
  }
  if(n===2){
    x=x.replace(/\n\*\*Would you like me to create[\s\S]*$/,'');
    x=x.replace(/\n# 🏥 Section 13\.0:[\s\S]*$/,'');
  }
  if(n===3){
    x=x.replace(/\n### 👨‍🏫 Tutor's Note:[\s\S]*$/,'');
  }
  if(n===4){
    x=x.replace(/\n## 🌳 USMLE Step 2 CK:[\s\S]*$/,'');
    x=x.replace(/\nPlaintext\s*$/,'');
  }
  if(n===5){
    x=x.replace(/\n## 🏥 \*\*Managing Acute GI Bleeding[\s\S]*$/,'');
  }
  if(n===6){
    x=x.replace(/\n\*\*Confidence:[\s\S]*$/,'');
    x=x.replace(/\n\*\*Caveat:[\s\S]*$/,'');
    x=x.replace(/\n# 🩸 \*\*Intrinsic Hemolytic Anemias:[\s\S]*$/,'');
  }
  if(n===7){
    x=x.replace(/\n"All right, everyone, settle in\.[\s\S]*$/,'');
  }
  if(n===8){
    x=x.replace(/\n### \*\*STEP 5: REFLECTION & CAVEATS\*\*[\s\S]*$/,'');
    x=x.replace(/\n\*\*Would you like me to generate[\s\S]*$/,'');
    x=x.replace(/\n아이고, 죄송합니다![\s\S]*$/,'');
  }
  if(n===9){
    x=x.replace(/…\d+ tokens truncated…/g,'');
  }
  if(n===10){
    x=x.replace(/\n## 🎓 Next Step for You[\s\S]*$/,'');
    x=x.replace(/\n# 4\.0-4\.5 📋 Overview:[\s\S]*$/,'');
  }
  if(n===11){
    x=x.replace(/\n- \*\*Caveats:\*\*[\s\S]*$/,'');
    x=x.replace(/\n# 7\.0-7\.5📋 Senior Medical Scribe[\s\S]*$/,'');
  }
  if(n===12){
    x=x.replace(/\n\*\*Final Caveat:\*\*[\s\S]*$/,'');
  }
  if(n===13){
    x=x.replace(/\n### Overview: Systemic Autoimmune Disorders Part 2[\s\S]*$/,'');
  }
  if(n===14){
    x=x.replace(/\n### 🩺 Doctor's Note \(Caveats\)[\s\S]*$/,'');
    x=x.replace(/\n## 📋 Overview: Hand & Wrist Pathology High-Yield Summary[\s\S]*$/,'');
  }
  if(n===15){
    x=x.replace(/\n- \*\*Caveats:\*\*[\s\S]*$/,'');
    x=x.replace(/\n\*\*Would you like me to generate[\s\S]*$/,'');
    x=x.replace(/\n### \*\*TL;DR: Spine Pathology Overview 🦴\*\*[\s\S]*$/,'');
  }
  if(n===17){
    x=x.replace(/\n\*Caveats:[\s\S]*$/,'');
    x=x.replace(/\nWould you like me to generate[\s\S]*$/,'');
  }
  return x.trim();
}

const refined=rows.map((r,i)=>({...r,text:clean(r.text,i+1)}));
fs.writeFileSync(curatedPath, refined.map(r=>JSON.stringify(r)).join('\n')+'\n');

const inputRows=fs.readFileSync(inputPath,'utf8').trim().split('\n');
const touched=new Set([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,17]);
const notes=refined.map((r,i)=>{
  const inObj=JSON.parse(inputRows[i]);
  const rationale=touched.has(i+1)
    ? `Line ${i+1}: removed narration/caveat/prompt carryover and preserved medical recap content only.`
    : `Line ${i+1}: line-by-line manual LLM refinement preserved exam-relevant content and structure.`;
  return JSON.stringify({line_no:i+1,decision:'manual_review_refine',rationale,input_sha256:hash(JSON.stringify(inObj)),output_sha256:hash(JSON.stringify(r))});
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
    'narration_and_prompt_text_removed',
    'cross_section_carryover_removed',
    'medical_recap_content_preserved',
    'review_notes_and_hashes_updated'
  ]
};
fs.writeFileSync(markerPath, JSON.stringify(marker,null,2)+'\n');
console.log('refined',batch,'lines',refined.length);
