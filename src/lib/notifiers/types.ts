// The notifier interface and the Alert payload.

import { config } from "../config";

export interface Alert {
  productName: string;
  goodsId: string;
  url: string;
  price: number;
  thresholdPrice: number;
  originalPrice?: number | null;
  currency: string;
}

export interface Notifier {
  readonly name: string;
  send(alert: Alert): Promise<void>;
}

export function alertSubject(a: Alert): string {
  return `Price drop: ${a.productName} now ${a.currency}${a.price.toFixed(2)}`;
}

export function alertBody(a: Alert): string {
  const lines = [
    `${a.productName} has dropped below your threshold.`,
    "",
    `Current price:   ${a.currency}${a.price.toFixed(2)}`,
    `Your threshold:  ${a.currency}${a.thresholdPrice.toFixed(2)}`,
  ];
  if (a.originalPrice != null) {
    lines.push(`List price:      ${a.currency}${a.originalPrice.toFixed(2)}`);
  }
  lines.push(`Goods ID:        ${a.goodsId}`);
  if (a.url) lines.push(`Link:            ${a.url}`);
  return lines.join("\n");
}

export function makeAlert(input: Omit<Alert, "currency">): Alert {
  return { ...input, currency: config.currencySymbol };
}
