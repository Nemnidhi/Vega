import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidDashboardSecret } from "@/lib/auth/dashboard-actor";
import { dashboardEventSchema } from "@/lib/validation/integrations";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { ClientModel } from "@/models";
import { logActivity } from "@/lib/activity/logging";
import { serializeForJson } from "@/lib/utils/serialize";

export async function POST(request: Request) {
  try {
    assertValidDashboardSecret(request);
    await connectToDatabase();

    const payload = dashboardEventSchema.parse(await request.json());

    const client = await ClientModel.findOne({ dashboardOrganizationId: payload.dashboardOrganizationId });

    // No matching Client is a normal outcome, not an error - Dashboard fires this for every
    // organization, including its own Workspace #1 (Nemnidhi itself), which will never have a
    // Client record. The sender shouldn't need to know which orgs map to real clients. Still
    // worth a server-side log line either way - there was previously no way to tell "Dashboard
    // never called us" from "it called us, nothing matched" from the outside.
    console.log(
      `dashboard-events: received ${payload.event} for org ${payload.dashboardOrganizationId} - ${
        client ? "matched client " + client._id : "no matching client"
      }`,
    );
    if (!client) {
      return ok(serializeForJson({ matched: false }));
    }

    if (payload.event === "plan_changed" && typeof payload.data.plan === "string") {
      client.dashboardPlan = payload.data.plan;
      client.dashboardPlanUpdatedAt = new Date();
    }
    client.dashboardLastEventAt = new Date();
    await client.save();

    await logActivity({
      action: "dashboard_event_received",
      entityType: "client",
      entityId: client._id.toString(),
      details: { event: payload.event, data: payload.data },
    });

    return ok(serializeForJson({ matched: true, clientId: client._id.toString() }));
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Not configured")) {
      return fail(error.message, 503);
    }
    if (error instanceof Error && error.message.startsWith("Unauthorized")) {
      return fail(error.message, 401);
    }
    return handleApiError(error);
  }
}
