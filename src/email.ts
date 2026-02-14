import nodemailer from "nodemailer";
import { config } from "./config.js";
import { FeedItem } from "./db.js";

function enabled(): boolean {
  return Boolean(config.smtpHost && config.smtpUser && config.smtpPass && config.emailFrom && config.emailTo);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function removeImageLines(text: string): string {
  return text
    .split("\n")
    .filter((v) => !/^!\[[^\]]*\]\([^)]+\)\s*$/i.test(v.trim()))
    .join("\n");
}

function extractTableLines(text: string): string[] {
  if (!/\|\s*---\s*\|/.test(text)) return [];
  return text.split("\n").filter((v) => v.includes("|")).map((v) => v.trim()).filter(Boolean);
}

function summarizeTable(tableLines: string[]): string[] {
  if (tableLines.length < 3) return [];
  const data = tableLines.slice(2);
  const bullets: string[] = [];
  for (const row of data.slice(0, 6)) {
    const cells = row.split("|").map((v) => v.trim()).filter(Boolean);
    if (cells.length >= 2) bullets.push(`${cells[0]}: ${cells.slice(1).join(" / ")}`);
  }
  return bullets;
}

function markdownTableToHtml(tableLines: string[]): string {
  if (tableLines.length < 2) return "";
  const headerCells = tableLines[0].split("|").map((v) => v.trim()).filter(Boolean);
  const bodyRows = tableLines.slice(2).map((row) => row.split("|").map((v) => v.trim()).filter(Boolean));
  const thead = `<tr>${headerCells.map((c) => `<th style="border:1px solid #ddd;padding:6px;">${escapeHtml(c)}</th>`).join("")}</tr>`;
  const tbody = bodyRows
    .map((cells) => `<tr>${cells.map((c) => `<td style="border:1px solid #ddd;padding:6px;">${escapeHtml(c)}</td>`).join("")}</tr>`)
    .join("");
  return `<table style="border-collapse:collapse;margin-top:8px;margin-bottom:8px;">${thead}${tbody}</table>`;
}

export async function sendEmailDigest(items: FeedItem[], session: "am" | "pm"): Promise<void> {
  if (!enabled() || !items.length) return;
  const transporter = nodemailer.createTransport({
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    }
  });

  const html = [
    `<h2>USMLE Step2 Daily Digest (${session})</h2>`,
    ...items.map((item) => {
      const cleaned = removeImageLines(item.text);
      const tableLines = extractTableLines(cleaned);
      const tableSummary = summarizeTable(tableLines);
      const tableHtml = markdownTableToHtml(tableLines.slice(0, 10));
      const textOnly = tableLines.length
        ? cleaned
            .split("\n")
            .filter((v) => !v.includes("|"))
            .join("\n")
        : cleaned;
      const summaryHtml =
        tableSummary.length > 0
          ? `<ul>${tableSummary.map((v) => `<li>${escapeHtml(v)}</li>`).join("")}</ul>`
          : "";
      return `<div style="margin-bottom:16px;">
        <strong>${escapeHtml(item.subject)}</strong><br/>
        <small>${escapeHtml(item.sectionPath.join(" > "))}</small>
        <p>${escapeHtml(textOnly.slice(0, 700)).replace(/\n/g, "<br/>")}</p>
        ${summaryHtml}
        ${tableHtml}
      </div>`;
    })
  ].join("\n");

  await transporter.sendMail({
    from: config.emailFrom,
    to: config.emailTo,
    subject: `[USMLE Bot] ${session.toUpperCase()} Session`,
    html
  });
}
