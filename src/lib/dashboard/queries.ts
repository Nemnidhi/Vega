import { connectToDatabase } from "@/lib/db/mongodb";
import {
  ActivityLogModel,
  ChangeOrderModel,
  ClientModel,
  LeadModel,
  PricingComponentModel,
  ProposalModel,
  ScopeManifestModel,
} from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export async function getDashboardMetrics() {
  await connectToDatabase();

  const [
    totalLeads,
    heavyArtilleryLeads,
    standardPipelineLeads,
    volumePipelineLeads,
    closedWonLeads,
    openChangeOrders,
    recentActivity,
  ] = await Promise.all([
    LeadModel.countDocuments(),
    LeadModel.countDocuments({ priorityBand: "heavy_artillery" }),
    LeadModel.countDocuments({ priorityBand: "standard_sales" }),
    LeadModel.countDocuments({ priorityBand: "volume_pipeline" }),
    LeadModel.countDocuments({ status: "closed_won" }),
    ChangeOrderModel.countDocuments({ approvalStatus: { $in: ["pending", "draft"] } }),
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
    openChangeOrders,
    recentActivity,
  });
}

export async function getLeads() {
  await connectToDatabase();
  const leads = await LeadModel.find({})
    .sort({ updatedAt: -1 })
    .select("title contactName email status category score priorityBand")
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
