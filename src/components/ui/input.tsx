import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-11 w-full rounded-lg border border-border bg-white px-3.5 text-sm text-foreground",
          "placeholder:text-muted-foreground/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
          "transition-colors duration-150 focus-visible:border-accent",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
