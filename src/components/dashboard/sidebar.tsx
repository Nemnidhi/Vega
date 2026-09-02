"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronLeft,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  LayoutDashboard,
  MessageSquareText,
  PackageSearch,
  ReceiptText,
  Settings,
  Target,
  Users,
  Workflow,
} from "lucide-react";
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

  return (
    <aside className="hidden h-screen w-[218px] shrink-0 border-r border-vega-border-soft bg-vega-sidebar text-vega-text lg:sticky lg:top-0 lg:flex lg:overflow-y-auto">
      <div className="flex min-h-full w-full flex-col">
        <div className="border-b border-vega-border-soft px-3 pb-4 pt-5">
          <div className="flex min-h-16 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-vega-purple-border bg-vega-purple-soft text-[13px] font-semibold text-[#c4b5fd]">
              V
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[27px] font-semibold leading-7 text-vega-text">Vega</h1>
              <p className="truncate text-[10px] leading-4 text-vega-text-muted">
                Nemnidhi Command Center
              </p>
            </div>
          </div>
        </div>

        <nav className="space-y-1 px-2 py-3">
          {navItems.map((item, index) => {
            const isActive = isDashboardNavItemActive(pathname, item.href);
            const Icon = iconMap[item.label as keyof typeof iconMap] ?? LayoutDashboard;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group flex h-10 items-center gap-[11px] rounded-md border px-3 text-[13px] font-medium transition-colors duration-150",
                  isActive
                    ? "border-vega-purple-border bg-vega-purple-soft text-[#c4b5fd]"
                    : "border-transparent text-vega-text-secondary hover:border-vega-border-soft hover:bg-vega-surface-hover hover:text-vega-text",
                )}
              >
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] shrink-0",
                    isActive ? "text-vega-purple" : "text-vega-text-muted group-hover:text-vega-text-secondary",
                  )}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span
                  className={cn(
                    "font-mono text-[10px] transition-colors",
                    isActive ? "text-[#c4b5fd]/80" : "text-vega-text-dim group-hover:text-vega-text-muted",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-vega-border-soft p-2">
          <div className="mb-2 rounded-md border border-vega-border-soft bg-vega-surface-1 px-3 py-2">
            <p className="truncate text-xs font-medium text-vega-text">{userLabel}</p>
            <p className="mt-0.5 truncate text-[10px] capitalize leading-4 text-vega-text-muted">
              {role.replaceAll("_", " ")}
            </p>
          </div>
          <button
            type="button"
            className="flex h-10 w-full items-center gap-[11px] rounded-md px-3 text-[13px] font-medium text-vega-text-muted transition-colors duration-150 hover:bg-vega-surface-hover hover:text-vega-text"
          >
            <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
            <span>Collapse</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
