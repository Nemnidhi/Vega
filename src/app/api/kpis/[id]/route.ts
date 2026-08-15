import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { objectIdSchema } from "@/lib/validation/common";
import { updateKpiSchema } from "@/lib/validation/kpi";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { KpiModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { computeKpiProgress } from "@/lib/kpi/progress";

type Params = Promise<{ id: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    const { id } = await params;
    const kpiId = objectIdSchema.parse(id);

    const kpi = await KpiModel.findById(kpiId)
      .populate("assignedUserId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .lean();
    if (!kpi) {
      return fail("KPI not found.", 404);
    }

    const isOwner =
      String(kpi.assignedUserId?._id ?? kpi.assignedUserId ?? "") === actor.userId ||
      kpi.assignedRole === actor.role;
    if (!isOwner) {
      assertRoleAccess(actor.role, { oneOf: permissionRules.manageKpis });
    }

    const progress = await computeKpiProgress(String(kpi._id), kpi.target);
    return ok(serializeForJson({ ...kpi, progress }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageKpis });

    const { id } = await params;
    const kpiId = objectIdSchema.parse(id);
    const payload = updateKpiSchema.parse(await request.json());

    const kpi = await KpiModel.findById(kpiId);
    if (!kpi) {
      return fail("KPI not found.", 404);
    }

    if (payload.title !== undefined) kpi.title = payload.title;
    if (payload.description !== undefined) kpi.description = payload.description;
    if (payload.target !== undefined) kpi.target = payload.target;
    if (payload.period !== undefined) kpi.period = payload.period;
    if (payload.periodStart !== undefined) kpi.periodStart = payload.periodStart;
    if (payload.periodEnd !== undefined) kpi.periodEnd = payload.periodEnd;
    if (payload.assignedRole !== undefined) kpi.assignedRole = payload.assignedRole;
    if (payload.assignedUserId !== undefined) {
      kpi.assignedUserId = payload.assignedUserId as unknown as typeof kpi.assignedUserId;
    }

    await kpi.save();

    const hydrated = await KpiModel.findById(kpi._id)
      .populate("assignedUserId", "fullName email role")
      .populate("createdBy", "fullName email role")
      .lean();

    // Same reason as POST /api/kpis: the client always reads kpi.progress.progress.
    const progress = await computeKpiProgress(String(kpi._id), kpi.target);

    return ok(serializeForJson({ ...hydrated, progress }));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageKpis });

    const { id } = await params;
    const kpiId = objectIdSchema.parse(id);

    const kpi = await KpiModel.findById(kpiId);
    if (!kpi) {
      return fail("KPI not found.", 404);
    }

    await kpi.deleteOne();
    return ok({ deleted: true });
  } catch (error) {
    return handleApiError(error);
  }
}
