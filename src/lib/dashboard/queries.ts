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
      .populate("actorId", "fullName role")
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
  const leads = await LeadModel.find({}).sort({ updatedAt: -1 }).lean();
  return serializeForJson(leads);
}

export async function getLeadById(id: string) {
  await connectToDatabase();
  const lead = await LeadModel.findById(id).lean();
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

  const items = await Promise.all(
    stages.map(async (stage) => {
      const leads = await LeadModel.find({ status: stage }).sort({ updatedAt: -1 }).lean();
      return { stage, leads: serializeForJson(leads) };
    }),
  );
  return items;
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
    .populate("leadId", "title priorityBand")
    .populate("clientId", "legalName")
    .lean();
  return serializeForJson(proposals);
}

export async function getProposalById(id: string) {
  await connectToDatabase();
  const proposal = await ProposalModel.findById(id)
    .populate("leadId")
    .populate("clientId")
    .populate("scopeManifestId")
    .lean();
  return serializeForJson(proposal);
}

export async function getPricingComponents() {
  await connectToDatabase();
  const components = await PricingComponentModel.find({})
    .sort({ isActive: -1, updatedAt: -1 })
    .lean();
  return serializeForJson(components);
}

export async function getChangeOrders() {
  await connectToDatabase();
  const changeOrders = await ChangeOrderModel.find({})
    .sort({ updatedAt: -1 })
    .populate("leadId", "title status")
    .populate("clientId", "legalName")
    .lean();
  return serializeForJson(changeOrders);
}

export async function getClientVault(clientId: string) {
  await connectToDatabase();
  const [client, proposals, scopes, changeOrders] = await Promise.all([
    ClientModel.findById(clientId).lean(),
    ProposalModel.find({ clientId }).sort({ updatedAt: -1 }).lean(),
    ScopeManifestModel.find({ clientId }).sort({ updatedAt: -1 }).lean(),
    ChangeOrderModel.find({ clientId }).sort({ updatedAt: -1 }).lean(),
  ]);

  return serializeForJson({ client, proposals, scopes, changeOrders });
}

export async function getClients() {
  await connectToDatabase();
  const clients = await ClientModel.find({}).sort({ updatedAt: -1 }).lean();
  return serializeForJson(clients);
}
