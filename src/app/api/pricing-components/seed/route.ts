import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { seedPricingComponentsData } from "@/lib/seed/seed-pricing-components";

export async function POST() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: ["admin", "partner"] });

    const result = await seedPricingComponentsData();
    return ok({ seeded: result.count });
  } catch (error) {
    return handleApiError(error);
  }
}
