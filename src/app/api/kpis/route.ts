import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { createKpiSchema } from "@/lib/validation/kpi";
import { handleApiError, ok } from "@/lib/api/responses";
import { KpiModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { computeKpiProgress, computeKpiProgressBulk } from "@/lib/kpi/progress";

function canManageKpis(role: string) {
  return (permissionRules.manageKpis as string[]).includes(role);
}

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    // Management roles see every KPI; everyone else sees only what's actually theirs - their
    // own personal KPIs, or team-wide ones assigned to their role.
    const query = canManageKpis(actor.role)
      ? {}
      : { $or: [{ assignedUserId: actor.userId }, { assignedRole: actor.role }] };

    const kpis = await KpiModel.find(query)
      .sort({ periodStart: -1 })
      .populate("assignedUserId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .lean();

    const progressByKpiId = await computeKpiProgressBulk(kpis.map((kpi) => String(kpi._id)));
    const withProgress = kpis.map((kpi) => {
      const completed = progressByKpiId.get(String(kpi._id)) ?? 0;
      return {
        ...kpi,
        progress: {
          completed,
          target: kpi.target,
          progress: kpi.target > 0 ? Math.min(1, completed / kpi.target) : 0,
        },
      };
    });

    return ok(serializeForJson(withProgress));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageKpis });

    const payload = createKpiSchema.parse(await request.json());

    const kpi = await KpiModel.create({
      title: payload.title,
      description: payload.description ?? "",
      target: payload.target,
      period: payload.period,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd,
      assignedRole: payload.assignedRole ?? null,
      assignedUserId: payload.assignedUserId ?? null,
      createdBy: actor.userId,
    });

    const hydrated = await KpiModel.findById(kpi._id)
      .populate("assignedUserId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .lean();

    // A freshly created KPI has no linked tasks yet, but the client's KPI cards always read
    // kpi.progress.progress - GET already attaches this, POST has to as well or the client
    // crashes rendering the new card (this exact bug, caught live while verifying in the browser).
    const progress = await computeKpiProgress(String(kpi._id), kpi.target);

    return ok(serializeForJson({ ...hydrated, progress }), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
