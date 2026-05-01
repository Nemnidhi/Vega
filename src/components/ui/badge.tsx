import * as React from "react";
import { cn } from "@/lib/utils/cn";

const badgeVariants = {
  neutral: "bg-white text-foreground ring-1 ring-border",
  success: "bg-[#dff7eb] text-[#0f7d4d] ring-1 ring-[#9ed5b8]",
  warning: "bg-[#fff0dc] text-[#9f4f0f] ring-1 ring-[#f4c58a]",
  danger: "bg-[#ffe2df] text-[#b62a22] ring-1 ring-[#f0a8a2]",
  accent: "bg-[#d7f5f2] text-[#0f6a64] ring-1 ring-[#9fded9]",
} as const;

type BadgeVariant = keyof typeof badgeVariants;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
