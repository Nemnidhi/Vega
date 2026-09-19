import { type NextRequest } from "next/server";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import {
  removePushSubscriptionSchema,
  savePushSubscriptionSchema,
} from "@/lib/validation/push";
import { PushSubscriptionModel } from "@/models";

export async function POST(request: NextRequest) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    if (!LOGIN_ROLES.includes(actor.role as (typeof LOGIN_ROLES)[number])) {
      throw new Error("Forbidden for role");
    }

    const payload = savePushSubscriptionSchema.parse(await request.json());

    // Upsert on the endpoint alone, not on (user, endpoint): the same device
    // re-subscribing must update in place, and a device that changes hands has to
    // be reassigned to whoever is signed in now rather than pushing to both.
    await PushSubscriptionModel.findOneAndUpdate(
      { endpoint: payload.endpoint },
      {
        $set: {
          userId: actor.userId,
          endpoint: payload.endpoint,
          p256dh: payload.keys.p256dh,
          auth: payload.keys.auth,
          userAgent: request.headers.get("user-agent")?.slice(0, 400) ?? "",
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    return ok({ subscribed: true });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    const payload = removePushSubscriptionSchema.parse(await request.json());

    await PushSubscriptionModel.deleteOne({
      endpoint: payload.endpoint,
      userId: actor.userId,
    });

    return ok({ subscribed: false });
  } catch (error) {
    return handleApiError(error);
  }
}
