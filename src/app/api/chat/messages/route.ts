import { type NextRequest } from "next/server";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { getChatThreadSchema, sendChatMessageSchema } from "@/lib/validation/chat";
import { ChatMessageModel, UserModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET(request: NextRequest) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    if (!LOGIN_ROLES.includes(actor.role as (typeof LOGIN_ROLES)[number])) {
      throw new Error("Forbidden for role");
    }

    const params = getChatThreadSchema.parse({
      with: request.nextUrl.searchParams.get("with"),
      limit: request.nextUrl.searchParams.get("limit") ?? undefined,
      markRead: request.nextUrl.searchParams.get("markRead") ?? undefined,
    });

    if (params.with === actor.userId) {
      throw new Error("Cannot open chat with your own account.");
    }

    const counterpart = await UserModel.findOne({
      _id: params.with,
      status: "active",
      role: { $in: LOGIN_ROLES },
    })
      .select("_id status")
      .lean();
    if (!counterpart) {
      throw new Error("Chat user not found.");
    }

    if (params.markRead) {
      await ChatMessageModel.updateMany(
        {
          senderId: params.with,
          recipientId: actor.userId,
          readAt: null,
        },
        { $set: { readAt: new Date() } },
      );
    }

    const messages = await ChatMessageModel.find({
      $or: [
        { senderId: actor.userId, recipientId: params.with },
        { senderId: params.with, recipientId: actor.userId },
      ],
    })
      .select("senderId recipientId message createdAt readAt")
      .sort({ createdAt: -1 })
      .limit(params.limit)
      .lean();

    return ok(serializeForJson([...messages].reverse()));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    if (!LOGIN_ROLES.includes(actor.role as (typeof LOGIN_ROLES)[number])) {
      throw new Error("Forbidden for role");
    }

    const payload = sendChatMessageSchema.parse(await request.json());

    if (payload.recipientId === actor.userId) {
      throw new Error("Cannot send message to your own account.");
    }

    const recipient = await UserModel.findOne({
      _id: payload.recipientId,
      status: "active",
      role: { $in: LOGIN_ROLES },
    })
      .select("_id status")
      .lean();
    if (!recipient) {
      throw new Error("Recipient is not available for chat.");
    }

    const created = await ChatMessageModel.create({
      senderId: actor.userId,
      recipientId: payload.recipientId,
      message: payload.message,
    });

    return ok(
      serializeForJson({
        _id: created._id,
        senderId: created.senderId,
        recipientId: created.recipientId,
        message: created.message,
        createdAt: created.createdAt,
        readAt: created.readAt,
      }),
      { status: 201 },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
