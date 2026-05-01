"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const roles = [
  "admin",
  "partner",
  "sales",
  "project_manager",
  "developer",
  "client",
] as const;

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<(typeof roles)[number]>("admin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, fullName: fullName || undefined, role }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Login failed");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-visible border-white/65 bg-white/92">
      <CardHeader>
        <CardTitle className="text-2xl">Sign In</CardTitle>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Start a secure HRMS session with role-scoped strategic access.
        </p>
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
            placeholder="Full name (optional)"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
          <select
            value={role}
            onChange={(event) => setRole(event.target.value as (typeof roles)[number])}
            className="h-11 w-full text-sm"
          >
            {roles.map((option) => (
              <option key={option} value={option}>
                {option.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <Button className="mt-2 w-full" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Continue"}
          </Button>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
