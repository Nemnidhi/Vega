
import { VegaLogo } from "@/components/vega-logo";
import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-[#040a14] text-white">
      {/* Deep-space backdrop: a base wash, two sweeping arcs and a faint star
          field. All decorative, all behind the content, none of it interactive. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(125%_100%_at_50%_0%,#0b1b35_0%,#071224_45%,#040a14_100%)]" />
        <div className="absolute -left-[22%] -top-[65%] h-[150%] w-[105%] rounded-full border border-[#2f6bff]/25 shadow-[0_0_140px_35px_rgba(47,107,255,0.14)]" />
        <div className="absolute -bottom-[78%] -right-[28%] h-[150%] w-[105%] rounded-full border border-[#2f6bff]/20 shadow-[0_0_150px_45px_rgba(47,107,255,0.11)]" />
        <div className="absolute -left-[12%] top-[8%] h-[34rem] w-[34rem] rounded-full bg-[#2f6bff]/[0.10] blur-[130px]" />
        <div className="absolute -right-[10%] bottom-[2%] h-[30rem] w-[30rem] rounded-full bg-[#3b82f6]/[0.09] blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(1.4px 1.4px at 18% 22%, rgba(255,255,255,0.55) 50%, transparent 51%)," +
              "radial-gradient(1.2px 1.2px at 71% 14%, rgba(255,255,255,0.40) 50%, transparent 51%)," +
              "radial-gradient(1.6px 1.6px at 86% 62%, rgba(255,255,255,0.35) 50%, transparent 51%)," +
              "radial-gradient(1.2px 1.2px at 32% 78%, rgba(255,255,255,0.30) 50%, transparent 51%)," +
              "radial-gradient(1.3px 1.3px at 58% 88%, rgba(255,255,255,0.28) 50%, transparent 51%)," +
              "radial-gradient(1.1px 1.1px at 9% 58%, rgba(255,255,255,0.30) 50%, transparent 51%)",
          }}
        />
      </div>

      <div className="relative flex min-h-[100dvh] items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full min-w-0 max-w-[460px]">
          <div className="overflow-hidden rounded-[26px] border border-[#2f6bff]/20 bg-[#060e1c]/70 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)] backdrop-blur-[2px]">
            <div className="p-7 sm:p-10">
              <VegaLogo horizontal className="mb-8 h-auto w-full max-w-[295px]" />
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
