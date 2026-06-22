// Centralized access to environment configuration.

export const config = {
  currencySymbol: process.env.CURRENCY_SYMBOL || "¥",
  defaultFetcher: process.env.DEFAULT_FETCHER || "mock",
  cronSecret: process.env.CRON_SECRET || "",

  resendApiKey: process.env.RESEND_API_KEY || "",
  alertEmailFrom: process.env.ALERT_EMAIL_FROM || "PDDapp <onboarding@resend.dev>",
  alertEmailTo: process.env.ALERT_EMAIL_TO || "",

  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || "",
};
