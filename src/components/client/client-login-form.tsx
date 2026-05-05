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
    <Card className="overflow-visible border-white/65 bg-white/92">
      <CardHeader>
        <CardTitle className="text-2xl">Client Login</CardTitle>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Sign in to raise project queries and track responses.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={login}>
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
          <Button className="mt-2 w-full" type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Continue"}
          </Button>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <p className="text-sm text-muted-foreground">
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
