/**
 * Attendance Desk hero.
 *
 * DashboardHeader is a shared component with a lead CTA and a different
 * typographic scale; this page wanted its own eyebrow, a much larger title and
 * the clipboard mark, so it gets its own header rather than growing options on
 * the shared one.
 */
export function AttendanceHero() {
  return (
    <div className="relative overflow-hidden border-b border-vega-border-soft bg-[linear-gradient(115deg,#0e1a2c_0%,#0b1524_55%,#0a1220_100%)] px-4 py-5 sm:px-6 sm:py-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#2f6bff]/[0.13] blur-[70px]"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-[0.16em] text-[#7d93b4]">
            Operations
          </p>
          <h1 className="mt-1.5 whitespace-nowrap text-[26px] font-bold leading-tight tracking-tight text-vega-text min-[400px]:text-[30px] sm:text-[34px]">
            Attendance Desk
          </h1>
          <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-vega-text-muted">
            Daily check-in and check-out tracking for team members.
          </p>
        </div>

        {/* Clipboard mark. Inline so it inherits the palette and costs no request. */}
        <svg
          viewBox="0 0 120 120"
          className="h-[76px] w-[76px] shrink-0 sm:h-[104px] sm:w-[104px]"
          aria-hidden="true"
        >
          <rect x="22" y="18" width="66" height="84" rx="10" fill="#1b2d4d" stroke="#2f6bff" strokeOpacity="0.45" strokeWidth="2" />
          <rect x="44" y="10" width="22" height="14" rx="5" fill="#2f6bff" />
          <rect x="34" y="40" width="42" height="5" rx="2.5" fill="#3f5f92" />
          <rect x="34" y="53" width="34" height="5" rx="2.5" fill="#33507d" />
          <rect x="34" y="66" width="38" height="5" rx="2.5" fill="#2b4568" />
          <circle cx="86" cy="86" r="19" fill="#2f6bff" />
          <path d="M78 86.5l5.5 5.5L95 80.5" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </div>
    </div>
  );
}
