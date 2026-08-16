import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext, assertRoleAccess } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { seedPricingCatalog } from "@/lib/seed/seed-pricing-catalog";

// One-time migration trigger - admin/partner only (not opened to
// digital_marketing like the day-to-day CRUD routes), since this bulk-writes
// the entire catalog from the Excel-derived seed file in one call.
export async function POST() {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    assertRoleAccess(actor.role, { oneOf: ["admin", "partner"] });

    const result = await seedPricingCatalog();
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
