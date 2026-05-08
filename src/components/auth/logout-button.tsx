"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface LogoutButtonProps {
  redirectTo?: string;
  className?: string;
}

export function LogoutButton({ redirectTo = "/admin", className }: LogoutButtonProps) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" onClick={logout} className={cn(className)}>
      Logout
    </Button>
  );
}
