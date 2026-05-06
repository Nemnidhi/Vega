"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getStaffHomeRoute,
  getStaffLoginRoute,
  LOGIN_ROLES,
  type LoginRole,
} from "@/lib/auth/constants";

interface LoginFormProps {
  lockedRole?: LoginRole;
  title?: string;
  description?: string;
}

export function LoginForm({
  lockedRole,
  title = "Sign In",
  description = "Start a secure Vega session with role-based access for admin, developer, and sales.",
}: LoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<LoginRole>("admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const selectedRole = lockedRole ?? role;

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          role: selectedRole,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Login failed");
      }

      const loggedInRole = data?.data?.user?.role as LoginRole | undefined;
      const destination = loggedInRole && LOGIN_ROLES.includes(loggedInRole)
        ? getStaffHomeRoute(loggedInRole)
        : "/dashboard";

      router.push(destination);
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-visible">
      <CardHeader>
        <CardTitle className="text-2xl">{title}</CardTitle>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={login}>
          <Input
            type="email"
            placeholder="work-email@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
          {lockedRole ? (
            <p className="rounded-xl border border-border/70 bg-muted/25 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-foreground/90">
              Role: {lockedRole.replaceAll("_", " ")}
            </p>
          ) : (
            <select
              value={role}
              onChange={(event) => setRole(event.target.value as LoginRole)}
              className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
            >
              {LOGIN_ROLES.map((option) => (
                <option key={option} value={option}>
                  {option.replaceAll("_", " ")}
                </option>
              ))}
            </select>
          )}
          <Button className="mt-2 w-full" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Continue"}
          </Button>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          {lockedRole ? (
            <p className="text-xs text-muted-foreground">
              Switch portal:{" "}
              {LOGIN_ROLES.map((option, index) => (
                <span key={option}>
                  {index > 0 ? " | " : ""}
                  <Link href={getStaffLoginRoute(option)} className="font-medium text-accent">
                    {option.replaceAll("_", " ")}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            Client account?{" "}
            <Link href="/client/login" className="font-medium text-accent hover:underline">
              Client login
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
