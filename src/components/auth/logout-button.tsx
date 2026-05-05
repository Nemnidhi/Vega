"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface LogoutButtonProps {
  redirectTo?: string;
}

export function LogoutButton({ redirectTo = "/admin" }: LogoutButtonProps) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" onClick={logout}>
      Logout
    </Button>
  );
}
