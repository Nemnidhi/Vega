import * as React from "react";
import { cn } from "@/lib/utils/cn";

const badgeVariants = {
  neutral: "border border-border/90 bg-white/85 text-foreground",
  success: "border border-success/35 bg-success/10 text-success",
  warning: "border border-warning/35 bg-warning/10 text-warning",
  danger: "border border-danger/35 bg-danger/10 text-danger",
  accent: "border border-accent/35 bg-accent/10 text-accent-strong",
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
