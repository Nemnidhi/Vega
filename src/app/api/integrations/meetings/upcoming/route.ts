import { connectToDatabase } from "@/lib/db/mongodb";
import { assertValidDashboardSecret } from "@/lib/auth/dashboard-actor";
import { MeetingModel } from "@/models";
import { fail, handleApiError, ok } from "@/lib/api/responses";
import { serializeForJson } from "@/lib/utils/serialize";

const WINDOW_HOURS = { "24h": 24, "1h": 1 };
const REMINDED_FIELD = { "24h": "reminded24hAt", "1h": "reminded1hAt" } as const;

// Dashboard-WhatsApp's reminder sweep polls this on a timer (every ~15min) rather than Vega
// pushing anything - keeps the reminder schedule entirely on Dashboard's side (it owns the
// WhatsApp send), Vega just answers "what's due" and "mark this one done" (see the sibling
// :id/remind route). Deliberately not narrow-windowed (e.g. "exactly 24h away") - "anything
// confirmed, in the future, within N hours, not yet reminded for this tier" is correct
// regardless of how long the sweep has been down, and the reminded*At field is what actually
// prevents duplicate sends, not the query window.
export async function GET(request: Request) {
  try {
    assertValidDashboardSecret(request);
    await connectToDatabase();

    const { searchParams } = new URL(request.url);
    const window = searchParams.get("window") as keyof typeof WINDOW_HOURS | null;
    if (!window || !(window in WINDOW_HOURS)) {
      return fail("window must be '24h' or '1h'", 400);
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() + WINDOW_HOURS[window] * 60 * 60 * 1000);
    const remindedField = REMINDED_FIELD[window];

    const meetings = await MeetingModel.find({
      status: "confirmed",
      startAt: { $gt: now, $lte: cutoff },
      [remindedField]: null,
    })
      .select("contactName contactPhone type startAt durationMinutes location")
      .lean();

    return ok({ meetings: meetings.map((m) => serializeForJson(m)) });
  } catch (error) {
    return handleApiError(error);
  }
}
