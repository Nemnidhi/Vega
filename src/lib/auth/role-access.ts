import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import type { UserRole } from "@/types/user";
import { LOGIN_PATH } from "@/lib/auth/constants";

export async function requireRoleAccess(
  allowedRoles: readonly UserRole[],
  options?: { redirectTo?: string; loginPath?: string },
) {
  const session = await getCurrentSession();

  if (!session) {
    redirect(options?.loginPath ?? LOGIN_PATH);
  }

  if (!allowedRoles.includes(session.role)) {
    redirect(options?.redirectTo ?? "/dashboard");
  }

  return session;
}
