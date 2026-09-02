import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { generateAiTaskProposal } from "@/lib/tasks/ai-assistant";
import { assertCanAccessTask } from "@/lib/tasks/subtasks";
import { objectIdSchema } from "@/lib/validation/common";
import { taskAiAssistantSchema } from "@/lib/validation/task";
import { TaskDependencyModel, TaskModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { id } = await params;
    const parentTaskId = objectIdSchema.parse(id);
    const payload = taskAiAssistantSchema.parse(await request.json());

    const parent = await TaskModel.findById(parentTaskId)
      .select("_id title description dueAt assignedToUserId createdBy")
      .lean();
    if (!parent) return fail("Task not found.", 404);
    await assertCanAccessTask(actor, parent);

    if (payload.subtaskId) {
      const exists = await TaskModel.exists({ _id: payload.subtaskId, parentTaskId });
      if (!exists) return fail("Subtask not found.", 404);
    }

    const [subtasks, dependencies] = await Promise.all([
      TaskModel.find({ parentTaskId })
        .sort({ order: 1, createdAt: 1 })
        .select("_id code title description status priority assignedToUserId startAt dueAt estimatedEffortHours progressPercent stage workflowNodeType")
        .lean(),
      TaskDependencyModel.find({ parentTaskId })
        .select("_id predecessorSubtaskId successorSubtaskId dependencyType branchKey branchLabel lagDuration")
        .lean(),
    ]);

    const proposal = await generateAiTaskProposal(payload.mode, {
      task: parent,
      subtasks,
      dependencies,
      prompt: payload.prompt,
      subtaskId: payload.subtaskId,
    });

    return ok(serializeForJson(proposal));
  } catch (error) {
    return handleApiError(error);
  }
}
