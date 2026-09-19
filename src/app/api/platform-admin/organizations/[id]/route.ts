import { z } from "zod";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { objectIdSchema } from "@/lib/validation/common";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { updateDashboardOrganization } from "@/lib/platformAdmin/dashboardClient";

type Params = Promise<{ id: string }>;

const updateOrganizationSchema = z.object({
  plan: z.enum(["basic", "medium", "pro", "custom"]).optional(),
  billingStatus: z
    .enum(["trial", "active", "pending", "cancelling", "past_due", "suspended", "halted", "cancelled"])
    .optional(),
});

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.managePlatformAdmin });

    const { id } = await params;
    const organizationId = objectIdSchema.parse(id);
    const payload = updateOrganizationSchema.parse(await request.json());

    if (!payload.plan && !payload.billingStatus) {
      return fail("Provide plan and/or billingStatus to update.", 400);
    }

    const result = await updateDashboardOrganization(organizationId, payload);
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
