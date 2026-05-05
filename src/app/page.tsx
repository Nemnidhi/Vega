import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { getStaffHomeRoute, LOGIN_ROLES } from "@/lib/auth/constants";

export default async function HomePage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/admin");
  }

  if (session.role === "client") {
    redirect("/client/queries");
  }

  if (LOGIN_ROLES.includes(session.role as (typeof LOGIN_ROLES)[number])) {
    redirect(getStaffHomeRoute(session.role as (typeof LOGIN_ROLES)[number]));
  }

  redirect("/admin");
}
