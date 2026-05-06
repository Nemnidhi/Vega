import * as React from "react";
import { cn } from "@/lib/utils/cn";

const buttonVariants = {
  primary:
    "border border-accent bg-accent text-white hover:bg-accent-strong focus-visible:outline-accent",
  secondary:
    "border border-border bg-white text-foreground hover:bg-surface-soft focus-visible:outline-accent",
  subtle:
    "border border-border bg-surface-soft text-foreground hover:bg-[#e8e4db] focus-visible:outline-accent",
  danger:
    "border border-danger bg-danger text-white hover:brightness-95 focus-visible:outline-danger",
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
          "inline-flex items-center justify-center rounded-lg font-semibold tracking-wide transition-colors duration-150",
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
