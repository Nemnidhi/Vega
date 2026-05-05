import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import type { UserRole } from "@/types/user";

export async function requireRoleAccess(
  allowedRoles: readonly UserRole[],
  options?: { redirectTo?: string; loginPath?: string },
) {
  const session = await getCurrentSession();

  if (!session) {
    redirect(options?.loginPath ?? "/admin");
  }

  if (!allowedRoles.includes(session.role)) {
    redirect(options?.redirectTo ?? "/dashboard");
  }

  return session;
}
