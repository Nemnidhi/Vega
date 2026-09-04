// Public, unauthenticated JSON view of a generated audit report, keyed by the report's own
// unguessable `shareToken` rather than a login - this is the route nemnidhi.com's
// /audit-report/[token] page calls server-to-server (lib/vega-proxy.ts, same
// LEAD_CAPTURE_ALLOWED_ORIGINS origin check every other /api/public/* route already enforces).
// A cold WhatsApp/ad lead has no portal account, so this is the only way they can see their own
// report as a web page instead of only a PDF - see report-data.ts for the payload shape.

import { connectToDatabase } from "@/lib/db/mongodb";
import { ReportModel } from "@/models";
import { handleApiError, fail, ok } from "@/lib/api/responses";
import { extractLeadSourceTracking, isAllowedLeadCaptureOrigin } from "@/lib/leads/source-tracking";

type Params = Promise<{ token: string }>;

function buildCorsHeaders(origin: string, request: Request): HeadersInit {
  const requestedHeaders = request.headers.get("access-control-request-headers");
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": requestedHeaders ?? "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin, Access-Control-Request-Headers",
  };
}

function withCors(response: Response, origin: string, request: Request) {
  const corsHeaders = buildCorsHeaders(origin, request) as Record<string, string>;
  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }
  return response;
}

function assertAllowedOrigin(request: Request) {
  const { requestOrigin } = extractLeadSourceTracking(request);
  if (!requestOrigin || !isAllowedLeadCaptureOrigin(requestOrigin)) {
    throw new Error("Forbidden for this origin");
  }
  return requestOrigin;
}

export async function OPTIONS(request: Request) {
  try {
    const origin = assertAllowedOrigin(request);
    return withCors(new Response(null, { status: 204 }), origin, request);
  } catch {
    return fail("Forbidden for this origin", 403);
  }
}

export async function GET(request: Request, { params }: { params: Params }) {
  let origin: string | null = null;
  try {
    origin = assertAllowedOrigin(request);
    await connectToDatabase();

    const { token } = await params;
    const report = await ReportModel.findOne({ shareToken: token }).select("reportData").lean();
    if (!report || !report.reportData) {
      return withCors(fail("Report not found", 404), origin, request);
    }

    return withCors(ok(report.reportData), origin, request);
  } catch (error) {
    const response = handleApiError(error);
    if (!origin) return response;
    return withCors(response, origin, request);
  }
}
