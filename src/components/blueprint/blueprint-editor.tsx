"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import type { Question } from "@/lib/blueprint/questionnaire";

type StoredComponent = {
  code: string;
  title: string;
  rationale: string;
  origin: "recommended" | "manual";
  included: boolean;
  features: Array<{ code: string; label: string; priceImpact: number }>;
  oneTimePrice: number;
  monthlyPrice: number;
  deliveryWeeksMin: number;
  deliveryWeeksMax: number;
};

type StoredAnswer = { questionCode: string; question: string; answer: string; note?: string };

export type BlueprintRecord = {
  _id: string;
  version: number;
  status: "draft" | "shared" | "approved" | "rejected" | "superseded" | "expired";
  scaleTier: string;
  answers: StoredAnswer[];
  components: StoredComponent[];
  estimate: {
    oneTimeMin: number;
    oneTimeMax: number;
    monthlyMin: number;
    monthlyMax: number;
    currency: string;
    confidence: string;
    deliveryWeeksMin: number;
    deliveryWeeksMax: number;
  };
  rejectionReason?: string | null;
  sharedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
};

function formatMoney(value: number, currency: string) {
  return `${currency === "INR" ? "Rs. " : currency + " "}${value.toLocaleString("en-IN")}`;
}

function statusVariant(status: string): "success" | "warning" | "danger" | "neutral" | "accent" {
  if (status === "approved") return "success";
  if (status === "shared") return "accent";
  if (status === "rejected") return "danger";
  if (status === "draft") return "warning";
  return "neutral";
}

function EstimateSummary({ blueprint }: { blueprint: BlueprintRecord }) {
  const { estimate } = blueprint;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={statusVariant(blueprint.status)}>
          v{blueprint.version} - {blueprint.status}
        </Badge>
        <Badge variant="neutral">{blueprint.scaleTier}</Badge>
        <Badge variant="neutral">{estimate.confidence} estimate</Badge>
      </div>

      {blueprint.status === "rejected" && blueprint.rejectionReason ? (
        <div className="rounded-lg border border-danger/40 bg-danger/5 p-3">
          <p className="text-xs font-semibold text-danger">Client requested changes</p>
          <p className="mt-1 text-sm text-foreground">{blueprint.rejectionReason}</p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-white p-3">
          <p className="text-xs text-muted-foreground">One-time</p>
          <p className="mt-1 font-semibold text-foreground">
            {formatMoney(estimate.oneTimeMin, estimate.currency)} - {formatMoney(estimate.oneTimeMax, estimate.currency)}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-white p-3">
          <p className="text-xs text-muted-foreground">Monthly</p>
          <p className="mt-1 font-semibold text-foreground">
            {formatMoney(estimate.monthlyMin, estimate.currency)} - {formatMoney(estimate.monthlyMax, estimate.currency)}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Delivery: {estimate.deliveryWeeksMin}-{estimate.deliveryWeeksMax} weeks
      </p>

      <div className="space-y-2">
        {blueprint.components.map((c) => (
          <div key={c.code} className="rounded-lg border border-border bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-foreground">{c.title}</span>
              <span className="text-sm text-muted-foreground">
                {formatMoney(c.oneTimePrice, estimate.currency)}
                {c.monthlyPrice ? ` + ${formatMoney(c.monthlyPrice, estimate.currency)}/mo` : ""}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{c.rationale}</p>
          </div>
        ))}
        {blueprint.components.length === 0 ? (
          <p className="text-sm text-muted-foreground">No components recommended from these answers.</p>
        ) : null}
      </div>
    </div>
  );
}

function QuestionnaireForm({
  leadId,
  questions,
  onCreated,
}: {
  leadId: string;
  questions: Question[];
  onCreated: (blueprint: BlueprintRecord) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function setSingle(code: string, value: string) {
    setAnswers((prev) => ({ ...prev, [code]: [value] }));
  }

  function toggleMulti(code: string, value: string) {
    setAnswers((prev) => {
      const current = prev[code] ?? [];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      return { ...prev, [code]: next };
    });
  }

  function setText(code: string, value: string) {
    setAnswers((prev) => ({ ...prev, [code]: value ? [value] : [] }));
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const payloadAnswers = questions
        .filter((q) => (answers[q.code]?.length ?? 0) > 0)
        .map((q) => ({ questionCode: q.code, values: answers[q.code] }));

      if (payloadAnswers.length === 0) {
        setError("Answer at least one question before generating a blueprint.");
        return;
      }

      const res = await fetch(`/api/blueprint/${leadId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: payloadAnswers }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body?.error?.message ?? "Failed to create blueprint");
      }
      onCreated(body.data as BlueprintRecord);
      setAnswers({});
    } catch (value) {
      setError(value instanceof Error ? value.message : "Failed to create blueprint");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {questions.map((question) => (
        <div key={question.code} className="space-y-2">
          <p className="text-sm font-medium text-foreground">{question.question}</p>
          {question.helpText ? (
            <p className="text-xs text-muted-foreground">{question.helpText}</p>
          ) : null}

          {question.kind === "text" ? (
            <Textarea
              value={answers[question.code]?.[0] ?? ""}
              onChange={(event) => setText(question.code, event.target.value)}
              placeholder="Type their answer"
            />
          ) : (
            <div className="flex flex-wrap gap-2">
              {question.options?.map((option) => {
                const selected = (answers[question.code] ?? []).includes(option.value);
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() =>
                      question.kind === "single"
                        ? setSingle(question.code, option.value)
                        : toggleMulti(question.code, option.value)
                    }
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      selected
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-white text-foreground hover:bg-surface-soft"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ))}

      <Button type="button" onClick={submit} disabled={busy}>
        {busy ? "Generating..." : "Generate Blueprint"}
      </Button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function BlueprintEditor({
  leadId,
  questions,
  initialBlueprint,
}: {
  leadId: string;
  questions: Question[];
  initialBlueprint: BlueprintRecord | null;
}) {
  const [blueprint, setBlueprint] = useState<BlueprintRecord | null>(initialBlueprint);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  async function share() {
    if (!blueprint) return;
    setSharing(true);
    setShareMessage("");
    try {
      const res = await fetch(`/api/blueprint/${leadId}/share`, { method: "POST" });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body?.error?.message ?? "Failed to share blueprint");
      }
      setBlueprint(body.data as BlueprintRecord);
      setShareMessage("Shared - the client can now review it in their portal.");
    } catch (value) {
      setShareMessage(value instanceof Error ? value.message : "Failed to share blueprint");
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="space-y-6">
      {blueprint ? (
        <Card>
          <CardHeader>
            <CardTitle>Current Blueprint</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EstimateSummary blueprint={blueprint} />
            {blueprint.status === "draft" ? (
              <Button type="button" variant="secondary" onClick={share} disabled={sharing}>
                {sharing ? "Sharing..." : "Share With Client"}
              </Button>
            ) : null}
            {shareMessage ? <p className="text-sm text-muted-foreground">{shareMessage}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>{blueprint ? "Create New Version" : "Requirements Call"}</CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionnaireForm leadId={leadId} questions={questions} onCreated={setBlueprint} />
        </CardContent>
      </Card>
    </div>
  );
}
