import * as React from "react";
import { cn } from "@/lib/utils/cn";

const buttonVariants = {
  primary:
    "bg-[linear-gradient(120deg,#0b8b83_0%,#1d4ed8_100%)] text-white shadow-[0_12px_24px_rgba(14,128,122,0.35)] hover:brightness-110 focus-visible:outline-accent",
  secondary:
    "border border-border bg-white/90 text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_8px_18px_rgba(8,29,51,0.08)] hover:bg-white focus-visible:outline-accent",
  subtle:
    "bg-accent-soft text-accent-strong hover:bg-[#bff4ef] focus-visible:outline-accent",
  danger:
    "bg-[linear-gradient(120deg,#c6261a_0%,#ef4444_100%)] text-white shadow-[0_10px_22px_rgba(180,35,24,0.32)] hover:brightness-105 focus-visible:outline-danger",
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
          "active:translate-y-[1px]",
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
