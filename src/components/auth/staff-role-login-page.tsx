import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import {
  getStaffHomeRoute,
  getStaffLoginRoute,
  LOGIN_ROLES,
  type LoginRole,
} from "@/lib/auth/constants";
import { getCurrentSession } from "@/lib/auth/session";

interface StaffRoleLoginPageProps {
  role: LoginRole;
  title: string;
  description: string;
}

function isStaffRole(value: string): value is LoginRole {
  return LOGIN_ROLES.includes(value as LoginRole);
}

export async function StaffRoleLoginPage({
  role,
  title,
  description,
}: StaffRoleLoginPageProps) {
  const session = await getCurrentSession();

  if (session?.role === "client") {
    redirect("/client/queries");
  }

  if (session && isStaffRole(session.role)) {
    if (session.role === role) {
      redirect(getStaffHomeRoute(session.role));
    }
    redirect(getStaffLoginRoute(session.role));
  }

  return <LoginForm lockedRole={role} title={title} description={description} />;
}
