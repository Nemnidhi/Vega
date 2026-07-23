import { connectToDatabase } from "@/lib/db/mongodb";
import {
  ActivityLogModel,
  ChangeOrderModel,
  ClientModel,
  LeadModel,
  ProjectModel,
  PasswordChangeRequestModel,
  PricingComponentModel,
  ProposalModel,
  ScopeManifestModel,
  UserModel,
} from "@/models";
import { Types } from "mongoose";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { serializeForJson } from "@/lib/utils/serialize";
import type { UserRole } from "@/types/user";

export async function getDashboardMetrics() {
  await connectToDatabase();

  const [
    totalLeads,
    heavyArtilleryLeads,
    standardPipelineLeads,
    volumePipelineLeads,
    closedWonLeads,
    recentActivity,
  ] = await Promise.all([
    LeadModel.countDocuments(),
    LeadModel.countDocuments({ priorityBand: "heavy_artillery" }),
    LeadModel.countDocuments({ priorityBand: "standard_sales" }),
    LeadModel.countDocuments({ priorityBand: "volume_pipeline" }),
    LeadModel.countDocuments({ status: "closed_won" }),
    ActivityLogModel.find({})
      .sort({ createdAt: -1 })
      .limit(10)
      .select("action entityType createdAt")
      .lean(),
  ]);

  return serializeForJson({
    totalLeads,
    heavyArtilleryLeads,
    standardPipelineLeads,
    volumePipelineLeads,
    closedWonLeads,
    recentActivity,
  });
}

export async function getLeads(options?: { limit?: number }) {
  await connectToDatabase();
  const limit = Math.min(Math.max(options?.limit ?? 200, 1), 500);
  const leads = await LeadModel.find({})
    .sort({ updatedAt: -1 })
    .limit(limit)
    .select("title contactName source status updatedAt")
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

export async function getPipelineBoard(options?: { limitPerStage?: number }) {
  await connectToDatabase();
  const limitPerStage = Math.min(Math.max(options?.limitPerStage ?? 60, 1), 200);
  const stages = [
    "new",
    "contacted",
    "qualified",
    "proposal_sent",
    "negotiation",
    "closed_won",
    "closed_lost",
  ];

  const stageLeadGroups = await Promise.all(
    stages.map((stage) =>
      LeadModel.find({ status: stage })
        .sort({ updatedAt: -1 })
        .limit(limitPerStage)
        .select("status title contactName priorityBand score")
        .lean(),
    ),
  );

  const items = stages.map((stage, index) => ({
    stage,
    leads: stageLeadGroups[index] ?? [],
  }));
  return serializeForJson(items);
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
      "legalName primaryContactName primaryContactEmail primaryContactPhone preferredCommunication requirementSummary onboardingStatus onboardedAt",
    )
    .lean();
  return serializeForJson(clients);
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

export async function getDevelopers() {
  await connectToDatabase();
  const developers = await UserModel.find({ role: "developer", status: "active" })
    .sort({ fullName: 1 })
    .select("fullName email role status")
    .lean();
  return serializeForJson(developers);
}

type ProjectPopulationQuery<TSelf> = {
  select(fields: string): TSelf;
  populate(path: string, select: string): TSelf;
};

function applyProjectPopulation<T extends ProjectPopulationQuery<T>>(
  query: T,
  includeHistory: boolean,
) {
  let populated = query
    .select("title description status assignedDeveloperId createdBy tasks updatedAt")
    .populate("assignedDeveloperId", "fullName email role status")
    .populate("createdBy", "fullName email role")
    .populate("tasks.assignedDeveloperId", "fullName email role status")
    .populate("tasks.completedByDeveloperId", "fullName email role status")
    .populate("tasks.createdBy", "fullName email role");

  if (includeHistory) {
    populated = populated
      .populate("tasks.history.actorId", "fullName email role status")
      .populate("tasks.history.assignedDeveloperId", "fullName email role status");
  }

  return populated;
}

function buildProjectAccessQuery(actor: { role: UserRole; userId: string }) {
  if (actor.role === "developer") {
    return {
      $or: [
        { assignedDeveloperId: actor.userId },
        { "tasks.assignedDeveloperId": actor.userId },
      ],
    };
  }

  return {};
}

export async function getProjectsForActor(
  actor: { role: UserRole; userId: string },
  options?: { includeHistory?: boolean; limit?: number },
) {
  await connectToDatabase();
  const includeHistory = options?.includeHistory ?? true;
  const limit = Math.min(Math.max(options?.limit ?? 150, 1), 300);
  const query = buildProjectAccessQuery(actor);

  const projects = await applyProjectPopulation(
    ProjectModel.find(query).sort({ updatedAt: -1 }).limit(limit),
    includeHistory,
  ).lean();

  return serializeForJson(projects);
}

export async function getProjectByIdForActor(
  actor: { role: UserRole; userId: string },
  projectId: string,
  options?: { includeHistory?: boolean },
) {
  await connectToDatabase();
  if (!Types.ObjectId.isValid(projectId)) {
    return null;
  }

  const includeHistory = options?.includeHistory ?? true;
  const accessQuery = buildProjectAccessQuery(actor);
  const query = {
    _id: projectId,
    ...accessQuery,
  };

  const project = await applyProjectPopulation(ProjectModel.findOne(query), includeHistory).lean();
  if (!project) {
    return null;
  }

  return serializeForJson(project);
}
