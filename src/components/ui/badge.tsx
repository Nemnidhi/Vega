import * as React from "react";
import { cn } from "@/lib/utils/cn";

const badgeVariants = {
  neutral: "border border-border bg-white text-foreground",
  success: "border border-[#b8d7c3] bg-[#edf7f0] text-[#2f6a42]",
  warning: "border border-[#dec39d] bg-[#f8f1e4] text-[#8a5a1f]",
  danger: "border border-[#e2b3ae] bg-[#faecea] text-[#a43c35]",
  accent: "border border-[#bac8d5] bg-[#ecf2f7] text-[#274d6f]",
} as const;

type BadgeVariant = keyof typeof badgeVariants;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
