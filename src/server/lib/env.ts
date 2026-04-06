const env = {
  appEncryptionKey: process.env.APP_ENCRYPTION_KEY ?? "development-key-32-characters-min",
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:3000",
  authAllowDemoLogin: process.env.AUTH_ALLOW_DEMO_LOGIN !== "false",
  authBootstrapAdminEmails: (process.env.AUTH_BOOTSTRAP_ADMIN_EMAILS ?? "owner@local.test")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
  inviteTtlHours: Number(process.env.INVITE_TTL_HOURS ?? "168"),
  openAiApiKey: process.env.OPENAI_API_KEY,
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  syncStaleAfterHours: Number(process.env.SYNC_STALE_AFTER_HOURS ?? "24"),
  wbUseMock: process.env.WB_USE_MOCK !== "false",
  wbApiBaseUrl: process.env.WB_API_BASE_URL,
  dailySyncSecret: process.env.WB_DAILY_SYNC_SECRET ?? "change-me",
  errorTrackingWebhookUrl: process.env.ERROR_TRACKING_WEBHOOK_URL
};

export { env };
