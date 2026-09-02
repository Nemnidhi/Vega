"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * A 34px back control, per design.md.
 *
 * With no `href` it steps back through history. Pass `href` when there is a meaningful parent to
 * return to - a deep link opened in a fresh tab has no history to step back through, and
 * router.back() would leave the person stranded.
 */

interface BackButtonProps {
  /** Where to go. Omit to use browser history. */
  href?: string;
  label?: string;
  className?: string;
}

const STYLES =
  "inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-md border border-vega-border " +
  "bg-vega-surface-1 px-3 text-xs font-medium text-vega-text-secondary transition-colors " +
  "hover:border-vega-purple-border hover:bg-vega-surface-hover hover:text-vega-text " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vega-purple/40";

export function BackButton({ href, label = "Back", className }: BackButtonProps) {
  const router = useRouter();

  if (href) {
    return (
      <Link href={href} className={cn(STYLES, className)}>
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => router.back()} className={cn(STYLES, className)}>
      <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
      {label}
    </button>
  );
}
