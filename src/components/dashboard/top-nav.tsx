"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useState } from "react";
import { LogoutButton } from "@/components/auth/logout-button";
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

export function DashboardTopNav({ role, userLabel }: DashboardTopNavProps) {
  const pathname = usePathname();
  const navItems = getDashboardNavItems(role);
  const [mobileNavAnchorPath, setMobileNavAnchorPath] = useState<string | null>(null);
  const mobileNavId = useId();
  const isMobileNavOpen = mobileNavAnchorPath === pathname;

  return (
    <header className="sticky top-3 z-50 mb-4 rounded-2xl border border-white/75 bg-white/90 p-3 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">Vega</p>
          <p className="truncate text-xs font-semibold text-foreground sm:text-sm">
            {userLabel} | {role.replaceAll("_", " ")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-controls={mobileNavId}
            aria-expanded={isMobileNavOpen}
            onClick={() =>
              setMobileNavAnchorPath((prev) => (prev === pathname ? null : pathname))
            }
            className="inline-flex h-9 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 px-3 text-xs font-semibold text-accent-strong transition-colors hover:bg-accent/18 sm:hidden"
          >
            {isMobileNavOpen ? "Close" : "Menu"}
          </button>
          <LogoutButton />
        </div>
      </div>

      <nav className="no-scrollbar mt-2 hidden gap-1.5 overflow-x-auto pb-0.5 sm:flex">
        {navItems.map((item) => {
          const isActive = isDashboardNavItemActive(pathname, item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "whitespace-nowrap rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all duration-150",
                isActive
                  ? "border-accent/45 bg-accent-soft text-accent-strong shadow-sm"
                  : "border-transparent bg-white/72 text-muted-foreground hover:border-border hover:bg-white hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div
        id={mobileNavId}
        className={cn(
          "overflow-hidden transition-all duration-200 sm:hidden",
          isMobileNavOpen ? "mt-2 max-h-[72dvh] opacity-100" : "max-h-0 opacity-0",
        )}
      >
        <nav className="no-scrollbar grid max-h-[68dvh] gap-1.5 overflow-y-auto overscroll-contain rounded-lg border border-border/80 bg-surface-soft/92 p-1.5 pr-1">
          {navItems.map((item) => {
            const isActive = isDashboardNavItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileNavAnchorPath(null)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm font-semibold transition-all duration-150",
                  isActive
                    ? "border-accent/40 bg-accent/14 text-accent-strong"
                    : "border-transparent bg-white/92 text-muted-foreground hover:border-border/80 hover:bg-white hover:text-foreground",
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
