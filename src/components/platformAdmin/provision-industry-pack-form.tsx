"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type IndustryPack = {
  id: string;
  key: string;
  label: string;
  industry: string;
  description: string;
  templateCount: number;
};

export function ProvisionIndustryPackForm({
  organizationId,
  workspaces,
  industryPacks,
}: {
  organizationId: string;
  workspaces: Array<{ id: string; name: string }>;
  industryPacks: IndustryPack[];
}) {
  const [workspaceId, setWorkspaceId] = useState(workspaces[0]?.id ?? "");
  const [industryPackKey, setIndustryPackKey] = useState(industryPacks[0]?.key ?? "");
  const [provisioning, setProvisioning] = useState(false);
  const [message, setMessage] = useState("");

  const selectedPack = industryPacks.find((pack) => pack.key === industryPackKey);
  const canProvision = Boolean(workspaceId && industryPackKey) && !provisioning;

  async function provision() {
    setProvisioning(true);
    setMessage("");
    try {
      const response = await fetch("/api/platform-admin/provision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId, workspaceId, industryPackKey }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message || "Could not provision the industry pack.");
      }
      const created = payload.data?.templatesCreated?.length ?? 0;
      setMessage(`Created ${created} draft template${created === 1 ? "" : "s"} in the selected workspace.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not provision the industry pack.");
    } finally {
      setProvisioning(false);
    }
  }

  if (workspaces.length === 0) {
    return <p className="text-sm text-muted-foreground">This organization has no workspaces to provision yet.</p>;
  }
  if (industryPacks.length === 0) {
    return <p className="text-sm text-muted-foreground">No industry packs are configured on Dashboard-WhatsApp yet.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Workspace</span>
          <select
            className="h-11 w-full rounded-lg border border-border bg-vega-surface-1 px-3 text-sm"
            value={workspaceId}
            onChange={(event) => setWorkspaceId(event.target.value)}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-xs font-medium text-muted-foreground">Industry pack</span>
          <select
            className="h-11 w-full rounded-lg border border-border bg-vega-surface-1 px-3 text-sm"
            value={industryPackKey}
            onChange={(event) => setIndustryPackKey(event.target.value)}
          >
            {industryPacks.map((pack) => (
              <option key={pack.key} value={pack.key}>
                {pack.label} ({pack.templateCount} templates)
              </option>
            ))}
          </select>
        </label>
      </div>
      {selectedPack ? <p className="text-xs text-muted-foreground">{selectedPack.description}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" onClick={provision} disabled={!canProvision}>
          {provisioning ? "Provisioning..." : "Activate pack for this workspace"}
        </Button>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      </div>
    </div>
  );
}
