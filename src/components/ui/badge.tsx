import * as React from "react";
import { cn } from "@/lib/utils/cn";

const badgeVariants = {
  neutral: "border border-vega-border bg-vega-surface-2 text-vega-text-secondary",
  success: "border border-vega-green/35 bg-vega-green/10 text-[#66dc91]",
  warning: "border border-vega-yellow/35 bg-vega-yellow/10 text-vega-yellow",
  danger: "border border-vega-red/35 bg-vega-red/10 text-vega-red",
  accent: "border border-vega-purple-border bg-vega-purple-soft text-[#c4b5fd]",
} as const;

type BadgeVariant = keyof typeof badgeVariants;

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-md px-2 text-[10px] font-medium",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
