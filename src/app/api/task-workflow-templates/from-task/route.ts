import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { createTemplateFromTask } from "@/lib/tasks/workflow-templates";
import { createTemplateFromTaskSchema } from "@/lib/validation/task";

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const payload = createTemplateFromTaskSchema.parse(await request.json());
    return ok(await createTemplateFromTask(payload, actor), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
