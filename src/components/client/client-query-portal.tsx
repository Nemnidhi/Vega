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

interface ClientQueryPortalProps {
  initialQueries: QueryRecord[];
  clientName: string;
}

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

export function ClientQueryPortal({ initialQueries, clientName }: ClientQueryPortalProps) {
  const [queries, setQueries] = useState(initialQueries);
  const [projectName, setProjectName] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<QueryRecord["priority"]>("medium");
  const [statusFilter, setStatusFilter] = useState<"all" | QueryRecord["status"]>("all");
  const [priorityFilter, setPriorityFilter] = useState<"all" | QueryRecord["priority"]>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
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
    <section className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Welcome, {clientName}</CardTitle>
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
          <CardTitle>Raise New Query</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={submitQuery}>
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
              className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
              value={priority}
              onChange={(event) => setPriority(event.target.value as QueryRecord["priority"])}
            >
              <option value="low">Low priority</option>
              <option value="medium">Medium priority</option>
              <option value="high">High priority</option>
            </select>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe your project query in detail..."
              required
            />
            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!canSubmit || submitting}>
                {submitting ? "Submitting..." : "Raise Query"}
              </Button>
              {formMessage ? <p className="text-sm text-muted-foreground">{formMessage}</p> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle>Track Queries</CardTitle>
            <Button variant="secondary" size="sm" onClick={refreshQueries} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-3">
            <Input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by project, subject, message"
            />
            <select
              className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "all" | QueryRecord["status"])}
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
            <select
              className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
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
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{query.subject}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Project: {query.projectName}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={priorityVariant(query.priority)}>{humanize(query.priority)}</Badge>
                    <Badge variant={statusVariant(query.status)}>{humanize(query.status)}</Badge>
                  </div>
                </div>
                <p className="mt-2 text-sm text-foreground">{query.message}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
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
