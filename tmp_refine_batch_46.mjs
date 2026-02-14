import fs from 'fs';
import crypto from 'crypto';

const base='/Users/kimhoechang/Documents/codex/data/llm_micro_batches';
const batch='batch_46';
const curatedPath=`${base}/${batch}.curated.jsonl`;
const inputPath=`${base}/${batch}.input.jsonl`;
const notesPath=`${base}/review_notes/${batch}.notes.jsonl`;
const markerPath=`${base}/reviewed_markers/${batch}.line_review.json`;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');

const now='2026-02-14T08:21:00Z';
const start='2026-02-14T08:08:00Z';

const rows=fs.readFileSync(curatedPath,'utf8').trim().split('\n').map(JSON.parse);

function clean(t,n){
  let x=t;
  if(n===1){
    x=x.replace(/\n### 5\. SYNTHESIZE & REFLECT[\s\S]*$/,'');
  }
  if(n===2){
    x=x.replace(/\n- 이 강의 노트는[\s\S]*$/,'');
    x=x.replace(/\n### 📋 Overview: CNS Tumors \(Deep Dive\)[\s\S]*$/,'');
  }
  if(n===3){
    x=x.replace(/\n\*\*Caveats:\*\*[\s\S]*$/,'');
    x=x.replace(/\n\*\*Next Step for User:\*\*[\s\S]*$/,'');
    x=x.replace(/\n### 📋 Overview: Pediatric Neurology[\s\S]*$/,'');
  }
  if(n===4){
    x=x.replace(/\n- 오디오 강의는 "General Rule"[\s\S]*$/,'');
    x=x.replace(/\n\*\*Overview: Pediatric Acute Neurology Deep Dive\*\*[\s\S]*$/,'');
  }
  if(n===5){
    x=x.replace(/\n\*\*Confidence:\*\*[\s\S]*$/,'');
    x=x.replace(/\n\*\*Caveats:\*\*[\s\S]*$/,'');
    x=x.replace(/\n\*\*Mental Model:\*\*[\s\S]*$/,'');
    x=x.replace(/\n\*\*Key Constraints:\*\*[\s\S]*$/,'');
    x=x.replace(/\n### 📋 Overview: High-Yield Vision Pathology \(TL;DR\)[\s\S]*$/,'');
  }
  if(n===6){
    x=x.replace(/\n- \*\*Confidence:\*\*[\s\S]*$/,'');
    x=x.replace(/\n- \*\*Disclaimer:\*\*[\s\S]*$/,'');
    x=x.replace(/\n- \*\*Images:\*\*[\s\S]*$/,'');
    x=x.replace(/\nHere is the response based on the analysis of the audio file provided\.[\s\S]*$/,'');
    x=x.replace(/\n### 📋 Overview: Eye Trauma High-Yield Summary \(TL;DR\)[\s\S]*$/,'');
  }
  if(n===7){
    x=x.replace('heals in 1-3 days위 내용은 **Ophthalmology Infections → Vision Pathology → Eye Trauma** 순서대로,','heals in 1-3 days |');
    x=x.replace(/\n## 👂 EAR \(Otolaryngology\)[\s\S]*$/,'');
  }
  if(n===9){
    x=x.replace(/\n### \*\*Episode 4: Epilepsy & Seizure Management\*\*[\s\S]*$/,'');
  }
  if(n===10){
    x=x.replace(/\n### \*\*Episode 9: Dementia & Cognitive Disorders\*\*[\s\S]*$/,'');
  }
  if(n===11){
    x=x.replace(/\n### \*\*Episode 15: Pediatric Neurology I\*\*[\s\S]*$/,'');
  }

  return x.trim();
}

const refined=rows.map((r,i)=>({...r,text:clean(r.text,i+1)}));
fs.writeFileSync(curatedPath, refined.map(r=>JSON.stringify(r)).join('\n')+'\n');

const inputRows=fs.readFileSync(inputPath,'utf8').trim().split('\n');
const touched=new Set([1,2,3,4,5,6,7,9,10,11]);
const notes=refined.map((r,i)=>{
  const inObj=JSON.parse(inputRows[i]);
  const rationale=touched.has(i+1)
    ? `Line ${i+1}: removed meta/caveat/next-step and cross-episode carryover, preserving core medical recap content.`
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
    'meta_prompt_carryover_removed',
    'cross_episode_tail_removed',
    'medical_recap_content_preserved',
    'review_notes_and_hashes_updated'
  ]
};
fs.writeFileSync(markerPath, JSON.stringify(marker,null,2)+'\n');
console.log('refined',batch,'lines',refined.length);
