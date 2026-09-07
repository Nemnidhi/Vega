"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  HelpCircle,
  LayoutDashboard,
  MessageSquareText,
  PackageSearch,
  ReceiptText,
  Settings,
  Target,
  Users,
  Workflow,
} from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageRefreshButton } from "@/components/dashboard/page-refresh-button";
import { cn } from "@/lib/utils/cn";
import {
  getDashboardNavItems,
  isDashboardNavItemActive,
} from "@/components/dashboard/nav-items";
import type { UserRole } from "@/types/user";

interface DashboardSidebarProps {
  role: UserRole;
  userLabel: string;
}

export function DashboardSidebar({ role, userLabel }: DashboardSidebarProps) {
  const pathname = usePathname();
  const navItems = getDashboardNavItems(role);
  const iconMap = {
    Home: LayoutDashboard,
    Chat: MessageSquareText,
    Leads: Target,
    Queries: MessageSquareText,
    Clients: BriefcaseBusiness,
    Users,
    "Pricing Catalog": PackageSearch,
    "Pricing Packages": CircleDollarSign,
    Industries: BriefcaseBusiness,
    "Pricing Tiers": ReceiptText,
    Tasks: ClipboardList,
    Meetings: Users,
    Calendar: CalendarDays,
    Attendance: ClipboardCheck,
    Account: Settings,
    Workflow,
  } as const;
  const workspaceLabels = new Set(["Home", "Chat", "Leads", "Queries", "Clients"]);
  const teamLabels = new Set(["Users", "Tasks", "Meetings", "Calendar", "Attendance"]);
  const pricingLabels = new Set(["Pricing Catalog", "Pricing Packages", "Industries", "Pricing Tiers"]);
  const workspaceItems = navItems.filter((item) => workspaceLabels.has(item.label));
  const teamItems = navItems.filter((item) => teamLabels.has(item.label));
  const pricingItems = navItems.filter((item) => pricingLabels.has(item.label));
  const accountItem = navItems.find((item) => item.label === "Account");

  function navLink(item: (typeof navItems)[number]) {
    const isActive = isDashboardNavItemActive(pathname, item.href);
    const Icon = iconMap[item.label as keyof typeof iconMap] ?? LayoutDashboard;
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group flex h-10 items-center gap-[11px] rounded-md border-l-2 px-3 text-[13px] font-medium transition-colors",
          isActive
            ? "border-l-vega-purple bg-vega-purple-soft text-[#ddd6fe]"
            : "border-l-transparent text-vega-text-secondary hover:bg-vega-surface-hover hover:text-vega-text",
        )}
      >
        <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-vega-purple" : "text-vega-text-muted")} strokeWidth={1.8} aria-hidden="true" />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <aside className="hidden h-screen w-[232px] shrink-0 border-r border-vega-border-soft bg-vega-sidebar text-vega-text lg:sticky lg:top-0 lg:flex lg:overflow-y-auto">
      <div className="flex min-h-full w-full flex-col">
        <div className="border-b border-vega-border-soft px-4 py-3">
          <div className="flex h-10 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-vega-purple-border bg-vega-purple text-sm font-semibold text-white">
              V
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold leading-5 text-vega-text">Vega</h1>
              <p className="truncate text-[10px] leading-4 text-vega-text-muted">
                Nemnidhi Command Center
              </p>
            </div>
          </div>
        </div>

        <nav className="space-y-5 px-2 py-4">
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase text-vega-text-muted">Workspace</p>
            {workspaceItems.map(navLink)}
          </div>
          {teamItems.length > 0 ? (
            <div className="space-y-1">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase text-vega-text-muted">Team</p>
              {teamItems.map(navLink)}
            </div>
          ) : null}
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase text-vega-text-muted">Manage</p>
            {pricingItems.length > 0 ? (
              <details className="group/pricing">
                <summary className="flex h-10 cursor-pointer list-none items-center gap-[11px] rounded-md px-3 text-[13px] font-medium text-vega-text-secondary hover:bg-vega-surface-hover hover:text-vega-text">
                  <CircleDollarSign className="h-[18px] w-[18px] text-vega-text-muted" strokeWidth={1.8} aria-hidden="true" />
                  <span className="flex-1">Pricing</span>
                  <ChevronDown className="h-4 w-4 transition-transform group-open/pricing:rotate-180" aria-hidden="true" />
                </summary>
                <div className="ml-6 space-y-1 border-l border-vega-border-soft pl-2">{pricingItems.map(navLink)}</div>
              </details>
            ) : null}
            {accountItem ? navLink(accountItem) : null}
            {accountItem ? (
              <Link href="/account#settings" className="flex h-10 items-center gap-[11px] rounded-md border-l-2 border-l-transparent px-3 text-[13px] font-medium text-vega-text-secondary hover:bg-vega-surface-hover hover:text-vega-text">
                <Settings className="h-[18px] w-[18px] text-vega-text-muted" strokeWidth={1.8} aria-hidden="true" />
                Settings
              </Link>
            ) : null}
          </div>
        </nav>

        <div className="mt-auto border-t border-vega-border-soft">
          <Link href="/account" className="flex h-11 items-center gap-3 border-b border-vega-border-soft px-4 text-xs text-vega-text-muted hover:bg-vega-surface-hover hover:text-vega-text">
            <HelpCircle className="h-4 w-4" aria-hidden="true" />
            Help & Support
          </Link>
          <details className="group/user relative p-2">
            <summary className="flex cursor-pointer list-none items-center gap-3 rounded-md px-2 py-2 hover:bg-vega-surface-hover">
              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#223148] text-[11px] font-semibold text-vega-text">{userLabel.slice(0, 2).toUpperCase()}</span>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-medium text-vega-text">{userLabel}</span><span className="block truncate text-[10px] capitalize text-vega-text-muted">{role.replaceAll("_", " ")}</span></span>
              <ChevronDown className="h-4 w-4 text-vega-text-muted transition-transform group-open/user:rotate-180" aria-hidden="true" />
            </summary>
            <div className="mt-1 rounded-md border border-vega-border-soft bg-vega-surface-1 p-1">
              <PageRefreshButton />
              <LogoutButton showIcon className="h-10 w-full justify-start gap-[11px] border-transparent bg-transparent px-3 text-[13px] font-medium text-vega-text-muted shadow-none hover:bg-vega-surface-hover hover:text-vega-text" />
            </div>
          </details>
        </div>
      </div>
    </aside>
  );
}
