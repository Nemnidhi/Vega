import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { listSalesTargets, createSalesTarget } from "@/lib/sales-targets/service";
import { serializeForJson } from "@/lib/utils/serialize";

export async function GET() {
  try { await connectToDatabase(); return ok(await listSalesTargets(await getActorContext())); }
  catch (error) { return handleApiError(error); }
}
export async function POST(request: Request) {
  try { await connectToDatabase(); return ok(serializeForJson(await createSalesTarget(await getActorContext(), await request.json())), { status: 201 }); }
  catch (error) { return handleApiError(error); }
}
