import * as React from "react";
import { cn } from "@/lib/utils/cn";

const buttonVariants = {
  primary:
    "border border-vega-purple bg-[#7c3fe0] text-white hover:bg-vega-purple-hover focus-visible:ring-vega-purple/40",
  secondary:
    "border border-vega-border bg-vega-surface-1 text-vega-text-secondary hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text focus-visible:ring-vega-purple/40",
  subtle:
    "border border-vega-purple-border bg-vega-purple-soft text-[#c4b5fd] hover:border-vega-purple hover:bg-vega-surface-selected focus-visible:ring-vega-purple/40",
  danger:
    "border border-vega-red/45 bg-vega-surface-1 text-vega-red hover:bg-vega-red/10 focus-visible:ring-vega-red/35",
} as const;

const buttonSizes = {
  sm: "h-8 px-2.5 text-xs",
  md: "h-[34px] px-3 text-xs",
  lg: "h-10 px-4 text-sm",
} as const;

type ButtonVariant = keyof typeof buttonVariants;
type ButtonSize = keyof typeof buttonSizes;

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-all duration-150",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:outline-none focus-visible:ring-2",
          buttonVariants[variant],
          buttonSizes[size],
          className,
        )}
        {...props}
      />
    );
  },
);

Button.displayName = "Button";
