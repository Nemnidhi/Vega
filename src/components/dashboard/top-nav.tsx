"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Bell, ChevronDown, Menu, Plus, Search, Settings } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageRefreshButton } from "@/components/dashboard/page-refresh-button";
import {
  getDashboardNavItems,
  isDashboardNavItemActive,
} from "@/components/dashboard/nav-items";
import { cn } from "@/lib/utils/cn";
import type { UserRole } from "@/types/user";

interface DashboardTopNavProps {
  role: UserRole;
  userLabel: string;
}

type WorkflowNotification = {
  _id: string;
  title: string;
  body?: string;
  readAt?: string | null;
  createdAt?: string;
  entityId?: string;
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
  const navItems = getDashboardNavItems(role);
  const [mobileNavAnchorPath, setMobileNavAnchorPath] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<WorkflowNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsError, setNotificationsError] = useState("");
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

  return (
    <header className="sticky top-0 z-40 min-h-[56px] border-b border-vega-border-soft bg-vega-topbar px-3 text-vega-text md:min-h-[62px] sm:px-5 lg:hidden">
      <div className="flex min-h-[56px] w-full items-center justify-between gap-2 md:min-h-[62px]">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            aria-controls={mobileNavId}
            aria-expanded={isMobileNavOpen}
            onClick={() =>
              setMobileNavAnchorPath((prev) => (prev === pathname ? null : pathname))
            }
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-vega-text-secondary transition-colors hover:bg-vega-surface-hover hover:text-vega-text lg:hidden"
            aria-label={isMobileNavOpen ? "Close menu" : "Open menu"}
          >
            <Menu className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-vega-purple-border bg-vega-purple-soft text-sm font-semibold text-[#c4b5fd] md:h-9 md:w-9 md:text-[13px] lg:hidden">
            V
          </div>
          <div className="min-w-0 lg:hidden">
            <p className="truncate text-lg font-semibold leading-5 text-vega-text">Vega</p>
            <p className="max-w-[78px] truncate text-[11px] leading-3.5 text-vega-text-muted sm:max-w-none">Nemnidhi Command</p>
          </div>
          <div className="hidden h-[34px] w-[410px] max-w-[36vw] items-center gap-2 rounded-md border border-vega-border bg-[#0b141f] px-3 text-xs text-vega-text-muted md:flex">
            <Search className="h-4 w-4 shrink-0" strokeWidth={1.8} aria-hidden="true" />
            <span className="truncate">Search across Vega...</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-vega-text-secondary">
          <button
            type="button"
            className="hidden h-[34px] items-center gap-2 rounded-md border border-vega-border bg-transparent px-3 text-xs font-medium transition-colors duration-150 hover:border-vega-purple-border hover:bg-vega-purple-soft hover:text-vega-text md:inline-flex"
          >
            <Plus className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
            Quick Create
          </button>
          <button
            type="button"
            aria-label="Settings"
            className="hidden h-[34px] w-[34px] items-center justify-center rounded-md border border-vega-border bg-vega-surface-1 transition-colors duration-150 hover:bg-vega-surface-hover hover:text-vega-text md:inline-flex"
          >
            <Settings className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
          </button>
          <div className="relative">
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={notificationsOpen}
              onClick={() => void markNotificationsRead()}
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-vega-text-secondary transition-colors duration-150 hover:bg-vega-surface-hover hover:text-vega-text md:h-[34px] md:w-[34px] md:border md:border-vega-border md:bg-vega-surface-1"
            >
              <Bell className="h-5 w-5 md:h-4 md:w-4" strokeWidth={1.8} aria-hidden="true" />
              {unreadCount > 0 ? (
                <span className="absolute right-0 top-0 min-w-4 rounded-full bg-vega-red px-1 text-[9px] font-semibold leading-4 text-white md:-right-1 md:-top-1">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </button>
            {notificationsOpen ? (
              <div className="absolute right-0 top-10 z-50 w-80 overflow-hidden rounded-md border border-vega-border bg-[#0a141f] shadow-[0_16px_36px_rgba(0,0,0,0.35)]">
                <div className="border-b border-vega-border-soft px-3 py-2">
                  <p className="text-xs font-semibold text-vega-text">Notifications</p>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notificationsError ? (
                    <p className="px-3 py-4 text-xs text-vega-red">{notificationsError}</p>
                  ) : notifications.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-vega-text-muted">No workflow notifications yet.</p>
                  ) : (
                    notifications.map((item) => (
                      <Link
                        key={item._id}
                        href={item.entityId ? `/tasks/${item.entityId}` : pathname}
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
              </div>
            ) : null}
          </div>
          <div className="hidden h-8 w-px bg-vega-border-soft md:block" aria-hidden="true" />
          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-vega-border bg-vega-surface-2 text-[11px] font-semibold text-vega-text">
              {userLabel.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="max-w-36 truncate text-xs font-medium text-vega-text">{userLabel}</p>
              <p className="truncate text-[10px] capitalize leading-4 text-vega-text-muted">
                {role.replaceAll("_", " ")}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-vega-text-muted" strokeWidth={1.8} aria-hidden="true" />
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-vega-purple text-xs font-semibold text-white md:hidden">
            {userLabel.slice(0, 2).toUpperCase()}
          </div>
          <ChevronDown className="h-4 w-4 text-vega-text-muted md:hidden" strokeWidth={1.8} aria-hidden="true" />
          <LogoutButton className="hidden md:inline-flex" />
        </div>
      </div>

      <div
        id={mobileNavId}
        className={cn(
          "overflow-hidden transition-all duration-200 lg:hidden",
          isMobileNavOpen ? "mt-3 max-h-[72dvh] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <nav className="no-scrollbar grid max-h-[68dvh] gap-1.5 overflow-y-auto overscroll-contain rounded-md border border-vega-border bg-vega-surface-1 p-2">
          {navItems.map((item) => {
            const isActive = isDashboardNavItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavAnchorPath(null)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md border px-3 py-2.5 text-sm font-medium transition-all duration-150",
                  isActive
                    ? "border-vega-purple-border bg-vega-purple-soft text-[#c4b5fd]"
                    : "border-vega-border-soft bg-vega-surface-2 text-vega-text-secondary hover:bg-vega-surface-hover hover:text-vega-text",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <div className="mt-1 border-t border-vega-border-soft pt-1">
            <PageRefreshButton />
          </div>
        </nav>
      </div>
    </header>
  );
}
