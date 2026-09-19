import { redirect } from "next/navigation";
import { UniversalLoginForm } from "@/components/auth/universal-login-form";
import { getCurrentSession } from "@/lib/auth/session";
import { getHomeRouteForRole } from "@/lib/auth/constants";

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) {
    redirect(getHomeRouteForRole(session.role));
  }

  return <UniversalLoginForm />;
}
