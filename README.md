# USMLE Step 2 Learning Bot MVP

Notion 자동 수집 + Telegram/Email 발송 + Google Drive PDF 컨텍스트 점프를 위한 MVP 서버입니다.

## 1) 포함된 기능

- Notion API 주간 동기화 (`POST /sync/notion`)
- ZIP fallback 동기화 (`POST /sync/fallback-zip`)
- ZIP 파일 직접 import (`npm run import:zip -- <zip-path>`)
- ZIP -> 초안 청크 추출 (`npm run export:draft -- <zip-path> <out.jsonl>`)
- 정제 JSONL import (`npm run import:curated -- <curated.jsonl>`)
- 10~20줄 청킹 + 타입 분리
  - `transcript_chunk`
  - `recap_summary`
  - `recap_quiz_seed`
- 일일 피드 생성 (`GET /daily-feed`)
  - 기본 분할: AM(본문4+recap2), PM(본문4+recap2)
- 피드백 반영 (`POST /feedback`)
  - `more`, `less`, `mastered`, `correct`, `wrong`
- 컨텍스트 조회 (`GET /context/:chunkId`)
  - Google Drive PDF 링크 반환
- Telegram 인라인 버튼 + 퀴즈 + 컨텍스트 점프
- Email digest 백업 발송

## 2) 코딩 없이 쓰는 가장 쉬운 방식 (권장)

이 방식은 Notion integration 없이, 네가 수동 export한 ZIP만 넣으면 됩니다.

1. Notion에서 상위 큰 페이지 1개를 export
   - Export format: `Markdown & CSV` 또는 `HTML`
   - `Include subpages` 반드시 켜기
   - ZIP 파일 다운로드
2. 터미널에서 프로젝트 폴더 열기
3. 아래 3줄 실행

```bash
cp .env.example .env
export DATABASE_URL='postgresql://...'
./scripts/setup_local.sh
```

4. ZIP import 실행

```bash
npm run import:zip -- "/absolute/path/to/your-notion-export.zip"
```

5. 서버 실행

```bash
npm run dev
```

6. 텔레그램 발송 테스트

```bash
curl -X POST http://localhost:8787/jobs/send-session \
  -H "x-sync-api-key: YOUR_SYNC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"session":"am","user_id":"default-user"}'
```

업데이트가 필요할 때마다 `ZIP 다시 export -> import:zip 다시 실행`만 하면 됩니다.

LLM으로 한번 정제해서 고정 소스를 쓰려면:
- `/Users/kimhoechang/Documents/codex/docs/NO_API_CURATION_FLOW.md`

## 3) 로컬 실행 (API 방식 포함)

```bash
cp .env.example .env
export DATABASE_URL='postgresql://...'
./scripts/setup_local.sh
```

서버 시작:

```bash
npm run dev
```

기존 DB를 사용 중이면(업데이트 사용자):

```bash
psql "$DATABASE_URL" -f /Users/kimhoechang/Documents/codex/sql/migrations/001_add_focus_tags.sql
```

## 3) 필수 환경변수

- `DATABASE_URL`
- `SYNC_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_CHAT_ID`

Notion API 자동수집을 쓸 때만 추가:

- `NOTION_TOKEN`
- `NOTION_ROOT_PAGE_IDS` (쉼표 구분)

이메일 사용 시 추가:

- `EMAIL_SMTP_HOST`
- `EMAIL_SMTP_PORT`
- `EMAIL_SMTP_USER`
- `EMAIL_SMTP_PASS`
- `EMAIL_FROM`
- `EMAIL_TO`

## 4) 엔드포인트 사용 예시

### Notion 동기화

```bash
curl -X POST http://localhost:8787/sync/notion \
  -H "x-sync-api-key: YOUR_KEY"
```

### ZIP fallback 동기화 (원격 API로 넣을 때)

로컬 `import:zip`가 더 쉽습니다. 이 API는 서버 원격 호출용입니다.

### PDF 매핑 입력

```bash
curl -X POST http://localhost:8787/sync/pdf-mapping \
  -H "x-sync-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "rows":[
      {"pageId":"NOTION_PAGE_ID_1","driveFileId":"GOOGLE_DRIVE_FILE_ID_1","title":"Cardiology Episode 1"}
    ]
  }'
```

### 세션 발송 트리거

```bash
curl -X POST http://localhost:8787/jobs/send-session \
  -H "x-sync-api-key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"session":"am","user_id":"default-user"}'
```

### 과목 선호도 설정

```bash
curl -X POST http://localhost:8787/preferences \
  -H "Content-Type: application/json" \
  -d '{
    "user_id":"default-user",
    "preferred_subjects":["Cardiology","Pulmonology"],
    "daily_total":12,
    "am_count":6,
    "pm_count":6
  }'
```

## 5) GitHub Actions 스케줄러

`.github/workflows` 포함:

- `weekly-sync.yml`
  - 매주 월요일 07:00 KST 근처(UTC 22:00 Sunday) 동기화
- `daily-send.yml`
  - 매일 07:00 / 21:00 KST 발송

GitHub Secrets에 아래를 넣으세요:

- `API_BASE_URL`
- `SYNC_API_KEY`

## 6) Telegram 웹훅 연결

서버가 외부에서 접근 가능할 때:

```bash
export TELEGRAM_BOT_TOKEN=...
export PUBLIC_BASE_URL=https://YOUR_PUBLIC_BASE_URL
./scripts/set_telegram_webhook.sh
```

## 7) 빠른 운영 루틴 (수동 ZIP 기준)

1. 상위 페이지 1개 export (subpages 포함)
2. `npm run import:zip -- <zip-path>` 실행
3. `/sync/pdf-mapping`으로 Notion pageId <-> Drive fileId 매핑 업로드
4. `scripts/seed_preferences.sh`로 과목 우선순위 설정
5. 발송 트리거 또는 자동 스케줄 실행

## 8) 현재 MVP 제한

- PDF 페이지 내 정확 하이라이트 좌표는 아직 미구현 (MVP-2 대상)
- 퀴즈는 recap 텍스트 기반 생성형 규칙 엔진(혼합형)으로 시작
- Notion episode/section 추출은 제목 패턴 기반 휴리스틱
