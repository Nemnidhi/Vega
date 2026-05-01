import { ScopeManifestModel } from "@/models";

function normalizeText(input: string) {
  return input.toLowerCase().replace(/[^\w\s]/g, " ").replace(/\s+/g, " ").trim();
}

export async function detectOutOfScopeFeature(leadId: string, requestedFeature: string) {
  const scopeManifest = await ScopeManifestModel.findOne({ leadId }).lean();

  if (!scopeManifest) {
    return {
      outOfScope: true,
      reason:
        "No scope manifest found. Treating request as out-of-scope until discovery is finalized.",
    };
  }

  const normalizedFeature = normalizeText(requestedFeature);
  const matched = scopeManifest.confirmedDeliverables.some((deliverable: string) => {
    const normalizedDeliverable = normalizeText(deliverable);
    return (
      normalizedFeature.includes(normalizedDeliverable) ||
      normalizedDeliverable.includes(normalizedFeature)
    );
  });

  if (matched) {
    return { outOfScope: false, reason: "Requested feature appears inside confirmed deliverables." };
  }

  return {
    outOfScope: true,
    reason: "Requested feature is outside the Deliverable Manifest and requires a Change Order.",
  };
}
