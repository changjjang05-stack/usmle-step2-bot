import { config } from "./config.js";
import { getUserPreference, pickWeightedFeed } from "./db.js";
import { writeObsidianDigest } from "./obsidian.js";

function splitMix(slotCount: number): { transcriptCount: number; recapCount: number } {
  const transcriptCount = Math.max(1, Math.round(slotCount * (2 / 3)));
  const recapCount = Math.max(1, slotCount - transcriptCount);
  return { transcriptCount, recapCount };
}

function sessionFromKstNow(): "am" | "pm" {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Seoul",
      hour: "2-digit",
      hour12: false
    }).format(new Date())
  );
  return hour < 14 ? "am" : "pm";
}

function parseSessionArg(): "am" | "pm" {
  const raw = String(process.argv[2] ?? "auto").toLowerCase();
  if (raw === "am" || raw === "pm") return raw;
  return sessionFromKstNow();
}

async function main(): Promise<void> {
  const userId = config.defaultUserId;
  const session = parseSessionArg();
  const pref = await getUserPreference(userId);
  const sessionSlots = session === "am" ? pref.amCount : pref.pmCount;
  const { transcriptCount, recapCount } = splitMix(sessionSlots);
  const items = await pickWeightedFeed(userId, transcriptCount, recapCount, pref.preferredSubjects);
  const out = await writeObsidianDigest(items, session, config.obsidianVaultDir, config.obsidianDailyFolder);
  console.log(
    JSON.stringify({
      ok: true,
      session,
      count: items.length,
      obsidian_path: out
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

