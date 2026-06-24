// Web Push notifier — delivers alerts to installed PWAs (home-screen apps) even
// when the app is closed. Sends to every stored subscription and prunes any that
// the push service reports as gone (404/410).

import webpush from "web-push";
import { config } from "../config";
import { prisma } from "../db";
import { Alert, Notifier, alertSubject } from "./types";

let configured = false;

function ensureConfigured() {
  if (!configured) {
    webpush.setVapidDetails(
      config.vapidSubject,
      config.vapidPublicKey,
      config.vapidPrivateKey,
    );
    configured = true;
  }
}

export class WebPushNotifier implements Notifier {
  readonly name = "push";

  async send(alert: Alert): Promise<void> {
    ensureConfigured();
    const subs = await prisma.pushSubscription.findMany();
    if (subs.length === 0) return;

    const payload = JSON.stringify({
      title: alertSubject(alert),
      body: `Threshold ${alert.currency}${alert.thresholdPrice.toFixed(2)} · ${alert.goodsId}`,
      url: alert.url || "/",
      tag: `pdd-${alert.goodsId}`,
    });

    const stale: string[] = [];
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
        } catch (err: unknown) {
          const status = (err as { statusCode?: number })?.statusCode;
          if (status === 404 || status === 410) {
            stale.push(s.endpoint);
          } else {
            console.error("web-push send failed:", err);
          }
        }
      }),
    );

    if (stale.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { endpoint: { in: stale } } });
    }
  }
}
