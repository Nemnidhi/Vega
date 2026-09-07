import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidDashboardSecret } from "@/lib/auth/dashboard-actor";
import { objectIdSchema } from "@/lib/validation/common";
import { MeetingModel } from "@/models";
import { ApiError, handleApiError, ok } from "@/lib/api/responses";

const cancelSchema = z.object({ reason: z.string().trim().max(500).optional() });

type Params = Promise<{ id: string }>;

// Called by Dashboard-WhatsApp's "CTWA - meeting reschedule" satellite flow, right before it
// re-offers slots for a fresh booking - mirrors [id]/remind/route.ts's shape exactly.
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    assertValidDashboardSecret(request);
    await connectToDatabase();

    const { id } = await params;
    const meetingId = objectIdSchema.parse(id);
    const { reason } = cancelSchema.parse(await request.json().catch(() => ({})));

    const meeting = await MeetingModel.findById(meetingId);
    if (!meeting) throw new ApiError("Meeting not found.", 404);

    meeting.status = "cancelled";
    meeting.cancelledAt = new Date();
    meeting.cancelledReason = reason || "Cancelled via Dashboard-WhatsApp";
    await meeting.save();

    return ok({ id: String(meeting._id), status: meeting.status, cancelledAt: meeting.cancelledAt });
  } catch (error) {
    return handleApiError(error);
  }
}
