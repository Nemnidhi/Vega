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
        "min-h-28 w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm text-foreground",
        "placeholder:text-muted-foreground/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent",
        "transition-colors duration-150 focus-visible:border-accent",
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";
