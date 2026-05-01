import { connectToDatabase } from "@/lib/db/mongodb";
import { handleApiError, fail, ok } from "@/lib/api/responses";
import { LeadModel } from "@/models";
import { createWebsiteLeadSchema } from "@/lib/validation/lead";
import { scoreLead } from "@/lib/leads/scoring";
import { serializeForJson } from "@/lib/utils/serialize";
import {
  extractLeadSourceTracking,
  isAllowedLeadCaptureOrigin,
} from "@/lib/leads/source-tracking";

function buildCorsHeaders(origin: string, request: Request): HeadersInit {
  const requestedHeaders = request.headers.get("access-control-request-headers");

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    throw new Error("Lead capture is forbidden for this origin");
  }

  return requestOrigin;
}

export async function OPTIONS(request: Request) {
  try {
    const origin = assertAllowedOrigin(request);
    return withCors(new Response(null, { status: 204 }), origin, request);
  } catch {
    return fail("Lead capture is forbidden for this origin", 403);
  }
}

export async function POST(request: Request) {
  let origin: string | null = null;

  try {
    origin = assertAllowedOrigin(request);
    await connectToDatabase();

    const payload = createWebsiteLeadSchema.parse(await request.json());

    const tracking = extractLeadSourceTracking(request);
    const scoring = scoreLead({
      source: payload.source,
      category: payload.category,
      urgency: payload.urgency,
      budget: payload.budget,
    });

    const lead = await LeadModel.create({
      ...payload,
      ...scoring,
      sourceDomain: tracking.sourceDomain,
      sourcePath: tracking.sourcePath,
      sourceReferrer: tracking.sourceReferrer,
    });

    return withCors(ok(serializeForJson(lead), { status: 201 }), origin, request);
  } catch (error) {
    const response = handleApiError(error);
    if (!origin) {
      return response;
    }
    return withCors(response, origin, request);
  }
}
