import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidDashboardSecret } from "@/lib/auth/dashboard-actor";
import { objectIdSchema } from "@/lib/validation/common";
import { MeetingModel } from "@/models";
import { ApiError, handleApiError, ok } from "@/lib/api/responses";

const remindSchema = z.object({ window: z.enum(["24h", "1h"]) });
const REMINDED_FIELD = { "24h": "reminded24hAt", "1h": "reminded1hAt" } as const;

type Params = Promise<{ id: string }>;

// Called by Dashboard-WhatsApp only after it has actually sent the reminder WhatsApp message -
// marking it here first and sending second would risk a real meeting silently never getting
// reminded if the send itself failed.
export async function POST(request: Request, { params }: { params: Params }) {
  try {
    assertValidDashboardSecret(request);
    await connectToDatabase();

    const { id } = await params;
    const meetingId = objectIdSchema.parse(id);
    const { window } = remindSchema.parse(await request.json());

    const meeting = await MeetingModel.findById(meetingId);
    if (!meeting) throw new ApiError("Meeting not found.", 404);

    meeting.set(REMINDED_FIELD[window], new Date());
    await meeting.save();

    return ok({ id: String(meeting._id), [REMINDED_FIELD[window]]: meeting[REMINDED_FIELD[window]] });
  } catch (error) {
    return handleApiError(error);
  }
}
