"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type PopulatedUser = { _id: string; fullName: string; email: string } | string | null;

type Meeting = {
  _id: string;
  type: "online" | "in_person";
  startAt: string;
  durationMinutes: number;
  contactName: string;
  contactEmail: string;
  notes: string;
  status: "confirmed" | "cancelled";
  assignedToUserId: PopulatedUser;
  clientUserId: PopulatedUser;
  location: string;
};

type Slot = { dateKey: string; timeKey: string };

type WeeklyWindow = { dayOfWeek: number; startTime: string; endTime: string };

type Availability = {
  weeklyWindows: WeeklyWindow[];
  slotDurationMinutes: number;
  bufferMinutes: number;
  maxConcurrentBookings: { online: number; in_person: number };
  bookingWindowDays: number;
  minNoticeHours: number;
  blackoutDates: string[];
} | null;

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const defaultAvailability: NonNullable<Availability> = {
  weeklyWindows: [],
  slotDurationMinutes: 30,
  bufferMinutes: 0,
  maxConcurrentBookings: { online: 1, in_person: 1 },
  bookingWindowDays: 21,
  minNoticeHours: 12,
  blackoutDates: [],
};

async function callApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const payload = await response.json();
  if (!response.ok || !payload.success) {
    throw new Error(payload?.error?.message ?? "Request failed.");
  }
  return payload.data as T;
}

function displayName(user: PopulatedUser) {
  if (!user) return "Unassigned";
  if (typeof user === "string") return user;
  return user.fullName || user.email;
}

function formatMeetingTime(iso: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function MeetingsView({
  currentUserRole,
  initialMeetings,
  initialAvailability,
}: {
  currentUserRole: string;
  initialMeetings: Meeting[];
  initialAvailability: Availability;
}) {
  const [tab, setTab] = useState<"upcoming" | "availability">("upcoming");
  const [meetings, setMeetings] = useState(initialMeetings);
  const [availability, setAvailability] = useState<NonNullable<Availability>>(
    initialAvailability ?? defaultAvailability,
  );
  const [savingAvailability, setSavingAvailability] = useState(false);
  const [message, setMessage] = useState("");
  const canManage = ["admin", "partner", "sales", "project_manager"].includes(currentUserRole);

  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState<"online" | "in_person">("online");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  async function loadSlots(type: "online" | "in_person") {
    setLoadingSlots(true);
    setSelectedSlot(null);
    try {
      const data = await callApi<{ slots: Slot[] }>(`/api/meetings/slots?type=${type}`);
      setSlots(data.slots);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to load available slots.");
    } finally {
      setLoadingSlots(false);
    }
  }

  function openCreate() {
    setShowCreate(true);
    setCreateError("");
    loadSlots(createType);
  }

  function closeCreate() {
    setShowCreate(false);
    setCreateError("");
    setSelectedSlot(null);
    setContactName("");
    setContactEmail("");
    setContactPhone("");
    setCreateNotes("");
  }

  function changeCreateType(type: "online" | "in_person") {
    setCreateType(type);
    loadSlots(type);
  }

  async function submitCreate() {
    if (!selectedSlot) {
      setCreateError("Pick a time slot.");
      return;
    }
    if (!contactName.trim()) {
      setCreateError("Contact name is required.");
      return;
    }
    if (!contactEmail.trim() && !contactPhone.trim()) {
      setCreateError("Provide an email or phone number for the contact.");
      return;
    }
    setCreating(true);
    setCreateError("");
    try {
      const result = await callApi<{ meeting: Meeting }>("/api/meetings", {
        method: "POST",
        body: JSON.stringify({
          type: createType,
          dateKey: selectedSlot.dateKey,
          timeKey: selectedSlot.timeKey,
          contactName: contactName.trim(),
          contactEmail: contactEmail.trim() || undefined,
          contactPhone: contactPhone.trim() || undefined,
          notes: createNotes.trim() || undefined,
        }),
      });
      setMeetings((prev) =>
        [...prev, result.meeting].sort((a, b) => a.startAt.localeCompare(b.startAt)),
      );
      closeCreate();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create meeting.");
    } finally {
      setCreating(false);
    }
  }

  const slotsByDate = slots.reduce<Record<string, Slot[]>>((acc, slot) => {
    (acc[slot.dateKey] ??= []).push(slot);
    return acc;
  }, {});

  async function assign(meeting: Meeting) {
    const updated = await callApi<Meeting>(`/api/meetings/${meeting._id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "assign" }),
    });
    setMeetings((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
  }

  async function cancel(meeting: Meeting) {
    const reason = window.prompt("Reason for cancelling (optional):") ?? "";
    const updated = await callApi<Meeting>(`/api/meetings/${meeting._id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "cancel", cancelledReason: reason }),
    });
    setMeetings((prev) => prev.filter((m) => m._id !== updated._id));
  }

  function addWindow() {
    setAvailability((prev) => ({
      ...prev,
      weeklyWindows: [...prev.weeklyWindows, { dayOfWeek: 1, startTime: "10:00", endTime: "18:00" }],
    }));
  }

  function removeWindow(index: number) {
    setAvailability((prev) => ({
      ...prev,
      weeklyWindows: prev.weeklyWindows.filter((_, i) => i !== index),
    }));
  }

  function updateWindow(index: number, field: keyof WeeklyWindow, value: string) {
    setAvailability((prev) => ({
      ...prev,
      weeklyWindows: prev.weeklyWindows.map((w, i) =>
        i === index ? { ...w, [field]: field === "dayOfWeek" ? Number(value) : value } : w,
      ),
    }));
  }

  function addBlackoutDate() {
    const date = window.prompt("Blackout date (YYYY-MM-DD):");
    if (!date) return;
    setAvailability((prev) => ({ ...prev, blackoutDates: [...prev.blackoutDates, date] }));
  }

  function removeBlackoutDate(date: string) {
    setAvailability((prev) => ({ ...prev, blackoutDates: prev.blackoutDates.filter((d) => d !== date) }));
  }

  async function saveAvailability() {
    setSavingAvailability(true);
    setMessage("");
    try {
      const updated = await callApi<NonNullable<Availability>>("/api/meetings/availability", {
        method: "PUT",
        body: JSON.stringify(availability),
      });
      setAvailability(updated);
      setMessage("Saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save.");
    } finally {
      setSavingAvailability(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Button variant={tab === "upcoming" ? "primary" : "secondary"} onClick={() => setTab("upcoming")}>
            Upcoming
          </Button>
          {canManage ? (
            <Button variant={tab === "availability" ? "primary" : "secondary"} onClick={() => setTab("availability")}>
              Availability
            </Button>
          ) : null}
        </div>
        {canManage && tab === "upcoming" ? (
          showCreate ? (
            <Button variant="secondary" onClick={closeCreate}>
              Cancel
            </Button>
          ) : (
            <Button onClick={openCreate}>New meeting</Button>
          )
        ) : null}
      </div>

      {tab === "upcoming" && showCreate ? (
        <Card>
          <CardHeader>
            <CardTitle>New meeting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={createType === "online" ? "primary" : "secondary"}
                size="sm"
                onClick={() => changeCreateType("online")}
              >
                Online
              </Button>
              <Button
                variant={createType === "in_person" ? "primary" : "secondary"}
                size="sm"
                onClick={() => changeCreateType("in_person")}
              >
                In person
              </Button>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Pick a time</p>
              {loadingSlots ? (
                <p className="text-sm text-muted-foreground">Loading available slots...</p>
              ) : Object.keys(slotsByDate).length === 0 ? (
                <p className="text-sm text-muted-foreground">No open slots - check Availability is configured.</p>
              ) : (
                <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                  {Object.entries(slotsByDate).map(([dateKey, daySlots]) => (
                    <div key={dateKey}>
                      <p className="mb-1 text-xs font-medium text-muted-foreground">{dateKey}</p>
                      <div className="flex flex-wrap gap-2">
                        {daySlots.map((slot) => (
                          <Button
                            key={slot.timeKey}
                            variant={
                              selectedSlot?.dateKey === slot.dateKey && selectedSlot?.timeKey === slot.timeKey
                                ? "primary"
                                : "secondary"
                            }
                            size="sm"
                            onClick={() => setSelectedSlot(slot)}
                          >
                            {slot.timeKey}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-sm font-medium">Contact name</p>
                <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Full name" />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Email</p>
                <Input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Phone</p>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+91..." />
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm font-medium">Notes</p>
              <Textarea value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="Optional" />
            </div>

            {createError ? <p className="text-sm text-danger">{createError}</p> : null}
            <Button onClick={submitCreate} disabled={creating}>
              {creating ? "Creating..." : "Create meeting"}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {tab === "upcoming" ? (
        <Card>
          <CardHeader>
            <CardTitle>Upcoming meetings ({meetings.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {meetings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No upcoming meetings.</p>
            ) : (
              meetings.map((meeting) => (
                <div key={meeting._id} className="flex flex-col gap-2 border-b border-border/40 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{formatMeetingTime(meeting.startAt)}</span>
                      <Badge variant={meeting.type === "online" ? "accent" : "neutral"}>
                        {meeting.type === "online" ? "Online" : "In person"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {meeting.contactName} ({meeting.contactEmail}) - assigned to {displayName(meeting.assignedToUserId)}
                    </p>
                    {meeting.notes ? <p className="text-xs text-muted-foreground">{meeting.notes}</p> : null}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => assign(meeting)}>
                      Assign to me
                    </Button>
                    {canManage ? (
                      <Button variant="secondary" size="sm" onClick={() => cancel(meeting)}>
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Availability</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="mb-2 text-sm font-medium">Weekly windows (IST)</p>
              <div className="space-y-2">
                {availability.weeklyWindows.map((window, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                      value={window.dayOfWeek}
                      onChange={(e) => updateWindow(index, "dayOfWeek", e.target.value)}
                    >
                      {DAY_LABELS.map((label, day) => (
                        <option key={day} value={day}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <Input
                      type="time"
                      value={window.startTime}
                      onChange={(e) => updateWindow(index, "startTime", e.target.value)}
                      className="w-32"
                    />
                    <span>to</span>
                    <Input
                      type="time"
                      value={window.endTime}
                      onChange={(e) => updateWindow(index, "endTime", e.target.value)}
                      className="w-32"
                    />
                    <Button variant="secondary" size="sm" onClick={() => removeWindow(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
              <Button variant="secondary" size="sm" className="mt-2" onClick={addWindow}>
                Add window
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1 text-sm font-medium">Slot duration (minutes)</p>
                <Input
                  type="number"
                  value={availability.slotDurationMinutes}
                  onChange={(e) =>
                    setAvailability((prev) => ({ ...prev, slotDurationMinutes: Number(e.target.value) }))
                  }
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Buffer between slots (minutes)</p>
                <Input
                  type="number"
                  value={availability.bufferMinutes}
                  onChange={(e) => setAvailability((prev) => ({ ...prev, bufferMinutes: Number(e.target.value) }))}
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Max concurrent online meetings</p>
                <Input
                  type="number"
                  value={availability.maxConcurrentBookings.online}
                  onChange={(e) =>
                    setAvailability((prev) => ({
                      ...prev,
                      maxConcurrentBookings: { ...prev.maxConcurrentBookings, online: Number(e.target.value) },
                    }))
                  }
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Max concurrent in-person meetings</p>
                <Input
                  type="number"
                  value={availability.maxConcurrentBookings.in_person}
                  onChange={(e) =>
                    setAvailability((prev) => ({
                      ...prev,
                      maxConcurrentBookings: { ...prev.maxConcurrentBookings, in_person: Number(e.target.value) },
                    }))
                  }
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Booking window (days ahead)</p>
                <Input
                  type="number"
                  value={availability.bookingWindowDays}
                  onChange={(e) => setAvailability((prev) => ({ ...prev, bookingWindowDays: Number(e.target.value) }))}
                />
              </div>
              <div>
                <p className="mb-1 text-sm font-medium">Minimum notice (hours)</p>
                <Input
                  type="number"
                  value={availability.minNoticeHours}
                  onChange={(e) => setAvailability((prev) => ({ ...prev, minNoticeHours: Number(e.target.value) }))}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Blackout dates</p>
              <div className="flex flex-wrap gap-2">
                {availability.blackoutDates.map((date) => (
                  <Badge key={date} variant="neutral" className="cursor-pointer" onClick={() => removeBlackoutDate(date)}>
                    {date} ✕
                  </Badge>
                ))}
              </div>
              <Button variant="secondary" size="sm" className="mt-2" onClick={addBlackoutDate}>
                Add blackout date
              </Button>
            </div>

            {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            <Button onClick={saveAvailability} disabled={savingAvailability}>
              {savingAvailability ? "Saving..." : "Save availability"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
