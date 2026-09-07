// Public PDF download for the same token the JSON route above serves - the web view's
// "Download PDF" button. Same origin-allowlist gate, real binary bytes, no session.

import { connectToDatabase } from "@/lib/db/mongodb";
import { ReportModel } from "@/models";
import { handleApiError, fail } from "@/lib/api/responses";
import { extractLeadSourceTracking, isAllowedLeadCaptureOrigin } from "@/lib/leads/source-tracking";

type Params = Promise<{ token: string }>;

function assertAllowedOrigin(request: Request) {
  const { requestOrigin } = extractLeadSourceTracking(request);
  if (!requestOrigin || !isAllowedLeadCaptureOrigin(requestOrigin)) {
    throw new Error("Forbidden for this origin");
  }
  return requestOrigin;
}

export async function GET(request: Request, { params }: { params: Params }) {
  try {
    assertAllowedOrigin(request);
    await connectToDatabase();

    const { token } = await params;
    // Hydrated, not .lean() - a lean read returns the pdf as a BSON Binary rather than a Buffer.
    const report = await ReportModel.findOne({ shareToken: token });
    if (!report) {
      return fail("Report not found", 404);
    }

    const pdf = Buffer.isBuffer(report.pdf) ? report.pdf : Buffer.from(report.pdf.buffer);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="audit-report-${token}.pdf"`,
        "Content-Length": String(pdf.length),
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
