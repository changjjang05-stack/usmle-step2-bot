import AdmZip from "adm-zip";
import { NotionLine } from "./types.js";

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseZipFallback(zipBase64: string): NotionLine[] {
  const zip = new AdmZip(Buffer.from(zipBase64, "base64"));
  const lines: NotionLine[] = [];

  const walkZip = (current: AdmZip): void => {
    const entries = current.getEntries();
    for (const entry of entries) {
      if (entry.isDirectory) continue;
      const lower = entry.entryName.toLowerCase();

      if (lower.endsWith(".zip")) {
        const nested = new AdmZip(entry.getData());
        walkZip(nested);
        continue;
      }

      if (!lower.endsWith(".md") && !lower.endsWith(".html")) continue;
      const raw = entry.getData().toString("utf8");
      const text = lower.endsWith(".html") ? stripHtml(raw) : raw;
      const name = entry.entryName.split("/").pop() ?? entry.entryName;
      const pageTitle = name.replace(/\.(md|html)$/i, "");
      const chunks = text.split(/\n{2,}/).map((v) => v.trim()).filter(Boolean);
      for (let i = 0; i < chunks.length; i += 1) {
        const content = chunks[i];
        const lowerContent = content.toLowerCase();
        lines.push({
          text: content,
          pageId: pageTitle,
          subject: pageTitle.split("-")[0]?.trim() || pageTitle,
          pageTitle,
          episode: pageTitle,
          sectionPath: [pageTitle],
          isRecap: lowerContent.includes("rapid fire recap") || lowerContent.includes("recap"),
          sourceAnchor: `${pageTitle}-${i + 1}`
        });
      }
    }
  };

  walkZip(zip);

  return lines;
}
