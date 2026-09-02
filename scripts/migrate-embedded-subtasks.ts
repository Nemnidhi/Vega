/**
 * Migrate legacy embedded `Task.subTasks[]` rows into real child Task documents.
 *
 * Why: Vega carried two subtask representations. Child Task documents (`parentTaskId`) back the
 * Task Workspace, the dependency engine, the workflow canvas, import and analytics. The embedded
 * `subTasks[]` array was written by the root-task routes and was invisible to all of them - so a
 * task created from /tasks with subtasks produced rows nobody downstream could see.
 *
 * The routes no longer write the array. This moves what is already there.
 *
 * Safety:
 *   - Idempotent. Migrated rows are fingerprinted `legacy-subtask:<parentId>:<subtaskId>` on the
 *     new child's `importExternalId`, and any parent whose rows are all present is skipped, so
 *     re-running cannot duplicate.
 *   - Non-destructive by default. The source array is left in place unless --clear is passed,
 *     so the migration can be verified in production before anything is removed.
 *   - --dry-run reports what would happen and writes nothing.
 *
 * Usage:
 *   npm run migrate:embedded-subtasks -- --dry-run
 *   npm run migrate:embedded-subtasks
 *   npm run migrate:embedded-subtasks -- --clear
 */

import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/db/mongodb";
import { TaskModel } from "../src/models";
import { normalizeTaskStatus } from "../src/lib/tasks/status";
import { generateSubtaskCode } from "../src/lib/tasks/codes";

type LegacySubtask = {
  _id?: unknown;
  title?: string;
  description?: string;
  status?: string;
  dueAt?: Date | null;
  assignedToUserId?: unknown;
  completedAt?: Date | null;
  sourceSheet?: string;
  sourceRow?: number | null;
  order?: number;
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const clearSource = args.has("--clear");

function fingerprintFor(parentId: string, subtaskId: string) {
  return `legacy-subtask:${parentId}:${subtaskId}`;
}

async function main() {
  await connectToDatabase();

  const parents = await TaskModel.find({ "subTasks.0": { $exists: true } })
    .select("_id title code assignedToUserId createdBy projectId clientId leadId subTasks")
    .lean();

  console.log(`Found ${parents.length} task(s) carrying embedded subtasks.`);
  if (parents.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  let created = 0;
  let skipped = 0;
  let cleared = 0;
  const failures: Array<{ parentId: string; error: string }> = [];

  for (const parent of parents) {
    const parentId = String(parent._id);
    const legacyRows = ((parent as unknown as { subTasks?: LegacySubtask[] }).subTasks ?? []).filter(
      (row) => typeof row.title === "string" && row.title.trim().length > 0,
    );

    if (legacyRows.length === 0) {
      continue;
    }

    try {
      // Which of this parent's rows already came across on a previous run?
      const fingerprints = legacyRows.map((row) => fingerprintFor(parentId, String(row._id)));
      const existing = await TaskModel.find({
        parentTaskId: parentId,
        importExternalId: { $in: fingerprints },
      })
        .select("importExternalId")
        .lean();

      const alreadyMigrated = new Set(existing.map((doc) => String(doc.importExternalId)));
      const pending = legacyRows.filter(
        (row) => !alreadyMigrated.has(fingerprintFor(parentId, String(row._id))),
      );

      if (pending.length === 0) {
        skipped += legacyRows.length;
      } else {
        for (const [index, row] of pending.entries()) {
          const status = normalizeTaskStatus(row.status);
          const assignee = row.assignedToUserId ?? parent.assignedToUserId;

          if (dryRun) {
            console.log(
              `  [dry-run] ${parent.code ?? parentId} -> child "${row.title}" (${status})`,
            );
            created += 1;
            continue;
          }

          const code = await generateSubtaskCode(parentId);

          await TaskModel.create({
            title: String(row.title).trim(),
            description: row.description ?? "",
            code,
            status,
            priority: "MEDIUM",
            dueAt: row.dueAt ?? null,
            completedAt: status === "COMPLETED" ? (row.completedAt ?? new Date()) : null,
            progressPercent: status === "COMPLETED" ? 100 : 0,
            // The legacy array allowed a null assignee, but Task requires one. Fall back to the
            // parent's assignee rather than dropping the row.
            assignedToUserId: assignee,
            createdBy: parent.createdBy,
            parentTaskId: parent._id,
            rootTaskId: parent._id,
            projectId: parent.projectId ?? null,
            clientId: parent.clientId ?? null,
            leadId: parent.leadId ?? null,
            order: row.order ?? index,
            workflowNodeType: "SUBTASK",
            importExternalId: fingerprintFor(parentId, String(row._id)),
          });

          created += 1;
        }
      }

      if (clearSource && !dryRun) {
        await TaskModel.updateOne({ _id: parent._id }, { $set: { subTasks: [] } });
        cleared += 1;
      }
    } catch (error) {
      failures.push({
        parentId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log("");
  console.log(`${dryRun ? "Would create" : "Created"}: ${created} child task(s)`);
  console.log(`Already migrated (skipped): ${skipped}`);
  if (clearSource) console.log(`Cleared source arrays on: ${cleared} parent(s)`);
  if (failures.length > 0) {
    console.log(`\nFailures (${failures.length}):`);
    for (const failure of failures) {
      console.log(`  ${failure.parentId}: ${failure.error}`);
    }
  }
  if (!clearSource && !dryRun && created > 0) {
    console.log(
      "\nSource arrays left in place. Verify the migrated children, then re-run with --clear.",
    );
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
