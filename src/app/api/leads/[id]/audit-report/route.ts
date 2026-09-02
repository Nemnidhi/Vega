// Digital-presence audit report for a lead.
//   POST - generate (or regenerate) the PDF and store it
//   GET  - download the stored PDF
//
// Named `audit-report` to stay clear of Vega's own /proposals/[id]/pdf -
// these are different documents: a proposal follows a sales conversation,
// this precedes one.
//
// Samvid gated the equivalent routes behind env-var basic auth; that's
// retired in favour of Vega's session + role system.

import { renderToBuffer } from "@react-pdf/renderer";
import { connectToDatabase } from "@/lib/db/mongodb";
import { LeadModel, ReportModel } from "@/models";
import { handleApiError, fail, ok } from "@/lib/api/responses";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { getCurrentSession } from "@/lib/auth/session";
import { getClientAuditReportPdf } from "@/lib/prospecting/client-audit-report";
import { logActivity } from "@/lib/activity/logging";
import { buildReportDocument } from "@/lib/prospecting/report-template";
import { generateParagraph } from "@/lib/prospecting/generate-paragraph";
import {
  toClassificationResult,
  toEnrichmentSignals,
  toProspectSubject,
} from "@/lib/prospecting/lead-adapter";
import type { Lead } from "@/types/lead";

type Params = Promise<{ id: string }>;

export async function POST(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageLeads });

    const { id } = await params;
    const lead = await LeadModel.findById(id).lean<Lead | null>();
    if (!lead) {
      return fail("Lead not found", 404);
    }

    const enrichment = toEnrichmentSignals(lead);
    const classification = toClassificationResult(lead);

    // Refuse rather than invent a tier: a report asserting "Tier A: no
    // digital presence found" for a lead nobody checked would be a lie to a
    // real business.
    if (!classification) {
      return fail(
        "Lead has not been classified yet - run enrichment and classification first",
        409,
      );
    }
    if (!Object.keys(enrichment).length) {
      return fail("Lead has no enrichment signals yet - run enrichment first", 409);
    }

    const subject = toProspectSubject(lead);
    const paragraph = await generateParagraph(subject, enrichment, classification);

    const doc = await buildReportDocument({
      lead: subject,
      enrichment,
      classification,
      paragraph: paragraph.text,
    });
    const pdf = await renderToBuffer(doc);

    await ReportModel.findOneAndUpdate(
      { leadId: lead._id },
      {
        $set: {
          leadId: lead._id,
          legacyLeadId: lead.prospecting?.legacyLeadId ?? null,
          pdf,
          categoryUsed: classification.category,
          paragraphSource: paragraph.source,
          generatedAt: new Date(),
        },
      },
      { upsert: true, new: true },
    );

    // Only advance the audit pipeline - the sales `status` is not ours to move.
    await LeadModel.updateOne(
      { _id: lead._id },
      { $set: { "prospecting.prospectingStatus": "reported" } },
    );

    await logActivity({
      action: "audit_report_generated",
      actorId: actor.userId,
      entityType: "lead",
      entityId: String(lead._id),
      details: {
        tier: classification.category,
        confidence: classification.confidence,
        paragraphSource: paragraph.source,
        bytes: pdf.length,
      },
    });

    return ok({
      bytes: pdf.length,
      tier: classification.category,
      confidence: classification.confidence,
      paragraphSource: paragraph.source,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function GET(_: Request, { params }: { params: Params }) {
  try {
    await connectToDatabase();
    const { id } = await params;

    // Staff can download any lead's report; a client may only download
    // their own - same ownership check the blueprint routes use.
    const session = await getCurrentSession();
    if (!session) throw new Error("Unauthorized");

    let pdf: Buffer;
    if (session.role === "client") {
      pdf = await getClientAuditReportPdf(session, id);
    } else {
      assertRoleAccess(session.role, { oneOf: permissionRules.manageLeads });
      // Hydrated, not .lean() - a lean read returns the pdf as a BSON Binary
      // rather than a Buffer.
      const report = await ReportModel.findOne({ leadId: id }).sort({ generatedAt: -1 });
      if (!report) {
        return fail("No audit report generated for this lead yet", 404);
      }
      pdf = Buffer.isBuffer(report.pdf) ? report.pdf : Buffer.from(report.pdf.buffer);
    }

    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="audit-report-${id}.pdf"`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
