import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import {
  archiveTaskWorkflowTemplate,
  ensureDefaultTaskWorkflowTemplates,
  updateTaskWorkflowTemplate,
} from "@/lib/tasks/workflow-templates";
import { objectIdSchema } from "@/lib/validation/common";
import { updateTaskWorkflowTemplateSchema } from "@/lib/validation/task";
import { TaskWorkflowTemplateModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type Params = Promise<{ templateId: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    await getActorContext();
    await ensureDefaultTaskWorkflowTemplates();
    const { templateId } = await params;
    const parsedTemplateId = objectIdSchema.parse(templateId);
    const template = await TaskWorkflowTemplateModel.findById(parsedTemplateId).lean();
    if (!template) return fail("Template not found.", 404);
    return ok(serializeForJson(template));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { templateId } = await params;
    const parsedTemplateId = objectIdSchema.parse(templateId);
    const payload = updateTaskWorkflowTemplateSchema.parse(await request.json());
    return ok(await updateTaskWorkflowTemplate(parsedTemplateId, payload, actor));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
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
