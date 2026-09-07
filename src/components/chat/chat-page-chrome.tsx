import Link from "next/link";
import { ArrowLeft, ChevronRight, Search, SquarePen } from "lucide-react";

export function ChatPageChrome({ thread = false }: { thread?: boolean }) {
  return (
    <>
      <div className="-mx-[22px] -mt-[18px] mb-5 hidden h-16 items-center justify-between border-b border-vega-border-soft bg-vega-topbar px-6 lg:flex">
        <div className="flex items-center gap-2 text-xs text-vega-text-secondary">
          <Link href="/dashboard" className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-vega-surface-hover" aria-label="Back to workspace">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          <span>Workspace</span>
          <ChevronRight className="h-3.5 w-3.5 text-vega-text-dim" aria-hidden="true" />
          <span className="font-medium text-vega-text">Chat</span>
        </div>
        <a href="#chat-user-search" className="flex h-9 w-[420px] max-w-[42vw] items-center gap-2 rounded-md border border-vega-border bg-[#0b141f] px-3 text-xs text-vega-text-muted">
          <Search className="h-4 w-4" aria-hidden="true" />
          <span className="flex-1">Search anything...</span>
          <kbd className="rounded bg-vega-surface-2 px-2 py-0.5 text-[10px]">Ctrl + K</kbd>
        </a>
        <span className="w-28" aria-hidden="true" />
      </div>

      <div className={thread ? "mb-4 hidden items-start justify-between lg:flex" : "mb-4 flex items-start justify-between"}>
        <div>
          <h1 className="text-[26px] font-semibold leading-8 text-vega-text lg:text-[28px]">Team chat</h1>
          <p className="mt-1 text-sm text-vega-text-muted">{thread ? "Stay connected with your team." : "Message your team."}</p>
        </div>
        <a href="#chat-user-search" className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-vega-purple text-white shadow-[0_8px_24px_rgba(124,63,224,0.28)] hover:bg-vega-purple-strong lg:hidden" aria-label="Find a teammate" title="Find a teammate">
          <SquarePen className="h-5 w-5" aria-hidden="true" />
        </a>
        <div className="hidden items-center gap-2 pt-2 text-xs font-medium text-vega-text lg:flex">
          <span className="h-2.5 w-2.5 rounded-full bg-[#42d889]" aria-hidden="true" />
          Connected
        </div>
      </div>
    </>
  );
}
