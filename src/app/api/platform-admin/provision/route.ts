import { z } from "zod";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { objectIdSchema } from "@/lib/validation/common";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { provisionDashboardOrganization } from "@/lib/platformAdmin/dashboardClient";

const provisionSchema = z.object({
  organizationId: objectIdSchema,
  workspaceId: objectIdSchema,
  industryPackKey: z.string().trim().min(1),
});

// Master plan Phase 8, fallback path: a staffer picking/activating an Industry Pack by hand from
// this console. The primary path (an onboarding questionnaire triggering this same underlying
// Dashboard-WhatsApp endpoint automatically) doesn't exist yet - this route is the mechanism
// either path would call.
export async function POST(request: Request) {
  try {
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.managePlatformAdmin });

    const payload = provisionSchema.parse(await request.json());
    if (!payload.organizationId) return fail("organizationId is required.", 400);

    const result = await provisionDashboardOrganization(payload.organizationId, {
      workspaceId: payload.workspaceId,
      industryPackKey: payload.industryPackKey,
    });
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
