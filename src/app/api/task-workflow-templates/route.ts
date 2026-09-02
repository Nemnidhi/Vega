import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { createTaskWorkflowTemplate, listTaskWorkflowTemplates } from "@/lib/tasks/workflow-templates";
import { createTaskWorkflowTemplateSchema } from "@/lib/validation/task";

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    await getActorContext();
    const { searchParams } = new URL(request.url);
    const includeArchived = searchParams.get("includeArchived") === "1";
    return ok(await listTaskWorkflowTemplates(includeArchived));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const payload = createTaskWorkflowTemplateSchema.parse(await request.json());
    return ok(await createTaskWorkflowTemplate(payload, actor), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
