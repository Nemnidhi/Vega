// Public open-slots list for the "Book a strategy call" button on the audit-report web view -
// keyed by the report's own shareToken (same origin-allowlist gate as the sibling audit-report
// routes), not a portal session. A cold WhatsApp/ad lead has no portal account, so this is the
// public-facing twin of client-portal/meetings/availability and integrations/meetings/slots
// (that one's for Dashboard-WhatsApp's server-to-server bot flow) - same computeOpenSlots engine,
// third caller of it.

import { connectToDatabase } from "@/lib/db/mongodb";
import { MeetingAvailabilityModel, MeetingModel, ReportModel } from "@/models";
import { computeOpenSlots, type AvailabilityConfig } from "@/lib/meetings/slots";
import { addDaysToDateKey, getMeetingDateKey, istWallTimeToUtc } from "@/lib/meetings/date";
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
    const report = await ReportModel.findOne({ shareToken: token }).select("_id");
    if (!report) {
      return withCors(fail("Report not found", 404), origin, request);
    }

    const availabilityDoc = await MeetingAvailabilityModel.findOne().lean();
    if (!availabilityDoc) {
      return withCors(ok({ configured: false, slots: [] }), origin, request);
    }

    const availability: AvailabilityConfig = {
      weeklyWindows: availabilityDoc.weeklyWindows ?? [],
      slotDurationMinutes: availabilityDoc.slotDurationMinutes,
      bufferMinutes: availabilityDoc.bufferMinutes,
      maxConcurrentBookings: availabilityDoc.maxConcurrentBookings,
      bookingWindowDays: availabilityDoc.bookingWindowDays,
      minNoticeHours: availabilityDoc.minNoticeHours,
      blackoutDates: availabilityDoc.blackoutDates ?? [],
    };

    const now = new Date();
    const windowEndDateKey = addDaysToDateKey(getMeetingDateKey(now), availability.bookingWindowDays);
    const windowEnd = istWallTimeToUtc(windowEndDateKey, "23:59");

    // Public flow only ever offers "online" - a cold digital lead could be anywhere, in-person
    // is a staff-arranged exception, not a self-serve option here.
    const existingMeetings = await MeetingModel.find({
      type: "online",
      status: "confirmed",
      startAt: { $gte: now, $lte: windowEnd },
    })
      .select("startAt")
      .lean();

    const slots = computeOpenSlots({ availability, type: "online", existingMeetings, now });

    return withCors(
      ok({ configured: true, slots: slots.slice(0, 20).map((slot) => ({ dateKey: slot.dateKey, timeKey: slot.timeKey })) }),
      origin,
      request,
    );
  } catch (error) {
    const response = handleApiError(error);
    if (!origin) return response;
    return withCors(response, origin, request);
  }
}
