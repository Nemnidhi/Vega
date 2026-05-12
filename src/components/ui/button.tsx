import * as React from "react";
import { cn } from "@/lib/utils/cn";

const buttonVariants = {
  primary:
    "border border-accent/75 bg-accent text-white shadow-sm hover:brightness-[1.03] focus-visible:outline-accent",
  secondary:
    "border border-border/90 bg-white/92 text-foreground shadow-sm hover:border-accent/35 hover:bg-white focus-visible:outline-accent",
  subtle:
    "border border-accent/20 bg-accent-soft text-accent-strong hover:border-accent/35 hover:brightness-[0.98] focus-visible:outline-accent",
  danger:
    "border border-danger/80 bg-danger text-white shadow-sm hover:brightness-[1.02] focus-visible:outline-danger",
} as const;

const buttonSizes = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-4.5 text-sm",
  lg: "h-12 px-6 text-base",
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
          "inline-flex items-center justify-center rounded-xl font-semibold tracking-wide transition-all duration-200",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
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
