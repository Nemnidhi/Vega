"use client";

import { type FormEvent, useState } from "react";
import { LOGIN_ROLES, type LoginRole } from "@/lib/auth/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type UserStatus = "active" | "inactive" | "invited";

export interface StaffUserItem {
  id: string;
  fullName: string;
  email: string;
  role: LoginRole;
  status: UserStatus;
  lastLoginAt?: string | null;
  createdAt?: string | null;
}

interface UserManagementPanelProps {
  initialUsers: StaffUserItem[];
  currentUserId: string;
}

const initialForm = {
  fullName: "",
  email: "",
  password: "",
  role: "sales" as LoginRole,
  status: "active" as UserStatus,
};

const initialCredentialForm = {
  fullName: "",
  email: "",
  password: "",
  role: "sales" as LoginRole,
  status: "active" as UserStatus,
};

export function UserManagementPanel({ initialUsers, currentUserId }: UserManagementPanelProps) {
  const [form, setForm] = useState(initialForm);
  const [users, setUsers] = useState(initialUsers);
  const [loading, setLoading] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [credentialForm, setCredentialForm] = useState(initialCredentialForm);
  const [updatingCredentials, setUpdatingCredentials] = useState(false);
  const [message, setMessage] = useState("");

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to create user");
      }

      const createdUser = data.data as StaffUserItem;
      setUsers((prev) => [createdUser, ...prev]);
      setForm(initialForm);
      setMessage("User created successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setLoading(false);
    }
  }

  function startEditUser(user: StaffUserItem) {
    setEditingUserId(user.id);
    setCredentialForm({
      fullName: user.fullName,
      email: user.email,
      password: "",
      role: user.role,
      status: user.status,
    });
    setMessage("");
  }

  function cancelEditUser() {
    setEditingUserId(null);
    setCredentialForm(initialCredentialForm);
    setMessage("");
  }

  async function updateUserCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingUserId) {
      return;
    }

    setUpdatingCredentials(true);
    setMessage("");

    try {
      const payload: Record<string, string> = {
        fullName: credentialForm.fullName,
        email: credentialForm.email,
        role: credentialForm.role,
        status: credentialForm.status,
      };
      if (credentialForm.password.trim().length > 0) {
        payload.password = credentialForm.password;
      }

      const response = await fetch(`/api/users/${editingUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to update user credentials");
      }

      const updatedUser = data.data as StaffUserItem;
      setUsers((prev) =>
        prev.map((user) => (user.id === updatedUser.id ? updatedUser : user)),
      );
      setEditingUserId(null);
      setCredentialForm(initialCredentialForm);
      setMessage("User credentials updated successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update credentials");
    } finally {
      setUpdatingCredentials(false);
    }
  }

  async function deleteUser(user: StaffUserItem) {
    const confirmed = window.confirm(
      `Delete ${user.fullName} (${user.email})? This action cannot be undone.`,
    );
    if (!confirmed) {
      return;
    }

    setDeletingUserId(user.id);
    setMessage("");

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to delete user");
      }

      setUsers((prev) => prev.filter((item) => item.id !== user.id));
      if (editingUserId === user.id) {
        setEditingUserId(null);
        setCredentialForm(initialCredentialForm);
      }
      setMessage("User deleted successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete user");
    } finally {
      setDeletingUserId(null);
    }
  }

  function formatLastLogin(lastLoginAt?: string | null) {
    return lastLoginAt ? new Date(lastLoginAt).toLocaleString("en-IN") : "Never";
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Create Staff User</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={createUser}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                placeholder="Full name"
                value={form.fullName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, fullName: event.target.value }))
                }
                required
              />
              <Input
                type="email"
                placeholder="Work email"
                value={form.email}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, email: event.target.value }))
                }
                required
              />
            </div>

            <Input
              type="password"
              placeholder="Temporary password"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              required
              minLength={8}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <select
                className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                value={form.role}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, role: event.target.value as LoginRole }))
                }
              >
                {LOGIN_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.replaceAll("_", " ")}
                  </option>
                ))}
              </select>

              <select
                className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                value={form.status}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, status: event.target.value as UserStatus }))
                }
              >
                <option value="active">active</option>
                <option value="inactive">inactive</option>
                <option value="invited">invited</option>
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create User"}
              </Button>
              {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
            </div>
          </form>
        </CardContent>
      </Card>

      {editingUserId ? (
        <Card>
          <CardHeader>
            <CardTitle>Update User Credentials</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={updateUserCredentials}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  placeholder="Full name"
                  value={credentialForm.fullName}
                  onChange={(event) =>
                    setCredentialForm((prev) => ({ ...prev, fullName: event.target.value }))
                  }
                  required
                />
                <Input
                  type="email"
                  placeholder="Work email"
                  value={credentialForm.email}
                  onChange={(event) =>
                    setCredentialForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  required
                />
              </div>

              <Input
                type="password"
                placeholder="New password (optional)"
                value={credentialForm.password}
                onChange={(event) =>
                  setCredentialForm((prev) => ({ ...prev, password: event.target.value }))
                }
                minLength={8}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                  value={credentialForm.role}
                  onChange={(event) =>
                    setCredentialForm((prev) => ({
                      ...prev,
                      role: event.target.value as LoginRole,
                    }))
                  }
                >
                  {LOGIN_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {role.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>

                <select
                  className="h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
                  value={credentialForm.status}
                  onChange={(event) =>
                    setCredentialForm((prev) => ({
                      ...prev,
                      status: event.target.value as UserStatus,
                    }))
                  }
                >
                  <option value="active">active</option>
                  <option value="inactive">inactive</option>
                  <option value="invited">invited</option>
                </select>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={updatingCredentials}>
                  {updatingCredentials ? "Updating..." : "Update Credentials"}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={updatingCredentials}
                  onClick={cancelEditUser}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Staff Users</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3 md:hidden">
            {users.map((user) => (
              <article key={user.id} className="rounded-xl border border-border/70 p-3">
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">{user.fullName}</p>
                  <p className="break-all text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <p className="text-muted-foreground">Role</p>
                  <p className="text-right text-foreground">{user.role.replaceAll("_", " ")}</p>
                  <p className="text-muted-foreground">Status</p>
                  <p className="text-right text-foreground">{user.status}</p>
                  <p className="text-muted-foreground">Last Login</p>
                  <p className="text-right text-foreground">{formatLastLogin(user.lastLoginAt)}</p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={deletingUserId !== null}
                    onClick={() => startEditUser(user)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={deletingUserId !== null || user.id === currentUserId}
                    onClick={() => void deleteUser(user)}
                  >
                    {deletingUserId === user.id ? "Deleting..." : "Delete"}
                  </Button>
                </div>
              </article>
            ))}
            {users.length === 0 ? (
              <p className="rounded-xl border border-border/70 px-3 py-6 text-center text-sm text-muted-foreground">
                No staff users found.
              </p>
            ) : null}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-2">Name</th>
                  <th className="px-2 py-2">Email</th>
                  <th className="px-2 py-2">Role</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Last Login</th>
                  <th className="px-2 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-border/70">
                    <td className="px-2 py-3 font-semibold text-foreground">{user.fullName}</td>
                    <td className="break-all px-2 py-3">{user.email}</td>
                    <td className="px-2 py-3">{user.role.replaceAll("_", " ")}</td>
                    <td className="px-2 py-3">{user.status}</td>
                    <td className="px-2 py-3 text-xs text-muted-foreground">
                      {formatLastLogin(user.lastLoginAt)}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={deletingUserId !== null}
                          onClick={() => startEditUser(user)}
                        >
                          Edit Credentials
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={deletingUserId !== null || user.id === currentUserId}
                          onClick={() => void deleteUser(user)}
                        >
                          {deletingUserId === user.id ? "Deleting..." : "Delete"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-2 py-6 text-center text-muted-foreground">
                      No staff users found.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
