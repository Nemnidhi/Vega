"use client";

import { type FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type LeadCategory = "software_request" | "infrastructure" | "other";

type LeadFormState = {
  title: string;
  contactName: string;
  email: string;
  phone: string;
  category: LeadCategory;
  source: "website" | "referral" | "cold_outreach" | "paid_ads" | "event" | "partner" | "other";
  urgency: "low" | "medium" | "high" | "critical";
  description: string;
};

type CsvLeadRow = Record<string, string>;

type BulkUploadResponse = {
  createdCount: number;
  failedCount: number;
  failedRows: Array<{ row: number; reason: string }>;
};

const initialState: LeadFormState = {
  title: "",
  contactName: "",
  email: "",
  phone: "",
  category: "software_request",
  source: "website",
  urgency: "medium",
  description: "",
};

function parseCsvText(text: string): CsvLeadRow[] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        currentCell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);
  rows.push(currentRow);

  const nonEmptyRows = rows
    .map((row) => row.map((cell) => cell.trim()))
    .filter((row) => row.some((cell) => cell.length > 0));

  if (!nonEmptyRows.length) return [];

  const headers = nonEmptyRows[0].map((header) => header.trim());
  const parsed: CsvLeadRow[] = [];

  for (const row of nonEmptyRows.slice(1)) {
    const record: CsvLeadRow = {};
    headers.forEach((header, columnIndex) => {
      if (!header) return;
      record[header] = row[columnIndex] ?? "";
    });

    const hasValues = Object.values(record).some((value) => value.trim().length > 0);
    if (hasValues) {
      parsed.push(record);
    }
  }

  return parsed;
}

function getCsvTemplateContent() {
  return [
    "title,contactName,email,phone,source,category,urgency,description,budgetMin,budgetMax,budgetCurrency,tags",
    "\"Website Revamp - Q2\",\"Riya Shah\",\"riya@example.com\",\"+91 9876543210\",\"website\",\"software_request\",\"high\",\"Need website redesign with lead forms\",50000,120000,INR,\"priority,website\"",
    "\"Infra Monitoring\",\"Aman Verma\",\"aman@example.com\",\"+91 9988776655\",\"referral\",\"infrastructure\",\"medium\",\"Set up monitoring and alerting for app servers\",80000,150000,INR,\"infra,devops\"",
  ].join("\n");
}

export function LeadIntakeForms() {
  const router = useRouter();
  const [form, setForm] = useState<LeadFormState>(initialState);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [bulkRows, setBulkRows] = useState<CsvLeadRow[]>([]);
  const [bulkFileName, setBulkFileName] = useState("");
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("");
  const [bulkResult, setBulkResult] = useState<BulkUploadResponse | null>(null);

  const canSubmit = useMemo(
    () =>
      form.title.trim().length >= 3 &&
      form.contactName.trim().length >= 2 &&
      form.email.trim().includes("@") &&
      form.description.trim().length >= 10,
    [form.contactName, form.description, form.email, form.title],
  );

  const canUploadBulk = bulkRows.length > 0 && !bulkUploading;

  async function submitLead(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          contactName: form.contactName,
          email: form.email,
          phone: form.phone || undefined,
          category: form.category,
          source: form.source,
          urgency: form.urgency,
          description: form.description,
          tags: [],
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Lead creation failed");
      }

      setMessage("Lead saved successfully.");
      setForm(initialState);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create lead");
    } finally {
      setLoading(false);
    }
  }

  async function handleCsvSelection(event: React.ChangeEvent<HTMLInputElement>) {
    setBulkMessage("");
    setBulkResult(null);

    const file = event.target.files?.[0];
    if (!file) {
      setBulkRows([]);
      setBulkFileName("");
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setBulkRows([]);
      setBulkFileName("");
      setBulkMessage("Please select a CSV file.");
      return;
    }

    try {
      const text = await file.text();
      const parsedRows = parseCsvText(text);

      if (!parsedRows.length) {
        throw new Error("CSV is empty or does not contain data rows.");
      }

      setBulkRows(parsedRows);
      setBulkFileName(file.name);
      setBulkMessage(`Parsed ${parsedRows.length} lead row(s).`);
    } catch (error) {
      setBulkRows([]);
      setBulkFileName("");
      setBulkMessage(error instanceof Error ? error.message : "Failed to read CSV file.");
    }
  }

  async function uploadBulkLeads(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    if (!bulkRows.length) {
      setBulkMessage("Select and parse a CSV file first.");
      return;
    }

    setBulkUploading(true);
    setBulkMessage("");
    setBulkResult(null);

    try {
      const response = await fetch("/api/leads/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: bulkRows }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Bulk lead upload failed.");
      }

      const result = data.data as BulkUploadResponse;
      setBulkResult(result);
      setBulkMessage(
        `Bulk upload complete. Created ${result.createdCount} lead(s), failed ${result.failedCount}.`,
      );
      if (result.createdCount > 0) {
        router.refresh();
      }

      if (result.failedCount === 0) {
        formElement.reset();
        setBulkRows([]);
        setBulkFileName("");
      } else {
        setBulkRows([]);
        setBulkMessage(
          `Bulk upload complete. Created ${result.createdCount} lead(s), failed ${result.failedCount}. If needed, fix failed rows in CSV and select file again.`,
        );
      }
    } catch (error) {
      setBulkMessage(error instanceof Error ? error.message : "Bulk lead upload failed.");
    } finally {
      setBulkUploading(false);
    }
  }

  function downloadCsvTemplate() {
    const blob = new Blob([getCsvTemplateContent()], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "lead-bulk-upload-template.csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Lead</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Fill basic details to add a lead quickly.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          <form className="grid gap-3" onSubmit={submitLead}>
            <Input
              value={form.title}
              onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Lead title"
              required
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={form.contactName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contactName: event.target.value }))
                }
                placeholder="Contact name"
                required
              />
              <Input
                value={form.email}
                type="email"
                onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="Contact email"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                value={form.phone}
                onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                placeholder="Phone (optional)"
              />
              <select
                className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
                value={form.category}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    category: event.target.value as LeadFormState["category"],
                  }))
                }
              >
                <option value="software_request">Software Request</option>
                <option value="infrastructure">Infrastructure</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
                value={form.source}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    source: event.target.value as LeadFormState["source"],
                  }))
                }
              >
                <option value="website">Website</option>
                <option value="referral">Referral</option>
                <option value="cold_outreach">Cold outreach</option>
                <option value="paid_ads">Paid ads</option>
                <option value="event">Event</option>
                <option value="partner">Partner</option>
                <option value="other">Other</option>
              </select>

              <select
                className="h-11 rounded-lg border border-border bg-white px-3 text-sm"
                value={form.urgency}
                onChange={(event) =>
                  setForm((prev) => ({
                    ...prev,
                    urgency: event.target.value as LeadFormState["urgency"],
                  }))
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>

            <Textarea
              value={form.description}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, description: event.target.value }))
              }
              placeholder="Short requirement summary..."
              required
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!canSubmit || loading}>
                {loading ? "Saving..." : "Save Lead"}
              </Button>
              {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Bulk Lead Upload (CSV)</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload multiple leads from one CSV file.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-border bg-surface-soft p-3 text-sm text-muted-foreground">
            <p>
              Required columns: <span className="font-medium text-foreground">contactName, email</span>
            </p>
            <p className="mt-1">
              Recommended columns: title, phone, source, category, urgency, description, budgetMin,
              budgetMax, budgetCurrency, tags
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="secondary" onClick={downloadCsvTemplate}>
              Download CSV Template
            </Button>
          </div>

          <form className="grid gap-3" onSubmit={uploadBulkLeads}>
            <Input type="file" accept=".csv,text/csv" onChange={handleCsvSelection} />

            <div className="text-sm text-muted-foreground">
              {bulkFileName ? <p>Selected file: {bulkFileName}</p> : <p>No CSV selected yet.</p>}
              {bulkRows.length > 0 ? <p>Rows ready: {bulkRows.length}</p> : null}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!canUploadBulk}>
                {bulkUploading ? "Uploading..." : "Upload CSV"}
              </Button>
              {bulkMessage ? <p className="text-sm text-muted-foreground">{bulkMessage}</p> : null}
            </div>
          </form>

          {bulkResult?.failedRows?.length ? (
            <div className="rounded-lg border border-border bg-white p-3 text-sm">
              <p className="font-semibold text-foreground">Failed Rows</p>
              <div className="mt-2 space-y-1 text-muted-foreground">
                {bulkResult.failedRows.slice(0, 8).map((item) => (
                  <p key={`${item.row}-${item.reason}`}>
                    Row {item.row}: {item.reason}
                  </p>
                ))}
                {bulkResult.failedRows.length > 8 ? (
                  <p>And {bulkResult.failedRows.length - 8} more failed row(s).</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
