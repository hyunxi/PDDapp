// Console notifier — always on, zero-config. On Vercel these lines show up in
// the function's runtime logs.

import { Alert, Notifier, alertSubject } from "./types";

export class ConsoleNotifier implements Notifier {
  readonly name = "console";

  async send(alert: Alert): Promise<void> {
    console.log(`🔔 ALERT  ${alertSubject(alert)}`);
  }
}
