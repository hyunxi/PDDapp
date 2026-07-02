// Email notifier via Resend (https://resend.com) — Vercel-native, simple SDK.

import { Resend } from "resend";
import { Alert, Notifier, alertBody, alertSubject } from "./types";

export class EmailNotifier implements Notifier {
  readonly name = "email";
  private readonly client: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
    private readonly to: string,
  ) {
    this.client = new Resend(apiKey);
  }

  async send(alert: Alert): Promise<void> {
    const { error } = await this.client.emails.send({
      from: this.from,
      to: this.to,
      subject: alertSubject(alert),
      text: alertBody(alert),
    });
    if (error) {
      throw new Error(`resend error: ${error.message}`);
    }
  }
}
