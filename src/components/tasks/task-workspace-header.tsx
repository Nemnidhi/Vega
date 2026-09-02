"use client";

import Link from "next/link";
import { ArrowLeft, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { normalizeTaskStatus } from "@/lib/tasks/status";
import { dueLabel, humanize, initialsOf, priorityTone, progressTone, statusTone } from "@/lib/tasks/tone";

/**
 * The Task Workspace entity header, per design.md.
 *
 * One compact bordered header with vertical separators between fields - deliberately NOT six
 * separate cards, which is the shape design.md section 5.3 calls out as wrong for Vega.
 */

type PopulatedUser = { _id: string; fullName: string; email: string; role: string };

interface TaskWorkspaceHeaderProps {
  title: string;
  code?: string | null;
  status: string;
  priority?: string;
  assignee: PopulatedUser | string | null | undefined;
  dueAt?: string | null;
  projectTitle?: string | null;
  progressPercent?: number;
}

function displayName(user: PopulatedUser | string | null | undefined) {
  if (!user) return "Unassigned";
  return typeof user === "string" ? "Unknown" : user.fullName;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 px-4 first:pl-0 last:pr-0">
      <p className="text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">{label}</p>
      <div className="mt-1 truncate text-xs text-vega-text">{children}</div>
    </div>
  );
}

export function TaskWorkspaceHeader({
  title,
  code,
  status,
  priority = "MEDIUM",
  assignee,
  dueAt,
  projectTitle,
  progressPercent = 0,
}: TaskWorkspaceHeaderProps) {
  const normalized = normalizeTaskStatus(status);
  const due = dueLabel(dueAt, status);
  const assigneeName = displayName(assignee);
  const progress = Math.min(100, Math.max(0, progressPercent));

  return (
    <div className="rounded-lg border border-vega-border bg-vega-surface-1">
      <div className="flex items-start gap-3 border-b border-vega-border-soft p-4">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-vega-purple-border bg-vega-purple-soft text-[#c4b5fd]">
          <ClipboardList className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-semibold leading-6 text-vega-text">{title}</h1>
          <p className="mt-0.5 font-mono text-[10px] text-vega-text-muted">{code ?? "—"}</p>
        </div>

        <Link
          href="/tasks"
          className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-md border border-vega-border bg-vega-surface-1 px-3 text-xs font-medium text-vega-text-secondary transition-colors hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text"
        >
          <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
          Tasks
        </Link>
      </div>

      {/* Field strip. Vertical separators, not cards. */}
      <div className="flex flex-wrap items-center gap-y-3 divide-x divide-vega-border-soft p-4">
        <Field label="Status">
          <span
            className={cn(
              "inline-flex h-[22px] items-center rounded-md border px-2 text-[10px] font-medium",
              statusTone(status),
            )}
          >
            {humanize(normalized)}
          </span>
        </Field>

        <Field label="Priority">
          <span
            className={cn(
              "inline-flex h-[22px] items-center rounded-md border px-2 text-[10px] font-medium",
              priorityTone(priority),
            )}
          >
            {humanize(priority)}
          </span>
        </Field>

        <Field label="Assignee">
          <span className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-vega-border bg-vega-surface-2 text-[8px] font-semibold text-vega-text-secondary">
              {initialsOf(assigneeName)}
            </span>
            <span className="truncate">{assigneeName}</span>
          </span>
        </Field>

        <Field label="Due Date">
          <span className={due.tone}>{due.text}</span>
        </Field>

        <Field label="Project">
          {projectTitle ? (
            <span className="truncate text-vega-text-secondary">{projectTitle}</span>
          ) : (
            <span className="text-vega-text-dim">—</span>
          )}
        </Field>

        <Field label="Progress">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-24 overflow-hidden rounded-sm bg-vega-surface-2">
              <span
                className={cn("block h-full rounded-sm", progressTone(status))}
                style={{ width: `${progress}%` }}
              />
            </span>
            <span className="text-[10px] tabular-nums text-vega-text-muted">{progress}%</span>
          </span>
        </Field>
      </div>
    </div>
  );
}
