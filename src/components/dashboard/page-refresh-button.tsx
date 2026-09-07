"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type PageRefreshButtonProps = {
  iconOnly?: boolean;
  className?: string;
};

export function PageRefreshButton({ iconOnly = false, className }: PageRefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function refreshPage() {
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={refreshPage}
      disabled={isPending}
      aria-label="Refresh page"
      title="Refresh page"
      className={cn(
        "inline-flex items-center justify-center rounded-md text-vega-text-muted transition-colors hover:bg-vega-surface-hover hover:text-vega-text disabled:cursor-wait disabled:opacity-60",
        iconOnly ? "h-8 w-8" : "h-10 w-full justify-start gap-[11px] px-3 text-[13px] font-medium",
        className,
      )}
    >
      <RefreshCw
        className={cn("h-[18px] w-[18px] shrink-0", isPending && "animate-spin")}
        strokeWidth={1.8}
        aria-hidden="true"
      />
      {iconOnly ? null : <span>{isPending ? "Refreshing..." : "Refresh"}</span>}
    </button>
  );
}
