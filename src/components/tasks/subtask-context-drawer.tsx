"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { normalizeTaskStatus } from "@/lib/tasks/status";
import {
  PRIORITY_OPTIONS,
  STATUS_OPTIONS,
  dueLabel,
  humanize,
  initialsOf,
  priorityTone,
  progressTone,
  statusTone,
} from "@/lib/tasks/tone";

/**
 * The ~400px contextual drawer for a selected subtask, per design.md section 6.4.
 *
 * This is a pane, not a modal: on wide screens the parent reduces the workspace width so the
 * subtask table behind it stays usable. Below lg it becomes a full-width overlay sheet.
 * Sections are compact and collapsible.
 */

type PopulatedUser = { _id: string; fullName: string; email?: string; role?: string };

type DependencyRef = { _id: string; code?: string; title: string; status: string };

type Dependency = {
  _id: string;
  predecessorSubtaskId: DependencyRef | string;
  successorSubtaskId: DependencyRef | string;
  dependencyType: string;
};

type ChecklistItem = { _id?: string; title: string; completed: boolean; order: number };

type Comment = { _id?: string; body: string; createdBy?: PopulatedUser | string; createdAt?: string };

type Attachment = { _id?: string; name: string; url: string; sizeBytes?: number | null };

export type DrawerSubtask = {
  _id: string;
  code?: string;
  title: string;
  description?: string;
  status: string;
  priority?: string;
  assignedToUserId?: PopulatedUser | string | null;
  startAt?: string | null;
  dueAt?: string | null;
  progressPercent?: number;
  checklist?: ChecklistItem[];
  comments?: Comment[];
  attachments?: Attachment[];
  blockedBy?: Dependency[];
  blocking?: Dependency[];
};

function displayName(user: PopulatedUser | string | null | undefined) {
  if (!user) return "Unassigned";
  return typeof user === "string" ? "Unknown" : user.fullName;
}

function userIdOf(user: PopulatedUser | string | null | undefined) {
  if (!user) return "";
  return typeof user === "string" ? user : user._id;
}

function refOf(value: DependencyRef | string): DependencyRef {
  if (typeof value === "string") return { _id: value, title: value, status: "" };
  return value;
}

function Section({
  title,
  count,
  children,
  defaultOpen = true,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-vega-border-soft">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left transition-colors hover:bg-vega-surface-hover"
      >
        <span className="text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">
          {title}
          {typeof count === "number" ? ` (${count})` : ""}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-vega-text-muted transition-transform",
            open ? "rotate-180" : "",
          )}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>
      {open ? <div className="px-4 pb-3">{children}</div> : null}
    </div>
  );
}

function DependencyRow({ reference }: { reference: DependencyRef }) {
  return (
    <li className="flex items-center gap-2 rounded-md border border-vega-border-soft bg-vega-surface-2 px-2.5 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs text-vega-text">{reference.title}</span>
        <span className="font-mono text-[10px] text-vega-text-muted">{reference.code ?? "—"}</span>
      </span>
      {reference.status ? (
        <span
          className={cn(
            "inline-flex h-[22px] shrink-0 items-center rounded-md border px-2 text-[10px] font-medium",
            statusTone(reference.status),
          )}
        >
          {humanize(normalizeTaskStatus(reference.status))}
        </span>
      ) : null}
    </li>
  );
}

interface SubtaskContextDrawerProps {
  subtask: DrawerSubtask;
  assignableUsers: PopulatedUser[];
  canAssignOthers: boolean;
  canEdit: boolean;
  busy?: boolean;
  onClose: () => void;
  onPatch: (patch: Record<string, unknown>) => Promise<void> | void;
  onAddComment: (body: string) => Promise<void> | void;
  onToggleChecklistItem: (itemId: string, completed: boolean) => Promise<void> | void;
}

export function SubtaskContextDrawer({
  subtask,
  assignableUsers,
  canAssignOthers,
  canEdit,
  busy = false,
  onClose,
  onPatch,
  onAddComment,
  onToggleChecklistItem,
}: SubtaskContextDrawerProps) {
  const [commentDraft, setCommentDraft] = useState("");

  const status = normalizeTaskStatus(subtask.status);
  const due = dueLabel(subtask.dueAt, subtask.status);
  const assigneeName = displayName(subtask.assignedToUserId);
  const progress = Math.min(100, Math.max(0, subtask.progressPercent ?? 0));
  const checklist = subtask.checklist ?? [];
  const checklistDone = checklist.filter((item) => item.completed).length;

  async function submitComment() {
    const body = commentDraft.trim();
    if (!body) return;
    await onAddComment(body);
    setCommentDraft("");
  }

  return (
    <aside
      className={cn(
        "flex flex-col overflow-y-auto border-vega-border bg-vega-surface-1",
        // Below lg this is an overlay sheet; at lg and up it is a pane the parent grid sizes,
        // so the table beside it stays usable.
        "fixed inset-y-0 right-0 z-50 w-full max-w-[400px] border-l",
        "lg:static lg:z-auto lg:w-[400px] lg:max-w-none lg:rounded-lg lg:border",
      )}
      aria-label={`Details for ${subtask.title}`}
    >
      <div className="flex items-start gap-2 border-b border-vega-border-soft p-4">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] text-vega-text-muted">{subtask.code ?? "—"}</p>
          <h2 className="mt-0.5 text-sm font-semibold leading-5 text-vega-text">{subtask.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex h-[22px] items-center rounded-md border px-2 text-[10px] font-medium",
                statusTone(subtask.status),
              )}
            >
              {humanize(status)}
            </span>
            <span
              className={cn(
                "inline-flex h-[22px] items-center rounded-md border px-2 text-[10px] font-medium",
                priorityTone(subtask.priority),
              )}
            >
              {humanize(subtask.priority ?? "MEDIUM")}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close details"
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-transparent text-vega-text-muted transition-colors hover:border-vega-border hover:bg-vega-surface-2 hover:text-vega-text"
        >
          <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>

      {/* Metadata */}
      <div className="space-y-3 p-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">Assignee</p>
          {canEdit && canAssignOthers && assignableUsers.length > 0 ? (
            <select
              value={userIdOf(subtask.assignedToUserId)}
              disabled={busy}
              onChange={(event) => void onPatch({ assignedToUserId: event.target.value })}
              className="mt-1 w-full text-xs"
              aria-label="Assignee"
            >
              {assignableUsers.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.fullName}
                </option>
              ))}
            </select>
          ) : (
            <p className="mt-1 flex items-center gap-2 text-xs text-vega-text">
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-vega-border bg-vega-surface-2 text-[8px] font-semibold text-vega-text-secondary">
                {initialsOf(assigneeName)}
              </span>
              {assigneeName}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">Status</p>
            {canEdit ? (
              <select
                value={status}
                disabled={busy}
                onChange={(event) => void onPatch({ status: event.target.value })}
                className="mt-1 w-full text-xs"
                aria-label="Status"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {humanize(option)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-xs text-vega-text">{humanize(status)}</p>
            )}
          </div>

          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">Priority</p>
            {canEdit ? (
              <select
                value={subtask.priority ?? "MEDIUM"}
                disabled={busy}
                onChange={(event) => void onPatch({ priority: event.target.value })}
                className="mt-1 w-full text-xs"
                aria-label="Priority"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {humanize(option)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="mt-1 text-xs text-vega-text">{humanize(subtask.priority ?? "MEDIUM")}</p>
            )}
          </div>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">Due Date</p>
          {canEdit ? (
            <input
              type="date"
              disabled={busy}
              value={subtask.dueAt ? subtask.dueAt.slice(0, 10) : ""}
              onChange={(event) => void onPatch({ dueAt: event.target.value || null })}
              className="mt-1 h-[34px] w-full rounded-md border border-vega-border bg-[#0b141f] px-3 text-xs text-vega-text"
              aria-label="Due date"
            />
          ) : (
            <p className={cn("mt-1 text-xs", due.tone)}>{due.text}</p>
          )}
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">Progress</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-sm bg-vega-surface-2">
              <div
                className={cn("h-full rounded-sm", progressTone(subtask.status))}
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[10px] tabular-nums text-vega-text-muted">{progress}%</span>
          </div>
        </div>

        {subtask.description ? (
          <div>
            <p className="text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-vega-text-secondary">
              {subtask.description}
            </p>
          </div>
        ) : null}
      </div>

      <Section title="Blocked By" count={subtask.blockedBy?.length ?? 0}>
        {subtask.blockedBy?.length ? (
          <ul className="space-y-1.5">
            {subtask.blockedBy.map((dependency) => (
              <DependencyRow key={dependency._id} reference={refOf(dependency.predecessorSubtaskId)} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-vega-text-muted">Nothing is blocking this subtask.</p>
        )}
      </Section>

      <Section title="Blocking" count={subtask.blocking?.length ?? 0}>
        {subtask.blocking?.length ? (
          <ul className="space-y-1.5">
            {subtask.blocking.map((dependency) => (
              <DependencyRow key={dependency._id} reference={refOf(dependency.successorSubtaskId)} />
            ))}
          </ul>
        ) : (
          <p className="text-xs text-vega-text-muted">This subtask is not blocking anything.</p>
        )}
      </Section>

      <Section title="Checklist" count={checklist.length} defaultOpen={checklist.length > 0}>
        {checklist.length ? (
          <>
            <p className="mb-2 text-[10px] text-vega-text-muted">
              {checklistDone} of {checklist.length} done
            </p>
            <ul className="space-y-1">
              {checklist.map((item) => (
                <li key={item._id ?? item.title} className="flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={item.completed}
                    disabled={busy || !canEdit || !item._id}
                    onChange={(event) =>
                      item._id ? void onToggleChecklistItem(item._id, event.target.checked) : undefined
                    }
                    className="mt-0.5 h-3.5 w-3.5 accent-[#8b5cf6]"
                    aria-label={item.title}
                  />
                  <span
                    className={cn(
                      "text-xs leading-5",
                      item.completed ? "text-vega-text-dim line-through" : "text-vega-text-secondary",
                    )}
                  >
                    {item.title}
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xs text-vega-text-muted">No checklist items.</p>
        )}
      </Section>

      <Section title="Comments" count={subtask.comments?.length ?? 0}>
        {subtask.comments?.length ? (
          <ul className="mb-2 space-y-2">
            {subtask.comments.map((comment, index) => (
              <li
                key={comment._id ?? index}
                className="rounded-md border border-vega-border-soft bg-vega-surface-2 p-2.5"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-vega-border bg-vega-surface-1 text-[8px] font-semibold text-vega-text-secondary">
                    {initialsOf(displayName(comment.createdBy))}
                  </span>
                  <span className="text-[10px] text-vega-text-secondary">
                    {displayName(comment.createdBy)}
                  </span>
                  {comment.createdAt ? (
                    <span className="ml-auto text-[10px] text-vega-text-dim">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-vega-text">
                  {comment.body}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-2 text-xs text-vega-text-muted">No comments yet.</p>
        )}

        {canEdit ? (
          <div className="space-y-2">
            <textarea
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Add a comment..."
              rows={2}
              className="w-full rounded-md border border-vega-border bg-[#0b141f] px-3 py-2 text-xs text-vega-text placeholder:text-vega-text-muted/85 focus-visible:border-vega-purple/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vega-purple/20"
            />
            <Button
              size="sm"
              variant="secondary"
              disabled={busy || !commentDraft.trim()}
              onClick={() => void submitComment()}
            >
              Comment
            </Button>
          </div>
        ) : null}
      </Section>

      <Section title="Files" count={subtask.attachments?.length ?? 0} defaultOpen={false}>
        {subtask.attachments?.length ? (
          <ul className="space-y-1.5">
            {subtask.attachments.map((attachment, index) => (
              <li key={attachment._id ?? index}>
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border border-vega-border-soft bg-vega-surface-2 px-2.5 py-2 text-xs text-vega-text-secondary hover:text-vega-text"
                >
                  <span className="min-w-0 flex-1 truncate">{attachment.name}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" strokeWidth={1.8} aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-vega-text-muted">No files attached.</p>
        )}
      </Section>

      <div className="mt-auto border-t border-vega-border-soft p-4">
        <Link
          href={`/tasks/${subtask._id}`}
          className="inline-flex h-[34px] w-full items-center justify-center gap-1.5 rounded-md border border-vega-border bg-vega-surface-1 px-3 text-xs font-medium text-vega-text-secondary transition-colors hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text"
        >
          Open as task
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
        </Link>
      </div>
    </aside>
  );
}
