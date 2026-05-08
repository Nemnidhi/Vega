"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ClientLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/client/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Client login failed");
      }

      router.push("/client/queries");
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Client login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-visible border-border shadow-sm">
      <CardHeader className="space-y-1 pb-4 sm:pb-6">
        <CardTitle className="text-xl sm:text-2xl">Client Login</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          Sign in to raise project queries and track responses.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-3.5 sm:space-y-4" onSubmit={login}>
          <Input
            type="email"
            placeholder="client-email@company.com"
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
          />
          <Button className="mt-1 w-full sm:mt-2" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Continue"}
          </Button>
          {error ? <p className="text-sm leading-6 text-danger">{error}</p> : null}
          <p className="text-sm leading-6 text-muted-foreground">
            No account yet?{" "}
            <Link href="/client/signup" className="font-medium text-accent hover:underline">
              Create client account
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
