import * as React from "react";
import { cn } from "@/lib/utils/cn";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-28 w-full rounded-md border border-vega-border bg-[#0b141f] px-3 py-2.5 text-xs text-vega-text",
        "placeholder:text-vega-text-muted/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vega-purple/20",
        "transition-all duration-150 focus-visible:border-vega-purple/65",
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
