import { Types } from "mongoose";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { ChatMessageModel, UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

type ConversationSummary = {
  _id: Types.ObjectId;
  lastMessage: string;
  lastMessageAt: Date;
  lastSenderId: Types.ObjectId;
  unreadCount: number;
};

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    if (!LOGIN_ROLES.includes(actor.role as (typeof LOGIN_ROLES)[number])) {
      throw new Error("Forbidden for role");
    }

    const actorObjectId = new Types.ObjectId(actor.userId);

    const [users, summaries] = await Promise.all([
      UserModel.find({
        _id: { $ne: actorObjectId },
        status: "active",
        role: { $in: LOGIN_ROLES },
      })
        .sort({ fullName: 1 })
        .select("fullName email role status")
        .lean(),
      ChatMessageModel.aggregate<ConversationSummary>([
        {
          $match: {
            $or: [{ senderId: actorObjectId }, { recipientId: actorObjectId }],
          },
        },
        { $sort: { createdAt: -1 } },
        {
          $project: {
            counterpartId: {
              $cond: [{ $eq: ["$senderId", actorObjectId] }, "$recipientId", "$senderId"],
            },
            message: 1,
            createdAt: 1,
            senderId: 1,
            recipientId: 1,
            readAt: 1,
          },
        },
        {
          $group: {
            _id: "$counterpartId",
            lastMessage: { $first: "$message" },
            lastMessageAt: { $first: "$createdAt" },
            lastSenderId: { $first: "$senderId" },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ["$recipientId", actorObjectId] },
                      { $eq: ["$readAt", null] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
    ]);

    const summaryMap = new Map(
      summaries.map((item) => [
        String(item._id),
        {
          lastMessage: item.lastMessage,
          lastMessageAt: item.lastMessageAt,
          unreadCount: item.unreadCount,
          lastMessageFromSelf: String(item.lastSenderId) === actor.userId,
        },
      ]),
    );

    const records = users
      .map((user) => {
        const summary = summaryMap.get(String(user._id));

        return {
          ...user,
          lastMessage: summary?.lastMessage ?? "",
          lastMessageAt: summary?.lastMessageAt ?? null,
          unreadCount: summary?.unreadCount ?? 0,
          lastMessageFromSelf: summary?.lastMessageFromSelf ?? false,
        };
      })
      .sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        if (aTime !== bTime) {
          return bTime - aTime;
        }
        return a.fullName.localeCompare(b.fullName);
      });

    return ok(serializeForJson(records));
  } catch (error) {
    return handleApiError(error);
  }
}
