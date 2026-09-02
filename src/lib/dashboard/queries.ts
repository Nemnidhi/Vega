import { connectToDatabase } from "@/lib/db/mongodb";
import {
  ActivityLogModel,
  ChangeOrderModel,
  ClientModel,
  ClientQueryModel,
  LeadModel,
  PasswordChangeRequestModel,
  PricingComponentModel,
  ProjectModel,
  ProposalModel,
  ScopeManifestModel,
  TaskModel,
  UserModel,
} from "@/models";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { permissionRules } from "@/lib/auth/permissions";
import { serializeForJson } from "@/lib/utils/serialize";
import { computeAccountHealth } from "@/lib/clients/health";
import type { UserRole } from "@/types/user";

function clampLimit(value: number | undefined, fallback: number, max: number) {
  return Math.min(Math.max(value ?? fallback, 1), max);
}

export async function getDashboardMetrics() {
  await connectToDatabase();

  const [leadMetricRows, recentActivity] = await Promise.all([
    LeadModel.aggregate([
      {
        $group: {
          _id: null,
          totalLeads: { $sum: 1 },
          heavyArtilleryLeads: {
            $sum: { $cond: [{ $eq: ["$priorityBand", "heavy_artillery"] }, 1, 0] },
          },
          standardPipelineLeads: {
            $sum: { $cond: [{ $eq: ["$priorityBand", "standard_sales"] }, 1, 0] },
          },
          volumePipelineLeads: {
            $sum: { $cond: [{ $eq: ["$priorityBand", "volume_pipeline"] }, 1, 0] },
          },
          closedWonLeads: {
            $sum: { $cond: [{ $eq: ["$status", "closed_won"] }, 1, 0] },
          },
        },
      },
    ]),
    ActivityLogModel.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select("action entityType createdAt")
      .lean(),
  ]);

  const leadMetrics = leadMetricRows[0] ?? {};

  return serializeForJson({
    totalLeads: leadMetrics.totalLeads ?? 0,
    heavyArtilleryLeads: leadMetrics.heavyArtilleryLeads ?? 0,
    standardPipelineLeads: leadMetrics.standardPipelineLeads ?? 0,
    volumePipelineLeads: leadMetrics.volumePipelineLeads ?? 0,
    closedWonLeads: leadMetrics.closedWonLeads ?? 0,
    recentActivity,
  });
}

export async function getLeads(options?: { limit?: number }) {
  await connectToDatabase();
  const limit = clampLimit(options?.limit, 200, 500);
  const leads = await LeadModel.find({})
    .sort({ updatedAt: -1 })
    .limit(limit)
    // prospecting.* is projected narrowly on purpose - the list only needs
    // the tier and industry, not the enrichment payload.
    .select(
      "title contactName source status updatedAt prospecting.industry prospecting.segment prospecting.prospectingStatus prospecting.classification.category",
    )
    .lean();
  return serializeForJson(leads);
}

export async function getLeadById(id: string) {
  await connectToDatabase();
  const lead = await LeadModel.findById(id)
    .select("title status score priorityBand")
    .lean();
  return serializeForJson(lead);
}

export async function getScopeByLeadId(leadId: string) {
  await connectToDatabase();
  const scope = await ScopeManifestModel.findOne({ leadId }).lean();
  return serializeForJson(scope);
}

export async function getProposals() {
  await connectToDatabase();
  const proposals = await ProposalModel.find({})
    .sort({ updatedAt: -1 })
    .select("version status approvalStatus leadId clientId")
    .populate("leadId", "title")
    .populate("clientId", "legalName")
    .lean();
  return serializeForJson(proposals);
}

export async function getProposalById(id: string) {
  await connectToDatabase();
  const proposal = await ProposalModel.findById(id)
    .select(
      "status approvalStatus projectSummary timeline scopeOfWork exclusions pricing paymentSchedule changeOrderClause signatureBlock leadId clientId",
    )
    .populate("leadId", "title")
    .populate("clientId", "legalName")
    .lean();
  return serializeForJson(proposal);
}

export async function getPricingComponents() {
  await connectToDatabase();
  const components = await PricingComponentModel.find({})
    .sort({ isActive: -1, updatedAt: -1 })
    .select("code title category basePrice complexityMultiplier marginPercentage finalPrice isActive")
    .lean();
  return serializeForJson(components);
}

export async function getChangeOrders() {
  await connectToDatabase();
  const changeOrders = await ChangeOrderModel.find({})
    .sort({ updatedAt: -1 })
    .select("requestedFeature additionalPrice currency timelineImpactDays approvalStatus leadId")
    .populate("leadId", "title")
    .lean();
  return serializeForJson(changeOrders);
}

export async function getClientVault(clientId: string) {
  await connectToDatabase();
  const [client, proposals, scopes, changeOrders] = await Promise.all([
    ClientModel.findById(clientId)
      .select(
        "legalName primaryContactName primaryContactEmail primaryContactPhone industry companySize preferredCommunication requirementSummary requirementDetails onboardingStatus onboardedAt",
      )
      .lean(),
    ProposalModel.find({ clientId })
      .sort({ updatedAt: -1 })
      .select("status approvalStatus")
      .lean(),
    ScopeManifestModel.find({ clientId })
      .sort({ updatedAt: -1 })
      .select("isCompleted signedAt")
      .lean(),
    ChangeOrderModel.find({ clientId })
      .sort({ updatedAt: -1 })
      .select("approvalStatus requestedFeature")
      .lean(),
  ]);

  return serializeForJson({ client, proposals, scopes, changeOrders });
}

export async function getClients() {
  await connectToDatabase();
  const clients = await ClientModel.find({})
    .sort({ updatedAt: -1 })
    .limit(300)
    .select(
      "legalName primaryContactName primaryContactEmail primaryContactPhone preferredCommunication requirementSummary onboardingStatus onboardedAt dashboardOrganizationId dashboardLastEventAt",
    )
    .lean();

  // Batch-fetch each client's most recent plan_changed event for the health computation, rather
  // than one query per client. Only clients actually linked to a Dashboard org can have any.
  const clientIds = clients
    .filter((client) => client.dashboardOrganizationId)
    .map((client) => client._id);
  const latestPlanChangeByClientId = new Map<string, { plan?: string; previousPlan?: string }>();
  if (clientIds.length > 0) {
    const logs = await ActivityLogModel.aggregate([
      {
        $match: {
          entityType: "client",
          entityId: { $in: clientIds },
          action: "dashboard_event_received",
          "details.event": "plan_changed",
        },
      },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$entityId", details: { $first: "$details" } } },
    ]);
    for (const log of logs) {
      latestPlanChangeByClientId.set(String(log._id), log.details?.data ?? {});
    }
  }

  const clientsWithHealth = clients.map((client) => ({
    ...client,
    accountHealth: computeAccountHealth({
      dashboardOrganizationId: client.dashboardOrganizationId,
      dashboardLastEventAt: client.dashboardLastEventAt,
      latestPlanChange: latestPlanChangeByClientId.get(String(client._id)) ?? null,
    }),
  }));

  return serializeForJson(clientsWithHealth);
}

export async function getStaffUsers() {
  await connectToDatabase();
  const users = await UserModel.find({ role: { $in: LOGIN_ROLES } })
    .sort({ createdAt: -1 })
    .limit(300)
    .select("fullName email role status lastLoginAt createdAt")
    .lean();
  return serializeForJson(users);
}

export async function getPasswordChangeRequests() {
  await connectToDatabase();
  const requests = await PasswordChangeRequestModel.find({})
    .sort({ status: 1, createdAt: -1 })
    .limit(100)
    .populate("userId", "fullName email role")
    .select("userId status createdAt reviewedAt reviewNote")
    .lean();

  return serializeForJson(
    requests.map((request) => ({
      id: String(request._id),
      user: request.userId
        ? {
            id: String(request.userId._id),
            fullName: request.userId.fullName,
            email: request.userId.email,
            role: request.userId.role,
          }
        : null,
      status: request.status,
      createdAt: request.createdAt,
      reviewedAt: request.reviewedAt,
      reviewNote: request.reviewNote ?? "",
    })),
  );
}

export async function getClientQueries(options?: { limit?: number }) {
  await connectToDatabase();
  const limit = clampLimit(options?.limit, 200, 500);
  const queries = await ClientQueryModel.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate("raisedBy", "fullName email")
    .lean();

  return serializeForJson(queries);
}

// Lead.status doubles as the pipeline stage - grouping by it (rather than a separate stage field)
// keeps this in sync with the same status every other lead view already reads/writes.
const pipelineStages = [
  "new",
  "contacted",
  "qualified",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

export async function getPipelineBoard(options?: { limitPerStage?: number }) {
  await connectToDatabase();
  const limitPerStage = clampLimit(options?.limitPerStage, 50, 200);

  const stages = await Promise.all(
    pipelineStages.map(async (stage) => {
      const leads = await LeadModel.find({ status: stage })
        .sort({ score: -1, updatedAt: -1 })
        .limit(limitPerStage)
        .select("title contactName status priorityBand score")
        .lean();
      return { stage, leads: serializeForJson(leads) };
    }),
  );

  return stages;
}

export async function getDevelopers() {
  await connectToDatabase();
  const developers = await UserModel.find({ role: "developer", status: "active" })
    .sort({ fullName: 1 })
    .select("fullName email role status")
    .lean();
  return serializeForJson(developers);
}

function canManageProjects(role: UserRole) {
  return (permissionRules.assignTasksToOthers as UserRole[]).includes(role);
}

// Real task-count summary, not a stored field - Project deliberately carries no embedded tasks
// (see models/Project.ts), so "how many tasks does this project have" is always a live Task
// aggregation scoped by projectId, same index this already has for the /api/tasks list views.
async function attachTaskSummary(projects: Array<{ _id: unknown }>) {
  if (!projects.length) return [];
  const projectIds = projects.map((project) => project._id);
  const rows = await TaskModel.aggregate([
    { $match: { projectId: { $in: projectIds }, parentTaskId: null } },
    {
      $group: {
        _id: "$projectId",
        totalTasks: { $sum: 1 },
        completedTasks: { $sum: { $cond: [{ $in: ["$status", ["done", "COMPLETED"]] }, 1, 0] } },
        blockedTasks: { $sum: { $cond: [{ $eq: ["$status", "BLOCKED"] }, 1, 0] } },
      },
    },
  ]);
  const summaryByProjectId = new Map(rows.map((row) => [String(row._id), row]));

  return projects.map((project) => {
    const summary = summaryByProjectId.get(String(project._id));
    return {
      ...project,
      taskSummary: {
        totalTasks: summary?.totalTasks ?? 0,
        completedTasks: summary?.completedTasks ?? 0,
        blockedTasks: summary?.blockedTasks ?? 0,
      },
    };
  });
}

// Same access shape as GET /api/projects (canManageProjects sees everything; everyone else sees
// only projects they run or are on the team of) - kept in sync deliberately, this is the
// server-page equivalent of that route, not a second definition of the rule.
export async function getProjectsForActor(
  actor: { role: UserRole; userId: string },
  options?: { includeHistory?: boolean; includeArchived?: boolean; limit?: number },
) {
  await connectToDatabase();
  const limit = clampLimit(options?.limit, 200, 500);

  const query: Record<string, unknown> = {};
  if (!options?.includeArchived) query.archivedAt = null;
  if (!canManageProjects(actor.role)) {
    query.$or = [
      { projectManagerId: actor.userId },
      { "team.userId": actor.userId },
      { createdBy: actor.userId },
    ];
  }

  const projects = await ProjectModel.find(query)
    .sort({ updatedAt: -1 })
    .limit(limit)
    .populate("clientId", "legalName primaryContactName")
    .populate("projectManagerId", "fullName email role")
    .populate("team.userId", "fullName email role")
    .lean();

  return serializeForJson(await attachTaskSummary(projects));
}

export async function getProjectByIdForActor(id: string, actor: { role: UserRole; userId: string }) {
  await connectToDatabase();

  const project = await ProjectModel.findById(id)
    .populate("clientId", "legalName primaryContactName primaryContactEmail")
    .populate("projectManagerId", "fullName email role")
    .populate("createdBy", "fullName email role")
    .populate("team.userId", "fullName email role")
    .lean();
  if (!project) return null;

  if (!canManageProjects(actor.role)) {
    const teamUserIds = (project.team ?? []).map((member: { userId?: { _id?: unknown } | string }) =>
      String((member.userId as { _id?: unknown })?._id ?? member.userId),
    );
    const isOnProject =
      String(project.projectManagerId?._id ?? project.projectManagerId ?? "") === actor.userId ||
      String(project.createdBy?._id ?? project.createdBy ?? "") === actor.userId ||
      teamUserIds.includes(actor.userId);
    if (!isOnProject) return null;
  }

  const [withSummary] = await attachTaskSummary([project]);
  const rootTasks = await TaskModel.find({ projectId: id, parentTaskId: null })
    .sort({ order: 1, createdAt: 1 })
    .select("title status priority assignedToUserId dueAt progressPercent code")
    .populate("assignedToUserId", "fullName email")
    .lean();

  return serializeForJson({ ...withSummary, rootTasks });
}

