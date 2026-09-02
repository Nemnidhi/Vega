"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadIntakeForms } from "@/components/leads/lead-intake-forms";
import { cn } from "@/lib/utils/cn";

/**
 * "Add Lead" / "Bulk Upload" controls plus the dialog that hosts the intake forms.
 *
 * The forms used to sit permanently expanded on the leads page, pushing the list itself below the
 * fold. They open on demand now; the list is what the page is for.
 */

type Tab = "create" | "bulk";

export function LeadIntakeLauncher() {
  const [openTab, setOpenTab] = useState<Tab | null>(null);
  const isOpen = openTab !== null;

  const close = useCallback(() => setOpenTab(null), []);

  // Escape closes, and the page behind must not scroll while the dialog owns the screen.
  useEffect(() => {
    if (!isOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen, close]);

  return (
    <>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="md" onClick={() => setOpenTab("bulk")}>
          <Upload className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
          Bulk Upload
        </Button>
        <Button variant="primary" size="md" onClick={() => setOpenTab("create")}>
          <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
          Add Lead
        </Button>
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[rgba(2,7,12,0.68)] p-4 backdrop-blur-[2px] sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={openTab === "create" ? "Add lead" : "Bulk upload leads"}
          // Only a click that starts and ends on the backdrop itself closes; a drag that ends
          // out here after selecting text inside the form should not discard what was typed.
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <div className="my-auto w-full max-w-[720px] overflow-hidden rounded-lg border border-vega-border bg-[#0a141f] shadow-[0_16px_36px_rgba(0,0,0,0.35)]">
            <div className="flex items-center gap-2 border-b border-vega-border-soft px-4 py-3">
              <div className="flex items-center gap-1">
                {(
                  [
                    { key: "create", label: "Single Lead" },
                    { key: "bulk", label: "Bulk Upload" },
                  ] as Array<{ key: Tab; label: string }>
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setOpenTab(tab.key)}
                    className={cn(
                      "h-[34px] rounded-md px-3 text-xs font-medium transition-colors",
                      openTab === tab.key
                        ? "border border-vega-purple-border bg-vega-purple-soft text-[#c4b5fd]"
                        : "border border-transparent text-vega-text-muted hover:bg-vega-surface-hover hover:text-vega-text",
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-md border border-transparent text-vega-text-muted transition-colors hover:border-vega-border hover:bg-vega-surface-2 hover:text-vega-text"
              >
                <X className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[76vh] overflow-y-auto p-4">
              <LeadIntakeForms section={openTab} onCompleted={close} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
