// Centralized access to environment configuration.

export const config = {
  currencySymbol: process.env.CURRENCY_SYMBOL || "¥",
  defaultFetcher: process.env.DEFAULT_FETCHER || "mock",
  cronSecret: process.env.CRON_SECRET || "",

  resendApiKey: process.env.RESEND_API_KEY || "",
  alertEmailFrom: process.env.ALERT_EMAIL_FROM || "PDDapp <onboarding@resend.dev>",
  alertEmailTo: process.env.ALERT_EMAIL_TO || "",

  alertWebhookUrl: process.env.ALERT_WEBHOOK_URL || "",

  // Web Push (VAPID). The public key is also exposed to the browser via
  // NEXT_PUBLIC_VAPID_PUBLIC_KEY (same value). The private key stays server-side.
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "",
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY || "",
  vapidSubject: process.env.VAPID_SUBJECT || "mailto:alerts@pddapp.local",
};

