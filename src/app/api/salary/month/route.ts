import { connectToDatabase } from "@/lib/db/mongodb";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { getActorContext } from "@/lib/auth/permissions";
import { attendanceMemberRoles } from "@/lib/attendance/constants";
import { getAttendanceMonthKey } from "@/lib/attendance/date";
import { computeMonthlySalaryForUser } from "@/lib/salary/calculator";

// Self-service: an employee's own salary for a month, never anyone else's - the actor's own
// userId from the session is what gets computed, there is no userId input to this route at all.
export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    if (!attendanceMemberRoles.includes(actor.role)) {
      return fail(`Forbidden for role ${actor.role}`, 403);
    }

    const { searchParams } = new URL(request.url);
    const monthKey = searchParams.get("month") ?? getAttendanceMonthKey();

    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
      return fail("Invalid month format.", 422);
    }

    const detail = await computeMonthlySalaryForUser(actor.userId, monthKey);
    if (!detail) {
      return fail("Employee not found.", 404);
    }

    return ok(detail);
  } catch (error) {
    return handleApiError(error);
  }
}
