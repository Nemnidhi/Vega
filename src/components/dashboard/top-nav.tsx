"use client";

import { VegaLogo } from "@/components/vega-logo";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Bell, Menu, Search } from "lucide-react";
import { PushNotificationToggle } from "@/components/push/push-notification-toggle";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import { PageRefreshButton } from "@/components/dashboard/page-refresh-button";
import type { UserRole } from "@/types/user";

interface DashboardTopNavProps {
  role: UserRole;
  userLabel: string;
}

/**
 * Notifications used to be task-only, so the link was built as /tasks/<entityId>.
 * They now cover leads too, and each row stores the destination it was raised
 * with - the same one its push notification opens. Rows written before that
 * field existed still have to resolve, hence the task fallback.
 */
function notificationHref(item: WorkflowNotification, fallback: string) {
  if (item.url) return item.url;
  if (item.entityType === "lead" && item.entityId) return `/leads/${item.entityId}`;
  if (item.entityId) return `/tasks/${item.entityId}`;
  return fallback;
}

type WorkflowNotification = {
  _id: string;
  title: string;
  body?: string;
  readAt?: string | null;
  createdAt?: string;
  entityId?: string;
  entityType?: "task" | "lead";
  url?: string;
};

async function fetchNotifications() {
  const response = await fetch("/api/notifications?limit=8", { cache: "no-store" });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload?.error?.message ?? "Could not load notifications.");
  }
  return payload.data as { items: WorkflowNotification[]; unreadCount: number };
}


export function DashboardTopNav({ role, userLabel }: DashboardTopNavProps) {
  const pathname = usePathname();
  const [mobileNavAnchorPath, setMobileNavAnchorPath] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<WorkflowNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsError, setNotificationsError] = useState("");
  const [clearing, setClearing] = useState(false);
  const mobileNavId = useId();
  const isMobileNavOpen = mobileNavAnchorPath === pathname;

  useEffect(() => {
    let active = true;
    fetchNotifications()
      .then((data) => {
        if (!active) return;
        setNotifications(data.items);
        setUnreadCount(data.unreadCount);
        setNotificationsError("");
      })
      .catch((error) => {
        if (!active) return;
        setNotificationsError(error instanceof Error ? error.message : "Could not load notifications.");
      });

    return () => {
      active = false;
    };
  }, []);

  async function markNotificationsRead() {
    setNotificationsOpen((value) => !value);
    if (unreadCount === 0) return;
    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readAll: true }),
      });
      if (!response.ok) return;
      setUnreadCount(0);
      setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? new Date().toISOString() })));
    } catch {
      // Non-blocking: the dropdown should still open if marking read fails.
    }
  }

  async function clearNotifications() {
    setClearing(true);
    try {
      const response = await fetch("/api/notifications", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not clear notifications.");
      setNotifications([]);
      setUnreadCount(0);
      setNotificationsError("");
    } catch (error) {
      setNotificationsError(error instanceof Error ? error.message : "Could not clear notifications.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-vega-border-soft bg-vega-topbar px-3 text-vega-text sm:px-5 lg:px-6">
      <div className="flex min-h-[56px] w-full items-center gap-2 md:min-h-[62px] lg:gap-4">
        <button
          type="button"
          aria-controls={mobileNavId}
          aria-expanded={isMobileNavOpen}
          onClick={() => setMobileNavAnchorPath((prev) => (prev === pathname ? null : pathname))}
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-vega-text-secondary transition-colors hover:bg-vega-surface-hover hover:text-vega-text lg:hidden"
          aria-label={isMobileNavOpen ? "Close menu" : "Open menu"}
        >
          <Menu className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
        </button>
        <VegaLogo className="h-10 w-10 shrink-0 lg:hidden" />
        <p className="min-w-0 truncate text-lg font-semibold leading-6 text-vega-text lg:hidden">Vega</p>

        <label className="relative hidden min-w-0 flex-1 items-center md:flex lg:max-w-[520px]">
          <Search className="pointer-events-none absolute left-3 h-4 w-4 text-vega-text-muted" strokeWidth={1.8} aria-hidden="true" />
          <input
            type="search"
            placeholder="Search anything..."
            aria-label="Search anything"
            className="h-10 w-full rounded-lg border border-vega-border bg-vega-surface-1 pl-9 pr-20 text-[13px] text-vega-text outline-none transition-colors placeholder:text-vega-text-muted focus:border-vega-accent-border"
          />
          <span className="pointer-events-none absolute right-3 flex items-center gap-1">
            <kbd className="rounded border border-vega-border bg-vega-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-vega-text-muted">Ctrl</kbd>
            <kbd className="rounded border border-vega-border bg-vega-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-vega-text-muted">K</kbd>
          </span>
        </label>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:gap-3">

          <PageRefreshButton iconOnly className="h-10 w-10" />

          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              onClick={() => void markNotificationsRead()}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-lg text-vega-text-secondary transition-colors hover:bg-vega-surface-hover hover:text-vega-text"
            >
              <Bell className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
              {unreadCount > 0 ? (
                <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-vega-red px-1 text-[9px] font-semibold leading-none text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>
            {notificationsOpen ? (
              <div className="fixed inset-x-3 top-[60px] z-50 overflow-hidden rounded-lg border border-vega-border bg-[#0a141f] shadow-[0_16px_36px_rgba(0,0,0,0.35)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-80">
                <div className="flex items-center justify-between gap-2 border-b border-vega-border-soft px-3 py-2">
                  <p className="text-xs font-semibold text-vega-text">Notifications</p>
                  {notifications.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => void clearNotifications()}
                      disabled={clearing}
                      className="rounded-md px-2 py-1 text-[11px] font-medium text-vega-text-muted transition-colors hover:bg-vega-surface-hover hover:text-vega-text disabled:opacity-50"
                    >
                      {clearing ? "Clearing..." : "Clear all"}
                    </button>
                  ) : null}
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notificationsError ? (
                    <p className="px-3 py-4 text-xs text-vega-red">{notificationsError}</p>
                  ) : notifications.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-vega-text-muted">Nothing new right now.</p>
                  ) : (
                    notifications.map((item) => (
                      <Link
                        key={item._id}
                        href={notificationHref(item, pathname)}
                        className="block border-b border-vega-border-soft px-3 py-2.5 transition-colors hover:bg-vega-surface-hover"
                        onClick={() => setNotificationsOpen(false)}
                      >
                        <p className="line-clamp-1 text-xs font-medium text-vega-text">{item.title}</p>
                        {item.body ? <p className="mt-1 line-clamp-2 text-[11px] text-vega-text-muted">{item.body}</p> : null}
                        {item.createdAt ? (
                          <p className="mt-1 text-[10px] text-vega-text-muted">{new Date(item.createdAt).toLocaleString()}</p>
                        ) : null}
                      </Link>
                    ))
                  )}
                </div>
                <div className="border-t border-vega-border-soft px-3 py-2.5">
                  <PushNotificationToggle
                    className="h-8 w-8 shrink-0"
                    label="Push to this device"
                    hint="Get these on your phone"
                  />
                </div>
              </div>
            ) : null}
          </div>

        </div>
      </div>

      <MobileNav
        role={role}
        userLabel={userLabel}
        open={isMobileNavOpen}
        onClose={() => setMobileNavAnchorPath(null)}
      />
    </header>
  );
}
