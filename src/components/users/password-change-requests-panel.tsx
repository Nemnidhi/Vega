"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type PasswordChangeRequestStatus = "pending" | "approved" | "rejected";

export type PasswordChangeRequestItem = {
  id: string;
  user: {
    id: string;
    fullName?: string;
    email?: string;
    role?: string;
  } | null;
  status: PasswordChangeRequestStatus;
  createdAt?: string | null;
  reviewedAt?: string | null;
  reviewNote?: string;
};

interface PasswordChangeRequestsPanelProps {
  initialRequests: PasswordChangeRequestItem[];
}

function formatDateTime(value?: string | null) {
  return value ? new Date(value).toLocaleString("en-IN") : "-";
}

function formatRole(value?: string) {
  return value ? value.replaceAll("_", " ") : "unknown";
}

export function PasswordChangeRequestsPanel({
  initialRequests,
}: PasswordChangeRequestsPanelProps) {
  const [requests, setRequests] = useState(initialRequests);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function reviewRequest(
    requestId: string,
    action: "approve" | "reject",
  ) {
    setReviewingRequestId(requestId);
    setMessage("");

    try {
      const response = await fetch(`/api/password-change-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to review request.");
      }

      const nextStatus = action === "approve" ? "approved" : "rejected";
      const reviewedAt = new Date().toISOString();
      setRequests((previous) =>
        previous.map((item) =>
          item.id === requestId ? { ...item, status: nextStatus, reviewedAt } : item,
        ),
      );
      setMessage(
        action === "approve"
          ? "Password change approved and applied."
          : "Password change request rejected.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to review request.");
    } finally {
      setReviewingRequestId(null);
    }
  }

  const pendingCount = requests.filter((item) => item.status === "pending").length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password Change Requests</CardTitle>
        <p className="text-sm text-muted-foreground">
          Pending approvals: <span className="font-semibold text-foreground">{pendingCount}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

        {requests.length === 0 ? (
          <p className="rounded-xl border border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
            No password change requests found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2">User</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">Requested</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Reviewed</th>
                  <th className="px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const isPending = request.status === "pending";
                  const isReviewing = reviewingRequestId === request.id;

                  return (
                    <tr key={request.id} className="border-b border-border/70">
                      <td className="px-2 py-3">
                        <p className="font-semibold text-foreground">
                          {request.user?.fullName ?? "Deleted user"}
                        </p>
                        <p className="break-all text-xs text-muted-foreground">
                          {request.user?.email ?? "Not available"}
                        </p>
                      </td>
                      <td className="px-2 py-3">{formatRole(request.user?.role)}</td>
                      <td className="px-2 py-3 text-xs text-muted-foreground">
                        {formatDateTime(request.createdAt)}
                      </td>
                      <td className="px-2 py-3">{request.status}</td>
                      <td className="px-2 py-3 text-xs text-muted-foreground">
                        {formatDateTime(request.reviewedAt)}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            disabled={!isPending || isReviewing}
                            onClick={() => void reviewRequest(request.id, "approve")}
                          >
                            {isReviewing ? "Reviewing..." : "Approve"}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={!isPending || isReviewing}
                            onClick={() => void reviewRequest(request.id, "reject")}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
