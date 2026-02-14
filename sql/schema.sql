CREATE TABLE IF NOT EXISTS content_chunks (
  id TEXT PRIMARY KEY,
  chunk_type TEXT NOT NULL CHECK (chunk_type IN ('transcript_chunk', 'recap_summary', 'recap_quiz_seed')),
  text TEXT NOT NULL,
  subject TEXT NOT NULL,
  focus_area TEXT NOT NULL DEFAULT '',
  tags TEXT[] NOT NULL DEFAULT '{}',
  page_title TEXT NOT NULL,
  episode TEXT NOT NULL,
  section_path TEXT[] NOT NULL DEFAULT '{}',
  source_doc_id TEXT NOT NULL,
  source_page INTEGER NULL,
  source_anchor TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_state (
  user_id TEXT NOT NULL,
  chunk_id TEXT NOT NULL REFERENCES content_chunks(id) ON DELETE CASCADE,
  show_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  confidence NUMERIC(4,3) NOT NULL DEFAULT 0.5,
  weight_delta NUMERIC(4,3) NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NULL,
  mastered_until TIMESTAMPTZ NULL,
  PRIMARY KEY (user_id, chunk_id)
);

CREATE TABLE IF NOT EXISTS daily_plans (
  user_id TEXT NOT NULL,
  plan_date DATE NOT NULL,
  session TEXT NOT NULL CHECK (session IN ('am', 'pm')),
  slots INTEGER NOT NULL,
  transcript_count INTEGER NOT NULL,
  recap_count INTEGER NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, plan_date, session)
);

CREATE TABLE IF NOT EXISTS source_documents (
  page_id TEXT PRIMARY KEY,
  drive_file_id TEXT NOT NULL,
  title TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sync_failures (
  id BIGSERIAL PRIMARY KEY,
  page_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  preferred_subjects TEXT[] NOT NULL DEFAULT '{}',
  daily_total INTEGER NOT NULL DEFAULT 12,
  am_count INTEGER NOT NULL DEFAULT 6,
  pm_count INTEGER NOT NULL DEFAULT 6,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_chunks_type ON content_chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_content_chunks_subject ON content_chunks(subject);
CREATE INDEX IF NOT EXISTS idx_learning_state_user ON learning_state(user_id);
