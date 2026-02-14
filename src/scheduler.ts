import { config } from "./config.js";

function kstNowParts(): { date: string; hm: string } {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
  const hm = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(now);
  return { date, hm };
}

export function startScheduler(runSession: (session: "am" | "pm") => Promise<void>): void {
  if (!config.schedulerEnabled) return;
  const times = [config.scheduleAmKst, config.schedulePmKst].filter(Boolean);
  const seen = new Set<string>();

  const tick = async (): Promise<void> => {
    const { date, hm } = kstNowParts();
    for (let i = 0; i < times.length; i += 1) {
      const t = times[i];
      if (hm !== t) continue;
      const session: "am" | "pm" = i === 0 ? "am" : "pm";
      const key = `${date}:${session}`;
      if (seen.has(key)) continue;
      seen.add(key);
      await runSession(session);
    }
  };

  void tick();
  setInterval(() => {
    void tick();
  }, 30_000);
}

