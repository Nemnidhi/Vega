"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function ClientSignupForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [legalName, setLegalName] = useState("");
  const [preferredCommunication, setPreferredCommunication] = useState<
    "email" | "phone" | "whatsapp" | "slack" | "meetings"
  >("email");
  const [primaryGoal, setPrimaryGoal] = useState("");
  const [requirementSummary, setRequirementSummary] = useState("");
  const [requirementDetails, setRequirementDetails] = useState("");
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
        body: JSON.stringify({
          fullName,
          email,
          phone,
          legalName,
          preferredCommunication,
          primaryGoal,
          requirementSummary,
          requirementDetails,
          password,
        }),
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
    <Card className="overflow-visible border-border shadow-sm">
      <CardHeader className="space-y-1 pb-4 sm:pb-6">
        <CardTitle className="text-xl sm:text-2xl">Client Sign Up</CardTitle>
        <p className="text-sm leading-6 text-muted-foreground">
          Create your client account and share complete Nemnidhi project details in one flow.
        </p>
      </CardHeader>
      <CardContent>
        <form className="space-y-3.5 sm:space-y-4" onSubmit={signup}>
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
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
          </div>
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            <Input
              type="tel"
              placeholder="Mobile number"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              required
            />
            <Input
              placeholder="Company / legal name"
              value={legalName}
              onChange={(event) => setLegalName(event.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
            <Input
              placeholder="Primary goal (e.g. lead generation, automation)"
              value={primaryGoal}
              onChange={(event) => setPrimaryGoal(event.target.value)}
              required
            />
            <select
              className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              value={preferredCommunication}
              onChange={(event) =>
                setPreferredCommunication(
                  event.target.value as "email" | "phone" | "whatsapp" | "slack" | "meetings",
                )
              }
            >
              <option value="email">Preferred: Email</option>
              <option value="phone">Preferred: Phone</option>
              <option value="whatsapp">Preferred: WhatsApp</option>
              <option value="slack">Preferred: Slack</option>
              <option value="meetings">Preferred: Meetings</option>
            </select>
          </div>
          <Textarea
            className="min-h-[110px] sm:min-h-[120px]"
            placeholder="Requirement summary (at least 10 characters)"
            value={requirementSummary}
            onChange={(event) => setRequirementSummary(event.target.value)}
            required
          />
          <Textarea
            className="min-h-[96px] sm:min-h-[110px]"
            placeholder="Detailed requirement notes (optional)"
            value={requirementDetails}
            onChange={(event) => setRequirementDetails(event.target.value)}
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
          <Button className="mt-1 w-full sm:mt-2" type="submit" disabled={loading}>
            {loading ? "Creating account..." : "Create account"}
          </Button>
          {error ? <p className="text-sm leading-6 text-danger">{error}</p> : null}
          <p className="text-sm leading-6 text-muted-foreground">
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
