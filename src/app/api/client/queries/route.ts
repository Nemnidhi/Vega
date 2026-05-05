import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { createClientQuerySchema } from "@/lib/validation/client-query";
import { ClientQueryModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

const staffRoles = ["admin", "developer", "sales"] as const;

export async function GET() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();

    if (actor.role === "client") {
      const queries = await ClientQueryModel.find({ raisedBy: actor.userId })
        .sort({ createdAt: -1 })
        .lean();
      return ok(serializeForJson(queries));
    }

    if (staffRoles.includes(actor.role as (typeof staffRoles)[number])) {
      const queries = await ClientQueryModel.find({})
        .sort({ createdAt: -1 })
        .populate("raisedBy", "fullName email")
        .lean();
      return ok(serializeForJson(queries));
    }

    throw new Error("Forbidden for role");
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    if (actor.role !== "client") {
      throw new Error("Forbidden for role");
    }

    const payload = createClientQuerySchema.parse(await request.json());
    const query = await ClientQueryModel.create({
      raisedBy: actor.userId,
      projectName: payload.projectName,
      subject: payload.subject,
      message: payload.message,
      priority: payload.priority,
      status: "open",
    });

    return ok(serializeForJson(query), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
