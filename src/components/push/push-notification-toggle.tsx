"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/** VAPID keys travel as base64url; PushManager wants raw bytes. */
function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

/**
 * Chrome stops showing the permission prompt for good once a user has dismissed
 * it a few times, and that state is not recoverable from inside the page. So the
 * automatic ask on app open is budgeted: after this many dismissals we stop
 * asking and leave the bell as the way in, which keeps the permission reachable.
 */
const AUTO_PROMPT_BUDGET = 2;
const AUTO_PROMPT_KEY = "hrms:push-auto-prompts";

function autoPromptsUsed() {
  try {
    return Number(window.localStorage.getItem(AUTO_PROMPT_KEY) ?? "0") || 0;
  } catch {
    // Private window or blocked storage: we cannot count, so do not auto-ask.
    return AUTO_PROMPT_BUDGET;
  }
}

function setAutoPromptsUsed(count: number) {
  try {
    window.localStorage.setItem(AUTO_PROMPT_KEY, String(count));
  } catch {
    // Nothing to do - the budget just will not persist.
  }
}

type State = "checking" | "unsupported" | "off" | "on" | "blocked" | "needs-install";

/**
 * iOS only delivers Web Push to a PWA opened from the Home Screen - a Safari tab
 * gets nothing, and PushManager is not even defined there. Without this check the
 * component silently rendered nothing on an iPhone, so there was no way to learn
 * that installing is the missing step.
 */
function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari's own, non-standard flag - the only reliable signal on iOS.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export function PushNotificationToggle({
  className,
  /**
   * Renders the control inside a labelled row. The label lives here rather than
   * at the call site so the two disappear together - this component returns null
   * on a browser that cannot do push, and a caller-supplied label would other-
   * wise be left sitting there with nothing beside it.
   */
  label,
  hint,
}: {
  className?: string;
  label?: string;
  hint?: string;
}) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // On iOS this is the normal state in a browser tab, and it is fixable by
        // installing - so say so instead of hiding.
        if (!cancelled) setState(isIOS() && !isStandalone() ? "needs-install" : "unsupported");
        return;
      }

      if (isIOS() && !isStandalone()) {
        if (!cancelled) setState("needs-install");
        return;
      }

      try {
        // updateViaCache: "none" keeps a stale cached worker from surviving a deploy.
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        // Browsers only check for a new worker on their own schedule, which on an
        // installed PWA that is resumed rather than relaunched can be a very long
        // time - so a deploy that changes sw.js would keep being handled by the
        // old one. Asking explicitly on every open makes a deploy actually land.
        void registration.update().catch(() => {
          // Offline or the check failed; the existing worker keeps running.
        });

        const existing = await registration.pushManager.getSubscription();
        if (cancelled) return;

        if (Notification.permission === "denied") {
          setState("blocked");
          return;
        }
        // A subscription can outlive the server row it was saved as (database
        // restored from backup, user re-registered elsewhere). Re-post it so the
        // two stay in step; it upserts.
        if (existing) {
          void fetch("/api/push/subscribe", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(existing.toJSON()),
          });
        }
        setState(existing ? "on" : "off");
      } catch (e) {
        if (!cancelled) {
          setState("off");
          setError(e instanceof Error ? e.message : "Could not set up notifications.");
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  const enable = useCallback(async ({ auto = false } = {}) => {
    setBusy(true);
    setError("");
    try {
      // Safari and Firefox only honour this inside a user gesture, so the
      // automatic ask is best-effort there and the bell remains the real path.
      // Chrome shows it on load, which is what makes the auto-prompt work.
      const permission = await Notification.requestPermission();
      if (permission === "denied") {
        setState("blocked");
        return;
      }
      if (permission !== "granted") return;

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
        ),
      });

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        // Don't leave a live browser subscription pointing at a server that has
        // no row for it - it would push nothing and look silently broken.
        await subscription.unsubscribe();
        throw new Error(payload?.error?.message ?? "Could not save the subscription.");
      }

      setAutoPromptsUsed(0);
      setState("on");
    } catch (e) {
      // A refused auto-ask is an expected outcome, not something to shout about.
      if (!auto) setError(e instanceof Error ? e.message : "Could not enable notifications.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Ask on first open instead of waiting for the bell to be noticed. Deliberately
  // after a short delay: a prompt thrown over a still-blank screen reads as spam
  // and gets dismissed, and every dismissal spends the budget above.
  useEffect(() => {
    if (state !== "off" || Notification.permission !== "default") return;

    const used = autoPromptsUsed();
    if (used >= AUTO_PROMPT_BUDGET) return;

    const timer = setTimeout(() => {
      setAutoPromptsUsed(used + 1);
      void enable({ auto: true });
    }, 1500);
    return () => clearTimeout(timer);
  }, [state, enable]);

  const disable = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState("off");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not turn notifications off.");
    } finally {
      setBusy(false);
    }
  }, []);

  if (state === "checking" || state === "unsupported") return null;

  if (state === "needs-install") {
    return (
      <button
        type="button"
        onClick={() => setShowInstallHelp((open) => !open)}
        aria-label="How to turn on notifications on iPhone"
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-md text-vega-text-secondary transition hover:bg-vega-surface-hover",
          className,
        )}
      >
        <BellOff className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        {showInstallHelp ? (
          <span className="absolute right-0 top-11 z-50 w-64 rounded-lg border border-vega-border bg-[#0a141f] p-3 text-left shadow-xl">
            <span className="block text-xs font-semibold text-vega-text">Turn on notifications</span>
            <span className="mt-1 block text-[11px] leading-relaxed text-vega-text-muted">
              On iPhone, notifications only work once this app is on your Home Screen.
              Tap Share, then <strong className="text-vega-text">Add to Home Screen</strong>,
              open it from there, and tap this bell again. Needs iOS 16.4 or newer.
            </span>
          </span>
        ) : null}
      </button>
    );
  }

  const description =
    state === "blocked"
      ? "Notifications blocked - allow them in browser settings"
      : state === "on"
        ? "Chat notifications on - tap to turn off"
        : "Turn on chat notifications";

  const Icon = busy ? Loader2 : state === "on" ? BellRing : state === "blocked" ? BellOff : Bell;

  const control = (
    <button
      type="button"
      disabled={busy || state === "blocked"}
      onClick={() => void (state === "on" ? disable() : enable())}
      title={error || description}
      aria-label={description}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md transition",
        state === "on"
          ? "text-vega-accent hover:bg-vega-surface-hover"
          : "text-vega-text-secondary hover:bg-vega-surface-hover",
        state === "blocked" && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <Icon className={cn("h-5 w-5", busy && "animate-spin")} strokeWidth={1.8} aria-hidden="true" />
    </button>
  );

  if (!label) return control;

  return (
    <span className="flex items-center justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-[11px] font-medium text-vega-text">{label}</span>
        {hint ? <span className="block text-[10px] text-vega-text-muted">{hint}</span> : null}
      </span>
      {control}
    </span>
  );
}
