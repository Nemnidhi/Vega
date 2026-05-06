"use client";

import {
  type FormEvent,
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils/cn";

type UserRef = {
  _id: string;
  fullName: string;
  email: string;
  role: string;
};

type ChatUser = UserRef & {
  status: string;
  lastMessage?: string;
  lastMessageAt?: string | null;
  unreadCount?: number;
  lastMessageFromSelf?: boolean;
};

type ChatMessageRecord = {
  _id: string;
  senderId: UserRef | string;
  recipientId: UserRef | string;
  message: string;
  createdAt: string;
  readAt?: string | null;
};

interface UniversalChatProps {
  currentUserId: string;
  currentUserLabel: string;
  initialUsers: ChatUser[];
}

function userId(value: UserRef | string) {
  return typeof value === "string" ? value : value._id;
}

function formatTimestamp(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDisplayName(user: { fullName?: string | null; email: string }) {
  const fullName = user.fullName?.trim();
  if (fullName) {
    return fullName;
  }
  return user.email;
}

export function UniversalChat({ currentUserId, currentUserLabel, initialUsers }: UniversalChatProps) {
  const [users, setUsers] = useState(initialUsers);
  const [selectedUserId, setSelectedUserId] = useState(initialUsers[0]?._id ?? "");
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [threadSearchValue, setThreadSearchValue] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "developer" | "sales">("all");
  const [listMode, setListMode] = useState<"all" | "unread">("all");
  const [messageLimit, setMessageLimit] = useState(100);
  const [pinnedUserIds, setPinnedUserIds] = useState<string[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const storedValue = window.localStorage.getItem(`hrms-chat-pins-${currentUserId}`);
      if (!storedValue) {
        return [];
      }
      const parsed = JSON.parse(storedValue) as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      return [];
    }
  });
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshingUsers, setRefreshingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const selectedUser = useMemo(
    () => users.find((item) => item._id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const totalUnreadCount = useMemo(
    () => users.reduce((sum, item) => sum + (item.unreadCount ?? 0), 0),
    [users],
  );

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `hrms-chat-pins-${currentUserId}`,
        JSON.stringify(pinnedUserIds),
      );
    } catch {
      // ignore storage write errors
    }
  }, [currentUserId, pinnedUserIds]);

  const pinnedUserSet = useMemo(() => new Set(pinnedUserIds), [pinnedUserIds]);

  const selectUser = useCallback((nextUserId: string) => {
    setSelectedUserId(nextUserId);
    setMessageLimit(100);
    setThreadSearchValue("");
  }, []);

  const visibleUsers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return users
      .filter((item) => {
        if (roleFilter !== "all" && item.role !== roleFilter) {
          return false;
        }

        if (listMode === "unread" && (item.unreadCount ?? 0) === 0) {
          return false;
        }

        if (!query) {
          return true;
        }

        const roleLabel = item.role.replaceAll("_", " ");
        const displayName = getDisplayName(item).toLowerCase();
        return (
          displayName.includes(query) ||
          item.email.toLowerCase().includes(query) ||
          roleLabel.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const aPinned = pinnedUserSet.has(a._id) ? 1 : 0;
        const bPinned = pinnedUserSet.has(b._id) ? 1 : 0;
        if (aPinned !== bPinned) {
          return bPinned - aPinned;
        }
        return 0;
      });
  }, [listMode, pinnedUserSet, roleFilter, searchValue, users]);

  const refreshUsers = useCallback(
    async (showLoader = true) => {
      if (showLoader) {
        setRefreshingUsers(true);
      }

      try {
        const response = await fetch("/api/chat/users", {
          method: "GET",
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data?.error?.message ?? "Failed to refresh chat users.");
        }

        const nextUsers = (data.data ?? []) as ChatUser[];
        setUsers(nextUsers);
        const selectedExists =
          selectedUserId && nextUsers.some((item) => item._id === selectedUserId);
        if (!selectedExists) {
          selectUser(nextUsers[0]?._id ?? "");
        }
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to refresh chat users.",
        );
      } finally {
        if (showLoader) {
          setRefreshingUsers(false);
        }
      }
    },
    [selectUser, selectedUserId],
  );

  const loadMessages = useCallback(
    async (targetUserId: string, showLoader = true) => {
      if (!targetUserId) {
        setMessages([]);
        return;
      }

      if (showLoader) {
        setLoadingMessages(true);
      }

      try {
        const response = await fetch(
          `/api/chat/messages?with=${encodeURIComponent(targetUserId)}&limit=${messageLimit}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data?.error?.message ?? "Failed to load messages.");
        }

        setMessages((data.data ?? []) as ChatMessageRecord[]);
        setUsers((previous) =>
          previous.map((item) =>
            item._id === targetUserId ? { ...item, unreadCount: 0 } : item,
          ),
        );
        setErrorMessage("");
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Failed to load messages.");
      } finally {
        if (showLoader) {
          setLoadingMessages(false);
        }
      }
    },
    [messageLimit],
  );

  useEffect(() => {
    const loadTimer = setTimeout(() => {
      void loadMessages(selectedUserId, true);
    }, 0);

    return () => clearTimeout(loadTimer);
  }, [loadMessages, selectedUserId]);

  useEffect(() => {
    const pollTimer = setInterval(() => {
      void refreshUsers(false);
      if (selectedUserId) {
        void loadMessages(selectedUserId, false);
      }
    }, 7000);

    return () => clearInterval(pollTimer);
  }, [loadMessages, refreshUsers, selectedUserId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredMessages = useMemo(() => {
    const query = threadSearchValue.trim().toLowerCase();
    if (!query) {
      return messages;
    }
    return messages.filter((item) => item.message.toLowerCase().includes(query));
  }, [messages, threadSearchValue]);

  const selectedUserPinned = selectedUser ? pinnedUserSet.has(selectedUser._id) : false;
  const canLoadOlderMessages = messageLimit < 200;

  function togglePinned(userIdToToggle: string) {
    setPinnedUserIds((previous) => {
      if (previous.includes(userIdToToggle)) {
        return previous.filter((item) => item !== userIdToToggle);
      }
      return [...previous, userIdToToggle];
    });
  }

  async function submitMessage() {
    const preparedMessage = draftMessage.trim();
    if (!selectedUserId || !preparedMessage) {
      return;
    }

    setSending(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: selectedUserId,
          message: preparedMessage,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to send message.");
      }

      setMessages((previous) => [...previous, data.data as ChatMessageRecord]);
      setDraftMessage("");
      void refreshUsers(false);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to send message.");
    } finally {
      setSending(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitMessage();
  }

  async function handleDraftKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") {
      return;
    }
    event.preventDefault();
    if (sending || !selectedUser || draftMessage.trim().length === 0) {
      return;
    }
    await submitMessage();
  }

  return (
    <section className="grid gap-4 lg:h-[calc(100vh-11rem)] lg:grid-cols-[340px_minmax(0,1fr)]">
      <Card className="flex flex-col overflow-hidden lg:h-full">
        <CardHeader className="pb-3">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>People</CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => void refreshUsers(true)}
                  disabled={refreshingUsers}
                >
                  {refreshingUsers ? "Refreshing..." : "Refresh"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Total unread messages: <span className="font-semibold text-foreground">{totalUnreadCount}</span>
            </p>
          </div>
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col space-y-3 overflow-hidden pt-0">
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search by name or role"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
              value={roleFilter}
              onChange={(event) =>
                setRoleFilter(event.target.value as "all" | "admin" | "developer" | "sales")
              }
            >
              <option value="all">All roles</option>
              <option value="admin">Admin</option>
              <option value="developer">Developer</option>
              <option value="sales">Sales</option>
            </select>
            <select
              className="h-10 w-full rounded-xl border border-border/70 bg-background px-3 text-sm"
              value={listMode}
              onChange={(event) => setListMode(event.target.value as "all" | "unread")}
            >
              <option value="all">All chats</option>
              <option value="unread">Unread only</option>
            </select>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {visibleUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No users available for the selected filters.
              </p>
            ) : (
              visibleUsers.map((item) => {
                const isActive = item._id === selectedUserId;
                const unreadCount = item.unreadCount ?? 0;
                const isPinned = pinnedUserSet.has(item._id);
                return (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => selectUser(item._id)}
                    className={cn(
                      "w-full rounded-2xl border px-3 py-2.5 text-left transition-all",
                      isActive
                        ? "border-accent/50 bg-accent-soft/70"
                        : "border-border bg-white/75 hover:border-accent/40 hover:bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {getDisplayName(item)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isPinned ? <Badge variant="accent">PIN</Badge> : null}
                        {unreadCount > 0 ? <Badge variant="danger">{unreadCount}</Badge> : null}
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between gap-2">
                      <p className="truncate text-xs text-muted-foreground">
                        {item.lastMessage
                          ? `${item.lastMessageFromSelf ? "You: " : ""}${item.lastMessage}`
                          : "No messages yet"}
                      </p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {formatTimestamp(item.lastMessageAt)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col overflow-hidden lg:h-full">
        <CardHeader className="pb-3">
          {selectedUser ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{getDisplayName(selectedUser)}</CardTitle>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {selectedUser.role.replaceAll("_", " ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => togglePinned(selectedUser._id)}
                >
                  {selectedUserPinned ? "Unpin Chat" : "Pin Chat"}
                </Button>
                <Badge variant="accent">Signed in as {currentUserLabel}</Badge>
              </div>
            </div>
          ) : (
            <CardTitle>Choose a user to start chat</CardTitle>
          )}
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col space-y-3 overflow-hidden pt-0">
          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input
              value={threadSearchValue}
              onChange={(event) => setThreadSearchValue(event.target.value)}
              placeholder="Search in current chat messages"
              disabled={!selectedUser}
              className="min-w-[240px] flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setMessageLimit((previous) => Math.min(previous + 50, 200))}
              disabled={!selectedUser || loadingMessages || !canLoadOlderMessages}
            >
              {canLoadOlderMessages ? `Load Older (${messageLimit}/200)` : "History Full"}
            </Button>
          </div>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-2xl border border-border bg-white/65 p-3">
            {!selectedUser ? (
              <p className="text-sm text-muted-foreground">Select any user from left panel.</p>
            ) : loadingMessages ? (
              <p className="text-sm text-muted-foreground">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No messages yet. Start the conversation.
              </p>
            ) : filteredMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No messages found for current thread search.
              </p>
            ) : (
              filteredMessages.map((item) => {
                const mine = userId(item.senderId) === currentUserId;
                return (
                  <div key={item._id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[82%] rounded-2xl px-3 py-2 shadow-sm",
                        mine
                          ? "border border-accent bg-accent text-white"
                          : "border border-border bg-white text-foreground",
                      )}
                    >
                      <p className="whitespace-pre-wrap text-sm leading-6">{item.message}</p>
                      <p className={cn("mt-1 text-[11px]", mine ? "text-white/85" : "text-muted-foreground")}>
                        {formatTimestamp(item.createdAt)}
                        {mine ? ` | ${item.readAt ? "Seen" : "Sent"}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={threadEndRef} />
          </div>

          <form onSubmit={sendMessage} className="flex items-center gap-2">
            <Textarea
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              onKeyDown={handleDraftKeyDown}
              placeholder={
                selectedUser
                  ? `Message ${getDisplayName(selectedUser)}...`
                  : "Select a user first"
              }
              disabled={!selectedUser || sending}
              className="h-12 min-h-12 flex-1 resize-none"
              maxLength={2000}
            />
            <Button
              type="submit"
              className="shrink-0"
              disabled={!selectedUser || sending || draftMessage.trim().length === 0}
            >
              {sending ? "Sending..." : "Send Message"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
