// Webhook notifier — posts JSON to a configured URL. The `content` field makes
// it work out-of-the-box with Discord and Slack incoming webhooks; structured
// fields are included for custom consumers.

import { Alert, Notifier, alertSubject } from "./types";

export class WebhookNotifier implements Notifier {
  readonly name = "webhook";

  constructor(private readonly url: string) {}

  async send(alert: Alert): Promise<void> {
    if (!this.url) return;
    const payload = {
      content: `${alertSubject(alert)}\n${alert.url}`.trim(),
      text: alertSubject(alert),
      alert,
    };
    const res = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      throw new Error(`webhook responded ${res.status}`);
    }
  }
}
