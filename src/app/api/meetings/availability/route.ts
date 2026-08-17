import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess, permissionRules } from "@/lib/auth/permissions";
import { meetingAvailabilitySchema } from "@/lib/validation/meeting-availability";
import { handleApiError, ok } from "@/lib/api/responses";
import { MeetingAvailabilityModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageMeetings });

    const availability = await MeetingAvailabilityModel.findOne().lean();
    return ok(serializeForJson(availability));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: permissionRules.manageMeetings });

    const payload = meetingAvailabilitySchema.parse(await request.json());

    const availability = await MeetingAvailabilityModel.findOneAndUpdate(
      {},
      { $set: payload },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    return ok(serializeForJson(availability));
  } catch (error) {
    return handleApiError(error);
  }
}
