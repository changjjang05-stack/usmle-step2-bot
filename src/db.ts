import { Pool } from "pg";
import { config } from "./config.js";
import { ContentChunk, DailyPlan, UserPreference } from "./types.js";

export const pool = new Pool({ connectionString: config.databaseUrl });

export async function upsertChunks(chunks: ContentChunk[]): Promise<number> {
  if (!chunks.length) return 0;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const chunk of chunks) {
      await client.query(
        `
        INSERT INTO content_chunks (
          id, chunk_type, text, subject, focus_area, tags, page_title, episode, section_path,
          source_doc_id, source_page, source_anchor
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        ON CONFLICT (id) DO UPDATE SET
          chunk_type = EXCLUDED.chunk_type,
          text = EXCLUDED.text,
          subject = EXCLUDED.subject,
          focus_area = EXCLUDED.focus_area,
          tags = EXCLUDED.tags,
          page_title = EXCLUDED.page_title,
          episode = EXCLUDED.episode,
          section_path = EXCLUDED.section_path,
          source_doc_id = EXCLUDED.source_doc_id,
          source_page = EXCLUDED.source_page,
          source_anchor = EXCLUDED.source_anchor,
          updated_at = NOW()
      `,
        [
          chunk.id,
          chunk.chunkType,
          chunk.text,
          chunk.subject,
          chunk.focusArea,
          chunk.tags,
          chunk.pageTitle,
          chunk.episode,
          chunk.sectionPath,
          chunk.sourceDocId,
          chunk.sourcePage,
          chunk.sourceAnchor
        ]
      );
    }
    await client.query("COMMIT");
    return chunks.length;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function upsertPdfMapping(rows: Array<{ pageId: string; driveFileId: string; title?: string }>): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      await client.query(
        `
        INSERT INTO source_documents (page_id, drive_file_id, title)
        VALUES ($1,$2,$3)
        ON CONFLICT (page_id) DO UPDATE SET
          drive_file_id = EXCLUDED.drive_file_id,
          title = COALESCE(EXCLUDED.title, source_documents.title),
          updated_at = NOW()
      `,
        [row.pageId, row.driveFileId, row.title ?? null]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export interface FeedItem {
  id: string;
  chunkType: string;
  text: string;
  subject: string;
  focusArea: string;
  tags: string[];
  pageTitle: string;
  episode: string;
  sectionPath: string[];
  sourceDocId: string;
  sourcePage: number | null;
  sourceAnchor: string | null;
  effectiveWeight: number;
}

export async function pickWeightedFeed(
  userId: string,
  transcriptCount: number,
  recapCount: number,
  subjectFilter: string[] = []
): Promise<FeedItem[]> {
  const query = `
    WITH base AS (
      SELECT
        c.id,
        c.chunk_type,
        c.text,
        c.subject,
        c.focus_area,
        c.tags,
        c.page_title,
        c.episode,
        c.section_path,
        c.source_doc_id,
        c.source_page,
        c.source_anchor,
        COALESCE(ls.weight_delta, 0) AS delta,
        COALESCE(ls.mastered_until < NOW(), true) AS active,
        COALESCE(ls.confidence, 0) AS confidence
      FROM content_chunks c
      LEFT JOIN learning_state ls
        ON ls.chunk_id = c.id
        AND ls.user_id = $1
    ),
    scored AS (
      SELECT
        *,
        GREATEST(0.1, 1 + delta + (1 - confidence)) AS effective_weight
      FROM base
      WHERE active = true
      AND NOT ('exclude-feed' = ANY(COALESCE(tags, ARRAY[]::text[])))
      AND (
        CARDINALITY($3::text[]) = 0
        OR subject = ANY($3::text[])
      )
    )
    SELECT
      id, chunk_type, text, subject, focus_area, tags, page_title, episode, section_path,
      source_doc_id, source_page, source_anchor, effective_weight
    FROM scored
    ORDER BY RANDOM() * effective_weight DESC
    LIMIT $2
  `;

  const total = transcriptCount + recapCount;
  const { rows } = await pool.query(query, [userId, total * 8, subjectFilter]);

  const transcript: FeedItem[] = [];
  const recap: FeedItem[] = [];
  for (const row of rows) {
    const item: FeedItem = {
      id: row.id,
      chunkType: row.chunk_type,
      text: row.text,
      subject: row.subject,
      focusArea: row.focus_area,
      tags: row.tags ?? [],
      pageTitle: row.page_title,
      episode: row.episode,
      sectionPath: row.section_path,
      sourceDocId: row.source_doc_id,
      sourcePage: row.source_page,
      sourceAnchor: row.source_anchor,
      effectiveWeight: Number(row.effective_weight)
    };
    if (item.chunkType === "transcript_chunk") transcript.push(item);
    else recap.push(item);
  }

  return [...transcript.slice(0, transcriptCount), ...recap.slice(0, recapCount)];
}

export async function getUserPreference(userId: string): Promise<UserPreference> {
  const { rows } = await pool.query(
    `
    SELECT user_id, preferred_subjects, daily_total, am_count, pm_count
    FROM user_preferences
    WHERE user_id = $1
  `,
    [userId]
  );
  if (!rows[0]) {
    return {
      userId,
      preferredSubjects: [],
      dailyTotal: 12,
      amCount: 6,
      pmCount: 6
    };
  }
  return {
    userId: rows[0].user_id,
    preferredSubjects: rows[0].preferred_subjects ?? [],
    dailyTotal: Number(rows[0].daily_total ?? 12),
    amCount: Number(rows[0].am_count ?? 6),
    pmCount: Number(rows[0].pm_count ?? 6)
  };
}

export async function upsertUserPreference(pref: UserPreference): Promise<void> {
  await pool.query(
    `
    INSERT INTO user_preferences (user_id, preferred_subjects, daily_total, am_count, pm_count)
    VALUES ($1,$2,$3,$4,$5)
    ON CONFLICT (user_id) DO UPDATE SET
      preferred_subjects = EXCLUDED.preferred_subjects,
      daily_total = EXCLUDED.daily_total,
      am_count = EXCLUDED.am_count,
      pm_count = EXCLUDED.pm_count,
      updated_at = NOW()
  `,
    [pref.userId, pref.preferredSubjects, pref.dailyTotal, pref.amCount, pref.pmCount]
  );
}

export async function registerFeedback(userId: string, chunkId: string, action: string): Promise<void> {
  const deltaMap: Record<string, number> = {
    more: 0.4,
    less: -0.4,
    correct: -0.2,
    wrong: 0.35
  };
  const delta = deltaMap[action] ?? 0;
  const masteredUntil =
    action === "mastered" ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) : null;

  await pool.query(
    `
    INSERT INTO learning_state (
      user_id, chunk_id, show_count, correct_count, confidence, weight_delta, last_seen_at, mastered_until
    )
    VALUES (
      $1, $2, 1, CASE WHEN $3 = 'correct' THEN 1 ELSE 0 END,
      CASE WHEN $3 = 'correct' THEN 0.65 WHEN $3 = 'wrong' THEN 0.2 ELSE 0.5 END,
      $4, NOW(), $5
    )
    ON CONFLICT (user_id, chunk_id) DO UPDATE SET
      show_count = learning_state.show_count + 1,
      correct_count = learning_state.correct_count + CASE WHEN $3 = 'correct' THEN 1 ELSE 0 END,
      confidence = LEAST(
        0.99,
        GREATEST(
          0.05,
          learning_state.confidence + CASE WHEN $3 = 'correct' THEN 0.06 WHEN $3 = 'wrong' THEN -0.08 ELSE 0 END
        )
      ),
      weight_delta = learning_state.weight_delta + $4,
      last_seen_at = NOW(),
      mastered_until = COALESCE($5, learning_state.mastered_until)
  `,
    [userId, chunkId, action, delta, masteredUntil]
  );
}

export async function saveDailyPlan(plan: DailyPlan): Promise<void> {
  await pool.query(
    `
    INSERT INTO daily_plans (user_id, plan_date, session, slots, transcript_count, recap_count)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (user_id, plan_date, session) DO UPDATE SET
      slots = EXCLUDED.slots,
      transcript_count = EXCLUDED.transcript_count,
      recap_count = EXCLUDED.recap_count,
      updated_at = NOW()
  `,
    [plan.userId, plan.date, plan.session, plan.slots, plan.transcriptCount, plan.recapCount]
  );
}

export async function getContext(chunkId: string): Promise<{
  id: string;
  chunkType: string;
  text: string;
  subject: string;
  focusArea: string;
  tags: string[];
  pageTitle: string;
  episode: string;
  sectionPath: string[];
  sourceDocId: string;
  sourcePage: number | null;
  sourceAnchor: string | null;
  driveFileId: string | null;
} | null> {
  const { rows } = await pool.query(
    `
    SELECT
      c.id,
      c.chunk_type,
      c.text,
      c.subject,
      c.focus_area,
      c.tags,
      c.page_title,
      c.episode,
      c.section_path,
      c.source_doc_id,
      c.source_page,
      c.source_anchor,
      sd.drive_file_id
    FROM content_chunks c
    LEFT JOIN source_documents sd
      ON sd.page_id = c.source_doc_id
    WHERE c.id = $1
  `,
    [chunkId]
  );
  if (!rows[0]) return null;
  return {
    id: rows[0].id,
    chunkType: rows[0].chunk_type,
    text: rows[0].text,
    subject: rows[0].subject,
    focusArea: rows[0].focus_area,
    tags: rows[0].tags ?? [],
    pageTitle: rows[0].page_title,
    episode: rows[0].episode,
    sectionPath: rows[0].section_path,
    sourceDocId: rows[0].source_doc_id,
    sourcePage: rows[0].source_page,
    sourceAnchor: rows[0].source_anchor,
    driveFileId: rows[0].drive_file_id ?? null
  };
}

export async function queueSyncFailure(pageId: string, reason: string): Promise<void> {
  await pool.query(
    `
    INSERT INTO sync_failures (page_id, reason)
    VALUES ($1, $2)
  `,
    [pageId, reason]
  );
}

export async function searchChunks(query: string, limit = 20): Promise<FeedItem[]> {
  const q = query.trim();
  if (!q) return [];
  const { rows } = await pool.query(
    `
    SELECT
      id, chunk_type, text, subject, focus_area, tags, page_title, episode, section_path,
      source_doc_id, source_page, source_anchor,
      1::float AS effective_weight
    FROM content_chunks
    WHERE
      subject ILIKE $1
      OR focus_area ILIKE $1
      OR page_title ILIKE $1
      OR episode ILIKE $1
      OR text ILIKE $1
    ORDER BY updated_at DESC
    LIMIT $2
  `,
    [`%${q}%`, Math.max(1, Math.min(100, limit))]
  );
  return rows.map((row) => ({
    id: row.id,
    chunkType: row.chunk_type,
    text: row.text,
    subject: row.subject,
    focusArea: row.focus_area,
    tags: row.tags ?? [],
    pageTitle: row.page_title,
    episode: row.episode,
    sectionPath: row.section_path,
    sourceDocId: row.source_doc_id,
    sourcePage: row.source_page,
    sourceAnchor: row.source_anchor,
    effectiveWeight: Number(row.effective_weight)
  }));
}
