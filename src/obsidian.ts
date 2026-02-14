import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { FeedItem } from "./db.js";

function todayKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function sanitizeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
}

function toSectionPath(item: FeedItem): string {
  return item.sectionPath.join(" > ");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function extractTableLines(text: string): string[] {
  if (!/\|\s*---\s*\|/.test(text)) return [];
  return text.split("\n").filter((v) => v.includes("|")).map((v) => v.trim()).filter(Boolean);
}

function markdownTableToHtml(tableLines: string[]): string {
  if (tableLines.length < 2) return "";
  const headerCells = tableLines[0].split("|").map((v) => v.trim()).filter(Boolean);
  const bodyRows = tableLines.slice(2).map((row) => row.split("|").map((v) => v.trim()).filter(Boolean));
  if (!headerCells.length) return "";
  const thead = `<tr>${headerCells.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>`;
  const tbody = bodyRows
    .map((cells) => `<tr>${cells.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table>${thead}${tbody}</table>`;
}

function buildItemMarkdown(item: FeedItem): string {
  const tableLines = extractTableLines(item.text);
  const tableHtml = markdownTableToHtml(tableLines.slice(0, 24));
  const textOnly = tableLines.length
    ? item.text
        .split("\n")
        .filter((v) => !v.includes("|"))
        .join("\n")
        .trim()
    : item.text.trim();
  const lines = [
    `### ${item.subject} | ${item.focusArea || "General"}`,
    `- Path: ${toSectionPath(item)}`,
    `- Episode: ${item.episode || "-"}`,
    `- Type: ${item.chunkType}`,
    `- Chunk ID: ${item.id}`,
    item.sourcePage ? `- Source Page: ${item.sourcePage}` : "",
    item.sourceAnchor ? `- Source Anchor: ${item.sourceAnchor}` : "",
    "",
    textOnly,
    tableHtml ? "\n[Table HTML]\n" : "",
    tableHtml,
    ""
  ].filter(Boolean);
  return lines.join("\n");
}

export async function writeObsidianDigest(
  items: FeedItem[],
  session: "am" | "pm",
  vaultDir: string,
  folder = "USMLE/Daily"
): Promise<string | null> {
  if (!vaultDir || !items.length) return null;

  const date = todayKst();
  const baseDir = path.join(vaultDir, folder);
  await mkdir(baseDir, { recursive: true });
  const filePath = path.join(baseDir, sanitizeFileName(`${date}-${session}.md`));

  const header = [
    `# USMLE Step2 Daily (${session.toUpperCase()})`,
    "",
    `- Date: ${date}`,
    `- Total: ${items.length}`,
    "",
    "## Content",
    ""
  ].join("\n");

  const body = items.map((item) => buildItemMarkdown(item)).join("\n---\n\n");
  await writeFile(filePath, `${header}${body}\n`, "utf8");
  return filePath;
}

export async function writeObsidianSearchDigest(
  query: string,
  items: FeedItem[],
  vaultDir: string,
  folder = "USMLE/Search"
): Promise<string | null> {
  if (!vaultDir) return null;
  const date = todayKst();
  const baseDir = path.join(vaultDir, folder);
  await mkdir(baseDir, { recursive: true });
  const filePath = path.join(baseDir, sanitizeFileName(`${date}-search-${query.slice(0, 40)}.md`));
  const header = [
    `# USMLE Search Result`,
    "",
    `- Date: ${date}`,
    `- Query: ${query}`,
    `- Total: ${items.length}`,
    "",
    "## Matched Chunks",
    ""
  ].join("\n");
  const body = items.map((item) => buildItemMarkdown(item)).join("\n---\n\n");
  await writeFile(filePath, `${header}${body}\n`, "utf8");
  return filePath;
}
