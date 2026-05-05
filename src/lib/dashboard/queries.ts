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

export async function getLeads() {
  await connectToDatabase();
  const leads = await LeadModel.find({})
    .sort({ updatedAt: -1 })
    .select("title contactName email source status category score priorityBand")
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
      .select("legalName primaryContactName primaryContactEmail")
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
    .select("legalName primaryContactName primaryContactEmail")
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

export async function getProjectsForActor(actor: { role: UserRole; userId: string }) {
  await connectToDatabase();

  const query =
    actor.role === "developer"
      ? {
          $or: [
            { assignedDeveloperId: actor.userId },
            { "tasks.assignedDeveloperId": actor.userId },
          ],
        }
      : {};

  const projects = await ProjectModel.find(query)
    .sort({ updatedAt: -1 })
    .populate("assignedDeveloperId", "fullName email role status")
    .populate("createdBy", "fullName email role")
    .populate("tasks.assignedDeveloperId", "fullName email role status")
    .populate("tasks.completedByDeveloperId", "fullName email role status")
    .populate("tasks.createdBy", "fullName email role")
    .lean();

  return serializeForJson(projects);
}
