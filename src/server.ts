import express from "express";
import { config } from "./config.js";
import { buildChunks } from "./chunker.js";
import {
  getUserPreference,
  getContext,
  pickWeightedFeed,
  registerFeedback,
  searchChunks,
  saveDailyPlan,
  upsertChunks,
  upsertPdfMapping,
  upsertUserPreference
} from "./db.js";
import { syncFromNotion } from "./notion.js";
import { writeObsidianDigest, writeObsidianSearchDigest } from "./obsidian.js";
import { buildAdaptiveQuiz } from "./quiz.js";
import { answerCallback, sendTelegramFeed, sendTelegramText } from "./telegram.js";
import { startScheduler } from "./scheduler.js";
import { parseZipFallback } from "./zip-fallback.js";

const app = express();
app.use(express.json({ limit: "50mb" }));

function requireSyncKey(req: express.Request, res: express.Response, next: express.NextFunction): void {
  const apiKey = req.header("x-sync-api-key");
  if (apiKey !== config.syncApiKey) {
    res.status(401).json({ error: "unauthorized" });
    return;
  }
  next();
}

function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function splitMix(slotCount: number): { transcriptCount: number; recapCount: number } {
  const transcriptCount = Math.max(1, Math.round(slotCount * (2 / 3)));
  const recapCount = Math.max(1, slotCount - transcriptCount);
  return { transcriptCount, recapCount };
}

async function runSessionJob(userId: string, session: "am" | "pm", sendTelegram = false): Promise<{ count: number; obsidianPath: string | null }> {
  const pref = await getUserPreference(userId);
  const sessionSlots = session === "am" ? pref.amCount : pref.pmCount;
  const { transcriptCount, recapCount } = splitMix(sessionSlots);
  const items = await pickWeightedFeed(userId, transcriptCount, recapCount, pref.preferredSubjects);
  const obsidianPath = await writeObsidianDigest(items, session, config.obsidianVaultDir, config.obsidianDailyFolder);
  if (obsidianPath) {
    await sendTelegramText("오늘의 리뷰가 도착했습니다");
  }
  if (sendTelegram) await sendTelegramFeed(items);
  return { count: items.length, obsidianPath };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

app.post("/sync/notion", requireSyncKey, async (_req, res) => {
  try {
    if (!config.notionToken || !config.notionRootPageIds.length) {
      res.status(400).json({ error: "notion env not configured" });
      return;
    }
    const lines = await syncFromNotion(config.notionRootPageIds, config.notionToken);
    const chunks = buildChunks(lines);
    const inserted = await upsertChunks(chunks);
    res.json({ ok: true, lines: lines.length, chunks: inserted });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/sync/fallback-zip", requireSyncKey, async (req, res) => {
  try {
    const zipBase64 = req.body?.zip_base64;
    if (!zipBase64 || typeof zipBase64 !== "string") {
      res.status(400).json({ error: "zip_base64 required" });
      return;
    }
    const lines = parseZipFallback(zipBase64);
    const chunks = buildChunks(lines);
    const inserted = await upsertChunks(chunks);
    res.json({ ok: true, lines: lines.length, chunks: inserted });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/sync/pdf-mapping", requireSyncKey, async (req, res) => {
  try {
    const rows = req.body?.rows;
    if (!Array.isArray(rows)) {
      res.status(400).json({ error: "rows array required" });
      return;
    }
    await upsertPdfMapping(rows);
    res.json({ ok: true, count: rows.length });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/daily-feed", async (req, res) => {
  try {
    const userId = String(req.query.user_id ?? config.defaultUserId);
    const session = req.query.session === "pm" ? "pm" : "am";
    const pref = await getUserPreference(userId);
    const sessionSlots = session === "am" ? pref.amCount : pref.pmCount;
    const { transcriptCount, recapCount } = splitMix(sessionSlots);
    const items = await pickWeightedFeed(userId, transcriptCount, recapCount, pref.preferredSubjects);
    await saveDailyPlan({
      userId,
      date: todayKst(),
      session,
      slots: transcriptCount + recapCount,
      transcriptCount,
      recapCount
    });
    res.json({ ok: true, session, count: items.length, items });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/feedback", async (req, res) => {
  try {
    const userId = String(req.body?.user_id ?? config.defaultUserId);
    const chunkId = String(req.body?.chunk_id ?? "");
    const action = String(req.body?.action ?? "");
    if (!chunkId || !["more", "less", "mastered", "correct", "wrong"].includes(action)) {
      res.status(400).json({ error: "invalid payload" });
      return;
    }
    await registerFeedback(userId, chunkId, action);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/preferences", async (req, res) => {
  try {
    const userId = String(req.query.user_id ?? config.defaultUserId);
    const pref = await getUserPreference(userId);
    res.json({ ok: true, preference: pref });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/preferences", async (req, res) => {
  try {
    const userId = String(req.body?.user_id ?? config.defaultUserId);
    const preferredSubjects = Array.isArray(req.body?.preferred_subjects)
      ? req.body.preferred_subjects.map((v: unknown) => String(v))
      : [];
    const dailyTotal = Number(req.body?.daily_total ?? 12);
    const amCount = Number(req.body?.am_count ?? 6);
    const pmCount = Number(req.body?.pm_count ?? 6);
    if (amCount + pmCount !== dailyTotal) {
      res.status(400).json({ error: "am_count + pm_count must equal daily_total" });
      return;
    }
    await upsertUserPreference({
      userId,
      preferredSubjects,
      dailyTotal,
      amCount,
      pmCount
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get("/context/:chunkId", async (req, res) => {
  try {
    const item = await getContext(req.params.chunkId);
    if (!item) {
      res.status(404).json({ error: "not found" });
      return;
    }
    const driveUrl = item.driveFileId ? `${config.googleDriveBaseUrl}/${item.driveFileId}/view` : null;
    res.json({
      ok: true,
      item,
      context: {
        path: item.sectionPath.join(" > "),
        drive_url: driveUrl,
        anchor: item.sourceAnchor,
        source_page: item.sourcePage
      }
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/jobs/send-session", requireSyncKey, async (req, res) => {
  try {
    const userId = String(req.body?.user_id ?? config.defaultUserId);
    const session = req.body?.session === "pm" ? "pm" : "am";
    const sendTelegram = req.body?.send_telegram === true;
    const result = await runSessionJob(userId, session, sendTelegram);
    res.json({ ok: true, sent: result.count, obsidian_path: result.obsidianPath, telegram_sent: sendTelegram });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/jobs/export-search", requireSyncKey, async (req, res) => {
  try {
    const query = String(req.body?.query ?? "").trim();
    const limit = Number(req.body?.limit ?? 20);
    if (!query) {
      res.status(400).json({ error: "query required" });
      return;
    }
    const items = await searchChunks(query, limit);
    const path = await writeObsidianSearchDigest(query, items, config.obsidianVaultDir, config.obsidianSearchFolder);
    res.json({ ok: true, query, count: items.length, obsidian_path: path });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post("/telegram/webhook", async (req, res) => {
  try {
    const callback = req.body?.callback_query;
    const message = req.body?.message;
    if (!callback && !message) {
      res.json({ ok: true });
      return;
    }
    if (message?.text && typeof message.text === "string") {
      const text = message.text.trim();
      const isSearch = text.startsWith("/search ") || text.startsWith("/find ");
      if (isSearch) {
        const q = text.replace(/^\/(search|find)\s+/i, "").trim();
        if (q) {
          const items = await searchChunks(q, 20);
          const path = await writeObsidianSearchDigest(q, items, config.obsidianVaultDir, config.obsidianSearchFolder);
          await sendTelegramText(`Saved to Obsidian\nquery: ${q}\ncount: ${items.length}\n${path ?? ""}`);
        } else {
          await sendTelegramText("Usage: /search pneumonia");
        }
      }
      res.json({ ok: true });
      return;
    }
    if (!callback) {
      res.json({ ok: true });
      return;
    }
    const data = String(callback.data ?? "");
    const callbackQueryId = String(callback.id);
    const userId = String(callback.from?.id ?? config.defaultUserId);

    if (data.startsWith("fb:")) {
      const [, action, chunkId] = data.split(":");
      if (chunkId && action) {
        await registerFeedback(userId, chunkId, action);
        await answerCallback(callbackQueryId, `Recorded: ${action}`);
      }
    } else if (data.startsWith("ctx:")) {
      const [, chunkId] = data.split(":");
      const ctx = await getContext(chunkId);
      if (ctx?.driveFileId) {
        const path = ctx.sectionPath.join(" > ");
        await sendTelegramText(`Context: ${path}\n${config.googleDriveBaseUrl}/${ctx.driveFileId}/view`);
      } else {
        await sendTelegramText("PDF mapping is missing for this chunk.");
      }
      await answerCallback(callbackQueryId, "Opened context");
    } else if (data.startsWith("quiz:")) {
      const [, chunkId] = data.split(":");
      const ctx = await getContext(chunkId);
      if (ctx) {
        const isRecap = ctx.chunkType === "recap_summary" || ctx.chunkType === "recap_quiz_seed";
        if (!isRecap) {
          await sendTelegramText("퀴즈는 Rapid Fire Recap 청크에서만 제공됩니다.");
        } else {
          const quiz = buildAdaptiveQuiz(ctx.text);
          if (!quiz.length) {
            await sendTelegramText("Quiz seed too short. Showing summary only.");
            await sendTelegramText(ctx.text.slice(0, 500));
          } else {
            for (const item of quiz) {
              const choices = item.choices?.map((v) => `- ${v}`).join("\n");
              const body = choices ? `${item.prompt}\n${choices}` : item.prompt;
              await sendTelegramText(`${body}\n\n정답: ${item.answer}`);
            }
          }
        }
      }
      await answerCallback(callbackQueryId, "Quiz generated");
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(config.port, () => {
  console.log(`USMLE bot API listening on :${config.port}`);
  startScheduler(async (session) => {
    await runSessionJob(config.defaultUserId, session, false);
  });
});
