# Batch QC Checklist (Must-pass per batch)

각 `batch_XX`는 아래 항목을 모두 통과해야 다음 배치로 진행합니다.

1. `line_count_match`
- 입력 줄 수 = 출력 줄 수

2. `key_identity_preserved`
- 각 줄의 `(source_doc_id, source_anchor, chunk_type)` 조합이 입력과 출력에서 동일

3. `required_fields_present`
- `focus_area`, `tags`, `text` 포함 필수 필드 누락 없음

4. `forbidden_narration_removed`
- `welcome back to the deep dive`, `dictation`, `verification`, `confidence score` 미포함

5. `image_markdown_removed`
- `![...](...)` 마크다운 라인 0개

6. `table_structure_preserved`
- 입력 줄에 Markdown table(`| --- |`)가 있으면 출력 줄에도 table 구조 유지

7. `nonempty_text`
- 빈 텍스트 청크 없음

8. `tags_min2`
- `tags` 길이 최소 2개

9. `llm_manual_reviewed`
- 배치별 수동 LLM 검토 마커 파일 존재:
- `/Users/kimhoechang/Documents/codex/data/llm_micro_batches/reviewed_markers/batch_XX.reviewed`

10. `llm_line_by_line_manual_reviewed`
- 줄 단위 수동 검토 증적 JSON 존재 및 유효:
- `/Users/kimhoechang/Documents/codex/data/llm_micro_batches/reviewed_markers/batch_XX.line_review.json`
- JSON 필수 조건:
- `review_mode = "llm_manual_line_by_line"`
- `line_count = 입력 줄 수`
- `lines_reviewed = [1..N]` 연속 배열

11. `review_notes_present`
- 줄 단위 검토 노트 파일 존재:
- `/Users/kimhoechang/Documents/codex/data/llm_micro_batches/review_notes/batch_XX.notes.jsonl`

12. `review_notes_line_complete`
- `notes.jsonl` 줄 수 = 입력 줄 수
- 각 줄의 `line_no`가 `[1..N]` 연속
- 각 줄에 `decision`, `rationale` 비어있지 않음

13. `review_per_line_hashes_match`
- `notes.jsonl` 각 줄의 `input_sha256`, `output_sha256`가 실제 해당 라인 해시와 일치

14. `review_bundle_hashes_match`
- 마커의 `input_sha256`, `output_sha256`, `notes_sha256`가 실제 파일 해시와 일치

15. `review_timing_plausible`
- 마커의 `started_at`, `finished_at`이 유효한 시간
- `finished_at > started_at`
- 최소 검토 시간 기준 통과(현재 기준: 라인당 2초 이상)

16. `review_timestamp_not_default`
- 고정 더미 타임스탬프(`2026-02-14T00:00:00Z`) 금지

QC 결과 파일:
- `/Users/kimhoechang/Documents/codex/data/llm_micro_batches/qc_reports/batch_XX.qc.json`

전체 상태 요약:
- `npm run qc:status -- /Users/kimhoechang/Documents/codex/data/llm_micro_batches`
