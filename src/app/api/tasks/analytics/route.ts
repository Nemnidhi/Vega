import { connectToDatabase } from "@/lib/db/mongodb";
import { getActorContext } from "@/lib/auth/permissions";
import { handleApiError, ok } from "@/lib/api/responses";
import { getTaskAnalytics } from "@/lib/tasks/analytics";
import { taskAnalyticsFiltersSchema } from "@/lib/validation/task";

function searchParamValue(url: URL, key: string) {
  const value = url.searchParams.get(key);
  return value?.trim() || undefined;
}

export async function GET(request: Request) {
  try {
    await connectToDatabase();
    const actor = await getActorContext();
    const url = new URL(request.url);
    const filters = taskAnalyticsFiltersSchema.parse({
      projectId: searchParamValue(url, "projectId"),
      userId: searchParamValue(url, "userId"),
      status: searchParamValue(url, "status"),
      priority: searchParamValue(url, "priority"),
      startDate: searchParamValue(url, "startDate"),
      endDate: searchParamValue(url, "endDate"),
      stage: searchParamValue(url, "stage"),
    });

    const analytics = await getTaskAnalytics(actor, filters);
    return ok(analytics);
  } catch (error) {
    return handleApiError(error);
  }
}
