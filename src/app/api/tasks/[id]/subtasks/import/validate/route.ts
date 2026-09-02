import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { summarizeValidation, validateImportJob } from "@/lib/tasks/import-subtasks";
import { assertCanAccessTask } from "@/lib/tasks/subtasks";
import { objectIdSchema } from "@/lib/validation/common";
import { validateSubtaskImportSchema } from "@/lib/validation/task";
import { ImportJobModel, TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const payload = validateSubtaskImportSchema.parse(await request.json());

    const parent = await TaskModel.findById(parentTaskId).select("assignedToUserId createdBy").lean();
    if (!parent) return fail("Task not found.", 404);
    await assertCanAccessTask(actor, parent);

    const jobExists = await ImportJobModel.exists({ _id: payload.importJobId, parentTaskId });
    if (!jobExists) return fail("Import job not found.", 404);

    const { job, normalizedRows } = await validateImportJob(payload.importJobId, payload.mapping);
    return ok(
      serializeForJson({
        importJobId: String(job._id),
        ...summarizeValidation(normalizedRows),
      }),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
