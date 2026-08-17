import { connectToDatabase } from "@/lib/db/mongodb";
import { handleApiError, fail, ok } from "@/lib/api/responses";
import { PricingTierModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";
import { extractLeadSourceTracking, isAllowedLeadCaptureOrigin } from "@/lib/leads/source-tracking";

// Public, read-only, deliberately minimal - key/label/order only. Mirrors
// /api/public/industries - see that route for the CORS/origin rationale.
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

    const tiers = await PricingTierModel.find({ isActive: true })
      .sort({ order: 1 })
      .select("key label order")
      .lean();

    const data = tiers.map((tier) => ({ key: tier.key, label: tier.label, order: tier.order }));

    return withCors(ok(serializeForJson(data)), origin, request);
  } catch (error) {
    const response = handleApiError(error);
    if (!origin) return response;
    return withCors(response, origin, request);
  }
}
