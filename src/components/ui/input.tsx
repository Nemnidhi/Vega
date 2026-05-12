import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-xl border border-border/90 bg-white/92 px-3.5 text-sm text-foreground",
          "shadow-[inset_0_1px_2px_rgba(17,33,56,0.05)]",
          "placeholder:text-muted-foreground/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          "transition-all duration-150 focus-visible:border-accent",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
