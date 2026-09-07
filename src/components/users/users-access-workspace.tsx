"use client";

import { type FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Eye,
  Layers3,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { LoginRole } from "@/lib/auth/constants";
import { LOGIN_ROLES } from "@/lib/auth/constants";
import { cn } from "@/lib/utils/cn";
import type { PasswordChangeRequestItem } from "@/components/users/password-change-requests-panel";
import type { StaffUserItem } from "@/components/users/user-management-panel";

type UserStatus = StaffUserItem["status"];
type UserForm = {
  fullName: string;
  email: string;
  password: string;
  role: LoginRole;
  status: UserStatus;
};

interface UsersAccessWorkspaceProps {
  initialUsers: StaffUserItem[];
  initialRequests: PasswordChangeRequestItem[];
  currentUserId: string;
  userLabel: string;
  userRole: string;
}

const emptyForm: UserForm = {
  fullName: "",
  email: "",
  password: "",
  role: "sales",
  status: "active",
};

const panelClass = "rounded-lg border border-vega-border bg-vega-surface-1";
const selectClass =
  "h-[38px] rounded-md border border-vega-border bg-[#0b141f] px-3 text-xs text-vega-text outline-none focus:border-vega-purple/70";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function roleLabel(role?: string) {
  return role ? role.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown";
}

function dateParts(value?: string | null) {
  if (!value) return { date: "Never", time: "" };
  const date = new Date(value);
  return {
    date: date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
    time: date.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
  };
}

function avatarColor(index: number) {
  return ["bg-[#5b3db7]", "bg-[#2f8065]", "bg-[#8b5a2f]", "bg-[#a83c4c]", "bg-[#277797]"][index % 5];
}

function roleClass(role: LoginRole | string) {
  if (role === "admin") return "border-vega-purple-border bg-vega-purple-soft text-[#c4b5fd]";
  if (role === "developer") return "border-vega-blue/30 bg-vega-blue-soft text-[#8fc3ff]";
  if (role === "sales") return "border-vega-green/30 bg-vega-green-soft text-[#6de49b]";
  return "border-vega-yellow/30 bg-vega-yellow-soft text-[#f2cf68]";
}

function statusClass(status: UserStatus) {
  if (status === "active") return "border-vega-green/25 bg-vega-green-soft text-[#61df90]";
  if (status === "invited") return "border-vega-purple-border bg-vega-purple-soft text-[#c4b5fd]";
  return "border-vega-border bg-vega-surface-2 text-vega-text-muted";
}

function requestStatusClass(status: PasswordChangeRequestItem["status"]) {
  if (status === "approved") return "bg-vega-green-soft text-[#61df90]";
  if (status === "rejected") return "bg-vega-red-soft text-[#ff727b]";
  return "bg-vega-yellow-soft text-vega-yellow";
}

function Avatar({ name, index = 0, large = false }: { name: string; index?: number; large?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        avatarColor(index),
        large ? "h-12 w-12 text-sm" : "h-9 w-9 text-xs",
      )}
    >
      {initials(name)}
    </span>
  );
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof UsersRound; label: string; value: number; tone: string }) {
  return (
    <div className={cn(panelClass, "flex min-h-[80px] items-center gap-4 px-5 py-3")}>
      <Icon className={cn("h-6 w-6 shrink-0", tone)} strokeWidth={1.8} aria-hidden="true" />
      <div>
        <p className="text-[11px] text-vega-text-muted">{label}</p>
        <p className="mt-1 text-xl font-semibold leading-none text-vega-text">{value}</p>
      </div>
    </div>
  );
}

export function UsersAccessWorkspace({ initialUsers, initialRequests, currentUserId, userLabel, userRole }: UsersAccessWorkspaceProps) {
  const [users, setUsers] = useState(initialUsers);
  const [requests, setRequests] = useState(initialRequests);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("recent_login");
  const [dialogMode, setDialogMode] = useState<"create" | "edit" | "view" | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [passwordHistoryOpen, setPasswordHistoryOpen] = useState(true);

  const activeUsers = users.filter((user) => user.status === "active").length;
  const roleCount = new Set(users.map((user) => user.role)).size;
  const pendingRequests = requests.filter((request) => request.status === "pending").length;
  const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;

  const visibleUsers = useMemo(() => {
    const search = query.trim().toLowerCase();
    const filtered = users.filter((user) => {
      const matchesSearch = !search || `${user.fullName} ${user.email}`.toLowerCase().includes(search);
      return matchesSearch && (roleFilter === "all" || user.role === roleFilter) && (statusFilter === "all" || user.status === statusFilter);
    });

    return [...filtered].sort((left, right) => {
      if (sortOrder === "name") return left.fullName.localeCompare(right.fullName);
      if (sortOrder === "oldest_login") return new Date(left.lastLoginAt ?? 0).getTime() - new Date(right.lastLoginAt ?? 0).getTime();
      return new Date(right.lastLoginAt ?? 0).getTime() - new Date(left.lastLoginAt ?? 0).getTime();
    });
  }, [users, query, roleFilter, statusFilter, sortOrder]);

  function openCreateDialog() {
    setSelectedUserId(null);
    setForm(emptyForm);
    setMessage("");
    setDialogMode("create");
  }

  function openUserDialog(user: StaffUserItem, mode: "edit" | "view") {
    setSelectedUserId(user.id);
    setForm({ fullName: user.fullName, email: user.email, password: "", role: user.role, status: user.status });
    setMessage("");
    setDialogMode(mode);
  }

  function closeDialog() {
    if (saving) return;
    setDialogMode(null);
    setSelectedUserId(null);
    setForm(emptyForm);
    setMessage("");
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    try {
      const editing = dialogMode === "edit" && selectedUserId;
      const payload: Record<string, string> = {
        fullName: form.fullName,
        email: form.email,
        role: form.role,
        status: form.status,
      };
      if (form.password.trim()) payload.password = form.password;
      const response = await fetch(editing ? `/api/users/${selectedUserId}` : "/api/users", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data?.error?.message ?? "Unable to save user.");
      const savedUser = data.data as StaffUserItem;
      setUsers((current) => editing ? current.map((user) => user.id === savedUser.id ? savedUser : user) : [savedUser, ...current]);
      setMessage(editing ? "User updated successfully." : "User created successfully.");
      window.setTimeout(closeDialog, 450);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save user.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteUser(user: StaffUserItem) {
    if (!window.confirm(`Delete ${user.fullName} (${user.email})? This action cannot be undone.`)) return;
    setDeletingUserId(user.id);
    setMessage("");
    try {
      const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data?.error?.message ?? "Unable to delete user.");
      setUsers((current) => current.filter((item) => item.id !== user.id));
      if (selectedUserId === user.id) closeDialog();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete user.");
    } finally {
      setDeletingUserId(null);
    }
  }

  async function reviewRequest(requestId: string, action: "approve" | "reject") {
    setReviewingRequestId(requestId);
    setMessage("");
    try {
      const response = await fetch(`/api/password-change-requests/${requestId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data?.error?.message ?? "Unable to review request.");
      setRequests((current) => current.map((request) => request.id === requestId ? { ...request, status: action === "approve" ? "approved" : "rejected", reviewedAt: new Date().toISOString() } : request));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to review request.");
    } finally {
      setReviewingRequestId(null);
    }
  }

  return (
    <section className="min-w-0">
      <div className="-mx-[22px] -mt-[18px] mb-5 hidden h-14 items-center justify-between border-b border-vega-border-soft bg-vega-topbar px-6 lg:flex">
        <div className="text-xs text-vega-text-muted">Team <span className="px-2 text-vega-text-dim">/</span><span className="font-medium text-vega-text">Users</span></div>
        <div className="flex h-9 w-[360px] max-w-[36vw] items-center gap-2 rounded-md border border-vega-border bg-[#0b141f] px-3 text-xs text-vega-text-muted"><Search className="h-4 w-4" aria-hidden="true" />Search across Vega...</div>
        <div className="flex items-center gap-3"><Bell className="h-4 w-4 text-vega-text-secondary" aria-hidden="true" /><Avatar name={userLabel} /><div><p className="text-xs font-medium text-vega-text">{userLabel}</p><p className="text-[10px] capitalize text-vega-text-muted">{userRole.replaceAll("_", " ")}</p></div><ChevronDown className="h-4 w-4 text-vega-text-muted" /></div>
      </div>

      <header className="mb-4 flex items-start justify-between gap-3">
        <div><h1 className="text-[26px] font-semibold leading-8 text-vega-text lg:text-[28px]">Users &amp; access</h1><p className="mt-1 text-xs text-vega-text-muted lg:text-sm">Manage staff accounts and roles.</p></div>
        <Button size="lg" onClick={openCreateDialog}><UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />Add user</Button>
      </header>

      {message && !dialogMode ? <div className="mb-3 rounded-md border border-vega-red/35 bg-vega-red-soft px-3 py-2 text-xs text-[#ff7b84]">{message}</div> : null}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric icon={UsersRound} label="Users" value={users.length} tone="text-[#83b8ef]" />
        <Metric icon={Check} label="Active" value={activeUsers} tone="text-[#5de386]" />
        <Metric icon={Layers3} label="Roles" value={roleCount} tone="text-[#9b73ff]" />
        <Metric icon={Clock3} label="Pending requests" value={pendingRequests} tone="text-[#75b9f4]" />
      </div>

      <div className={cn(panelClass, "overflow-hidden")}>
        <div className="px-4 pb-3 pt-4"><h2 className="text-base font-semibold text-vega-text">Staff directory</h2></div>
        <div className="grid gap-2 px-4 pb-4 lg:grid-cols-[minmax(260px,1fr)_175px_175px_minmax(240px,auto)]">
          <label className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vega-text-muted" aria-hidden="true" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name or email..." className="h-[38px] pl-9" /></label>
          <select className={selectClass} value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} aria-label="Filter by role"><option value="all">All roles</option>{LOGIN_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select>
          <select className={selectClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filter by status"><option value="all">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="invited">Invited</option></select>
          <div className="flex items-center gap-2 lg:justify-end"><span className="hidden text-[11px] text-vega-text-muted lg:inline">Sort by</span><select className={cn(selectClass, "min-w-0 flex-1 lg:w-[145px] lg:flex-none")} value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort users"><option value="recent_login">Recent login</option><option value="oldest_login">Oldest login</option><option value="name">Name</option></select><button type="button" onClick={() => { setQuery(""); setRoleFilter("all"); setStatusFilter("all"); }} className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-vega-border text-vega-text-muted hover:bg-vega-surface-hover" title="Reset filters" aria-label="Reset filters"><RefreshCw className="h-4 w-4" /></button></div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[850px] table-fixed text-left text-xs">
            <thead className="border-y border-vega-border bg-[#0b151f] text-[11px] text-vega-text-muted"><tr><th className="w-[32%] px-4 py-2.5 font-medium">User</th><th className="w-[18%] px-3 py-2.5 font-medium">Role</th><th className="w-[14%] px-3 py-2.5 font-medium">Status</th><th className="w-[17%] px-3 py-2.5 font-medium">Last login</th><th className="px-3 py-2.5 font-medium">Actions</th></tr></thead>
            <tbody>{visibleUsers.map((user, index) => { const lastLogin = dateParts(user.lastLoginAt); return <tr key={user.id} className="border-b border-vega-border-soft hover:bg-vega-surface-hover/45"><td className="px-4 py-2"><div className="flex items-center gap-3"><Avatar name={user.fullName} index={index} /><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-semibold text-vega-text">{user.fullName}</p>{user.id === currentUserId ? <span className="rounded-full bg-vega-purple px-1.5 py-0.5 text-[9px] font-semibold text-white">You</span> : null}</div><p className="truncate text-[10px] text-vega-text-muted">{user.email}</p></div></div></td><td className="px-3 py-2"><span className={cn("inline-flex rounded-md border px-2 py-1 text-[10px] font-medium capitalize", roleClass(user.role))}>{roleLabel(user.role)}</span></td><td className="px-3 py-2"><span className={cn("inline-flex items-center gap-2 rounded-md border px-2 py-1 text-[10px] font-medium", statusClass(user.status))}><span className={cn("h-2 w-2 rounded-full", user.status === "active" ? "bg-[#5ce386]" : user.status === "invited" ? "bg-vega-purple" : "bg-vega-text-dim")} />{roleLabel(user.status)}</span></td><td className="px-3 py-2"><p className="text-vega-text">{lastLogin.date}</p><p className="text-[10px] text-vega-text-muted">{lastLogin.time}</p></td><td className="px-3 py-2"><div className="flex items-center gap-4"><Link href={`/users/${user.id}`} className="text-[11px] font-medium text-vega-purple hover:text-[#b996ff]">View profile</Link><button type="button" onClick={() => openUserDialog(user, "edit")} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#aac2dc] hover:bg-vega-surface-hover" title="Edit user" aria-label={`Edit ${user.fullName}`}><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => void deleteUser(user)} disabled={deletingUserId !== null || user.id === currentUserId} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-vega-text-muted hover:bg-vega-red-soft hover:text-vega-red disabled:opacity-35" title={user.id === currentUserId ? "You cannot delete your own account" : "Delete user"} aria-label={`Delete ${user.fullName}`}><MoreHorizontal className="h-4 w-4" /></button></div></td></tr>; })}</tbody>
          </table>
        </div>

        <div className="space-y-2.5 px-3 pb-3 md:hidden">
          {visibleUsers.map((user, index) => { const lastLogin = dateParts(user.lastLoginAt); return <article key={user.id} className="rounded-md border border-vega-border bg-[#0b151f] p-3"><div className="flex items-center gap-3"><Avatar name={user.fullName} index={index} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="truncate text-sm font-semibold text-vega-text">{user.fullName}</p>{user.id === currentUserId ? <span className="rounded-full bg-vega-purple px-1.5 py-0.5 text-[9px] text-white">You</span> : null}</div><p className="truncate text-[11px] text-vega-text-muted">{user.email}</p></div><button type="button" onClick={() => openUserDialog(user, "view")} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-vega-text-muted" aria-label={`View ${user.fullName}`}><MoreHorizontal className="h-5 w-5" /></button></div><div className="mt-3 flex flex-wrap items-center gap-2"><span className={cn("rounded-md border px-2 py-1 text-[10px]", roleClass(user.role))}>{roleLabel(user.role)}</span><span className={cn("rounded-md border px-2 py-1 text-[10px]", statusClass(user.status))}>{roleLabel(user.status)}</span><span className="ml-auto text-[10px] text-vega-text-muted">Last login: {lastLogin.date}</span></div><div className="mt-3 grid grid-cols-2 gap-2 border-t border-vega-border-soft pt-3"><Link href={`/users/${user.id}`} className="inline-flex h-9 items-center justify-center rounded-md border border-vega-border bg-vega-surface px-3 text-xs font-medium text-vega-text hover:bg-vega-surface-hover"><Eye className="mr-2 h-4 w-4" />Profile</Link><Button variant="secondary" onClick={() => openUserDialog(user, "edit")}><Pencil className="mr-2 h-4 w-4" />Edit</Button></div></article>; })}
        </div>
        {visibleUsers.length === 0 ? <p className="px-4 py-8 text-center text-xs text-vega-text-muted">No users match these filters.</p> : null}
        <div className="border-t border-vega-border px-4 py-3 text-[11px] text-vega-text-muted">Showing {visibleUsers.length} of {users.length} users</div>
      </div>

      <div className={cn(panelClass, "mt-4 overflow-hidden")}>
        <div className="flex items-center justify-between gap-3 px-4 py-3"><div className="flex items-center gap-3"><h2 className="text-sm font-semibold text-vega-text">Password requests</h2><span className="rounded-full bg-[#1a2a3c] px-3 py-1 text-[10px] text-vega-text-secondary">{pendingRequests} pending</span></div><button type="button" onClick={() => setPasswordHistoryOpen((open) => !open)} className="inline-flex items-center gap-2 text-[11px] font-medium text-vega-purple">{passwordHistoryOpen ? "Hide history" : "View history"}<ChevronRight className={cn("h-3.5 w-3.5 transition-transform", passwordHistoryOpen && "rotate-90")} /></button></div>
        {pendingRequests === 0 ? <div className="mx-4 flex items-center gap-2 border-b border-vega-border-soft pb-3 text-[11px] text-vega-text-muted"><span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#54dc85] text-[#062414]"><Check className="h-3 w-3" /></span>No pending requests</div> : null}
        {passwordHistoryOpen ? <><div className="hidden overflow-x-auto px-4 pb-3 md:block"><table className="w-full min-w-[760px] table-fixed text-left text-[11px]"><thead className="text-vega-text-muted"><tr><th className="w-[25%] px-3 py-2 font-medium">User</th><th className="w-[17%] px-3 py-2 font-medium">Role</th><th className="w-[16%] px-3 py-2 font-medium">Requested</th><th className="w-[16%] px-3 py-2 font-medium">Reviewed</th><th className="w-[13%] px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Action</th></tr></thead><tbody>{requests.map((request, index) => { const requested = dateParts(request.createdAt); const reviewed = dateParts(request.reviewedAt); const name = request.user?.fullName ?? "Deleted user"; return <tr key={request.id} className="border-t border-vega-border-soft"><td className="px-3 py-2"><div className="flex items-center gap-2.5"><Avatar name={name} index={index + 3} /><div className="min-w-0"><p className="truncate font-semibold text-vega-text">{name}</p><p className="truncate text-[10px] text-vega-text-muted">{request.user?.email ?? "Not available"}</p></div></div></td><td className="px-3 py-2"><span className={cn("inline-flex rounded-md border px-2 py-1 capitalize", roleClass(request.user?.role ?? "unknown"))}>{roleLabel(request.user?.role)}</span></td><td className="px-3 py-2"><p>{requested.date}</p><p className="text-[10px] text-vega-text-muted">{requested.time}</p></td><td className="px-3 py-2"><p>{reviewed.date}</p><p className="text-[10px] text-vega-text-muted">{reviewed.time}</p></td><td className="px-3 py-2"><span className={cn("inline-flex rounded-md px-2 py-1 capitalize", requestStatusClass(request.status))}>{request.status}</span></td><td className="px-3 py-2">{request.status === "pending" ? <div className="flex gap-2"><Button size="sm" onClick={() => void reviewRequest(request.id, "approve")} disabled={reviewingRequestId !== null}>Approve</Button><Button size="sm" variant="danger" onClick={() => void reviewRequest(request.id, "reject")} disabled={reviewingRequestId !== null}>Reject</Button></div> : <span className="text-vega-purple">View details</span>}</td></tr>; })}</tbody></table></div><div className="space-y-2 p-3 md:hidden">{requests.map((request, index) => { const name = request.user?.fullName ?? "Deleted user"; return <div key={request.id} className="rounded-md border border-vega-border bg-[#0b151f] p-3"><div className="flex items-center gap-3"><Avatar name={name} index={index + 2} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{name}</p><p className="text-[10px] text-vega-text-muted">{dateParts(request.createdAt).date}</p></div><span className={cn("rounded-md px-2 py-1 text-[10px] capitalize", requestStatusClass(request.status))}>{request.status}</span></div>{request.status === "pending" ? <div className="mt-3 grid grid-cols-2 gap-2"><Button onClick={() => void reviewRequest(request.id, "approve")}>Approve</Button><Button variant="danger" onClick={() => void reviewRequest(request.id, "reject")}>Reject</Button></div> : null}</div>; })}</div></> : null}
      </div>

      {dialogMode ? <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={dialogMode === "create" ? "Add user" : `${dialogMode} user`}><div className={cn(panelClass, "max-h-[92dvh] w-full max-w-lg overflow-y-auto bg-[#0a141f] shadow-2xl")}><div className="flex items-center justify-between border-b border-vega-border px-4 py-3"><div><h2 className="text-base font-semibold text-vega-text">{dialogMode === "create" ? "Add user" : dialogMode === "edit" ? "Edit user" : "User profile"}</h2><p className="mt-0.5 text-[11px] text-vega-text-muted">{dialogMode === "create" ? "Create a staff account and assign access." : "Account details, role, and access status."}</p></div><button type="button" onClick={closeDialog} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-vega-text-muted hover:bg-vega-surface-hover" aria-label="Close"><X className="h-4 w-4" /></button></div>{dialogMode === "view" && selectedUser ? <div className="p-4"><div className="flex items-center gap-3"><Avatar name={selectedUser.fullName} large /><div><p className="font-semibold text-vega-text">{selectedUser.fullName}</p><p className="text-xs text-vega-text-muted">{selectedUser.email}</p></div></div><dl className="mt-5 grid grid-cols-2 gap-y-3 text-xs"><dt className="text-vega-text-muted">Role</dt><dd>{roleLabel(selectedUser.role)}</dd><dt className="text-vega-text-muted">Status</dt><dd>{roleLabel(selectedUser.status)}</dd><dt className="text-vega-text-muted">Last login</dt><dd>{dateParts(selectedUser.lastLoginAt).date} {dateParts(selectedUser.lastLoginAt).time}</dd><dt className="text-vega-text-muted">Created</dt><dd>{dateParts(selectedUser.createdAt).date}</dd></dl><div className="mt-5 grid grid-cols-2 gap-2"><Button onClick={() => openUserDialog(selectedUser, "edit")}><Pencil className="mr-2 h-4 w-4" />Edit user</Button><Button variant="danger" onClick={() => void deleteUser(selectedUser)} disabled={selectedUser.id === currentUserId || deletingUserId !== null}><Trash2 className="mr-2 h-4 w-4" />Delete</Button></div></div> : <form className="space-y-3 p-4" onSubmit={submitUser}><label className="block text-[11px] text-vega-text-muted">Full name<Input className="mt-1 h-[38px]" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} required /></label><label className="block text-[11px] text-vega-text-muted">Work email<Input type="email" className="mt-1 h-[38px]" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} required /></label><label className="block text-[11px] text-vega-text-muted">{dialogMode === "create" ? "Temporary password" : "New password (optional)"}<Input type="password" className="mt-1 h-[38px]" value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} required={dialogMode === "create"} minLength={8} /></label><div className="grid grid-cols-2 gap-3"><label className="text-[11px] text-vega-text-muted">Role<select className={cn(selectClass, "mt-1 w-full")} value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as LoginRole }))}>{LOGIN_ROLES.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}</select></label><label className="text-[11px] text-vega-text-muted">Status<select className={cn(selectClass, "mt-1 w-full")} value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as UserStatus }))}><option value="active">Active</option><option value="inactive">Inactive</option><option value="invited">Invited</option></select></label></div>{message ? <p className={cn("text-xs", message.includes("successfully") ? "text-vega-green" : "text-vega-red")}>{message}</p> : null}<div className="grid grid-cols-2 gap-2 pt-2"><Button type="button" variant="secondary" onClick={closeDialog}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? "Saving..." : dialogMode === "create" ? "Create user" : "Save changes"}</Button></div></form>}</div></div> : null}
    </section>
  );
}
