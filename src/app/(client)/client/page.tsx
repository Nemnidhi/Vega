import { redirect } from "next/navigation";
import { requireRoleAccess } from "@/lib/auth/role-access";
import { resolveClientLeadId } from "@/lib/auth/client-lead";

export default async function ClientHomePage() {
  const session = await requireRoleAccess(["client"], {
    loginPath: "/client/login",
    redirectTo: "/dashboard",
  });

  // A client invited during the lead phase (Client.leadId set) gets their
  // audit + blueprint view; an onboarded client with no linked lead keeps
  // landing on the existing query portal.
  const leadId = await resolveClientLeadId(session);
  redirect(leadId ? "/client/lead" : "/client/queries");
}
