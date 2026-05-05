"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { getDashboardNavItems } from "@/components/dashboard/nav-items";
import type { UserRole } from "@/types/user";

interface DashboardSidebarProps {
  role: UserRole;
}

export function DashboardSidebar({ role }: DashboardSidebarProps) {
  const pathname = usePathname();
  const navItems = getDashboardNavItems(role);

  return (
    <aside className="hidden h-screen w-[300px] shrink-0 border-r border-white/10 bg-[linear-gradient(155deg,#061325_0%,#102a46_58%,#0a4f56_100%)] p-5 text-white lg:sticky lg:top-0 lg:flex lg:overflow-y-auto">
      <div className="flex min-h-full flex-col">
        <div className="mb-7 rounded-3xl border border-white/20 bg-white/8 p-5 backdrop-blur">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/70">
            HRMS
          </p>
          <h1 className="mt-2 text-2xl font-semibold leading-8">Command Center</h1>
          <p className="mt-3 inline-flex rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-wide text-white/90">
            {role.replaceAll("_", " ")}
          </p>
        </div>

        <nav className="space-y-1.5">
          {navItems.map((item, index) => {
            const isActive =
              pathname === item.href || pathname.startsWith(`${item.href}/`);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between rounded-2xl px-3.5 py-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-[linear-gradient(135deg,#159c95_0%,#1d4ed8_100%)] text-white shadow-[0_12px_25px_rgba(11,128,120,0.4)]"
                    : "text-white/75 hover:bg-white/10 hover:text-white",
                )}
              >
                <span>{item.label}</span>
                <span
                  className={cn(
                    "font-mono text-[11px] transition-colors",
                    isActive ? "text-white/90" : "text-white/45 group-hover:text-white/70",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-5">
          <div className="rounded-3xl border border-white/20 bg-white/8 p-4 backdrop-blur">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
              Security Grid
            </p>
            <p className="mt-2 text-sm leading-6 text-white/90">
              Session auth is live with role-level control and full audit traceability.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
