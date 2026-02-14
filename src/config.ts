import dotenv from "dotenv";

dotenv.config();

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.PORT ?? "8787"),
  databaseUrl: required("DATABASE_URL"),
  syncApiKey: required("SYNC_API_KEY"),
  notionToken: process.env.NOTION_TOKEN ?? "",
  notionRootPageIds: (process.env.NOTION_ROOT_PAGE_IDS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean),
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
  smtpHost: process.env.EMAIL_SMTP_HOST ?? "",
  smtpPort: Number(process.env.EMAIL_SMTP_PORT ?? "587"),
  smtpUser: process.env.EMAIL_SMTP_USER ?? "",
  smtpPass: process.env.EMAIL_SMTP_PASS ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
  emailTo: process.env.EMAIL_TO ?? "",
  obsidianVaultDir: process.env.OBSIDIAN_VAULT_DIR ?? "",
  obsidianDailyFolder: process.env.OBSIDIAN_DAILY_FOLDER ?? "USMLE/Daily",
  obsidianSearchFolder: process.env.OBSIDIAN_SEARCH_FOLDER ?? "USMLE/Search",
  schedulerEnabled: (process.env.SCHEDULER_ENABLED ?? "true").toLowerCase() === "true",
  scheduleAmKst: process.env.SCHEDULE_AM_KST ?? "07:00",
  schedulePmKst: process.env.SCHEDULE_PM_KST ?? "21:00",
  baseUrl: process.env.BASE_URL ?? "http://localhost:8787",
  googleDriveBaseUrl: process.env.GOOGLE_DRIVE_BASE_URL ?? "https://drive.google.com/file/d",
  episodeHeadingRegex: new RegExp(process.env.EPISODE_HEADING_REGEX ?? "^episode\\b", "i"),
  recapHeadingRegex: new RegExp(process.env.RECAP_HEADING_REGEX ?? "rapid fire recap", "i"),
  defaultUserId: process.env.DEFAULT_USER_ID ?? "default-user"
};
