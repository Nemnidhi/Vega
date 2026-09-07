"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

interface LogoutButtonProps {
  redirectTo?: string;
  className?: string;
  showIcon?: boolean;
}

export function LogoutButton({ redirectTo = "/admin", className, showIcon = false }: LogoutButtonProps) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" onClick={logout} className={cn(className)}>
      {showIcon ? <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" /> : null}
      Logout
    </Button>
  );
}
