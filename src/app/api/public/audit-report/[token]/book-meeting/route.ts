// Public booking for the same shareToken the meeting-slots route above lists - the "Book a
// strategy call" action on the audit-report web view. Lead-based twin of
// client-portal/meetings/book and integrations/meetings/book (Dashboard-WhatsApp's bot flow),
// same slot-revalidation and race-recheck logic, but reached with no auth beyond the report's own
// token - leadId is resolved server-side from the token, never trusted from the client, so a
// booking can't be forged against an arbitrary lead.

import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { MeetingAvailabilityModel, MeetingModel, ReportModel } from "@/models";
import { computeOpenSlots, type AvailabilityConfig } from "@/lib/meetings/slots";
import { istWallTimeToUtc } from "@/lib/meetings/date";
import { sendMeetingConfirmationEmail } from "@/lib/notifications/send-meeting-confirmation-email";
import { logActivity } from "@/lib/activity/logging";
import { ApiError, handleApiError, fail, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";
import { extractLeadSourceTracking, isAllowedLeadCaptureOrigin } from "@/lib/leads/source-tracking";
import { nonEmptyStringSchema } from "@/lib/validation/common";

type Params = Promise<{ token: string }>;

const publicBookMeetingSchema = z.object({
  contactName: nonEmptyStringSchema,
  contactPhone: nonEmptyStringSchema,
  contactEmail: z.string().trim().email().optional(),
  dateKey: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
  timeKey: z.string().trim().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  notes: z.string().trim().max(1000).optional(),
});

const ONLINE_LOCATION = "Meeting link will be shared with you before the call.";

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

export async function POST(request: Request, { params }: { params: Params }) {
  let origin: string | null = null;
  try {
    origin = assertAllowedOrigin(request);
    await connectToDatabase();

    const { token } = await params;
    const report = await ReportModel.findOne({ shareToken: token }).select("leadId");
    if (!report) {
      return withCors(fail("Report not found", 404), origin, request);
    }

    const payload = publicBookMeetingSchema.parse(await request.json());

    const availabilityDoc = await MeetingAvailabilityModel.findOne().lean();
    if (!availabilityDoc) {
      throw new ApiError("Meeting booking isn't configured yet.", 409);
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

    const startAtUtc = istWallTimeToUtc(payload.dateKey, payload.timeKey);
    const now = new Date();

    // Re-validate against fresh data - never trust a slot the browser saw when it first fetched
    // the list, the booking may arrive minutes later.
    const existingMeetingsForDay = await MeetingModel.find({
      type: "online",
      status: "confirmed",
      startAt: { $gte: istWallTimeToUtc(payload.dateKey, "00:00"), $lt: istWallTimeToUtc(payload.dateKey, "23:59") },
    })
      .select("startAt")
      .lean();

    const candidateSlots = computeOpenSlots({
      availability,
      type: "online",
      existingMeetings: existingMeetingsForDay,
      now,
      days: availability.bookingWindowDays,
    });
    const stillOpen = candidateSlots.some((slot) => slot.dateKey === payload.dateKey && slot.timeKey === payload.timeKey);
    if (!stillOpen) {
      return withCors(fail("That slot is no longer available.", 409), origin, request);
    }

    const concurrentCount = await MeetingModel.countDocuments({ startAt: startAtUtc, type: "online", status: "confirmed" });
    if (concurrentCount >= availability.maxConcurrentBookings.online) {
      return withCors(fail("That slot was just taken.", 409), origin, request);
    }

    const meeting = await MeetingModel.create({
      type: "online",
      startAt: startAtUtc,
      durationMinutes: availability.slotDurationMinutes,
      clientUserId: null,
      leadId: report.leadId,
      contactName: payload.contactName,
      contactEmail: payload.contactEmail ?? "",
      contactPhone: payload.contactPhone,
      notes: payload.notes ?? "",
      status: "confirmed",
      assignedToUserId: null,
      location: ONLINE_LOCATION,
    });

    await logActivity({
      action: "meeting_booked",
      entityType: "meeting",
      entityId: String(meeting._id),
      details: { type: "online", startAt: startAtUtc.toISOString(), source: "audit_report_public" },
    });

    const emailResult = payload.contactEmail
      ? await sendMeetingConfirmationEmail({
          to: payload.contactEmail,
          contactName: payload.contactName,
          type: "online",
          startAt: startAtUtc,
          durationMinutes: availability.slotDurationMinutes,
          location: ONLINE_LOCATION,
        })
      : { sent: false as const, reason: "no_email" as const };

    return withCors(
      ok(
        { meeting: serializeForJson(meeting.toObject()), emailSent: emailResult.sent, durationMinutes: availability.slotDurationMinutes },
        { status: 201 },
      ),
      origin,
      request,
    );
  } catch (error) {
    const response = handleApiError(error);
    if (!origin) return response;
    return withCors(response, origin, request);
  }
}
