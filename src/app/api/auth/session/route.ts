import { getCurrentSession } from "@/lib/auth/session";
import { handleApiError, ok } from "@/lib/api/responses";

export async function GET() {
  try {
    const session = await getCurrentSession();
    if (!session) {
      throw new Error("Unauthorized");
    }
    return ok(session);
  } catch (error) {
    return handleApiError(error);
  }
}
