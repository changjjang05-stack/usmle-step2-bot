# Setup Checklist (One-time)

## A. Notion Integration

1. Notion `Settings & members` -> `Connections` -> `Develop or manage integrations`
2. New integration 생성 후 `Internal Integration Token` 복사
3. 학습용 루트 페이지에서 `...` -> `Connections` -> 생성한 integration 연결
4. 루트 페이지 ID 복사
5. `.env` 설정
   - `NOTION_TOKEN=...`
   - `NOTION_ROOT_PAGE_IDS=<root_page_id_1>,<root_page_id_2>`

## B. Telegram

1. Telegram `@BotFather`에서 봇 생성
2. 토큰 발급 후 `.env`의 `TELEGRAM_BOT_TOKEN`에 입력
3. 본인 chat id 확인 후 `.env`의 `TELEGRAM_CHAT_ID` 입력
4. 배포 URL 확보 후:
   - `export TELEGRAM_BOT_TOKEN=...`
   - `export PUBLIC_BASE_URL=https://...`
   - `./scripts/set_telegram_webhook.sh`

## C. Database

1. Supabase 프로젝트 생성
2. Connection string을 `.env`의 `DATABASE_URL`에 입력
3. 스키마 적용:
   - `export DATABASE_URL=...`
   - `./scripts/setup_local.sh`

## D. PDF Mapping

1. Google Drive 공유 폴더에 PDF 업로드
2. Notion pageId와 Drive fileId를 짝지어 `/sync/pdf-mapping` 호출

## E. Scheduler

1. GitHub repo secrets 설정:
   - `API_BASE_URL`
   - `SYNC_API_KEY`
2. Actions 활성화 후 `weekly-sync`, `daily-send` 확인
