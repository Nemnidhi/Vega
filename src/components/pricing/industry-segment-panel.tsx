"use client";

import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

export interface IndustryItem {
  _id: string;
  key: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface SegmentItem {
  _id: string;
  industryId: string;
  key: string;
  label: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

const emptyIndustryForm = { key: "", label: "", sortOrder: "0" };
const emptySegmentForm = { key: "", label: "", description: "", sortOrder: "0" };

interface Props {
  initialIndustries: IndustryItem[];
  initialSegments: SegmentItem[];
}

export function IndustrySegmentPanel({ initialIndustries, initialSegments }: Props) {
  const [industries, setIndustries] = useState(initialIndustries);
  const [segments, setSegments] = useState(initialSegments);
  const [selectedIndustryId, setSelectedIndustryId] = useState<string | null>(
    initialIndustries[0]?._id ?? null,
  );
  const [industryForm, setIndustryForm] = useState(emptyIndustryForm);
  const [segmentForm, setSegmentForm] = useState(emptySegmentForm);
  const [editingSegmentId, setEditingSegmentId] = useState<string | null>(null);
  const [savingIndustry, setSavingIndustry] = useState(false);
  const [savingSegment, setSavingSegment] = useState(false);
  const [message, setMessage] = useState("");

  const segmentsForSelected = segments.filter((segment) => segment.industryId === selectedIndustryId);

  async function createIndustry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingIndustry(true);
    setMessage("");
    try {
      const response = await fetch("/api/industries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: industryForm.key,
          label: industryForm.label,
          sortOrder: Number(industryForm.sortOrder),
          isActive: true,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to save industry");
      }
      const saved = data.data as IndustryItem;
      setIndustries((prev) => {
        const exists = prev.some((industry) => industry._id === saved._id);
        return exists
          ? prev.map((industry) => (industry._id === saved._id ? saved : industry))
          : [...prev, saved].sort((a, b) => a.sortOrder - b.sortOrder);
      });
      setSelectedIndustryId(saved._id);
      setIndustryForm(emptyIndustryForm);
      setMessage("Industry saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save industry");
    } finally {
      setSavingIndustry(false);
    }
  }

  async function toggleIndustryActive(industry: IndustryItem) {
    const response = await fetch(`/api/industries/${industry._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !industry.isActive }),
    });
    const data = await response.json();
    if (response.ok && data.success) {
      setIndustries((prev) =>
        prev.map((item) => (item._id === industry._id ? (data.data as IndustryItem) : item)),
      );
    }
  }

  function startCreateSegment() {
    setEditingSegmentId(null);
    setSegmentForm(emptySegmentForm);
  }

  function startEditSegment(segment: SegmentItem) {
    setEditingSegmentId(segment._id);
    setSegmentForm({
      key: segment.key,
      label: segment.label,
      description: segment.description,
      sortOrder: String(segment.sortOrder),
    });
  }

  async function saveSegment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedIndustryId) return;
    setSavingSegment(true);
    setMessage("");

    try {
      const payload = {
        industryId: selectedIndustryId,
        key: segmentForm.key,
        label: segmentForm.label,
        description: segmentForm.description,
        sortOrder: Number(segmentForm.sortOrder),
        isActive: true,
      };
      const response = editingSegmentId
        ? await fetch(`/api/industry-segments/${editingSegmentId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/industry-segments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to save segment");
      }
      const saved = data.data as SegmentItem;
      setSegments((prev) => {
        const exists = prev.some((segment) => segment._id === saved._id);
        return exists
          ? prev.map((segment) => (segment._id === saved._id ? saved : segment))
          : [...prev, saved];
      });
      startCreateSegment();
      setMessage("Business type saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save segment");
    } finally {
      setSavingSegment(false);
    }
  }

  async function toggleSegmentActive(segment: SegmentItem) {
    const response = await fetch(`/api/industry-segments/${segment._id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !segment.isActive }),
    });
    const data = await response.json();
    if (response.ok && data.success) {
      setSegments((prev) =>
        prev.map((item) => (item._id === segment._id ? (data.data as SegmentItem) : item)),
      );
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Add Industry</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-2.5" onSubmit={createIndustry}>
              <Input
                placeholder="Key (e.g. healthcare_services)"
                value={industryForm.key}
                onChange={(event) => setIndustryForm((prev) => ({ ...prev, key: event.target.value }))}
                required
              />
              <Input
                placeholder="Label (e.g. Healthcare Services)"
                value={industryForm.label}
                onChange={(event) => setIndustryForm((prev) => ({ ...prev, label: event.target.value }))}
                required
              />
              <Input
                type="number"
                placeholder="Sort order"
                value={industryForm.sortOrder}
                onChange={(event) => setIndustryForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
              />
              <Button type="submit" disabled={savingIndustry}>
                {savingIndustry ? "Saving..." : "Add Industry"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Industries ({industries.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {industries.map((industry) => (
              <button
                key={industry._id}
                type="button"
                onClick={() => setSelectedIndustryId(industry._id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  selectedIndustryId === industry._id
                    ? "bg-accent/10 font-semibold text-accent-strong"
                    : "hover:bg-vega-surface-hover"
                }`}
              >
                <span>{industry.label}</span>
                <span className="flex items-center gap-2">
                  <Badge variant={industry.isActive ? "success" : "neutral"}>
                    {industry.isActive ? "active" : "off"}
                  </Badge>
                  <span
                    role="button"
                    tabIndex={0}
                    className="text-xs text-muted-foreground underline"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleIndustryActive(industry);
                    }}
                  >
                    toggle
                  </span>
                </span>
              </button>
            ))}
            {industries.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No industries yet.</p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>
              {editingSegmentId ? "Edit Business Type" : "Add Business Type"}
              {selectedIndustryId ? (
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  in {industries.find((industry) => industry._id === selectedIndustryId)?.label}
                </span>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedIndustryId ? (
              <form className="grid gap-2.5" onSubmit={saveSegment}>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <Input
                    placeholder="Key (e.g. clinic_doctor)"
                    value={segmentForm.key}
                    onChange={(event) => setSegmentForm((prev) => ({ ...prev, key: event.target.value }))}
                    required
                  />
                  <Input
                    placeholder="Label (e.g. Clinic / Doctor)"
                    value={segmentForm.label}
                    onChange={(event) => setSegmentForm((prev) => ({ ...prev, label: event.target.value }))}
                    required
                  />
                </div>
                <Textarea
                  placeholder="Description (optional)"
                  value={segmentForm.description}
                  onChange={(event) => setSegmentForm((prev) => ({ ...prev, description: event.target.value }))}
                />
                <Input
                  type="number"
                  placeholder="Sort order"
                  value={segmentForm.sortOrder}
                  onChange={(event) => setSegmentForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                />
                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={savingSegment}>
                    {savingSegment ? "Saving..." : editingSegmentId ? "Update" : "Add Business Type"}
                  </Button>
                  {editingSegmentId ? (
                    <Button type="button" variant="secondary" onClick={startCreateSegment}>
                      Cancel edit
                    </Button>
                  ) : null}
                </div>
              </form>
            ) : (
              <p className="text-sm text-muted-foreground">Select an industry first.</p>
            )}
            {message ? <p className="mt-2 text-sm text-muted-foreground">{message}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Types ({segmentsForSelected.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {segmentsForSelected.map((segment) => (
              <div
                key={segment._id}
                className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{segment.label}</p>
                  {segment.description ? (
                    <p className="text-xs text-muted-foreground">{segment.description}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={segment.isActive ? "success" : "neutral"}>
                    {segment.isActive ? "active" : "off"}
                  </Badge>
                  <Button variant="secondary" size="sm" onClick={() => startEditSegment(segment)}>
                    Edit
                  </Button>
                  <Button variant="subtle" size="sm" onClick={() => toggleSegmentActive(segment)}>
                    {segment.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              </div>
            ))}
            {segmentsForSelected.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No business types under this industry yet.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
