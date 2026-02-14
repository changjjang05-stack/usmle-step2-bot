# No-API LLM 정제 플로우 (추천)

이 플로우는 API 키 없이, ChatGPT/Codex를 수동으로 한 번 사용해 정제된 소스를 만드는 방식입니다.

## 1) Notion ZIP을 초안 청크로 변환

```bash
cd /Users/kimhoechang/Documents/codex
npm run export:draft -- "/absolute/path/notion-export.zip" "/Users/kimhoechang/Documents/codex/data/draft_chunks.jsonl"
```

## 2) 배치 자동 생성 (권장)

```bash
cd /Users/kimhoechang/Documents/codex
npm run pack:batches -- "/Users/kimhoechang/Documents/codex/data/draft_chunks.jsonl" "/Users/kimhoechang/Documents/codex/data/curation_batches" 45000 1.05
```

컨텍스트 리스크를 더 줄이려면(권장):

```bash
npm run pack:batches -- "/Users/kimhoechang/Documents/codex/data/draft_chunks.jsonl" "/Users/kimhoechang/Documents/codex/data/curation_micro_batches" 12000 1.08
```

생성 결과:
- `batch_XX.input.jsonl`
- `batch_XX.prompt.txt`
- `manifest.json`

## 3) ChatGPT/Codex/Gemini에서 배치별 정제

각 배치마다:
1. `batch_XX.prompt.txt` 내용을 첫 메시지로 붙여넣기
2. `batch_XX.input.jsonl` 파일 업로드
3. 출력 파일명을 `batch_XX.curated.jsonl`로 받기
4. 파일을 `/Users/kimhoechang/Documents/codex/data/curation_batches/`에 저장

주의:
- 결과는 JSONL만 있어야 함
- 코드블록/설명문이 섞이면 import 실패

진행상태 확인:

```bash
npm run status:batches -- "/Users/kimhoechang/Documents/codex/data/curation_micro_batches"
```

## 4) 배치 결과 병합

```bash
cd /Users/kimhoechang/Documents/codex
npm run merge:batches -- "/Users/kimhoechang/Documents/codex/data/curation_micro_batches" "/Users/kimhoechang/Documents/codex/data/curated_chunks.jsonl"
```

## 5) 누락 검증 (필수)

```bash
cd /Users/kimhoechang/Documents/codex
npm run validate:curated -- "/Users/kimhoechang/Documents/codex/data/draft_chunks.jsonl" "/Users/kimhoechang/Documents/codex/data/curated_chunks.jsonl"
```

`ok: true`가 나와야 다음 단계로 진행하세요.

## 6) 정제본을 DB에 반영

```bash
cd /Users/kimhoechang/Documents/codex
npm run import:curated -- "/Users/kimhoechang/Documents/codex/data/curated_chunks.jsonl"
```

## 7) 발송 테스트

```bash
curl "http://localhost:8787/daily-feed?user_id=default-user&session=am"
```

또는 텔레그램 테스트:

```bash
curl -X POST http://localhost:8787/jobs/send-session \
  -H "x-sync-api-key: YOUR_SYNC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"session":"am","user_id":"default-user"}'
```
