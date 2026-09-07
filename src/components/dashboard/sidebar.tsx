"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  CalendarDays,
  CircleHelp,
  Clock3,
  House,
  LayoutGrid,
  MessageCircle,
  MessageSquareText,
  Package,
  PanelLeft,
  Settings,
  SquareCheckBig,
  Tag,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  getDashboardNavGroup,
  isDashboardNavItemActive,
  type DashboardNavGroup,
} from "@/components/dashboard/nav-items";
import type { UserRole } from "@/types/user";

interface DashboardSidebarProps {
  role: UserRole;
}

const iconMap = {
  Dashboard: House,
  Chat: MessageCircle,
  Leads: User,
  Clients: Building2,
  Tasks: SquareCheckBig,
  Meetings: Users,
  Calendar: CalendarDays,
  Attendance: Clock3,
  Team: Users,
  Queries: MessageSquareText,
  "Pricing Catalog": Tag,
  "Pricing Packages": Package,
  Industries: LayoutGrid,
  "Pricing Tiers": BarChart3,
  Account: Settings,
} as const;

const groupHeadings: Array<{ group: DashboardNavGroup; heading: string }> = [
  { group: "main", heading: "Main" },
  { group: "team", heading: "Team" },
  { group: "pricing", heading: "Pricing" },
];

export function DashboardSidebar({ role }: DashboardSidebarProps) {
  const pathname = usePathname();

  function navLink(item: { label: string; href: string }) {
    const isActive = isDashboardNavItemActive(pathname, item.href);
    const Icon = iconMap[item.label as keyof typeof iconMap] ?? House;

    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "group flex h-[38px] items-center gap-3 rounded-lg px-3 text-[13px] font-medium transition-colors duration-150",
          isActive
            ? "bg-vega-accent text-white"
            : "text-vega-text-secondary hover:bg-vega-surface-hover hover:text-vega-text",
        )}
      >
        <Icon
          className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-white" : "text-vega-text-muted group-hover:text-vega-text-secondary")}
          strokeWidth={1.8}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
      </Link>
    );
  }

  const settingsItems = getDashboardNavGroup(role, "settings");

  return (
    <aside className="hidden h-screen w-[250px] shrink-0 border-r border-vega-border-soft bg-vega-sidebar text-vega-text lg:sticky lg:top-0 lg:flex lg:overflow-y-auto">
      <div className="flex min-h-full w-full flex-col">
        <div className="flex h-[62px] shrink-0 items-center gap-2.5 px-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-vega-accent text-sm font-bold text-white">
            V
          </span>
          <span className="min-w-0 flex-1 truncate text-xl font-semibold leading-6 text-vega-text">Vega</span>
          <button
            type="button"
            aria-label="Toggle navigation"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-vega-text-muted transition-colors hover:bg-vega-surface-hover hover:text-vega-text"
          >
            <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        <nav className="flex-1 space-y-6 px-3 pb-4">
          {groupHeadings.map(({ group, heading }) => {
            const items = getDashboardNavGroup(role, group);
            if (items.length === 0) return null;

            return (
              <div key={group} className="space-y-1">
                <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-vega-text-dim">
                  {heading}
                </p>
                {items.map(navLink)}
              </div>
            );
          })}

          <div className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-vega-text-dim">
              Settings
            </p>
            {settingsItems.map(navLink)}
            <Link
              href="/account#settings"
              className="group flex h-[38px] items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-vega-text-secondary transition-colors duration-150 hover:bg-vega-surface-hover hover:text-vega-text"
            >
              <Settings className="h-[18px] w-[18px] shrink-0 text-vega-text-muted group-hover:text-vega-text-secondary" strokeWidth={1.8} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">Settings</span>
            </Link>
            <Link
              href="/queries"
              className="group flex h-[38px] items-center gap-3 rounded-lg px-3 text-[13px] font-medium text-vega-text-secondary transition-colors duration-150 hover:bg-vega-surface-hover hover:text-vega-text"
            >
              <CircleHelp className="h-[18px] w-[18px] shrink-0 text-vega-text-muted group-hover:text-vega-text-secondary" strokeWidth={1.8} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">Help &amp; Support</span>
            </Link>
          </div>
        </nav>
      </div>
    </aside>
  );
}
