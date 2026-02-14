import { config } from "./config.js";
import { FeedItem } from "./db.js";

function apiUrl(method: string): string {
  return `https://api.telegram.org/bot${config.telegramBotToken}/${method}`;
}

function treePath(item: FeedItem): string {
  return item.sectionPath.join(" > ");
}

function extractTableLines(text: string): string[] {
  const lines = text.split("\n");
  const hasTable = /\|\s*---\s*\|/.test(text);
  if (!hasTable) return [];
  return lines.filter((v) => v.includes("|")).map((v) => v.trim()).filter(Boolean);
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function parseTableRows(tableLines: string[]): string[][] {
  return tableLines
    .map((line) =>
      line
        .split("|")
        .map((v) => v.trim())
        .filter(Boolean)
    )
    .filter((cells) => cells.length > 0);
}

function renderPreTable(tableLines: string[]): string {
  const rows = parseTableRows(tableLines);
  if (rows.length < 2) return "";

  const [header, ...rest] = rows;
  const dataRows = rest.filter((cells, idx) => !(idx === 0 && cells.every((v) => /^:?-{2,}:?$/.test(v))));
  const cols = Math.max(header.length, ...dataRows.map((r) => r.length));
  const widths = Array.from({ length: cols }, (_, i) => {
    const h = header[i] ?? "";
    const maxData = Math.max(0, ...dataRows.map((r) => (r[i] ?? "").length));
    return Math.max(h.length, maxData);
  });

  const fmt = (cells: string[]) =>
    cells
      .map((c, i) => (c ?? "").padEnd(widths[i], " "))
      .join(" | ")
      .trimEnd();

  const divider = widths.map((w) => "-".repeat(Math.max(3, w))).join("-+-");
  const lines = [fmt(header), divider, ...dataRows.map((r) => fmt(r))];
  return `<pre>${escapeHtml(lines.join("\n"))}</pre>`;
}

function summarizeTable(tableLines: string[]): string[] {
  if (tableLines.length < 3) return [];
  const data = tableLines.slice(2).filter((v) => v.includes("|"));
  const bullets: string[] = [];
  for (const row of data.slice(0, 5)) {
    const cells = row.split("|").map((v) => v.trim()).filter(Boolean);
    if (cells.length >= 2) bullets.push(`- ${cells[0]}: ${cells.slice(1).join(" / ")}`);
  }
  return bullets;
}

function removeImageLines(text: string): string {
  return text
    .split("\n")
    .filter((v) => !/^!\[[^\]]*\]\([^)]+\)\s*$/i.test(v.trim()))
    .join("\n");
}

export async function sendTelegramFeed(items: FeedItem[]): Promise<void> {
  if (!config.telegramBotToken || !config.telegramChatId) return;

  for (const item of items) {
    const cleaned = removeImageLines(item.text);
    const tableLines = extractTableLines(cleaned);
    const tableBullets = summarizeTable(tableLines);
    const mainText = cleaned.length > 1200 ? `${cleaned.slice(0, 1200)}...` : cleaned;
    const preTable = renderPreTable(tableLines);

    const tableSummaryHtml =
      tableBullets.length > 0
        ? ["", "<b>[Table Summary]</b>", ...tableBullets.map((v) => escapeHtml(v)), "", "<b>[Table]</b>", preTable]
            .filter(Boolean)
            .join("\n")
        : "";

    const textHtml = [
      `<b>${escapeHtml(item.subject)}</b>`,
      `${escapeHtml(treePath(item))}`,
      "",
      `${escapeHtml(mainText)}`,
      tableSummaryHtml
    ].join("\n");

    await fetch(apiUrl("sendMessage"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: config.telegramChatId,
        text: textHtml,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "More", callback_data: `fb:more:${item.id}` },
              { text: "Less", callback_data: `fb:less:${item.id}` },
              { text: "Mastered", callback_data: `fb:mastered:${item.id}` }
            ],
            [{ text: "Quiz", callback_data: `quiz:${item.id}` }, { text: "Full Context", callback_data: `ctx:${item.id}` }]
          ]
        }
      })
    });
  }
}

export async function answerCallback(callbackQueryId: string, text: string): Promise<void> {
  if (!config.telegramBotToken) return;
  await fetch(apiUrl("answerCallbackQuery"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      callback_query_id: callbackQueryId,
      text,
      show_alert: false
    })
  });
}

export async function sendTelegramText(text: string): Promise<void> {
  if (!config.telegramBotToken || !config.telegramChatId) return;
  await fetch(apiUrl("sendMessage"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: config.telegramChatId,
      text
    })
  });
}
