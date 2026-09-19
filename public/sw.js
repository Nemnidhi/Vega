// Push handling for the HRMS PWA. Kept dependency-free and hand-written: the app
// has no offline/caching requirement, only notifications.

// Bumping this changes the worker's bytes, which is what makes a browser treat it
// as a new version. Handy for confirming which build a device is actually running.
const SW_VERSION = "2026-09-15.3-drawer-reply";

self.addEventListener("message", (event) => {
  if (event.data?.type === "version") {
    event.source?.postMessage({ type: "version", version: SW_VERSION });
  }
});

self.addEventListener("install", () => {
  // Take over without waiting for existing tabs to close, so a deploy that changes
  // this file starts handling pushes immediately.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "HRMS", body: event.data.text(), url: "/" };
  }

  const url = data.url || "/";

  event.waitUntil(
    (async () => {
      let clientList = [];
      try {
        clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      } catch {
        clientList = [];
      }

      // Tell any open tab a message landed so the thread updates immediately
      // rather than waiting out its poll interval.
      for (const client of clientList) {
        try {
          client.postMessage({ type: "chat-message", url });
        } catch {
          // A tab that has gone away simply never hears it.
        }
      }

      // If this conversation is already on screen and focused, the message is
      // visible the moment the line above lands - so buzzing the phone for it is
      // just noise. The notification is still shown, because userVisibleOnly
      // requires one and skipping it eventually costs the subscription; it is
      // shown silently instead.
      let target;
      try {
        target = new URL(url, self.location.origin).pathname;
      } catch {
        target = null;
      }
      const alreadyWatching = clientList.some((client) => {
        if (!client.focused || !target) return false;
        try {
          return new URL(client.url).pathname === target;
        } catch {
          return false;
        }
      });

      await self.registration.showNotification(data.title || "HRMS", {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/badge-72.png",
        tag: data.tag || undefined,
        // Chromium renders a text action as an inline reply box in the drawer.
        // Browsers without support ignore it and just show the notification.
        actions: data.replyTo
          ? [{ action: "reply", type: "text", title: "Reply", placeholder: "Message" }]
          : [],
        // With a tag set, replace the previous notification rather than stacking
        // one row per message in a fast back-and-forth.
        renotify: Boolean(data.tag) && !alreadyWatching,
        silent: alreadyWatching,
        vibrate: alreadyWatching ? undefined : [80, 40, 80],
        data: { url, replyTo: data.replyTo || null },
      });
    })(),
  );
});

/**
 * Deliver a reply typed into the notification drawer.
 *
 * The session cookie is SameSite=Lax and this is a same-origin request, so
 * credentials: "include" authenticates it as the signed-in user.
 */
async function sendDrawerReply(recipientId, message, url) {
  try {
    const response = await fetch("/api/chat/messages", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipientId, message }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.success !== true) {
      throw new Error((payload && payload.error && payload.error.message) || "HTTP " + response.status);
    }

    // Keep an open thread in step with what was just sent from the drawer.
    const clientList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientList) {
      try {
        client.postMessage({ type: "chat-message", url });
      } catch {
        // Tab went away; nothing to do.
      }
    }
  } catch (error) {
    // A reply that vanishes silently is worse than one that visibly failed - the
    // sender would believe it was delivered. Hand the text back so it is not lost.
    await self.registration.showNotification("Reply not sent", {
      body: message,
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      tag: "chat-reply-failed",
      requireInteraction: true,
      data: { url },
    });
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "reply") {
    const message = (event.reply || "").trim();
    const recipientId = event.notification.data && event.notification.data.replyTo;
    // An empty reply box is a dismissal, not a message.
    if (message && recipientId) {
      event.waitUntil(
        sendDrawerReply(recipientId, message, (event.notification.data || {}).url || "/"),
      );
    }
    return;
  }

  const target = new URL(event.notification.data?.url || "/", self.location.origin);

  // Focus an already-open tab on the same origin instead of stacking up new
  // windows every time a notification is tapped.
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (new URL(client.url).origin === target.origin && "focus" in client) {
            client.navigate(target.href);
            return client.focus();
          }
        }
        return self.clients.openWindow(target.href);
      }),
  );
});
