import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { ClientModel } from "@/models";
import { serializeForJson } from "@/lib/utils/serialize";

const createClientSchema = z.object({
  legalName: z.string().trim().min(2).max(200),
  primaryContactName: z.string().trim().min(2).max(120),
  primaryContactEmail: z.string().email(),
  primaryContactPhone: z.string().trim().max(30).optional(),
  companySize: z.string().trim().max(80).optional(),
  industry: z.string().trim().max(120).optional(),
  preferredCommunication: z
    .enum(["email", "phone", "whatsapp", "slack", "meetings"])
    .optional(),
  requirementSummary: z.string().trim().max(500).optional(),
  requirementDetails: z.string().trim().max(3000).optional(),
  onboardingStatus: z.enum(["pending", "in_progress", "completed"]).optional(),
  leadId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  accountManagerId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
});

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { atLeast: "sales" });

    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get("limit") ?? 200);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(requestedLimit, 1), 500)
      : 200;
    const clients = await ClientModel.find({})
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();
    return ok(serializeForJson(clients));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { atLeast: "sales" });

    const payload = createClientSchema.parse(await request.json());
    const requirementsProvided =
      Boolean(payload.requirementSummary?.trim()) || Boolean(payload.requirementDetails?.trim());
    const onboardingStatus =
      payload.onboardingStatus ?? (requirementsProvided ? "completed" : "pending");

    const client = await ClientModel.create({
      ...payload,
      onboardingStatus,
      onboardedByUserId: actor.userId,
      onboardedAt: requirementsProvided ? new Date() : null,
    });
    return ok(serializeForJson(client), { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
