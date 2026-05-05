"use client";

import {
  type FormEvent,
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

export function UniversalChat({ currentUserId, currentUserLabel, initialUsers }: UniversalChatProps) {
  const [users, setUsers] = useState(initialUsers);
  const [selectedUserId, setSelectedUserId] = useState(initialUsers[0]?._id ?? "");
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [draftMessage, setDraftMessage] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [refreshingUsers, setRefreshingUsers] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const threadEndRef = useRef<HTMLDivElement | null>(null);

  const selectedUser = useMemo(
    () => users.find((item) => item._id === selectedUserId) ?? null,
    [selectedUserId, users],
  );

  const visibleUsers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) {
      return users;
    }
    return users.filter((item) => {
      const roleLabel = item.role.replaceAll("_", " ");
      return (
        item.fullName.toLowerCase().includes(query) ||
        item.email.toLowerCase().includes(query) ||
        roleLabel.toLowerCase().includes(query)
      );
    });
  }, [searchValue, users]);

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
        setSelectedUserId((currentValue) => {
          if (currentValue && nextUsers.some((item) => item._id === currentValue)) {
            return currentValue;
          }
          return nextUsers[0]?._id ?? "";
        });
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
    [],
  );

  const loadMessages = useCallback(async (targetUserId: string, showLoader = true) => {
    if (!targetUserId) {
      setMessages([]);
      return;
    }

    if (showLoader) {
      setLoadingMessages(true);
    }

    try {
      const response = await fetch(`/api/chat/messages?with=${encodeURIComponent(targetUserId)}`, {
        method: "GET",
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data?.error?.message ?? "Failed to load messages.");
      }

      setMessages((data.data ?? []) as ChatMessageRecord[]);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to load messages.");
    } finally {
      if (showLoader) {
        setLoadingMessages(false);
      }
    }
  }, []);

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

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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

  return (
    <section className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>People</CardTitle>
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
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Input
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Search by name, email, role"
          />

          <div className="max-h-[62vh] space-y-2 overflow-y-auto pr-1">
            {visibleUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users available for chat.</p>
            ) : (
              visibleUsers.map((item) => {
                const isActive = item._id === selectedUserId;
                const unreadCount = item.unreadCount ?? 0;
                return (
                  <button
                    key={item._id}
                    type="button"
                    onClick={() => setSelectedUserId(item._id)}
                    className={cn(
                      "w-full rounded-2xl border px-3 py-2.5 text-left transition-all",
                      isActive
                        ? "border-accent/50 bg-accent-soft/70"
                        : "border-border bg-white/75 hover:border-accent/40 hover:bg-white",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{item.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{item.email}</p>
                      </div>
                      {unreadCount > 0 ? <Badge variant="danger">{unreadCount}</Badge> : null}
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

      <Card>
        <CardHeader className="pb-3">
          {selectedUser ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>{selectedUser.fullName}</CardTitle>
                <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
                  {selectedUser.role.replaceAll("_", " ")} | {selectedUser.email}
                </p>
              </div>
              <Badge variant="accent">Signed in as {currentUserLabel}</Badge>
            </div>
          ) : (
            <CardTitle>Choose a user to start chat</CardTitle>
          )}
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {errorMessage ? <p className="text-sm text-danger">{errorMessage}</p> : null}

          <div className="h-[54vh] space-y-2 overflow-y-auto rounded-2xl border border-border bg-white/65 p-3">
            {!selectedUser ? (
              <p className="text-sm text-muted-foreground">Select any user from left panel.</p>
            ) : loadingMessages ? (
              <p className="text-sm text-muted-foreground">Loading messages...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No messages yet. Start the conversation.
              </p>
            ) : (
              messages.map((item) => {
                const mine = userId(item.senderId) === currentUserId;
                return (
                  <div key={item._id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[82%] rounded-2xl px-3 py-2 shadow-sm",
                        mine
                          ? "bg-[linear-gradient(125deg,#0f938a_0%,#1d4ed8_100%)] text-white"
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

          <form onSubmit={sendMessage} className="space-y-2">
            <Textarea
              value={draftMessage}
              onChange={(event) => setDraftMessage(event.target.value)}
              placeholder={selectedUser ? `Message ${selectedUser.fullName}...` : "Select a user first"}
              disabled={!selectedUser || sending}
              className="min-h-20"
              maxLength={2000}
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{draftMessage.length}/2000</p>
              <Button type="submit" disabled={!selectedUser || sending || draftMessage.trim().length === 0}>
                {sending ? "Sending..." : "Send Message"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
