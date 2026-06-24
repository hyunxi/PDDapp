// Fan-out manager that dispatches an alert to every enabled channel. A failure
// in one channel never prevents the others, and never propagates out of
// dispatch() — alerting must not crash the monitor.

import { config } from "../config";
import { ConsoleNotifier } from "./console";
import { EmailNotifier } from "./email";
import { WebPushNotifier } from "./push";
import { WebhookNotifier } from "./webhook";
import { Alert, Notifier } from "./types";

export class NotifierManager {
  constructor(private readonly notifiers: Notifier[]) {}

  get channelNames(): string[] {
    return this.notifiers.map((n) => n.name);
  }

  /** Send `alert` to all channels; return the names that succeeded. */
  async dispatch(alert: Alert): Promise<string[]> {
    const results = await Promise.allSettled(
      this.notifiers.map(async (n) => {
        await n.send(alert);
        return n.name;
      }),
    );
    const delivered: string[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        delivered.push(r.value);
      } else {
        console.error(`Notifier ${this.notifiers[i].name} failed:`, r.reason);
      }
    });
    return delivered;
  }
}

/** Build a manager from configuration, enabling only what's turned on. */
export function buildDefaultManager(): NotifierManager {
  const notifiers: Notifier[] = [new ConsoleNotifier()];

  if (config.vapidPublicKey && config.vapidPrivateKey) {
    notifiers.push(new WebPushNotifier());
  }
  if (config.alertWebhookUrl) {
    notifiers.push(new WebhookNotifier(config.alertWebhookUrl));
  }
  if (config.resendApiKey && config.alertEmailTo) {
    notifiers.push(
      new EmailNotifier(config.resendApiKey, config.alertEmailFrom, config.alertEmailTo),
    );
  }
  return new NotifierManager(notifiers);
}

export * from "./types";
