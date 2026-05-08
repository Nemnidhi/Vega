"use client";

import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type QueryRecord = {
  _id: string;
  projectName: string;
  subject: string;
  message: string;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "resolved";
  createdAt: string;
  updatedAt: string;
};

type OnboardingChecklist = {
  accountSetup: boolean;
  businessProfile: boolean;
  requirementsShared: boolean;
  documentsShared: boolean;
  kickoffCallBooked: boolean;
};

type OnboardingRecord = {
  companyName: string;
  primaryGoal: string;
  kickoffDate: string | null;
  preferredCommunication: "email" | "phone" | "whatsapp" | "slack" | "meetings";
  billingContactEmail: string;
  projectBrief: string;
  onboardingNotes: string;
  checklist: OnboardingChecklist;
};

type OnboardingFormState = Omit<OnboardingRecord, "kickoffDate"> & {
  kickoffDate: string;
};

interface ClientQueryPortalProps {
  initialQueries: QueryRecord[];
  initialOnboarding: OnboardingRecord;
  clientName: string;
}

const onboardingSteps: Array<{
  key: keyof OnboardingChecklist;
  label: string;
  help: string;
}> = [
  {
    key: "accountSetup",
    label: "Account and access confirmed",
    help: "Ensure your login and portal access are working.",
  },
  {
    key: "businessProfile",
    label: "Business profile shared",
    help: "Add your business context and main contacts.",
  },
  {
    key: "requirementsShared",
    label: "Requirements submitted",
    help: "Provide goals, scope, and must-have expectations.",
  },
  {
    key: "documentsShared",
    label: "Documents uploaded",
    help: "Share supporting files and reference documents.",
  },
  {
    key: "kickoffCallBooked",
    label: "Kickoff call scheduled",
    help: "Finalize kickoff date and communication process.",
  },
];

function statusVariant(status: QueryRecord["status"]) {
  if (status === "resolved") return "success" as const;
  if (status === "in_progress") return "warning" as const;
  return "accent" as const;
}

function priorityVariant(priority: QueryRecord["priority"]) {
  if (priority === "high") return "danger" as const;
  if (priority === "medium") return "warning" as const;
  return "neutral" as const;
}

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-IN");
}

function toDateInputValue(value: string | null) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

export function ClientQueryPortal({
  initialQueries,
  initialOnboarding,
  clientName,
}: ClientQueryPortalProps) {
  const [queries, setQueries] = useState(initialQueries);
  const [onboarding, setOnboarding] = useState<OnboardingFormState>({
    ...initialOnboarding,
    kickoffDate: toDateInputValue(initialOnboarding.kickoffDate),
  });
  const [projectName, setProjectName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<QueryRecord["priority"]>("medium");
  const [statusFilter, setStatusFilter] = useState<"all" | QueryRecord["status"]>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | QueryRecord["priority"]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [savingOnboarding, setSavingOnboarding] = useState(false);
  const [onboardingMessage, setOnboardingMessage] = useState("");
  const [formMessage, setFormMessage] = useState("");

  const canSubmit = useMemo(
    () =>
      projectName.trim().length >= 2 &&
      subject.trim().length >= 3 &&
      message.trim().length >= 10,
    [message, projectName, subject],
  );

  const stats = useMemo(() => {
    const total = queries.length;
    const open = queries.filter((item) => item.status === "open").length;
    const inProgress = queries.filter((item) => item.status === "in_progress").length;
    const resolved = queries.filter((item) => item.status === "resolved").length;
    return { total, open, inProgress, resolved };
  }, [queries]);

  const filteredQueries = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();

    return queries.filter((item) => {
      const statusMatch = statusFilter === "all" || item.status === statusFilter;
      const priorityMatch = priorityFilter === "all" || item.priority === priorityFilter;
      const searchMatch =
        normalizedSearch.length === 0 ||
        item.projectName.toLowerCase().includes(normalizedSearch) ||
        item.subject.toLowerCase().includes(normalizedSearch) ||
        item.message.toLowerCase().includes(normalizedSearch);

      return statusMatch && priorityMatch && searchMatch;
    });
  }, [priorityFilter, queries, searchQuery, statusFilter]);

  const onboardingCompletedCount = useMemo(
    () =>
      onboardingSteps.filter((item) => onboarding.checklist[item.key]).length,
    [onboarding.checklist],
  );

  const onboardingProgress = useMemo(
    () => Math.round((onboardingCompletedCount / onboardingSteps.length) * 100),
    [onboardingCompletedCount],
  );

  const onboardingStatus = useMemo(() => {
    if (onboardingCompletedCount === 0) {
      return "Not Started";
    }
    if (onboardingCompletedCount === onboardingSteps.length) {
      return "Completed";
    }
    return "In Progress";
  }, [onboardingCompletedCount]);

  function toggleOnboardingStep(step: keyof OnboardingChecklist) {
    setOnboarding((prev) => ({
      ...prev,
      checklist: {
        ...prev.checklist,
        [step]: !prev.checklist[step],
      },
    }));
  }

  async function saveOnboarding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingOnboarding(true);
    setOnboardingMessage("");

    try {
      const response = await fetch("/api/client/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...onboarding,
          kickoffDate: onboarding.kickoffDate || null,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to save onboarding details");
      }

      const saved = data.data as OnboardingRecord;
      setOnboarding({
        ...saved,
        kickoffDate: toDateInputValue(saved.kickoffDate),
      });
      setOnboardingMessage("Onboarding details saved.");
    } catch (error) {
      setOnboardingMessage(
        error instanceof Error ? error.message : "Failed to save onboarding details",
      );
    } finally {
      setSavingOnboarding(false);
    }
  }

  async function refreshQueries() {
    setRefreshing(true);
    try {
      const response = await fetch("/api/client/queries", { method: "GET" });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to refresh queries");
      }
      setQueries(data.data as QueryRecord[]);
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Failed to refresh queries");
    } finally {
      setRefreshing(false);
    }
  }

  async function submitQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setFormMessage("");

    try {
      const response = await fetch("/api/client/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName, subject, message, priority }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to raise query");
      }

      setQueries((prev) => [data.data as QueryRecord, ...prev]);
      setProjectName("");
      setSubject("");
      setMessage("");
      setPriority("medium");
      setFormMessage("Query raised successfully.");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "Failed to raise query");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-4 sm:space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">Welcome, {clientName}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Total Queries</p>
            <p className="mt-1 text-2xl font-semibold">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Open</p>
            <p className="mt-1 text-2xl font-semibold">{stats.open}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">In Progress</p>
            <p className="mt-1 text-2xl font-semibold">{stats.inProgress}</p>
          </div>
          <div className="rounded-xl border border-border bg-white p-3">
            <p className="text-xs text-muted-foreground">Resolved</p>
            <p className="mt-1 text-2xl font-semibold">{stats.resolved}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Client Onboarding</CardTitle>
            <Badge
              variant={
                onboardingProgress === 100
                  ? "success"
                  : onboardingProgress === 0
                    ? "neutral"
                    : "warning"
              }
            >
              {onboardingStatus}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3.5 sm:space-y-4">
          <div className="space-y-2">
            <div className="h-2 overflow-hidden rounded-full bg-[#ece8de]">
              <div
                className="h-full bg-accent transition-[width] duration-200"
                style={{ width: `${onboardingProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {onboardingCompletedCount}/{onboardingSteps.length} onboarding steps completed.
            </p>
          </div>

          <form className="grid gap-3.5 sm:gap-4" onSubmit={saveOnboarding}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={onboarding.companyName}
                onChange={(event) =>
                  setOnboarding((prev) => ({ ...prev, companyName: event.target.value }))
                }
                placeholder="Company name"
              />
              <Input
                value={onboarding.primaryGoal}
                onChange={(event) =>
                  setOnboarding((prev) => ({ ...prev, primaryGoal: event.target.value }))
                }
                placeholder="Primary onboarding goal"
              />
              <Input
                type="date"
                value={onboarding.kickoffDate}
                onChange={(event) =>
                  setOnboarding((prev) => ({ ...prev, kickoffDate: event.target.value }))
                }
              />
              <select
                className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
                value={onboarding.preferredCommunication}
                onChange={(event) =>
                  setOnboarding((prev) => ({
                    ...prev,
                    preferredCommunication: event.target.value as OnboardingFormState["preferredCommunication"],
                  }))
                }
              >
                <option value="email">Email</option>
                <option value="phone">Phone Call</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="slack">Slack</option>
                <option value="meetings">Meetings</option>
              </select>
              <Input
                type="email"
                value={onboarding.billingContactEmail}
                onChange={(event) =>
                  setOnboarding((prev) => ({
                    ...prev,
                    billingContactEmail: event.target.value,
                  }))
                }
                placeholder="Billing contact email"
                className="sm:col-span-2"
              />
            </div>

            <Textarea
              className="min-h-[110px] sm:min-h-[120px]"
              value={onboarding.projectBrief}
              onChange={(event) =>
                setOnboarding((prev) => ({ ...prev, projectBrief: event.target.value }))
              }
              placeholder="Project brief and onboarding context"
            />
            <Textarea
              className="min-h-[96px] sm:min-h-[110px]"
              value={onboarding.onboardingNotes}
              onChange={(event) =>
                setOnboarding((prev) => ({ ...prev, onboardingNotes: event.target.value }))
              }
              placeholder="Notes for your onboarding manager"
            />

            <div className="rounded-xl border border-border bg-white p-3">
              <p className="text-sm font-semibold">Onboarding Checklist</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {onboardingSteps.map((item) => (
                  <label
                    key={item.key}
                    className="flex items-start gap-2 rounded-md border border-border p-2.5"
                  >
                    <input
                      type="checkbox"
                      checked={onboarding.checklist[item.key]}
                      onChange={() => toggleOnboardingStep(item.key)}
                      className="mt-0.5 h-4 w-4 rounded border-border accent-accent"
                    />
                    <span>
                      <span className="block text-sm font-medium text-foreground">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.help}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
              <Button type="submit" disabled={savingOnboarding} className="w-full sm:w-auto">
                {savingOnboarding ? "Saving..." : "Save Onboarding"}
              </Button>
              {onboardingMessage ? (
                <p className="text-sm leading-6 text-muted-foreground">{onboardingMessage}</p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raise New Query</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3.5 sm:gap-4" onSubmit={submitQuery}>
            <Input
              value={projectName}
              onChange={(event) => setProjectName(event.target.value)}
              placeholder="Project name"
              required
            />
            <Input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Query subject"
              required
            />
            <select
              className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              value={priority}
              onChange={(event) => setPriority(event.target.value as QueryRecord["priority"])}
            >
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
            <Textarea
              className="min-h-[120px] sm:min-h-[132px]"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe your project query in detail..."
              required
            />
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:gap-3">
              <Button type="submit" disabled={!canSubmit || submitting} className="w-full sm:w-auto">
                {submitting ? "Submitting..." : "Raise Query"}
              </Button>
              {formMessage ? (
                <p className="text-sm leading-6 text-muted-foreground">{formMessage}</p>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Track Queries</CardTitle>
            <Button
              variant="secondary"
              size="sm"
              onClick={refreshQueries}
              disabled={refreshing}
              className="w-full sm:w-auto"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by project, subject, message"
            />
            <select
              className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | QueryRecord["status"])}
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              value={priorityFilter}
              onChange={(event) =>
                setPriorityFilter(event.target.value as "all" | QueryRecord["priority"])
              }
            >
              <option value="all">All priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          {filteredQueries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No queries found for selected filters.
            </p>
          ) : (
            filteredQueries.map((query) => (
              <div key={query._id} className="rounded-xl border border-border bg-white p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold">{query.subject}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Project: {query.projectName}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={priorityVariant(query.priority)}>{humanize(query.priority)}</Badge>
                    <Badge variant={statusVariant(query.status)}>{humanize(query.status)}</Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm text-foreground">{query.message}</p>
                <div className="mt-3 flex flex-col gap-1 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                  <p>Raised: {formatDateTime(query.createdAt)}</p>
                  <p>Last Update: {formatDateTime(query.updatedAt)}</p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Help and SLA</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground">
          <p>High priority queries are reviewed first by the team.</p>
          <p>Use clear subject lines so support can route quickly.</p>
          <p>For urgent blockers, mark priority as High and include impact details.</p>
        </CardContent>
      </Card>
    </section>
  );
}
