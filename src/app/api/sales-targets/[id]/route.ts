import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { updateSalesTarget } from "@/lib/sales-targets/service";
import { serializeForJson } from "@/lib/utils/serialize";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try { await connectToDatabase(); const { id } = await params; return ok(serializeForJson(await updateSalesTarget(await getActorContext(), id, await request.json()))); }
  catch (error) { return handleApiError(error); }
}
