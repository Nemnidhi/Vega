"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, GripVertical, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";

/**
 * The Checklist tab, per design.md.
 *
 * The task PATCH route replaces the checklist array wholesale, so this edits a local draft and
 * saves the whole list in one call rather than firing a request per keystroke.
 */

export type ChecklistDraftItem = {
  _id?: string;
  title: string;
  completed: boolean;
  order: number;
};

interface TaskChecklistPanelProps {
  items: ChecklistDraftItem[];
  canEdit: boolean;
  busy?: boolean;
  onSave: (items: Array<{ title: string; completed: boolean; order: number }>) => Promise<void> | void;
}

export function TaskChecklistPanel({ items, canEdit, busy = false, onSave }: TaskChecklistPanelProps) {
  const [draft, setDraft] = useState<ChecklistDraftItem[]>(items);
  const [newTitle, setNewTitle] = useState("");

  /**
   * Re-seed when the server sends a different list (after a save, or a navigation).
   *
   * Adjusted during render against the last-seen props rather than in an effect: setting state
   * in an effect to mirror a prop causes a second render pass, which is what
   * react-hooks/set-state-in-effect exists to catch.
   */
  const [seededFrom, setSeededFrom] = useState(items);
  if (seededFrom !== items) {
    setSeededFrom(items);
    setDraft(items);
  }

  const done = draft.filter((item) => item.completed).length;
  const dirty = JSON.stringify(draft) !== JSON.stringify(items);

  function update(index: number, patch: Partial<ChecklistDraftItem>) {
    setDraft((current) =>
      current.map((item, position) => (position === index ? { ...item, ...patch } : item)),
    );
  }

  function remove(index: number) {
    setDraft((current) =>
      current.filter((_, position) => position !== index).map((item, position) => ({ ...item, order: position })),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.length) return;
    setDraft((current) => {
      const next = [...current];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next.map((entry, position) => ({ ...entry, order: position }));
    });
  }

  function add() {
    const title = newTitle.trim();
    if (!title) return;
    setDraft((current) => [...current, { title, completed: false, order: current.length }]);
    setNewTitle("");
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-vega-border bg-vega-surface-1">
        <div className="flex items-center justify-between border-b border-vega-border-soft px-4 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.08em] text-vega-text-muted">
            Checklist ({done}/{draft.length})
          </p>
          {canEdit && dirty ? (
            <Button
              variant="primary"
              size="sm"
              disabled={busy}
              onClick={() =>
                void onSave(
                  draft.map((item, index) => ({
                    title: item.title,
                    completed: item.completed,
                    order: index,
                  })),
                )
              }
            >
              {busy ? "Saving..." : "Save changes"}
            </Button>
          ) : null}
        </div>

        <div className="p-4">
          {draft.length === 0 ? (
            <p className="text-xs text-vega-text-muted">
              No checklist items yet. Break the task into concrete steps below.
            </p>
          ) : (
            <ul className="space-y-1">
              {draft.map((item, index) => (
                <li
                  key={item._id ?? `${index}-${item.title}`}
                  className="group flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-vega-border-soft hover:bg-vega-surface-2"
                >
                  <GripVertical
                    className="h-3.5 w-3.5 shrink-0 text-vega-text-dim"
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                  <input
                    type="checkbox"
                    checked={item.completed}
                    disabled={!canEdit || busy}
                    onChange={(event) => update(index, { completed: event.target.checked })}
                    className="h-3.5 w-3.5 shrink-0 accent-[#8b5cf6]"
                    aria-label={item.title}
                  />
                  {canEdit ? (
                    <input
                      value={item.title}
                      disabled={busy}
                      onChange={(event) => update(index, { title: event.target.value })}
                      className={cn(
                        "min-w-0 flex-1 bg-transparent text-xs text-vega-text outline-none",
                        item.completed ? "text-vega-text-dim line-through" : "",
                      )}
                    />
                  ) : (
                    <span
                      className={cn(
                        "min-w-0 flex-1 text-xs",
                        item.completed ? "text-vega-text-dim line-through" : "text-vega-text",
                      )}
                    >
                      {item.title}
                    </span>
                  )}

                  {canEdit ? (
                    <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => move(index, -1)}
                        disabled={busy || index === 0}
                        aria-label="Move up"
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-vega-text-muted hover:bg-vega-surface-hover hover:text-vega-text disabled:opacity-30"
                      >
                        <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(index, 1)}
                        disabled={busy || index === draft.length - 1}
                        aria-label="Move down"
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-vega-text-muted hover:bg-vega-surface-hover hover:text-vega-text disabled:opacity-30"
                      >
                        <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={busy}
                        aria-label={`Remove ${item.title}`}
                        className="inline-flex h-6 w-6 items-center justify-center rounded text-vega-text-muted hover:bg-vega-red/10 hover:text-vega-red disabled:opacity-30"
                      >
                        <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                      </button>
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {canEdit ? (
            <div className="mt-3 flex items-center gap-2 border-t border-vega-border-soft pt-3">
              <Input
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    add();
                  }
                }}
                placeholder="Add a checklist item..."
                disabled={busy}
              />
              <Button variant="secondary" size="md" disabled={busy || !newTitle.trim()} onClick={add}>
                <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                Add
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {dirty ? (
        <p className="text-[10px] text-vega-text-dim">
          Unsaved changes. Nothing is written until you save.
        </p>
      ) : null}
    </div>
  );
}
