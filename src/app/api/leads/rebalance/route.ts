import { z } from "zod";
import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { getLeadRebalancePlan, rebalanceLeads } from "@/lib/leads/rebalance";

export async function GET() {
  try {
    await connectToDatabase();
    const plan = await getLeadRebalancePlan(await getActorContext());
    return ok({ total: plan.total, team: plan.team, moving: plan.moves.length, token: plan.token });
  } catch (error) { return handleApiError(error); }
}

export async function POST(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const { token } = z.object({ token: z.string().regex(/^[a-f0-9]{64}$/) }).parse(await request.json());
    return ok(await rebalanceLeads(actor, token));
  } catch (error) { return handleApiError(error); }
}
