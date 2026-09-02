import { z } from "zod";
import { assertRoleAccess, getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { runWorkflowDueNotificationSweep } from "@/lib/notifications/workflow";

const sweepSchema = z.object({
  daysAhead: z.number().int().min(0).max(30).optional(),
});

export async function POST(request: Request) {
  try {
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { atLeast: "project_manager" });
    const payload = sweepSchema.parse(await request.json().catch(() => ({})));
    const summary = await runWorkflowDueNotificationSweep(payload.daysAhead ?? 2);

    return ok(summary);
  } catch (error) {
    return handleApiError(error);
  }
}
