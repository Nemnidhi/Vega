import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth/role-access";

export default async function ClientHomePage() {
  await requireRoleAccess(["client"], {
    loginPath: "/client/login",
    redirectTo: "/dashboard",
  });

  redirect("/client/queries");
}
