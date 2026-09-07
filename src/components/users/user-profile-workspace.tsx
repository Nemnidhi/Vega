"use client";

import { type FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  FileText,
  Mail,
  MessageSquareText,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import type { UserProfilePayload, UserProfileTask } from "@/lib/users/profile";

interface UserProfileWorkspaceProps {
  initialProfile: UserProfilePayload;
}

const panelClass = "rounded-lg border border-vega-border bg-vega-surface-1";
const selectClass = "h-[38px] w-full rounded-md border border-vega-border bg-[#0b141f] px-3 text-xs text-vega-text outline-none focus:border-vega-accent/70";
const profileTabs = [
  { id: "profile-overview", label: "Overview" },
  { id: "profile-attendance", label: "Attendance" },
  { id: "profile-tasks", label: "Tasks" },
  { id: "profile-targets", label: "Targets" },
  { id: "profile-activity", label: "Activity" },
] as const;

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function titleCase(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function dateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "No due date";
}

function shortDateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "No due date";
}

function monthLabel(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function statusLabel(status: string) {
  if (status === "COMPLETED") return "Completed";
  if (["IN_PROGRESS", "REVIEW", "CLIENT_REVIEW", "WAITING", "BLOCKED"].includes(status)) return titleCase(status);
  if (status === "CANCELLED") return "Cancelled";
  return "To do";
}

function taskStatusClass(task: UserProfileTask) {
  if (task.status === "COMPLETED") return "bg-vega-green-soft text-[#62df90]";
  if (["IN_PROGRESS", "REVIEW", "CLIENT_REVIEW", "WAITING", "BLOCKED"].includes(task.status)) return "bg-vega-blue-soft text-[#73b7ff]";
  return "bg-[#192a3c] text-[#b7c7dc]";
}

function priorityClass(priority: string) {
  if (priority === "HIGH" || priority === "URGENT") return "bg-vega-red-soft text-[#ff717a]";
  if (priority === "MEDIUM") return "bg-vega-yellow-soft text-[#f0cc61]";
  return "bg-vega-green-soft text-[#62df90]";
}

function activityLabel(action: string) {
  const labels: Record<string, string> = {
    task_created: "Created a task",
    task_updated: "Updated a task",
    task_assigned: "Assigned a task",
    task_status_changed: "Updated task status",
    task_completed: "Completed a task",
    task_archived: "Archived a task",
    task_restored: "Restored a task",
    subtask_completed: "Completed a subtask",
    lead_status_changed: "Updated a lead status",
    lead_follow_up_completed: "Completed a lead follow-up",
    workflow_changed: "Updated a workflow",
  };
  return labels[action] ?? titleCase(action);
}

function activityDetail(entityType: string, action: string) {
  const verb = action.split("_").pop() ?? "updated";
  return `${titleCase(entityType)} ${verb.toLowerCase()}`;
}

function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-[#2563eb] font-semibold text-white", small ? "h-8 w-8 text-[11px]" : "h-16 w-16 text-xl lg:h-[72px] lg:w-[72px] lg:text-2xl")}>{initials(name)}</span>;
}

function OverdueBadge() {
  return <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-vega-red-soft px-1.5 py-0.5 text-[10px] font-medium text-[#ff707a]"><CircleAlert className="h-3 w-3" />Overdue</span>;
}

export function UserProfileWorkspace({ initialProfile }: UserProfileWorkspaceProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [activeTab, setActiveTab] = useState<string>(profileTabs[0].id);
  const [editing, setEditing] = useState(false);
  const [workDetailsOpen, setWorkDetailsOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    fullName: initialProfile.user.fullName,
    email: initialProfile.user.email,
    phone: initialProfile.user.phone,
    department: initialProfile.user.department,
    managerId: initialProfile.user.manager?.id ?? "",
    role: initialProfile.user.role,
    status: initialProfile.user.status,
  });

  const { user, attendance, tasks, targets, activity } = profile;
  const attendedDays = attendance.present + attendance.late + attendance.halfDay;
  const monthDays = attendance.totalMarked + attendance.leave;
  const donutSegments = [
    { key: "Present", value: attendance.present, color: "#39db7e" },
    { key: "Late", value: attendance.late, color: "#3b82f6" },
    { key: "Leave", value: attendance.leave, color: "#f2b842" },
    { key: "Absent", value: attendance.absent, color: "#f3626d" },
  ];
  const donutTotal = donutSegments.reduce((total, segment) => total + segment.value, 0);
  let donutCursor = 0;
  const donutStops = donutTotal > 0
    ? donutSegments
        .map((segment) => {
          const start = donutCursor;
          donutCursor += (segment.value / donutTotal) * 100;
          return `${segment.color} ${start}% ${donutCursor}%`;
        })
        .join(", ")
    : "#1a3044 0% 100%";

  function changeMonth(monthKey: string) {
    router.push(`/users/${user.id}?month=${monthKey}`);
  }

  function openTab(sectionId: string) {
    setActiveTab(sectionId);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data?.error?.message ?? "Unable to update profile.");
      const manager = profile.managers.find((item) => item.id === form.managerId) ?? null;
      setProfile((current) => ({
        ...current,
        user: {
          ...current.user,
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          department: form.department,
          role: form.role,
          status: form.status,
          manager,
        },
      }));
      setMessage("Profile updated successfully.");
      setEditing(false);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="min-w-0">

      <Link href="/users" className="mb-1 inline-flex items-center gap-2 text-xs font-medium text-[#7db7f3] hover:text-[#a6d0ff]"><ArrowLeft className="h-3.5 w-3.5" />Back to users</Link>
      <div className="mb-3"><h1 className="text-[26px] font-semibold leading-8 text-vega-text lg:text-[28px]">User profile</h1><p className="hidden text-xs text-vega-text-muted sm:block">View and manage user information, performance and activity.</p></div>

      {message ? <div className={cn("mb-3 rounded-md border px-3 py-2 text-xs", message.includes("successfully") ? "border-vega-green/35 bg-vega-green-soft text-[#67df94]" : "border-vega-red/35 bg-vega-red-soft text-[#ff7a83]")}>{message}</div> : null}

      <div className={cn(panelClass, "mb-4 p-4")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 items-start gap-4 lg:items-center">
            <Avatar name={user.fullName} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3"><h2 className="truncate text-lg font-semibold text-vega-text lg:text-xl">{user.fullName}</h2><span className={cn("rounded-md px-2 py-1 text-[10px] font-medium capitalize", user.status === "active" ? "bg-vega-green-soft text-[#62df90]" : "bg-vega-surface-2 text-vega-text-muted")}>{user.status}</span></div>
              <p className="mt-1 text-sm text-vega-text-secondary">{titleCase(user.role)}<span className="hidden lg:inline"><span className="px-2 text-vega-text-muted">·</span>{user.department || "No department"}</span></p>
              <p className="mt-1 text-xs text-vega-text-muted lg:hidden">{user.department || "No department"} <span className="px-1">·</span> {user.employeeId}</p>
            </div>
          </div>
          <div className="hidden h-14 w-px bg-vega-border lg:block" />
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-xs text-vega-text-secondary lg:grid lg:flex-1 lg:grid-cols-1 lg:gap-2"><a href={`mailto:${user.email}`} className="inline-flex min-w-0 items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-vega-text-muted" /><span className="truncate">{user.email}</span></a><span className="h-4 w-px bg-vega-border lg:hidden" /><a href={user.phone ? `tel:${user.phone}` : undefined} className="inline-flex min-w-0 items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-vega-text-muted" /><span>{user.phone || "Phone not added"}</span></a></div>
          <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center"><Link href={`/chat/${user.id}`} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-vega-border px-4 text-xs font-medium text-vega-text-secondary hover:bg-vega-surface-hover"><MessageSquareText className="h-4 w-4" />Message</Link><Button size="lg" onClick={() => setEditing(true)}><Pencil className="mr-2 h-4 w-4" />Edit profile</Button><button type="button" onClick={() => setEditing(true)} aria-label="More profile actions" className="hidden h-10 w-10 items-center justify-center rounded-md border border-vega-border text-vega-text-secondary hover:bg-vega-surface-hover lg:inline-flex"><MoreHorizontal className="h-4 w-4" /></button></div>
        </div>
        <div className="mt-4 hidden grid-cols-3 border-t border-vega-border pt-3 text-xs lg:grid"><div><p className="text-[10px] text-vega-text-muted">Employee ID</p><p className="mt-1 font-medium">{user.employeeId}</p></div><div className="border-l border-vega-border pl-6"><p className="text-[10px] text-vega-text-muted">Department</p><p className="mt-1 font-medium">{user.department || "Not assigned"}</p></div><div className="border-l border-vega-border pl-6"><p className="text-[10px] text-vega-text-muted">Reports to</p><p className="mt-1 font-medium">{user.manager?.fullName || "Not assigned"}</p></div></div>
        <button type="button" onClick={() => setWorkDetailsOpen((open) => !open)} className="mt-4 flex w-full items-center gap-3 border-t border-vega-border pt-3 text-left lg:hidden"><span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#142537] text-[#b7cbe2]"><UsersRound className="h-5 w-5" /></span><span className="flex-1"><span className="block text-sm font-semibold">Work details</span><span className="block text-xs text-vega-text-muted">Reports to {user.manager?.fullName || "not assigned"}</span></span><ChevronRight className={cn("h-4 w-4 text-vega-text-muted transition-transform", workDetailsOpen && "rotate-90")} /></button>
        {workDetailsOpen ? <div className="mt-3 grid grid-cols-2 gap-3 text-xs lg:hidden"><div><p className="text-vega-text-muted">Employee ID</p><p className="mt-1">{user.employeeId}</p></div><div><p className="text-vega-text-muted">Department</p><p className="mt-1">{user.department || "Not assigned"}</p></div></div> : null}
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid h-10 grid-cols-5 overflow-hidden rounded-md border border-vega-border sm:w-[610px]">{profileTabs.map((tab) => <button key={tab.id} type="button" onClick={() => openTab(tab.id)} className={cn("border-r border-vega-border px-2 text-[11px] font-medium transition-colors last:border-r-0", activeTab === tab.id ? "bg-vega-accent text-white" : "text-vega-text-secondary hover:bg-vega-surface-hover")}>{tab.label}</button>)}</div>
        <label className="relative ml-auto flex h-10 w-[185px] items-center gap-2 rounded-md border border-vega-border bg-[#0b141f] px-3 text-xs font-medium"><CalendarDays className="h-4 w-4 text-vega-text-muted" /><span>{monthLabel(profile.monthKey)}</span><ChevronDown className="ml-auto h-4 w-4 text-vega-text-muted" /><input type="month" value={profile.monthKey} onChange={(event) => changeMonth(event.target.value)} className="absolute inset-0 cursor-pointer opacity-0" /></label>
      </div>

      <div id="profile-overview" className="grid scroll-mt-20 gap-3 lg:grid-cols-[1.05fr_1.05fr_1fr]">
        <section id="profile-attendance" className={cn(panelClass, "scroll-mt-20 p-4")}>
          <div className="flex items-start gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-vega-blue-soft text-[#50a9f5]"><UsersRound className="h-5 w-5" /></span><div><h2 className="text-sm font-semibold">Attendance</h2><p className="hidden text-[11px] text-vega-text-muted lg:block">Workday attendance in {monthLabel(profile.monthKey)}</p></div></div>
          <div className="mt-3 flex items-center justify-around gap-5">
            <div className="relative h-[132px] w-[132px] shrink-0 rounded-full" style={{ background: `conic-gradient(${donutStops})` }}><div className="absolute inset-[18px] flex flex-col items-center justify-center rounded-full bg-vega-surface-1"><strong className="text-2xl">{attendance.attendancePercent}%</strong><span className="text-[10px] text-vega-text-muted">Attendance</span></div></div>
            <div className="min-w-[145px] flex-1 space-y-2 text-xs">{donutSegments.map((segment) => <div key={segment.key} className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: segment.color }} /><span className="flex-1 text-vega-text-muted">{segment.key}</span><strong>{segment.value}</strong></div>)}<p className="border-t border-vega-border pt-2 text-[10px] text-vega-text-muted">{attendedDays} of {monthDays} workdays attended</p></div>
          </div>
        </section>

        <section id="profile-tasks" className={cn(panelClass, "scroll-mt-20 p-4")}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#142537] text-[#a9c5e2] lg:flex"><CheckCircle2 className="h-5 w-5" /></span><div><h2 className="text-sm font-semibold">Task overview</h2><p className="hidden text-[11px] text-vega-text-muted lg:block">Total tasks across all statuses</p></div></div>
            <div className="flex items-center gap-2">{tasks.overdue > 0 ? <span className="inline-flex items-center gap-1.5 rounded-md bg-vega-red-soft px-2 py-1 text-[10px] text-[#ff707a]"><CircleAlert className="h-3.5 w-3.5" />{tasks.overdue} overdue</span> : null}<Link href="/tasks" aria-label="View all tasks" className="text-vega-text-muted lg:hidden"><ChevronRight className="h-4 w-4" /></Link></div>
          </div>
          <div className="mt-5 flex items-end justify-between gap-3"><p><strong className="text-3xl">{tasks.completed} / {tasks.total}</strong><span className="ml-2 text-xs text-vega-text-muted lg:hidden">Tasks complete</span><span className="ml-2 hidden text-xs text-vega-text-muted lg:inline">completed</span></p><strong className="text-sm lg:hidden">{tasks.completionPercent}%</strong></div>
          <div className="mt-3 flex items-center gap-3"><div className="h-3 flex-1 overflow-hidden rounded-full bg-[#1a3044]"><div className="h-full rounded-full bg-[#39d77e]" style={{ width: `${tasks.completionPercent}%` }} /></div><strong className="hidden text-sm lg:block">{tasks.completionPercent}%</strong></div>
          <div className="mt-4 grid grid-cols-3 divide-x divide-vega-border text-xs"><div><p className="flex items-center gap-2 text-vega-text-muted"><span className="h-2 w-2 rounded-full bg-[#39db7e]" /><span className="lg:hidden">Done</span><span className="hidden lg:inline">Completed</span></p><strong className="mt-1 block text-lg">{tasks.completed}</strong></div><div className="pl-4"><p className="flex items-center gap-2 text-vega-text-muted"><span className="h-2 w-2 rounded-full bg-[#4b9dfb]" />In progress</p><strong className="mt-1 block text-lg">{tasks.inProgress}</strong></div><div className="pl-4"><p className="flex items-center gap-2 text-vega-text-muted"><span className="h-2 w-2 rounded-full bg-[#6b7f95]" />To do</p><strong className="mt-1 block text-lg">{tasks.todo}</strong></div></div>
          <div className="mt-3 border-t border-vega-border-soft lg:hidden">
            {tasks.items.slice(0, 3).map((task) => <Link key={task.id} href={`/tasks/${task.id}`} className="flex items-center gap-2 border-b border-vega-border-soft py-2.5 text-xs"><span className="min-w-0 flex-1 truncate">{task.title}</span><span className={cn("shrink-0 rounded-md px-2 py-1 text-[10px]", taskStatusClass(task))}>{statusLabel(task.status)}</span><span className="shrink-0 text-vega-text-muted">{shortDateLabel(task.dueAt)}</span>{task.overdue ? <OverdueBadge /> : null}<span className={cn("shrink-0 rounded-md px-2 py-1 text-[10px]", priorityClass(task.priority))}>{titleCase(task.priority)}</span><ChevronRight className="h-4 w-4 shrink-0 text-vega-text-muted" /></Link>)}
            {tasks.items.length === 0 ? <p className="py-4 text-center text-xs text-vega-text-muted">No tasks assigned to this user.</p> : null}
            <Link href="/tasks" className="flex items-center gap-2 py-3 text-xs font-medium text-vega-accent">View all tasks <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </section>

        <section id="profile-targets" className={cn(panelClass, "scroll-mt-20 p-4")}>
          <div className="flex gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#142537] text-[#a9c5e2]"><Target className="h-5 w-5" /></span><div><h2 className="text-sm font-semibold">Targets</h2><p className="hidden text-[11px] text-vega-text-muted lg:block">Monthly target progress</p></div></div>
          <div className="mt-5 flex items-end justify-between gap-3"><p><strong className="text-3xl">{targets.met} / {targets.total}</strong><span className="ml-2 text-xs text-vega-text-muted">Targets met</span></p><strong className="text-sm lg:hidden">{targets.progressPercent}%</strong></div>
          <div className="mt-3 flex items-center gap-3"><div className="h-3 flex-1 overflow-hidden rounded-full bg-[#1a3044]"><div className="h-full rounded-full bg-[#39d77e]" style={{ width: `${targets.progressPercent}%` }} /></div><strong className="hidden text-sm lg:block">{targets.progressPercent}%</strong></div>
          <p className="mt-4 text-xs text-vega-text-muted">{targets.met} completed <span className="px-1">·</span> {Math.max(0, targets.total - targets.met)} in progress</p>
          <div className="lg:hidden">
            {targets.items.slice(0, 1).map((target) => <div key={target.id} className="mt-4 border-t border-vega-border-soft pt-3"><div className="mb-2 flex items-center gap-3 text-xs"><span className="min-w-0 flex-1 truncate">{target.title}</span><span className="text-vega-text-muted">{target.completed} / {target.target}</span><span className="w-10 text-right">{target.progressPercent}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#1a3044]"><div className="h-full rounded-full bg-vega-accent" style={{ width: `${target.progressPercent}%` }} /></div></div>)}
            <Link href="/tasks" className="mt-3 flex items-center gap-2 border-t border-vega-border-soft py-3 text-xs"><span className="flex-1">{targets.met} completed targets</span><ChevronRight className="h-4 w-4 text-vega-text-muted" /></Link>
            <Link href="/tasks" className="flex items-center gap-2 text-xs font-medium text-vega-accent">View targets <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <Link href="/tasks" className="mt-5 hidden items-center justify-end gap-2 text-xs font-medium text-vega-accent lg:flex">View targets <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>

      <div className="mt-3 hidden gap-3 lg:grid lg:grid-cols-[1.7fr_1fr]">
        <section className={cn(panelClass, "overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-vega-border px-4 py-3"><div className="flex gap-3"><ClipboardCheck className="h-5 w-5 text-vega-text-muted" /><div><h2 className="text-sm font-semibold">Assigned tasks</h2><p className="text-[10px] text-vega-text-muted">Key tasks and their current status</p></div></div><div className="flex items-center gap-3"><Link href="/tasks" className="inline-flex h-8 items-center gap-2 rounded-md bg-vega-accent px-3 text-[11px] font-medium text-white"><Plus className="h-3.5 w-3.5" />Assign task</Link><Link href="/tasks" className="inline-flex items-center gap-1.5 text-[11px] font-medium text-vega-accent">View all <ArrowRight className="h-3.5 w-3.5" /></Link></div></div>
          <div className="grid grid-cols-[1.6fr_1fr_1.2fr_.8fr] bg-[#102031] px-4 py-2 text-[10px] text-vega-text-muted"><span>Task</span><span>Status</span><span>Due date</span><span>Priority</span></div>
          {tasks.items.slice(0, 4).map((task) => <Link href={`/tasks/${task.id}`} key={task.id} className="grid grid-cols-[1.6fr_1fr_1.2fr_.8fr] items-center border-t border-vega-border-soft px-4 py-2 text-xs hover:bg-vega-surface-hover"><span className="truncate">{task.title}</span><span><span className={cn("rounded-md px-2 py-1 text-[10px]", taskStatusClass(task))}>{statusLabel(task.status)}</span></span><span className="flex items-center gap-2 text-vega-text-secondary">{dateLabel(task.dueAt)}{task.overdue ? <OverdueBadge /> : null}</span><span><span className={cn("rounded-md px-2 py-1 text-[10px]", priorityClass(task.priority))}>{titleCase(task.priority)}</span></span></Link>)}
          {tasks.items.length === 0 ? <p className="px-4 py-8 text-center text-xs text-vega-text-muted">No tasks assigned to this user.</p> : null}
        </section>

        <section className={cn(panelClass, "overflow-hidden")}>
          <div className="flex items-center gap-3 border-b border-vega-border px-4 py-3"><Target className="h-5 w-5 text-vega-text-muted" /><div><h2 className="text-sm font-semibold">Monthly targets</h2><p className="text-[10px] text-vega-text-muted">Individual target breakdown for {monthLabel(profile.monthKey)}</p></div></div>
          <div className="space-y-4 p-4">{targets.items.map((target) => <div key={target.id} className="flex items-center gap-3 text-xs"><span className="min-w-0 flex-1 truncate">{target.title}</span><div className="h-2 w-[110px] shrink-0 overflow-hidden rounded-full bg-[#1a3044]"><div className="h-full rounded-full bg-vega-accent" style={{ width: `${target.progressPercent}%` }} /></div><span className="w-12 shrink-0 text-right text-vega-text-secondary">{target.completed} / {target.target}</span><span className="w-10 shrink-0 text-right">{target.progressPercent}%</span></div>)}{targets.items.length === 0 ? <p className="py-5 text-center text-xs text-vega-text-muted">No targets for this month.</p> : null}</div>
        </section>
      </div>

      <section id="profile-activity" className={cn(panelClass, "mt-3 scroll-mt-20 overflow-hidden")}>
        <div className="flex items-center justify-between gap-3 border-b border-vega-border px-4 py-3"><div className="flex items-center gap-3"><span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#142537]"><FileText className="h-4 w-4 text-[#b1c7dd]" /></span><div><h2 className="text-sm font-semibold">Recent activity</h2><p className="text-[10px] text-vega-text-muted">Latest activity from {monthLabel(profile.monthKey)}</p></div></div><Link href="/tasks" className="hidden items-center gap-1.5 text-[11px] font-medium text-vega-accent lg:inline-flex">View activity <ArrowRight className="h-3.5 w-3.5" /></Link></div>
        <div className="divide-y divide-vega-border-soft px-4">
          {activity.map((item, index) => <div key={item.id} className="flex items-center gap-3 py-2.5 text-xs"><span className={cn("hidden h-2.5 w-2.5 shrink-0 rounded-full lg:block", index % 2 === 0 ? "bg-vega-accent" : "bg-vega-green")} /><span className={cn("inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md lg:hidden", index % 2 === 0 ? "bg-vega-green-soft text-[#62df90]" : "bg-vega-accent-soft text-[#60a5fa]")}>{index % 2 === 0 ? <FileText className="h-4 w-4" /> : <BarChart3 className="h-4 w-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate">{activityLabel(item.action)}</span><span className="block truncate text-[10px] text-vega-text-muted">{activityDetail(item.entityType, item.action)}</span></span><span className="shrink-0 text-vega-text-muted">{dateLabel(item.createdAt)}</span></div>)}
          {activity.length === 0 ? <p className="py-6 text-center text-xs text-vega-text-muted">No recent activity found.</p> : null}
        </div>
        <Link href="/tasks" className="flex items-center gap-2 px-4 py-3 text-xs font-medium text-vega-accent lg:hidden">View activity <ArrowRight className="h-4 w-4" /></Link>
      </section>

      {editing ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label="Edit user profile"><form onSubmit={saveProfile} className={cn(panelClass, "max-h-[92dvh] w-full max-w-lg overflow-y-auto bg-[#0a141f]")}><div className="flex items-center justify-between border-b border-vega-border px-4 py-3"><div><h2 className="text-base font-semibold">Edit profile</h2><p className="text-[11px] text-vega-text-muted">Update account and work details.</p></div><button type="button" onClick={() => setEditing(false)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-vega-text-muted" aria-label="Close"><X className="h-4 w-4" /></button></div><div className="space-y-3 p-4"><label className="block text-[11px] text-vega-text-muted">Full name<Input className="mt-1 h-[38px]" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} required /></label><label className="block text-[11px] text-vega-text-muted">Work email<Input type="email" className="mt-1 h-[38px]" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /></label><div className="grid grid-cols-2 gap-3"><label className="text-[11px] text-vega-text-muted">Phone<Input className="mt-1 h-[38px]" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} /></label><label className="text-[11px] text-vega-text-muted">Department<Input className="mt-1 h-[38px]" value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} /></label></div><label className="block text-[11px] text-vega-text-muted">Reports to<select className={cn(selectClass, "mt-1")} value={form.managerId} onChange={(event) => setForm((current) => ({ ...current, managerId: event.target.value }))}><option value="">Not assigned</option>{profile.managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.fullName}</option>)}</select></label><div className="grid grid-cols-2 gap-3"><label className="text-[11px] text-vega-text-muted">Role<select className={cn(selectClass, "mt-1")} value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}><option value="admin">Admin</option><option value="developer">Developer</option><option value="sales">Sales</option><option value="digital_marketing">Digital marketing</option></select></label><label className="text-[11px] text-vega-text-muted">Status<select className={cn(selectClass, "mt-1")} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as typeof form.status }))}><option value="active">Active</option><option value="inactive">Inactive</option><option value="invited">Invited</option></select></label></div><div className="grid grid-cols-2 gap-2 pt-2"><Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</Button></div></div></form></div> : null}
    </section>
  );
}
