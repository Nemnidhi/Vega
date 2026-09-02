import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          "h-[34px] w-full rounded-md border border-vega-border bg-[#0b141f] px-3 text-xs text-vega-text",
          "placeholder:text-vega-text-muted/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vega-purple/20",
          "transition-all duration-150 focus-visible:border-vega-purple/65",
          className,
        )}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
