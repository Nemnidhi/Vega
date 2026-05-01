import type { Proposal } from "@/types/proposal";
import type { Client } from "@/types/client";
import type { Lead } from "@/types/lead";
import type { ScopeManifest } from "@/types/scope-manifest";

function currency(amount: number, code: "INR" | "USD") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function buildProposalHtml(input: {
  proposal: Proposal;
  client: Client;
  lead: Lead;
  scopeManifest: ScopeManifest;
}) {
  const { proposal, client, lead, scopeManifest } = input;
  const pricingRows = proposal.pricing
    .map(
      (line) =>
        `<tr><td>${line.label}</td><td>${line.quantity}</td><td>${currency(
          line.amount,
          line.currency,
        )}</td><td>${currency(line.amount * line.quantity, line.currency)}</td></tr>`,
    )
    .join("");

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Proposal ${proposal._id}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 28px; color: #0f172a; }
      h1, h2, h3 { margin-bottom: 6px; }
      .muted { color: #475467; }
      .block { margin-bottom: 18px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      th, td { border: 1px solid #d0d5dd; padding: 8px; text-align: left; }
      th { background: #f8fafe; }
      ul { margin: 8px 0; padding-left: 20px; }
      .signature { margin-top: 26px; border-top: 1px solid #d0d5dd; padding-top: 12px; }
    </style>
  </head>
  <body>
    <div class="block">
      <h1>Project Proposal</h1>
      <p class="muted">Status: ${proposal.status} | Version: ${proposal.version}</p>
    </div>

    <div class="block">
      <h2>Client Details</h2>
      <p><strong>${client.legalName}</strong></p>
      <p>${client.primaryContactName} (${client.primaryContactEmail})</p>
      <p class="muted">Lead: ${lead.title}</p>
    </div>

    <div class="block">
      <h2>Project Summary</h2>
      <p>${proposal.projectSummary}</p>
    </div>

    <div class="block">
      <h2>Scope of Work</h2>
      <ul>${proposal.scopeOfWork.map((item) => `<li>${item}</li>`).join("")}</ul>
    </div>

    <div class="block">
      <h2>Deliverable Manifest</h2>
      <ul>${scopeManifest.confirmedDeliverables.map((item) => `<li>${item}</li>`).join("")}</ul>
    </div>

    <div class="block">
      <h2>Exclusions</h2>
      <ul>${proposal.exclusions.map((item) => `<li>${item}</li>`).join("")}</ul>
    </div>

    <div class="block">
      <h2>Timeline</h2>
      <p>${proposal.timeline}</p>
    </div>

    <div class="block">
      <h2>Pricing</h2>
      <table>
        <thead>
          <tr><th>Component</th><th>Qty</th><th>Rate</th><th>Total</th></tr>
        </thead>
        <tbody>${pricingRows}</tbody>
      </table>
    </div>

    <div class="block">
      <h2>Payment Schedule</h2>
      <ul>
        ${proposal.paymentSchedule
          .map(
            (item) =>
              `<li>${item.label}: ${currency(item.amount, item.currency)}${
                item.dueBy ? ` (Due ${new Date(item.dueBy).toLocaleDateString("en-IN")})` : ""
              }</li>`,
          )
          .join("")}
      </ul>
    </div>

    <div class="block">
      <h2>Change Order Clause</h2>
      <p>${proposal.changeOrderClause}</p>
    </div>

    <div class="signature">
      <h3>Signature Block</h3>
      <p>${proposal.signatureBlock}</p>
    </div>
  </body>
</html>
  `.trim();
}
