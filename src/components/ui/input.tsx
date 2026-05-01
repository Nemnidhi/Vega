import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-border/80 bg-white/95 px-3.5 text-sm text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]",
          "placeholder:text-muted-foreground/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
          "transition-all duration-200 focus-visible:border-accent focus-visible:bg-white",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
