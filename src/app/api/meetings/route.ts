import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { MeetingModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    if (actor.role === "client") {
      throw new Error("Forbidden");
    }

    const meetings = await MeetingModel.find({ status: "confirmed" })
      .sort({ startAt: 1 })
      .limit(500)
      .populate("clientUserId", "fullName email")
      .populate("assignedToUserId", "fullName")
      .lean();

    return ok(serializeForJson(meetings));
  } catch (error) {
    return handleApiError(error);
  }
}
