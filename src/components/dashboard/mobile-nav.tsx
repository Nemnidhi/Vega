"use client";

import { VegaLogo } from "@/components/vega-logo";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  ChevronRight,
  Clock3,
  House,
  LayoutGrid,
  MessageCircle,
  MessageSquareText,
  Package,
  Settings,
  Sparkles,
  SquareCheckBig,
  Tag,
  Target,
  User,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { LogoutButton } from "@/components/auth/logout-button";
import { getDashboardNavItems, isDashboardNavItemActive } from "@/components/dashboard/nav-items";
import type { UserRole } from "@/types/user";

const iconMap = {
  Dashboard: House,
  Chat: MessageCircle,
  Leads: User,
  "Sales Targets": Target,
  Clients: Building2,
  Tasks: SquareCheckBig,
  Meetings: Users,
  Calendar: CalendarDays,
  Attendance: Clock3,
  Salary: Wallet,
  Team: Users,
  Queries: MessageSquareText,
  "Pricing Catalog": Tag,
  "Pricing Packages": Package,
  Industries: LayoutGrid,
  "Pricing Tiers": BarChart3,
  Account: Settings,
} as const;

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  partner: "Partner",
  project_manager: "Project Manager",
  developer: "Developer",
  sales: "Sales",
  digital_marketing: "Digital Marketing",
  client: "Client",
};

function initials(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

/**
 * Phone navigation.
 *
 * The desktop sidebar is `hidden lg:flex`, so on a phone the only way around was
 * a dropdown of bare text links under the header - no icons, no grouping, and it
 * pushed the page down instead of covering it. This is a proper drawer: it slides
 * over the page, scrolls on its own, and carries the same icons as the sidebar so
 * the two read as one navigation rather than two different apps.
 */
export function MobileNav({
  role,
  userLabel,
  open,
  onClose,
}: {
  role: UserRole;
  userLabel: string;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const navItems = getDashboardNavItems(role);

  // Escape closes it, and the page behind must not scroll while it is open -
  // on a phone that is what makes a drawer feel stuck rather than layered.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  return (
    <div className={cn("lg:hidden", open ? "" : "pointer-events-none")} aria-hidden={!open}>
      <button
        type="button"
        tabIndex={-1}
        aria-label="Close menu"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-black/65 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[86vw] max-w-[320px] flex-col",
          "border-r border-vega-border bg-vega-sidebar shadow-[0_0_60px_rgba(0,0,0,0.6)]",
          "transition-transform duration-250 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-vega-border-soft px-4 py-3.5">
          <VegaLogo className="h-10 w-10 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold leading-5 text-vega-text">
              Vega
            </span>
            <span className="block truncate text-[12px] leading-4 text-vega-text-muted">
              Command Center
            </span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-vega-text-muted transition-colors hover:bg-vega-surface-hover hover:text-vega-text"
          >
            <X className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        {/* The list scrolls, not the drawer, so the account row below stays put. */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-3">
          {navItems.map((item) => {
            const isActive = isDashboardNavItemActive(pathname, item.href);
            const Icon = iconMap[item.label as keyof typeof iconMap] ?? House;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-[46px] items-center gap-3.5 rounded-xl px-3 text-[15px] font-medium transition-colors",
                  isActive
                    ? "bg-vega-accent text-white"
                    : "text-vega-text-secondary active:bg-vega-surface-hover",
                )}
              >
                <Icon
                  className={cn(
                    "h-[21px] w-[21px] shrink-0",
                    isActive ? "text-white" : "text-vega-text-muted",
                  )}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <ChevronRight
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    isActive ? "text-white/80" : "text-vega-text-dim",
                  )}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </Link>
            );
          })}
        </nav>

        {/* Deliberately not a link: it is a banner, and there is no page behind
            it yet. Wiring it to somewhere arbitrary would be worse than a card
            that plainly does not move. */}
        <div className="mx-3 mb-3 flex shrink-0 items-center gap-3 rounded-xl border border-vega-border bg-gradient-to-r from-[#141d33] to-[#0f1725] p-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white">
            <Sparkles className="h-5 w-5" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-vega-text">
              Make work simpler
            </span>
            <span className="block truncate text-[12px] text-vega-text-muted">
              Automate, track and grow with Vega.
            </span>
          </span>
        </div>

        <div className="shrink-0 space-y-1 border-t border-vega-border-soft px-3 py-3">
          <Link
            href="/account"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors active:bg-vega-surface-hover"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-vega-accent text-[13px] font-semibold text-white">
              {initials(userLabel)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-medium leading-5 text-vega-text">
                {userLabel}
              </span>
              <span className="block truncate text-[12px] leading-4 text-vega-text-muted">
                {ROLE_LABELS[role] ?? role}
              </span>
            </span>
            <ChevronRight className="h-[18px] w-[18px] shrink-0 text-vega-text-dim" strokeWidth={1.8} aria-hidden="true" />
          </Link>

          <LogoutButton
            showIcon
            className="h-[44px] w-full justify-start gap-3.5 rounded-xl border-transparent bg-transparent px-3 text-[15px] font-medium text-vega-text-secondary shadow-none hover:bg-vega-surface-hover hover:text-vega-text"
          />
        </div>
      </div>
    </div>
  );
}
