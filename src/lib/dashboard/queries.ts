import { connectToDatabase } from "@/lib/db/mongodb";
import {
  ActivityLogModel,
  ChangeOrderModel,
  ClientModel,
  LeadModel,
  ProjectModel,
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

export async function getPipelineBoard() {
  await connectToDatabase();
  const stages = [
    "new",
    "contacted",
    "qualified",
    "proposal_sent",
    "negotiation",
    "closed_won",
    "closed_lost",
  ];

  const stageMap = new Map(stages.map((stage) => [stage, [] as unknown[]]));
  const leads = await LeadModel.find({ status: { $in: stages } })
    .sort({ updatedAt: -1 })
    .select("status title contactName priorityBand score")
    .lean();

  for (const lead of leads) {
    const stage = String((lead as { status?: unknown }).status ?? "");
    const bucket = stageMap.get(stage);
    if (bucket) {
      bucket.push(lead);
    }
  }

  const items = stages.map((stage) => ({
    stage,
    leads: stageMap.get(stage) ?? [],
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
    .select("fullName email role status lastLoginAt createdAt")
    .lean();
  return serializeForJson(users);
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
  populate(path: string, select: string): TSelf;
};

function applyProjectPopulation<T extends ProjectPopulationQuery<T>>(
  query: T,
  includeHistory: boolean,
) {
  let populated = query
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
  options?: { includeHistory?: boolean },
) {
  await connectToDatabase();
  const includeHistory = options?.includeHistory ?? true;
  const query = buildProjectAccessQuery(actor);

  const projects = await applyProjectPopulation(
    ProjectModel.find(query).sort({ updatedAt: -1 }),
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
