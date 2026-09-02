import { connectToDatabase } from "@/lib/db/mongodb";
import { handleApiError, fail, ok } from "@/lib/api/responses";
import { IndustryModel, IndustrySegmentModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { extractLeadSourceTracking, isAllowedLeadCaptureOrigin } from "@/lib/leads/source-tracking";

// Public, read-only, deliberately minimal - key/label only. No pricing here;
// see /api/public/questionnaire for that, scoped to one industry at a time.
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

export async function GET(request: Request) {
  let origin: string | null = null;
  try {
    origin = assertAllowedOrigin(request);
    await connectToDatabase();

    const [industries, segments] = await Promise.all([
      IndustryModel.find({ isActive: true }).sort({ sortOrder: 1, label: 1 }).select("key label").lean(),
      IndustrySegmentModel.find({ isActive: true }).sort({ sortOrder: 1, label: 1 }).select("industryId key label description").lean(),
    ]);

    const segmentsByIndustry = new Map<string, typeof segments>();
    for (const segment of segments) {
      const industryId = String(segment.industryId);
      const list = segmentsByIndustry.get(industryId) ?? [];
      list.push(segment);
      segmentsByIndustry.set(industryId, list);
    }

    const data = industries.map((industry) => ({
      key: industry.key,
      label: industry.label,
      segments: (segmentsByIndustry.get(String(industry._id)) ?? []).map((segment) => ({
        key: segment.key,
        label: segment.label,
        description: segment.description,
      })),
    }));

    return withCors(ok(serializeForJson(data)), origin, request);
  } catch (error) {
    const response = handleApiError(error);
    if (!origin) return response;
    return withCors(response, origin, request);
  }
}
