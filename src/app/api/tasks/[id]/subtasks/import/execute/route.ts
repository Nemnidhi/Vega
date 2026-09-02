import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { executeImportJob } from "@/lib/tasks/import-subtasks";
import { assertCanAccessTask } from "@/lib/tasks/subtasks";
import { syncParentTaskProgress } from "@/lib/tasks/workflow-execution";
import { objectIdSchema } from "@/lib/validation/common";
import { executeSubtaskImportSchema } from "@/lib/validation/task";
import { ImportJobModel, TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const payload = executeSubtaskImportSchema.parse(await request.json());

    const parent = await TaskModel.findById(parentTaskId)
      .select("assignedToUserId createdBy projectId")
      .lean();
    if (!parent) return fail("Task not found.", 404);
    await assertCanAccessTask(actor, parent);

    const jobExists = await ImportJobModel.exists({ _id: payload.importJobId, parentTaskId });
    if (!jobExists) return fail("Import job not found.", 404);

    const result = await executeImportJob({
      importJobId: payload.importJobId,
      mapping: payload.mapping,
      actorId: actor.userId,
      actorRole: actor.role,
      parentTaskId,
      defaultAssigneeId: String(parent.assignedToUserId),
      importValidRowsOnly: payload.importValidRowsOnly,
      projectId: parent.projectId ? String(parent.projectId) : null,
    });
    await syncParentTaskProgress(parentTaskId);

    return ok(
      serializeForJson({
        importJobId: String(result.job._id),
        summary: result.job.summary,
        importedRows: result.importedRows,
        skippedRows: result.skippedRows,
        dependencyCount: result.dependencyCount,
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
