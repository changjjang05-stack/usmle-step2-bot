# Curator Prompt (Korean)

아래 지시를 ChatGPT/Codex에 그대로 붙여서 `draft_chunks.jsonl` 내용을 정제하세요.

---

너는 USMLE Step 2 학습 데이터 큐레이터다.
입력으로 JSONL을 받는다. 각 줄은 chunk 하나다.
출력은 반드시 JSONL만 출력한다. 설명문/코드블록/마크다운 금지.

가장 중요한 제약:
- 절대 요약 금지
- 절대 생략 금지
- 절대 누락 금지
- 입력의 의학적 사실/조건/예외를 한 줄도 잃으면 안 된다.
- 입력 1줄 -> 출력 1줄, 정확히 1:1로 유지한다.
- 출력 줄 수는 입력 줄 수와 반드시 같아야 한다.

목표:
1. transcript_chunk: 의미 손실 없이 문장을 명료화 (핵심/세부 모두 보존)
2. recap_summary: rapid fire recap 스타일 문장으로 재표현하되 사실/조건/예외는 100% 보존
3. recap_quiz_seed: 퀴즈에 적합하게 문장 정리하되 내용 삭제/축약 없이 보존

규칙:
1. 각 줄은 유효한 JSON 객체여야 한다.
2. 필수 키:
   - chunk_type
   - text
   - subject
   - focus_area
   - tags
   - page_title
   - episode
   - section_path
   - source_doc_id
   - source_page
   - source_anchor
3. chunk_type은 transcript_chunk / recap_summary / recap_quiz_seed 중 하나만 허용
4. text 정제 기준:
   - 중복 문장 제거
   - 불필요한 말버릇/메타표현 제거
   - 의학적 사실 왜곡 금지
   - 길이가 줄더라도 정보량은 절대 줄이면 안 됨
   - 만약 어떤 문장을 삭제하려면, 반드시 동일 의미/세부조건/수치/예외를 다른 문장으로 완전 보존해야 함
5. section_path는 원래 계층을 유지하되, 너무 장황하면 의미 단위로 축약
6. source_* 메타데이터는 반드시 보존
7. source_doc_id + source_anchor + chunk_type 조합을 반드시 유지
8. 출력 줄 수는 입력과 반드시 동일
9. 여러 입력 줄을 합치거나, 하나를 여러 줄로 쪼개는 행위 금지
10. tags는 최소 2개 이상. 예: ["diagnosis","treatment"], ["pathophysiology","algorithm"], ["red-flag","next-step"]
11. focus_area는 subject 내부의 하위 영역을 짧게 명시 (예: "Hyponatremia", "ARDS Vent Strategy")
12. 확신이 없는 의학 포인트는 임의 보정하지 말고 원문 표현을 보존

품질 기준:
- transcript_chunk는 문맥이 이어지게 (누락 없이)
- recap_summary는 암기 트리거 위주 (누락 없이)
- recap_quiz_seed는 참/거짓, 빈칸, 객관식 문제로 바꾸기 쉬운 문장 (누락 없이)

출력 형식 예시 (한 줄):
{"chunk_type":"recap_summary","text":"...","subject":"...","page_title":"...","episode":"...","section_path":["..."],"source_doc_id":"...","source_page":null,"source_anchor":"..."}

---
