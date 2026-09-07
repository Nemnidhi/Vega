import { redirect } from "next/navigation";
import { ClientActivateForm } from "@/components/client/client-activate-form";
import { getCurrentSession } from "@/lib/auth/session";

type SearchParams = Promise<{ token?: string }>;

export default async function ClientActivatePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getCurrentSession();
  if (session) {
    redirect(session.role === "client" ? "/client" : "/dashboard");
  }

  const { token } = await searchParams;
  return <ClientActivateForm token={token ?? null} />;
}
