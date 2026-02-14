import { queueSyncFailure } from "./db.js";
import { config } from "./config.js";
import { NotionLine } from "./types.js";

const NOTION_API = "https://api.notion.com/v1";
const NOTION_VERSION = "2022-06-28";

type NotionBlock = {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: unknown;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function notionFetch(path: string, token: string, init?: RequestInit, retry = 0): Promise<any> {
  const res = await fetch(`${NOTION_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  if (!res.ok) {
    if ((res.status === 429 || res.status >= 500) && retry < 4) {
      await sleep((retry + 1) * 1500);
      return notionFetch(path, token, init, retry + 1);
    }
    const body = await res.text();
    throw new Error(`Notion API error ${res.status}: ${body}`);
  }
  return res.json();
}

function richTextToString(node: unknown): string {
  if (!node || typeof node !== "object") return "";
  const rich = (node as any).rich_text;
  if (!Array.isArray(rich)) return "";
  return rich.map((r: any) => r?.plain_text ?? "").join("").trim();
}

function extractBlockText(block: NotionBlock): string {
  const t = block.type;
  const value = (block as any)[t];
  if (!value || typeof value !== "object") return "";

  if ("rich_text" in value) return richTextToString(value);
  if ("caption" in value && Array.isArray(value.caption)) {
    return value.caption.map((r: any) => r?.plain_text ?? "").join("").trim();
  }
  if ("title" in value && Array.isArray(value.title)) {
    return value.title.map((r: any) => r?.plain_text ?? "").join("").trim();
  }
  return "";
}

async function listChildren(blockId: string, token: string): Promise<NotionBlock[]> {
  let cursor = "";
  let hasMore = true;
  const results: NotionBlock[] = [];

  while (hasMore) {
    const qs = cursor ? `?page_size=100&start_cursor=${encodeURIComponent(cursor)}` : "?page_size=100";
    const data = await notionFetch(`/blocks/${blockId}/children${qs}`, token);
    results.push(...(data.results ?? []));
    hasMore = Boolean(data.has_more);
    cursor = data.next_cursor ?? "";
  }
  return results;
}

async function pageTitle(pageId: string, token: string): Promise<string> {
  const page = await notionFetch(`/pages/${pageId}`, token);
  const properties = page.properties ?? {};
  for (const key of Object.keys(properties)) {
    const prop = properties[key];
    if (prop?.type === "title" && Array.isArray(prop.title)) {
      return prop.title.map((r: any) => r.plain_text ?? "").join("").trim() || `Page-${pageId.slice(0, 8)}`;
    }
  }
  return `Page-${pageId.slice(0, 8)}`;
}

interface TraverseState {
  subject: string;
  pageTitle: string;
  episode: string;
  sectionPath: string[];
}

export async function syncFromNotion(rootPageIds: string[], token: string): Promise<NotionLine[]> {
  const lines: NotionLine[] = [];
  const visitedPages = new Set<string>();

  async function walkPage(pageId: string, state?: TraverseState): Promise<void> {
    if (visitedPages.has(pageId)) return;
    visitedPages.add(pageId);

    try {
      const currentTitle = await pageTitle(pageId, token);
      const subject = state?.subject ?? currentTitle;
      const pageState: TraverseState = {
        subject,
        pageTitle: currentTitle,
        episode: state?.episode ?? currentTitle,
        sectionPath: [subject, currentTitle]
      };
      const blocks = await listChildren(pageId, token);
      await walkBlocks(blocks, pageId, pageState);
    } catch (err) {
      await queueSyncFailure(pageId, (err as Error).message);
    }
  }

  async function walkBlocks(blocks: NotionBlock[], pageId: string, state: TraverseState): Promise<void> {
    for (const block of blocks) {
      let sectionPath = [...state.sectionPath];
      let episode = state.episode;

      if (block.type === "heading_1" || block.type === "heading_2" || block.type === "heading_3") {
        const heading = extractBlockText(block);
        if (heading) {
          sectionPath = [...state.sectionPath.slice(0, 2), heading];
          episode = config.episodeHeadingRegex.test(heading) ? heading : state.episode;
        }
      }

      if (block.type === "child_page") {
        const childTitle = (block as any).child_page?.title ?? "Child Page";
        await walkPage(block.id, {
          subject: state.subject,
          pageTitle: childTitle,
          episode: childTitle,
          sectionPath: [...state.sectionPath, childTitle]
        });
      }

      const text = extractBlockText(block);
      if (text) {
        lines.push({
          text,
          pageId,
          subject: state.subject,
          pageTitle: state.pageTitle,
          episode,
          sectionPath,
          isRecap: sectionPath.some((v) => config.recapHeadingRegex.test(v)),
          sourceAnchor: block.id
        });
      }

      if (block.has_children && block.type !== "child_page") {
        const childBlocks = await listChildren(block.id, token);
        await walkBlocks(childBlocks, pageId, {
          ...state,
          episode,
          sectionPath
        });
      }
    }
  }

  for (const pageId of rootPageIds) {
    await walkPage(pageId);
  }

  return lines;
}
