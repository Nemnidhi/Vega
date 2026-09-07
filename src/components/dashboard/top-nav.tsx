"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Bell, ChevronDown, Menu, Plus, Search } from "lucide-react";
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

function initials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function DashboardTopNav({ role, userLabel }: DashboardTopNavProps) {
  const pathname = usePathname();
  const navItems = getDashboardNavItems(role);
  const [mobileNavAnchorPath, setMobileNavAnchorPath] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
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
    setUserMenuOpen(false);
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
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-vega-accent text-sm font-bold text-white lg:hidden">
          V
        </div>
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
          <Link
            href="/leads"
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-vega-accent px-4 text-[13px] font-medium text-white transition-colors hover:bg-vega-accent-hover"
          >
            <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            <span className="hidden sm:inline">New</span>
          </Link>

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
              <div className="absolute right-0 top-12 z-50 w-80 overflow-hidden rounded-lg border border-vega-border bg-[#0a141f] shadow-[0_16px_36px_rgba(0,0,0,0.35)]">
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

          <div className="relative">
            <button
              type="button"
              aria-expanded={userMenuOpen}
              aria-label="Account menu"
              onClick={() => {
                setNotificationsOpen(false);
                setUserMenuOpen((value) => !value);
              }}
              className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-1 transition-colors hover:bg-vega-surface-hover lg:pr-2"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-vega-accent text-xs font-semibold text-white">
                {initials(userLabel)}
              </span>
              <span className="hidden min-w-0 text-left lg:block">
                <span className="block max-w-40 truncate text-[13px] font-medium leading-4 text-vega-text">{userLabel}</span>
                <span className="block truncate text-[11px] capitalize leading-4 text-vega-text-muted">
                  {role.replaceAll("_", " ")}
                </span>
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-vega-text-muted" strokeWidth={1.8} aria-hidden="true" />
            </button>
            {userMenuOpen ? (
              <div className="absolute right-0 top-12 z-50 w-52 overflow-hidden rounded-lg border border-vega-border bg-[#0a141f] p-1 shadow-[0_16px_36px_rgba(0,0,0,0.35)]">
                <Link
                  href="/account"
                  onClick={() => setUserMenuOpen(false)}
                  className="block rounded-md px-3 py-2 text-[13px] font-medium text-vega-text-secondary transition-colors hover:bg-vega-surface-hover hover:text-vega-text"
                >
                  Account
                </Link>
                <PageRefreshButton />
                <LogoutButton
                  showIcon
                  className="h-9 w-full justify-start gap-2 border-transparent bg-transparent px-3 text-[13px] font-medium text-vega-text-muted shadow-none hover:bg-vega-surface-hover hover:text-vega-text"
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div
        id={mobileNavId}
        className={cn(
          "overflow-hidden transition-all duration-200 lg:hidden",
          isMobileNavOpen ? "mt-3 max-h-[72dvh] pb-3 opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <nav className="no-scrollbar grid max-h-[68dvh] gap-1.5 overflow-y-auto overscroll-contain rounded-lg border border-vega-border bg-vega-surface-1 p-2">
          {navItems.map((item) => {
            const isActive = isDashboardNavItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavAnchorPath(null)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150",
                  isActive
                    ? "bg-vega-accent text-white"
                    : "bg-vega-surface-2 text-vega-text-secondary hover:bg-vega-surface-hover hover:text-vega-text",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
