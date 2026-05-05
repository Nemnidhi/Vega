import { redirect } from "next/navigation";
import { ClientSignupForm } from "@/components/client/client-signup-form";
import { getCurrentSession } from "@/lib/auth/session";

export default async function ClientSignupPage() {
  const session = await getCurrentSession();
  if (session?.role === "client") {
    redirect("/client/queries");
  }
  if (session) {
    redirect("/dashboard");
  }

  return <ClientSignupForm />;
}
