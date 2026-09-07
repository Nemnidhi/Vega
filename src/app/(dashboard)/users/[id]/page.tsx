import { notFound } from "next/navigation";
import { UserProfileWorkspace } from "@/components/users/user-profile-workspace";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { getAttendanceMonthKey } from "@/lib/attendance/date";
import { getUserProfile } from "@/lib/users/profile";

export const dynamic = "force-dynamic";

type UserProfilePageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string | string[] }>;
};

export default async function UserProfilePage({ params, searchParams }: UserProfilePageProps) {
  await requireRoleAccess(["admin"]);
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const requestedMonth = typeof query.month === "string" && /^\d{4}-\d{2}$/.test(query.month)
    ? query.month
    : getAttendanceMonthKey();
  const profile = await getUserProfile(id, requestedMonth);
  if (!profile) notFound();

  return <UserProfileWorkspace initialProfile={profile} />;
}
