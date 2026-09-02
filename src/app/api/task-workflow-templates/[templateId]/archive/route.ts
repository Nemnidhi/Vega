import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { archiveTaskWorkflowTemplate } from "@/lib/tasks/workflow-templates";
import { objectIdSchema } from "@/lib/validation/common";

type Params = Promise<{ templateId: string }>;

export async function POST(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { templateId } = await params;
    const parsedTemplateId = objectIdSchema.parse(templateId);
    return ok(await archiveTaskWorkflowTemplate(parsedTemplateId, actor));
  } catch (error) {
    return handleApiError(error);
  }
}
