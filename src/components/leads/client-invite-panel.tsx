"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type ClientInvitePanelProps = {
  leadId: string;
  hasEmail: boolean;
  invite: {
    status: "pending" | "accepted" | "revoked" | "expired";
    email: string;
    createdAt: string;
    acceptedAt: string | null;
  } | null;
  linkedClientUser: { fullName: string; email: string; status: string } | null;
};

export function ClientInvitePanel({
  leadId,
  hasEmail,
  invite,
  linkedClientUser,
}: ClientInvitePanelProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [activationLink, setActivationLink] = useState<string | null>(null);

  async function invitedClient() {
    setBusy(true);
    setMessage(null);
    setActivationLink(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/invite-client`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setMessage({ kind: "error", text: body?.error?.message ?? `Request failed (${res.status})` });
        return;
      }

      if (body.data.emailSent) {
        setMessage({ kind: "ok", text: `Invite emailed to ${body.data.email}.` });
      } else {
        setMessage({
          kind: "ok",
          text: `Invite created for ${body.data.email}, but the email could not be sent (SMTP not configured). Share the link below manually.`,
        });
        setActivationLink(body.data.activationLink);
      }
      // Refresh in place rather than reloading the page - the activation link rendered
      // above has to survive, and a timed reload used to race the request and wipe it.
      router.refresh();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "Request failed" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      {invite ? (
        <div className="rounded-lg border border-border bg-vega-surface-1 p-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">Invited: {invite.email}</span>
            <Badge
              variant={
                invite.status === "accepted"
                  ? "success"
                  : invite.status === "pending"
                    ? "neutral"
                    : "danger"
              }
            >
              {invite.status}
            </Badge>
          </div>
          {linkedClientUser ? (
            <p className="mt-2 text-xs text-muted-foreground">
              Portal account active: {linkedClientUser.fullName} ({linkedClientUser.email})
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No client-portal login has been set up for this lead yet.
        </p>
      )}

      {activationLink ? (
        <p className="break-all rounded-lg border border-border bg-surface-soft p-3 text-xs text-muted-foreground">
          {activationLink}
        </p>
      ) : null}

      <Button type="button" onClick={invitedClient} disabled={busy || !hasEmail}>
        {busy ? "Inviting..." : invite?.status === "accepted" ? "Re-invite" : "Invite to Client Portal"}
      </Button>

      {!hasEmail ? (
        <p className="text-xs text-muted-foreground">
          Inviting is disabled: this lead has no email address on file.
        </p>
      ) : null}
      {message ? (
        <p className={`text-sm ${message.kind === "ok" ? "text-success" : "text-danger"}`}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
