"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ClientSignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function signup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (password !== confirmPassword) {
        throw new Error("Password and confirm password do not match.");
      }

      const response = await fetch("/api/auth/client/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, email, password }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Client signup failed");
      }

      router.push("/client/queries");
      router.refresh();
    } catch (value) {
      setError(value instanceof Error ? value.message : "Client signup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="overflow-visible">
      <CardHeader>
        <CardTitle className="text-2xl">Client Sign Up</CardTitle>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Create your client account to raise project-related queries.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={signup}>
          <Input
            placeholder="Full name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
          <Input
            type="email"
            placeholder="client-email@company.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            type="password"
            placeholder="Password (minimum 8 characters)"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            minLength={8}
            required
          />
          <Input
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            minLength={8}
            required
          />
          <Button className="mt-2 w-full" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <p className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/client/login" className="font-medium text-accent hover:underline">
              Login here
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
