"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Eye, EyeOff, Loader2, LockKeyhole, Mail } from "lucide-react";
import { getHomeRouteForRole } from "@/lib/auth/constants";
import { cn } from "@/lib/utils/cn";

const FIELD = cn(
  "h-[52px] w-full rounded-xl border border-[#1e3357] bg-[#08121f] pl-12 text-[14px] text-white",
  "placeholder:text-[#5b7190] transition-colors",
  "focus:border-[#2f6bff] focus:outline-none focus:ring-2 focus:ring-[#2f6bff]/25",
);

const LABEL = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.14em] text-[#6d86a8]";

/**
 * The single sign-in form.
 *
 * There used to be one page per staff role plus a separate client login, with a
 * dropdown for picking your own role. That asked people a question only the
 * server can answer - the account already knows what it is - and a wrong guess
 * returned "invalid email or password", which reads as a lost password rather
 * than the wrong door.
 */
export function UniversalLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showResetHelp, setShowResetHelp] = useState(false);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // No role: the account's own role is the answer.
        body: JSON.stringify({ email: email.trim(), password, rememberMe }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Could not sign you in.");
      }

      router.push(getHomeRouteForRole(data?.data?.user?.role ?? ""));
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not sign you in.");
      setLoading(false);
    }
    // Deliberately not clearing `loading` on success - the redirect is in flight
    // and re-enabling the button invites a second submit.
  }

  return (
    <form onSubmit={login} className="w-full">
      <h2 className="text-[30px] font-bold leading-none tracking-tight text-white">Sign in</h2>
      <p className="mt-3 text-[13.5px] leading-relaxed text-[#8ba0bd]">
        Use your work email. Your account decides what you see.
      </p>

      <div className="mt-7 space-y-5">
        <div>
          <label htmlFor="login-email" className={LABEL}>
            Email
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#6d86a8]"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <input
              id="login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              className={cn(FIELD, "pr-4")}
            />
          </div>
        </div>

        <div>
          <label htmlFor="login-password" className={LABEL}>
            Password
          </label>
          <div className="relative">
            <LockKeyhole
              className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#6d86a8]"
              strokeWidth={1.8}
              aria-hidden="true"
            />
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              className={cn(FIELD, "pr-12")}
            />
            <button
              type="button"
              onClick={() => setShowPassword((visible) => !visible)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#6d86a8] transition-colors hover:bg-white/[0.06] hover:text-[#b8cbe6]"
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
              ) : (
                <Eye className="h-[18px] w-[18px]" strokeWidth={1.8} aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Wraps rather than squeezing: below ~360px these two do not fit on one
          line, and breaking mid-phrase reads worse than stacking. */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
        <label className="inline-flex cursor-pointer select-none items-center gap-2.5 whitespace-nowrap text-[13px] text-[#a8bcd8]">
          <span className="relative inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(event) => setRememberMe(event.target.checked)}
              className="peer absolute inset-0 cursor-pointer appearance-none rounded-[5px] border border-[#2a4370] bg-[#0b1524] transition-colors checked:border-[#2f6bff] checked:bg-[#2f6bff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]/40"
            />
            <Check
              className="pointer-events-none relative h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100"
              strokeWidth={3.5}
              aria-hidden="true"
            />
          </span>
          Keep me signed in
        </label>

        <button
          type="button"
          onClick={() => setShowResetHelp((open) => !open)}
          className="whitespace-nowrap text-[13px] font-medium text-[#4d8dff] transition-colors hover:text-[#7aabff]"
        >
          Forgot password?
        </button>
      </div>

      {showResetHelp ? (
        // Honest rather than decorative: this system has no self-serve reset -
        // an admin sets passwords from the users screen - so the link says so
        // instead of leading somewhere that cannot help.
        <p className="mt-3 rounded-xl border border-[#1e3357] bg-[#08121f] px-4 py-3 text-[12.5px] leading-relaxed text-[#8ba0bd]">
          Passwords are reset by an admin. Ask yours to set a new one for you from the Users screen,
          then sign in with it.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-[#ef4444]/40 bg-[#ef4444]/10 px-4 py-3 text-[13px] text-[#fca5a5]"
        >
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading || !email.trim() || password.length < 8}
        className={cn(
          "mt-6 inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-xl text-[15px] font-semibold text-white",
          "bg-gradient-to-r from-[#2563eb] via-[#3b82f6] to-[#2f6bff]",
          "shadow-[0_12px_30px_-8px_rgba(47,107,255,0.75)] transition-all",
          "hover:shadow-[0_14px_36px_-8px_rgba(47,107,255,0.95)] hover:brightness-110",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2f6bff]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060e1c]",
          "disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:hover:brightness-100",
        )}
      >
        {loading ? (
          <>
            <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
            Signing in...
          </>
        ) : (
          <>
            Sign in
            <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} aria-hidden="true" />
          </>
        )}
      </button>

      <div className="mt-7 flex items-center gap-4" aria-hidden="true">
        <span className="h-px flex-1 bg-[#1e3357]" />
        <span className="text-[11px] font-semibold tracking-[0.12em] text-[#5d7398]">OR</span>
        <span className="h-px flex-1 bg-[#1e3357]" />
      </div>

      <p className="mt-6 text-center text-[12.5px] leading-[1.75] text-[#7b90ae]">
        Staff and client accounts both sign in here.
        <br />
        Trouble getting in? Ask your admin to check your account.
      </p>
    </form>
  );
}
