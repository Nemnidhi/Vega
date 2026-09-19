"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Briefcase,
  CalendarCheck,
  Check,
  ChevronRight,
  CircleCheck,
  Clock,
  Loader2,
  Mail,
  Pencil,
  Phone,
  Target,
  UserRound,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { UserProfilePayload } from "@/lib/users/profile";

const panel = "rounded-xl border border-vega-border bg-vega-surface-1";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  partner: "Partner",
  project_manager: "Project Manager",
  developer: "Developer",
  sales: "Sales",
  digital_marketing: "Digital Marketing",
  client: "Client",
};

const STATUS_TONES: Record<string, string> = {
  active: "border-vega-green/35 bg-vega-green/10 text-[#66dc91]",
  inactive: "border-vega-border bg-vega-surface-2 text-vega-text-muted",
  invited: "border-vega-accent-border bg-vega-accent-soft text-[#93c5fd]",
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

function Ring({ percent, label, sublabel }: { percent: number; label: string; sublabel: string }) {
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <div className="flex items-center gap-3.5">
      <div
        className="relative h-[68px] w-[68px] shrink-0 rounded-full"
        style={{ background: `conic-gradient(#3b82f6 ${safe}%, #1a2634 ${safe}% 100%)` }}
      >
        <div className="absolute inset-[7px] flex items-center justify-center rounded-full bg-vega-surface-1 text-[15px] font-bold text-vega-text">
          {safe}%
        </div>
      </div>
      <div className="min-w-0">
        <p className="text-[13.5px] font-semibold text-vega-text">{label}</p>
        <p className="text-[12px] text-vega-text-muted">{sublabel}</p>
      </div>
    </div>
  );
}

function Breakdown({ rows }: { rows: Array<{ label: string; value: number; tone: string }> }) {
  return (
    <ul className="mt-3 space-y-2">
      {rows.map((row) => (
        <li key={row.label} className="flex items-center gap-2.5">
          <span className={cn("h-2 w-2 shrink-0 rounded-full", row.tone)} aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate text-[13px] text-vega-text-secondary">{row.label}</span>
          <span className="shrink-0 text-[13px] font-semibold text-vega-text">{row.value}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Your own profile.
 *
 * /account was a password-request form and nothing else - to see your own
 * attendance or how your targets were tracking you had to be an admin looking at
 * you through /users/[id]. This shows a person their own record, and lets them
 * correct the parts that are theirs to correct.
 */
export function ProfileWorkspace({ data }: { data: UserProfilePayload }) {
  const router = useRouter();
  const { user, attendance, tasks, targets, activity } = data;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fullName: user.fullName,
    phone: user.phone,
    department: user.department,
  });

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message ?? "Could not save your details.");
      }
      setEditing(false);
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not save your details.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <div className={cn(panel, "relative overflow-hidden p-4 sm:p-5")}>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 -top-28 h-72 w-96 rounded-full bg-vega-accent/[0.12] blur-[80px]"
        />
        <div className="relative flex flex-wrap items-start gap-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-vega-accent text-xl font-bold text-white sm:h-[72px] sm:w-[72px] sm:text-2xl">
            {initials(user.fullName)}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-[22px] font-semibold leading-7 text-vega-text sm:text-[26px]">
                {user.fullName}
              </h1>
              <span
                className={cn(
                  "shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize",
                  STATUS_TONES[user.status] ?? STATUS_TONES.inactive,
                )}
              >
                {user.status}
              </span>
            </div>
            <p className="mt-1 text-[13.5px] text-vega-text-secondary">
              {ROLE_LABELS[user.role] ?? user.role}
              {user.department ? (
                <>
                  <span className="px-2 text-vega-text-dim">·</span>
                  {user.department}
                </>
              ) : null}
            </p>
            <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-vega-text-muted">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                <span className="truncate">{user.email}</span>
              </span>
              {user.phone ? (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  {user.phone}
                </span>
              ) : null}
              {user.manager ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                  <span className="truncate">Reports to {user.manager.fullName}</span>
                </span>
              ) : null}
            </p>
          </div>

          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-vega-border bg-vega-surface-2 px-3 text-[13px] font-medium text-vega-text-secondary transition-colors hover:bg-vega-surface-hover hover:text-vega-text"
            >
              <Pencil className="h-[15px] w-[15px]" strokeWidth={1.8} aria-hidden="true" />
              Edit details
            </button>
          ) : null}
        </div>

        {editing ? (
          <form onSubmit={save} className="relative mt-4 border-t border-vega-border-soft pt-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  { key: "fullName", label: "Full name", placeholder: "Your name" },
                  { key: "phone", label: "Phone", placeholder: "Contact number" },
                  { key: "department", label: "Department", placeholder: "Team or function" },
                ] as const
              ).map((field) => (
                <label key={field.key} className="block">
                  <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.1em] text-vega-text-muted">
                    {field.label}
                  </span>
                  <input
                    value={form[field.key]}
                    onChange={(event) => setForm((prev) => ({ ...prev, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    className="h-10 w-full rounded-lg border border-vega-border bg-[#0b141f] px-3 text-[13.5px] text-vega-text outline-none transition-colors placeholder:text-vega-text-dim focus:border-vega-accent"
                  />
                </label>
              ))}
            </div>

            {/* Said plainly, so nobody hunts for a field that is not here. */}
            <p className="mt-2.5 text-[11.5px] text-vega-text-dim">
              Your role, email and status are set by an admin.
            </p>

            {error ? (
              <p role="alert" className="mt-2.5 text-[12.5px] text-vega-red">
                {error}
              </p>
            ) : null}

            <div className="mt-3 flex flex-wrap gap-2.5">
              <button
                type="submit"
                disabled={saving || !form.fullName.trim()}
                className="inline-flex h-9 items-center gap-2 rounded-lg bg-vega-accent px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-vega-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Check className="h-4 w-4" strokeWidth={2.2} aria-hidden="true" />
                )}
                {saving ? "Saving..." : "Save changes"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setEditing(false);
                  setError("");
                  setForm({ fullName: user.fullName, phone: user.phone, department: user.department });
                }}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-vega-border px-3.5 text-[13px] font-medium text-vega-text-secondary transition-colors hover:bg-vega-surface-hover"
              >
                <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className={cn(panel, "p-4")}>
          <div className="mb-3 flex items-center gap-2.5">
            <CalendarCheck className="h-[18px] w-[18px] text-[#5fd88c]" strokeWidth={2} aria-hidden="true" />
            <h2 className="text-[15px] font-semibold text-vega-text">Attendance</h2>
            <span className="ml-auto text-[11.5px] text-vega-text-muted">This month</span>
          </div>
          <Ring
            percent={attendance.attendancePercent}
            label={`${attendance.present} days present`}
            sublabel={`${attendance.totalMarked} days marked`}
          />
          <Breakdown
            rows={[
              { label: "Late coming", value: attendance.late, tone: "bg-[#e6bb3f]" },
              { label: "Half days", value: attendance.halfDay, tone: "bg-[#f59e5c]" },
              { label: "Absent", value: attendance.absent, tone: "bg-[#f47171]" },
              { label: "Leave", value: attendance.leave, tone: "bg-[#a98bff]" },
            ]}
          />
        </div>

        <div className={cn(panel, "p-4")}>
          <div className="mb-3 flex items-center gap-2.5">
            <CircleCheck className="h-[18px] w-[18px] text-[#6da2ff]" strokeWidth={2} aria-hidden="true" />
            <h2 className="text-[15px] font-semibold text-vega-text">Tasks</h2>
            <Link href="/tasks" className="ml-auto text-[11.5px] font-medium text-vega-accent hover:text-vega-accent-hover">
              View all
            </Link>
          </div>
          <Ring
            percent={tasks.completionPercent}
            label={`${tasks.completed} of ${tasks.total} done`}
            sublabel={tasks.overdue > 0 ? `${tasks.overdue} overdue` : "Nothing overdue"}
          />
          <Breakdown
            rows={[
              { label: "In progress", value: tasks.inProgress, tone: "bg-[#6da2ff]" },
              { label: "To do", value: tasks.todo, tone: "bg-[#8996a6]" },
              { label: "Overdue", value: tasks.overdue, tone: "bg-[#f47171]" },
            ]}
          />
        </div>

        <div className={cn(panel, "p-4")}>
          <div className="mb-3 flex items-center gap-2.5">
            <Target className="h-[18px] w-[18px] text-[#a98bff]" strokeWidth={2} aria-hidden="true" />
            <h2 className="text-[15px] font-semibold text-vega-text">Targets</h2>
            <span className="ml-auto text-[11.5px] text-vega-text-muted">This month</span>
          </div>

          {targets.total === 0 ? (
            <p className="py-8 text-center text-[13px] text-vega-text-muted">
              No targets set for you.
            </p>
          ) : (
            <>
              <Ring
                percent={targets.progressPercent}
                label={`${targets.met} of ${targets.total} met`}
                sublabel="Across all targets"
              />
              <ul className="mt-3 space-y-2.5">
                {targets.items.slice(0, 3).map((target) => (
                  <li key={target.id}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="min-w-0 truncate text-[12.5px] text-vega-text-secondary">
                        {target.title}
                      </span>
                      <span className="shrink-0 text-[11.5px] text-vega-text-dim">
                        {target.progressPercent}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-vega-surface-2">
                      <div
                        className="h-full rounded-full bg-vega-accent"
                        style={{ width: `${Math.min(100, target.progressPercent)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <div className={cn(panel, "p-4")}>
          <div className="mb-3 flex items-center gap-2.5">
            <Briefcase className="h-[18px] w-[18px] text-[#6da2ff]" strokeWidth={2} aria-hidden="true" />
            <h2 className="text-[15px] font-semibold text-vega-text">Recent tasks</h2>
          </div>
          {tasks.items.length === 0 ? (
            <p className="py-7 text-center text-[13px] text-vega-text-muted">Nothing assigned to you.</p>
          ) : (
            <ul className="divide-y divide-vega-border-soft">
              {tasks.items.slice(0, 6).map((task) => (
                <li key={task.id}>
                  <Link
                    href={`/tasks/${task.id}`}
                    className="flex items-center gap-3 py-2.5 transition-colors hover:bg-vega-surface-hover"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] text-vega-text">{task.title}</span>
                    <span className="shrink-0 text-[11.5px] capitalize text-vega-text-dim">
                      {task.status.toLowerCase().replaceAll("_", " ")}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-vega-text-dim" strokeWidth={1.8} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className={cn(panel, "p-4")}>
          <div className="mb-3 flex items-center gap-2.5">
            <Clock className="h-[18px] w-[18px] text-[#e6bb3f]" strokeWidth={2} aria-hidden="true" />
            <h2 className="text-[15px] font-semibold text-vega-text">Recent activity</h2>
          </div>
          {activity.length === 0 ? (
            <p className="py-7 text-center text-[13px] text-vega-text-muted">Nothing recorded yet.</p>
          ) : (
            <ul className="space-y-3">
              {activity.slice(0, 6).map((item) => (
                <li key={item.id} className="flex items-start gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-vega-accent" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] capitalize text-vega-text">
                      {item.action.replaceAll("_", " ")}
                    </span>
                    <span className="block truncate text-[11.5px] capitalize text-vega-text-muted">
                      {item.entityType.replaceAll("_", " ")}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-vega-text-dim">
                    {item.createdAt
                      ? new Date(item.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
