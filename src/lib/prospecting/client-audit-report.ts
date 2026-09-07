// Shared by the cookie-session route's GET handler (src/app/api/leads/[id]/audit-report/route.ts)
// and the shared-secret /api/client-portal/audit-report/[leadId] route the website calls.
// Client-only: the existing route also serves staff (any lead), but client-portal callers
// are always role "client" by construction (resolveClientPortalActor never returns anything
// else), so this only needs the client-ownership branch.

import { ReportModel } from "@/models";
import type { AuthSession } from "@/lib/auth/session";
import { resolveClientLeadId } from "@/lib/auth/client-lead";
import { ApiError } from "@/lib/api/responses";

export async function getClientAuditReportPdf(session: AuthSession, leadId: string): Promise<Buffer> {
  if (session.role !== "client") throw new Error("Forbidden");

  const clientLeadId = await resolveClientLeadId(session);
  if (!clientLeadId || clientLeadId !== leadId) throw new Error("Forbidden");

  // Hydrated, not .lean() - a lean read returns the pdf as a BSON Binary rather than a Buffer.
  const report = await ReportModel.findOne({ leadId }).sort({ generatedAt: -1 });
  if (!report) {
    throw new ApiError("No audit report generated for this lead yet", 404);
  }

  return Buffer.isBuffer(report.pdf) ? report.pdf : Buffer.from(report.pdf.buffer);
}
