import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { NotificationModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

const markNotificationsSchema = z.object({
  ids: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(100).optional(),
  readAll: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "1";
    const limit = Math.min(Number(searchParams.get("limit") ?? 20) || 20, 50);
    const query: Record<string, unknown> = { recipientUserId: actor.userId };

    if (unreadOnly) query.readAt = null;

    const [items, unreadCount] = await Promise.all([
      NotificationModel.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate("actorId", "fullName email role")
        .lean(),
      NotificationModel.countDocuments({ recipientUserId: actor.userId, readAt: null }),
    ]);

    return ok(serializeForJson({ items, unreadCount }));
  } catch (error) {
    return handleApiError(error);
  }
}

/**
 * Clear the bell.
 *
 * Marking everything read leaves the list exactly as long as it was, which is
 * not what "clear" means to anyone looking at it - so this removes the rows.
 * Scoped to the caller: a notification belongs to the person it was raised for.
 */
export async function DELETE() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const result = await NotificationModel.deleteMany({ recipientUserId: actor.userId });
    return ok({ cleared: result.deletedCount ?? 0 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const payload = markNotificationsSchema.parse(await request.json());
    const filter: Record<string, unknown> = { recipientUserId: actor.userId, readAt: null };

    if (!payload.readAll) {
      filter._id = { $in: payload.ids ?? [] };
    }

    const result = await NotificationModel.updateMany(filter, { $set: { readAt: new Date() } });
    return ok({ modified: result.modifiedCount });
  } catch (error) {
    return handleApiError(error);
  }
}
