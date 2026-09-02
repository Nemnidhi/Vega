import type { ClientSession } from "mongoose";
import { ProjectModel, TaskModel } from "@/models";

/**
 * Structural validation for the task tree.
 *
 * The hierarchy is self-referencing (`parentTaskId` / `rootTaskId` on Task), so nothing in the
 * schema prevents a task becoming its own ancestor. These guards run server-side before any
 * parent link is written - the UI preventing it is not a control.
 */

const MAX_PARENT_WALK = 100;

export class TaskValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskValidationError";
  }
}

type LeanParent = {
  _id: unknown;
  parentTaskId?: unknown;
  rootTaskId?: unknown;
  projectId?: unknown;
  archivedAt?: Date | null;
};

/**
 * Verify that parenting `taskId` under `parentTaskId` is legal.
 *
 * Rejects self-parenting, cycles at any depth, missing or archived parents, and parents belonging
 * to a different project. Returns the resolved `rootTaskId` for the new position.
 */
export async function assertValidParent(
  taskId: string | null,
  parentTaskId: string,
  options?: { session?: ClientSession; projectId?: string | null },
): Promise<string> {
  const session = options?.session ?? null;

  if (taskId && String(taskId) === String(parentTaskId)) {
    throw new TaskValidationError("A task cannot be its own parent.");
  }

  const parent = (await TaskModel.findById(parentTaskId)
    .select("parentTaskId rootTaskId projectId archivedAt")
    .session(session)
    .lean()) as LeanParent | null;

  if (!parent) {
    throw new TaskValidationError("Parent task not found.");
  }
  if (parent.archivedAt) {
    throw new TaskValidationError("Cannot attach a task to an archived parent.");
  }

  if (options?.projectId !== undefined) {
    const parentProject = parent.projectId ? String(parent.projectId) : null;
    const childProject = options.projectId ? String(options.projectId) : null;
    if (parentProject !== childProject) {
      throw new TaskValidationError("Parent and child tasks must belong to the same project.");
    }
  }

  // Walk up from the proposed parent. If we reach the task being moved, this link would close a
  // loop. The step cap also protects against pre-existing corrupt chains.
  if (taskId) {
    let cursor: unknown = parent.parentTaskId;
    for (let depth = 0; cursor && depth < MAX_PARENT_WALK; depth += 1) {
      if (String(cursor) === String(taskId)) {
        throw new TaskValidationError("That parent would create a circular task hierarchy.");
      }
      const ancestor = (await TaskModel.findById(cursor)
        .select("parentTaskId")
        .session(session)
        .lean()) as LeanParent | null;
      if (!ancestor) break;
      cursor = ancestor.parentTaskId;
    }
  }

  return String(parent.rootTaskId ?? parent._id);
}

/** Reject a projectId that does not resolve to a live project. */
export async function assertValidProject(
  projectId: string | null | undefined,
  options?: { session?: ClientSession },
) {
  if (!projectId) return;

  const project = await ProjectModel.findById(projectId)
    .select("archivedAt")
    .session(options?.session ?? null)
    .lean();

  if (!project) {
    throw new TaskValidationError("Project not found.");
  }
  if ((project as { archivedAt?: Date | null }).archivedAt) {
    throw new TaskValidationError("Cannot attach a task to an archived project.");
  }
}

/** Progress must be a whole percentage inside 0-100. */
export function assertValidProgress(progressPercent?: number | null) {
  if (progressPercent === undefined || progressPercent === null) return;
  if (!Number.isFinite(progressPercent) || progressPercent < 0 || progressPercent > 100) {
    throw new TaskValidationError("Progress must be between 0 and 100.");
  }
}

/** A due date before the start date is always a mistake, not a valid schedule. */
export function assertValidDateRange(startAt?: Date | null, dueAt?: Date | null) {
  if (!startAt || !dueAt) return;
  if (startAt.getTime() > dueAt.getTime()) {
    throw new TaskValidationError("Due date must be on or after the start date.");
  }
}

/** Collect a task and every descendant id, for cascade operations. */
export async function collectDescendantIds(
  taskId: string,
  options?: { session?: ClientSession },
): Promise<string[]> {
  const session = options?.session ?? null;
  const collected: string[] = [];
  let frontier = [String(taskId)];

  for (let depth = 0; frontier.length > 0 && depth < MAX_PARENT_WALK; depth += 1) {
    const children = await TaskModel.find({ parentTaskId: { $in: frontier } })
      .select("_id")
      .session(session)
      .lean();

    frontier = children.map((child) => String(child._id));
    collected.push(...frontier);
  }

  return collected;
}
