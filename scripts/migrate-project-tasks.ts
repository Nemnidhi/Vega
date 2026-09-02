/**
 * Migrate legacy embedded `Project.tasks[]` rows into real Task documents.
 *
 * Why: the Project model that existed at 4c919d5 carried its own `tasks[]` subdocument array with
 * `assignedDeveloperId`, `completedByDeveloperId` and a `history[]` audit trail. That was a second
 * task system, invisible to the Task collection, the dependency engine and the workflow canvas.
 * The restored thin Project model no longer declares that path, so those rows are stranded: still
 * in the documents, no longer readable through the model.
 *
 * This reads them off the raw collection (bypassing the schema, which is the only way to see a
 * path the model no longer declares) and recreates each as a root Task pointing at the project.
 *
 * Field mapping:
 *   title, description  -> as-is
 *   status              -> normalised (legacy todo/in_progress/blocked/done -> canonical)
 *   assignedDeveloperId -> assignedToUserId
 *   createdBy           -> createdBy
 *   completedAt         -> completedAt
 *   history[]           -> dropped; ActivityLog is the audit store now, and back-dating synthetic
 *                          entries would misrepresent who did what and when
 *
 * Safety:
 *   - Idempotent. Each created Task carries `importExternalId` = `legacy-project-task:<pid>:<tid>`,
 *     and rows already present are skipped, so re-running cannot duplicate.
 *   - Non-destructive by default. The source array is only removed with --clear.
 *   - --dry-run writes nothing.
 *
 * Usage:
 *   npm run migrate:project-tasks -- --dry-run
 *   npm run migrate:project-tasks
 *   npm run migrate:project-tasks -- --clear
 */

import mongoose from "mongoose";
import { connectToDatabase } from "../src/lib/db/mongodb";
import { TaskModel } from "../src/models";
import { normalizeTaskStatus } from "../src/lib/tasks/status";
import { generateTaskCode } from "../src/lib/tasks/codes";

type LegacyProjectTask = {
  _id?: unknown;
  title?: string;
  description?: string;
  status?: string;
  assignedDeveloperId?: unknown;
  createdBy?: unknown;
  completedAt?: Date | null;
  createdAt?: Date | null;
};

type RawProject = {
  _id: unknown;
  title?: string;
  clientId?: unknown;
  leadId?: unknown;
  createdBy?: unknown;
  assignedDeveloperId?: unknown;
  tasks?: LegacyProjectTask[];
};

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const clearSource = args.has("--clear");

function fingerprintFor(projectId: string, taskId: string) {
  return `legacy-project-task:${projectId}:${taskId}`;
}

async function main() {
  await connectToDatabase();

  const db = mongoose.connection.db;
  if (!db) throw new Error("No database handle after connecting.");

  // Read through the driver, not the model: the restored Project schema does not declare `tasks`,
  // so Mongoose would strip the field before we ever saw it.
  const collection = db.collection<RawProject>("projects");
  const projects = await collection.find({ "tasks.0": { $exists: true } }).toArray();

  console.log(`Found ${projects.length} project(s) carrying embedded tasks.`);
  if (projects.length === 0) {
    console.log("Nothing to migrate.");
    return;
  }

  let created = 0;
  let skipped = 0;
  let cleared = 0;
  const failures: Array<{ projectId: string; error: string }> = [];

  for (const project of projects) {
    const projectId = String(project._id);
    const legacyRows = (project.tasks ?? []).filter(
      (row) => typeof row.title === "string" && row.title.trim().length > 0,
    );

    if (legacyRows.length === 0) continue;

    try {
      const fingerprints = legacyRows.map((row) => fingerprintFor(projectId, String(row._id)));
      const existing = await TaskModel.find({
        projectId,
        importExternalId: { $in: fingerprints },
      })
        .select("importExternalId")
        .lean();

      const alreadyMigrated = new Set(existing.map((doc) => String(doc.importExternalId)));
      const pending = legacyRows.filter(
        (row) => !alreadyMigrated.has(fingerprintFor(projectId, String(row._id))),
      );

      if (pending.length === 0) {
        skipped += legacyRows.length;
      } else {
        for (const row of pending) {
          const status = normalizeTaskStatus(row.status);

          // Task requires an assignee and a creator. Fall back through the project's own fields
          // rather than dropping a row that carries real delivery history.
          const assignee = row.assignedDeveloperId ?? project.assignedDeveloperId ?? row.createdBy ?? project.createdBy;
          const creator = row.createdBy ?? project.createdBy ?? assignee;

          if (!assignee || !creator) {
            failures.push({
              projectId,
              error: `Task "${row.title}" has no resolvable assignee or creator; skipped.`,
            });
            continue;
          }

          if (dryRun) {
            console.log(`  [dry-run] ${project.title ?? projectId} -> task "${row.title}" (${status})`);
            created += 1;
            continue;
          }

          const code = await generateTaskCode();

          await TaskModel.create({
            title: String(row.title).trim(),
            description: row.description ?? "",
            code,
            status,
            priority: "MEDIUM",
            completedAt: status === "COMPLETED" ? (row.completedAt ?? new Date()) : null,
            progressPercent: status === "COMPLETED" ? 100 : 0,
            assignedToUserId: assignee,
            createdBy: creator,
            projectId: project._id,
            clientId: project.clientId ?? null,
            leadId: project.leadId ?? null,
            parentTaskId: null,
            rootTaskId: null,
            workflowNodeType: "SUBTASK",
            importExternalId: fingerprintFor(projectId, String(row._id)),
          });

          created += 1;
        }
      }

      if (clearSource && !dryRun) {
        await collection.updateOne({ _id: project._id }, { $unset: { tasks: "" } });
        cleared += 1;
      }
    } catch (error) {
      failures.push({
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log("");
  console.log(`${dryRun ? "Would create" : "Created"}: ${created} task(s)`);
  console.log(`Already migrated (skipped): ${skipped}`);
  if (clearSource) console.log(`Removed source arrays from: ${cleared} project(s)`);
  if (failures.length > 0) {
    console.log(`\nProblems (${failures.length}):`);
    for (const failure of failures) {
      console.log(`  ${failure.projectId}: ${failure.error}`);
    }
  }
  if (!clearSource && !dryRun && created > 0) {
    console.log("\nSource arrays left in place. Verify the migrated tasks, then re-run with --clear.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.connection.close());
