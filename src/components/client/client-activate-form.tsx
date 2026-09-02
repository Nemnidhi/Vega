"use client";

import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ClientActivateForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/client/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, fullName: fullName || undefined }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Could not activate this invite");
      }

      router.push("/client");
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Could not activate this invite");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Card className="overflow-visible border-border shadow-sm">
        <CardHeader className="space-y-1 pb-4 sm:pb-6">
          <CardTitle className="text-xl sm:text-2xl">Invite link missing</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            This page needs the invite link a team member sent you - check your email for the
            full link, or ask them to resend it.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-visible border-border shadow-sm">
      <CardHeader className="space-y-1 pb-4 sm:pb-6">
        <CardTitle className="text-xl sm:text-2xl">Set Up Your Client Portal Login</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          One more step - choose a password to finish setting up your account.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-3.5 sm:space-y-4" onSubmit={activate}>
          <Input
            type="text"
            placeholder="Your full name (optional)"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
          <Input
            type="password"
            placeholder="Choose a password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
          <Button className="mt-1 w-full sm:mt-2" type="submit" disabled={loading}>
            {loading ? "Setting up..." : "Activate Account"}
          </Button>
          {error ? <p className="text-sm leading-6 text-danger">{error}</p> : null}
        </form>
      </CardContent>
    </Card>
  );
}
