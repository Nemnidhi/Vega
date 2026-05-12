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
import { useRouter } from "next/navigation";
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
  initialSelectedUserId?: string;
  mobileMode?: "split" | "people" | "thread";
  mobileBackHref?: string;
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

function getUserInitial(value: { fullName?: string | null; email: string }) {
  const source = value.fullName?.trim() || value.email.trim();
  const parts = source
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return "?";
  }
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return `${first}${second}`.toUpperCase();
}

function SendIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 2 11 13" />
      <path d="m22 2-7 20-4-9-9-4Z" />
    </svg>
  );
}

export function UniversalChat({
  currentUserId,
  currentUserLabel,
  initialUsers,
  initialSelectedUserId,
  mobileMode = "split",
  mobileBackHref = "/chat",
}: UniversalChatProps) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [selectedUserId, setSelectedUserId] = useState(
    initialSelectedUserId ?? initialUsers[0]?._id ?? "",
  );
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
  const usersRefreshInFlightRef = useRef(false);

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

  const activateUser = useCallback(
    (nextUserId: string) => {
      const isPhoneViewport =
        typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
      if (mobileMode === "people" && isPhoneViewport) {
        router.push(`/chat/${nextUserId}`);
        return;
      }
      selectUser(nextUserId);
    },
    [mobileMode, router, selectUser],
  );

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
    async (
      showLoader = true,
      options?: { suppressErrors?: boolean; signal?: AbortSignal },
    ) => {
      if (usersRefreshInFlightRef.current) {
        return;
      }
      if (showLoader) {
        setRefreshingUsers(true);
      }
      usersRefreshInFlightRef.current = true;

      try {
        const response = await fetch("/api/chat/users", {
          method: "GET",
          cache: "no-store",
          signal: options?.signal,
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
        if (!options?.suppressErrors) {
          setErrorMessage("");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (options?.suppressErrors) {
          return;
        }
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to refresh chat users.",
        );
      } finally {
        usersRefreshInFlightRef.current = false;
        if (showLoader) {
          setRefreshingUsers(false);
        }
      }
    },
    [selectUser, selectedUserId],
  );

  const loadMessages = useCallback(
    async (
      targetUserId: string,
      showLoader = true,
      options?: { markRead?: boolean; suppressErrors?: boolean; signal?: AbortSignal },
    ) => {
      if (!targetUserId) {
        setMessages([]);
        return;
      }

      if (showLoader) {
        setLoadingMessages(true);
      }

      try {
        const markRead = options?.markRead === false ? "0" : "1";
        const response = await fetch(
          `/api/chat/messages?with=${encodeURIComponent(targetUserId)}&limit=${messageLimit}&markRead=${markRead}`,
          {
            method: "GET",
            cache: "no-store",
            signal: options?.signal,
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
        if (!options?.suppressErrors) {
          setErrorMessage("");
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        if (options?.suppressErrors) {
          return;
        }
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
      void loadMessages(selectedUserId, true, { markRead: true });
    }, 0);

    return () => clearTimeout(loadTimer);
  }, [loadMessages, selectedUserId]);

  useEffect(() => {
    const pollIntervalMs = 20000;
    let disposed = false;
    const controller = new AbortController();

    async function pollOnce() {
      if (disposed) {
        return;
      }
      if (typeof document !== "undefined" && document.visibilityState !== "visible") {
        return;
      }

      await refreshUsers(false, {
        suppressErrors: true,
        signal: controller.signal,
      });

      if (selectedUserId) {
        await loadMessages(selectedUserId, false, {
          markRead: false,
          suppressErrors: true,
          signal: controller.signal,
        });
      }
    }

    void pollOnce();
    const pollTimer = setInterval(() => {
      void pollOnce();
    }, pollIntervalMs);

    return () => {
      disposed = true;
      controller.abort();
      clearInterval(pollTimer);
    };
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
  const showPeopleOnMobile = mobileMode !== "thread";
  const showThreadOnMobile = mobileMode !== "people";
  const whatsappMobilePeople = mobileMode === "people";
  const whatsappMobileThread = mobileMode === "thread";

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
    <section
      className={cn(
        "grid gap-4 lg:h-[calc(100vh-11rem)] lg:grid-cols-[340px_minmax(0,1fr)]",
        whatsappMobilePeople || whatsappMobileThread
          ? "h-[calc(100dvh-6.5rem)] gap-0 lg:gap-4"
          : "",
      )}
    >
      <Card
        className={cn(
          "overflow-hidden lg:h-full",
          showPeopleOnMobile ? "flex flex-col" : "hidden lg:flex lg:flex-col",
          whatsappMobilePeople
            ? "h-full rounded-xl border border-border bg-surface shadow-sm lg:h-full"
            : "",
        )}
      >
        <CardHeader className={cn("pb-3", whatsappMobilePeople ? "border-b border-border bg-white" : "")}>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Chats</CardTitle>
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
            className="mt-2"
          />
          <div className={cn("grid grid-cols-2 gap-2", whatsappMobilePeople ? "hidden lg:grid" : "")}>
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
                    onClick={() => activateUser(item._id)}
                    className={cn(
                      "w-full px-3 py-2.5 text-left transition-all",
                      whatsappMobilePeople
                        ? "rounded-xl border border-border bg-white shadow-sm"
                        : "rounded-2xl border",
                      isActive
                        ? whatsappMobilePeople
                          ? "border-accent/50 bg-accent-soft/70"
                          : "border-accent/50 bg-accent-soft/70"
                        : whatsappMobilePeople
                          ? "hover:bg-white"
                          : "border-border bg-white/75 hover:border-accent/40 hover:bg-white",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          whatsappMobilePeople
                            ? "bg-accent/15 text-accent-strong"
                            : "bg-surface-soft text-foreground",
                        )}
                      >
                        {getUserInitial(item)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {getDisplayName(item)}
                          </p>
                          <span className="shrink-0 text-[11px] text-muted-foreground">
                            {formatTimestamp(item.lastMessageAt)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {item.lastMessage
                            ? `${item.lastMessageFromSelf ? "You: " : ""}${item.lastMessage}`
                            : "No messages yet"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {isPinned && !whatsappMobilePeople ? <Badge variant="accent">PIN</Badge> : null}
                        {unreadCount > 0 ? <Badge variant="danger">{unreadCount}</Badge> : null}
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Card
        className={cn(
          "overflow-hidden lg:h-full",
          showThreadOnMobile ? "flex flex-col" : "hidden lg:flex lg:flex-col",
          mobileMode === "thread"
            ? "h-full rounded-xl border border-border bg-surface-soft shadow-sm sm:h-auto lg:h-full lg:bg-surface"
            : undefined,
        )}
      >
        <CardHeader className={cn("pb-3", whatsappMobileThread ? "border-b border-border bg-white" : "")}>
          {selectedUser ? (
            whatsappMobileThread ? (
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-9 w-9 shrink-0 rounded-full p-0"
                  onClick={() => router.push(mobileBackHref)}
                >
                  <span aria-hidden="true">←</span>
                  <span className="sr-only">Back to chats</span>
                </Button>
                <div className="min-w-0">
                  <CardTitle className="truncate">{getDisplayName(selectedUser)}</CardTitle>
                  <p className="mt-0.5 truncate text-xs uppercase tracking-wide text-muted-foreground">
                    {selectedUser.role.replaceAll("_", " ")}
                  </p>
                </div>
              </div>
            ) : (
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
            )
          ) : (
            <CardTitle>Choose a user to start chat</CardTitle>
          )}
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col space-y-3 overflow-hidden pt-0">
          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}

          <div className={cn("flex flex-wrap items-center justify-between gap-2", whatsappMobileThread ? "hidden lg:flex" : "")}>
            <Input
              value={threadSearchValue}
              onChange={(event) => setThreadSearchValue(event.target.value)}
              placeholder="Search in current chat messages"
              disabled={!selectedUser}
              className="w-full flex-1 sm:min-w-[240px]"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setMessageLimit((previous) => Math.min(previous + 50, 200))}
              disabled={!selectedUser || loadingMessages || !canLoadOlderMessages}
            >
              {canLoadOlderMessages ? (
                <>
                  <span className="sm:hidden">{`Older (${messageLimit}/200)`}</span>
                  <span className="hidden sm:inline">{`Load Older (${messageLimit}/200)`}</span>
                </>
              ) : (
                "History Full"
              )}
            </Button>
          </div>

          <div
            className={cn(
              "min-h-0 flex-1 space-y-2 overflow-y-auto p-3",
              whatsappMobileThread
                ? "rounded-none border-0 bg-surface-soft pb-2"
                : "rounded-2xl border border-border bg-white/65",
            )}
          >
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
                      <p
                        className={cn(
                          "mt-1 text-[11px]",
                          mine ? "text-white/85" : "text-muted-foreground",
                        )}
                      >
                        {formatTimestamp(item.createdAt)}
                        {mine ? ` | ${item.readAt ? "✓✓" : "✓"}` : ""}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={threadEndRef} />
          </div>

          <form
            onSubmit={sendMessage}
            className={cn(
              "sticky bottom-0 z-10 mt-auto pt-2",
              whatsappMobileThread
                ? "border-0 bg-surface px-2 pb-2"
                : "border-t border-border bg-white/95",
            )}
          >
            <div className="flex items-end gap-2">
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
                className={cn(
                  "min-h-12 flex-1 resize-none",
                  whatsappMobileThread
                    ? "h-11 rounded-full bg-white px-4 py-2 shadow-sm"
                    : "h-12",
                )}
                maxLength={2000}
              />
              <Button
                type="submit"
                size="sm"
                className={cn(
                  "shrink-0 p-0",
                  whatsappMobileThread
                    ? "h-11 w-11 rounded-full border-0 bg-accent text-white hover:bg-accent-strong"
                    : "h-12 w-12 rounded-xl",
                )}
                disabled={!selectedUser || sending || draftMessage.trim().length === 0}
              >
                <SendIcon />
                <span className="sr-only">
                  {sending ? "Sending message" : "Send message"}
                </span>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
