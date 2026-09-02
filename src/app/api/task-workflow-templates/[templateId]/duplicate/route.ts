import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { duplicateTaskWorkflowTemplate } from "@/lib/tasks/workflow-templates";
import { objectIdSchema } from "@/lib/validation/common";
import { duplicateTaskWorkflowTemplateSchema } from "@/lib/validation/task";

type Params = Promise<{ templateId: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { templateId } = await params;
    const parsedTemplateId = objectIdSchema.parse(templateId);
    const payload = duplicateTaskWorkflowTemplateSchema.parse(await request.json());
    return ok(await duplicateTaskWorkflowTemplate(parsedTemplateId, actor, payload.name), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
