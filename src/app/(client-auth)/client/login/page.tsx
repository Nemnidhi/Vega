import { redirect } from "next/navigation";
import { ClientLoginForm } from "@/components/client/client-login-form";
import { getCurrentSession } from "@/lib/auth/session";

export default async function ClientLoginPage() {
  const session = await getCurrentSession();
  if (session?.role === "client") {
    redirect("/client");
  }
  if (session) {
    redirect("/dashboard");
  }

  return <ClientLoginForm />;
}
