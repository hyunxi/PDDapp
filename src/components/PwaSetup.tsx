"use client";

import { useEffect, useState } from "react";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function PwaSetup() {
  const [deferred, setDeferred] = useState<{ prompt: () => void; userChoice: Promise<unknown> } | null>(
    null,
  );
  const [subscribed, setSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [isIOS, setIsIOS] = useState(false);
  const [standalone, setStandalone] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((e) => console.error("SW registration failed", e));
    }

    const ua = window.navigator.userAgent;
    setIsIOS(/iphone|ipad|ipod/i.test(ua));
    setStandalone(
      window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true,
    );

    const pushSupported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (!pushSupported) {
      setPermission("unsupported");
    } else {
      setPermission(Notification.permission);
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((s) => setSubscribed(!!s))
        .catch(() => {});
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as unknown as { prompt: () => void; userChoice: Promise<unknown> });
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  }

  async function enableAlerts() {
    if (!VAPID) {
      setMsg("Push isn't configured on the server yet (missing VAPID key).");
      return;
    }
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setMsg("Notifications weren't allowed.");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID),
      });
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(sub),
      });
      if (!res.ok) throw new Error("server rejected the subscription");
      setSubscribed(true);
      setMsg("Alerts enabled on this device ✓");
    } catch (e) {
      console.error(e);
      setMsg("Couldn't enable alerts. " + (e instanceof Error ? e.message : ""));
    }
  }

  if (hidden) return null;

  const showInstall = !!deferred;
  const pushSupported = permission !== "unsupported";
  const canEnable =
    pushSupported && !subscribed && permission !== "denied" && !!VAPID && (!isIOS || standalone);
  const iosNeedsInstall = isIOS && !standalone && pushSupported;

  if (!showInstall && !canEnable && !iosNeedsInstall && !msg) return null;

  return (
    <div className="pwa-bar">
      <div className="pwa-bar-inner">
        {iosNeedsInstall && (
          <span className="pwa-hint">
            To get price alerts, tap <strong>Share</strong> → <strong>Add to Home Screen</strong>.
          </span>
        )}
        {msg && <span className="pwa-hint">{msg}</span>}
        <span className="pwa-actions">
          {showInstall && (
            <button className="btn btn-sm btn-primary" onClick={install}>
              Install app
            </button>
          )}
          {canEnable && (
            <button className="btn btn-sm btn-primary" onClick={enableAlerts}>
              Enable alerts
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setHidden(true)}>
            Dismiss
          </button>
        </span>
      </div>
    </div>
  );
}
