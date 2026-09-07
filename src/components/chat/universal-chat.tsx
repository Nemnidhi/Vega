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
import {
  ArrowLeft,
  CheckCheck,
  ChevronDown,
  EllipsisVertical,
  Laugh,
  MessageSquareMore,
  Paperclip,
  Pin,
  RefreshCw,
  Search,
  Send,
  SquarePen,
} from "lucide-react";
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

function formatTime(value?: string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDisplayName(user: { fullName?: string | null; email: string }) {
  return user.fullName?.trim() || user.email;
}

function getUserInitial(value: { fullName?: string | null; email: string }) {
  const parts = (value.fullName?.trim() || value.email.trim()).split(" ").filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase() || "?";
}

function formatRole(role: string) {
  return role.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase());
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
  const [threadSearchOpen, setThreadSearchOpen] = useState(false);
  const [roleFilter, setRoleFilter] = useState<
    "all" | "admin" | "developer" | "sales" | "digital_marketing"
  >("all");
  const [listMode, setListMode] = useState<"all" | "unread" | "pinned">("all");
  const [messageLimit, setMessageLimit] = useState(100);
  const [pinnedUserIds, setPinnedUserIds] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const stored = window.localStorage.getItem(`hrms-chat-pins-${currentUserId}`);
      const parsed = stored ? (JSON.parse(stored) as unknown) : [];
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === "string")
        : [];
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
  const messagesRefreshTargetRef = useRef<string | null>(null);
  const messagesRequestSeqRef = useRef(0);

  const selectedUser = useMemo(
    () => users.find((item) => item._id === selectedUserId) ?? null,
    [selectedUserId, users],
  );
  const pinnedUserSet = useMemo(() => new Set(pinnedUserIds), [pinnedUserIds]);
  const totalUnreadCount = useMemo(
    () => users.reduce((sum, item) => sum + (item.unreadCount ?? 0), 0),
    [users],
  );
  const unreadConversationCount = useMemo(
    () => users.filter((item) => (item.unreadCount ?? 0) > 0).length,
    [users],
  );

  const visibleUsers = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    return users
      .filter((item) => {
        if (roleFilter !== "all" && item.role !== roleFilter) return false;
        if (listMode === "unread" && (item.unreadCount ?? 0) === 0) return false;
        if (listMode === "pinned" && !pinnedUserSet.has(item._id)) return false;
        if (!query) return true;
        return (
          getDisplayName(item).toLowerCase().includes(query) ||
          item.email.toLowerCase().includes(query) ||
          item.role.replaceAll("_", " ").toLowerCase().includes(query)
        );
      })
      .sort((a, b) => {
        const pinDifference = Number(pinnedUserSet.has(b._id)) - Number(pinnedUserSet.has(a._id));
        if (pinDifference !== 0) return pinDifference;
        return new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime();
      });
  }, [listMode, pinnedUserSet, roleFilter, searchValue, users]);

  const pinnedUsers = visibleUsers.filter((item) => pinnedUserSet.has(item._id));
  const recentUsers = visibleUsers.filter((item) => !pinnedUserSet.has(item._id));
  const selectedUserPinned = selectedUser ? pinnedUserSet.has(selectedUser._id) : false;
  const canLoadOlderMessages = messageLimit < 200;
  const showPeopleOnMobile = mobileMode !== "thread";
  const showThreadOnMobile = mobileMode !== "people";
  const mobileThread = mobileMode === "thread";

  useEffect(() => {
    try {
      window.localStorage.setItem(
        `hrms-chat-pins-${currentUserId}`,
        JSON.stringify(pinnedUserIds),
      );
    } catch {
      // Local pin persistence is optional.
    }
  }, [currentUserId, pinnedUserIds]);

  const selectUser = useCallback((nextUserId: string) => {
    setSelectedUserId(nextUserId);
    setMessageLimit(100);
    setThreadSearchValue("");
  }, []);

  const activateUser = useCallback(
    (nextUserId: string) => {
      const isMobile =
        typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches;
      if (mobileMode === "people" && isMobile) {
        router.push(`/chat/${nextUserId}`);
        return;
      }
      selectUser(nextUserId);
    },
    [mobileMode, router, selectUser],
  );

  const refreshUsers = useCallback(
    async (
      showLoader = true,
      options?: { suppressErrors?: boolean; signal?: AbortSignal },
    ) => {
      if (usersRefreshInFlightRef.current) return;
      if (showLoader) setRefreshingUsers(true);
      usersRefreshInFlightRef.current = true;
      try {
        const response = await fetch("/api/chat/users", {
          cache: "no-store",
          signal: options?.signal,
        });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload?.error?.message ?? "Failed to refresh chat users.");
        }
        const nextUsers = (payload.data ?? []) as ChatUser[];
        setUsers(nextUsers);
        if (selectedUserId && !nextUsers.some((item) => item._id === selectedUserId)) {
          selectUser(nextUsers[0]?._id ?? "");
        }
        if (!options?.suppressErrors) setErrorMessage("");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!options?.suppressErrors) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to refresh chat users.");
        }
      } finally {
        usersRefreshInFlightRef.current = false;
        if (showLoader) setRefreshingUsers(false);
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
        messagesRequestSeqRef.current += 1;
        setMessages([]);
        return;
      }
      if (messagesRefreshTargetRef.current === targetUserId) return;
      if (showLoader) setLoadingMessages(true);
      messagesRefreshTargetRef.current = targetUserId;
      const requestSequence = messagesRequestSeqRef.current + 1;
      messagesRequestSeqRef.current = requestSequence;
      try {
        const markRead = options?.markRead === false ? "0" : "1";
        const response = await fetch(
          `/api/chat/messages?with=${encodeURIComponent(targetUserId)}&limit=${messageLimit}&markRead=${markRead}`,
          { cache: "no-store", signal: options?.signal },
        );
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload?.error?.message ?? "Failed to load messages.");
        }
        if (requestSequence !== messagesRequestSeqRef.current) return;
        setMessages((payload.data ?? []) as ChatMessageRecord[]);
        setUsers((previous) =>
          previous.map((item) =>
            item._id === targetUserId ? { ...item, unreadCount: 0 } : item,
          ),
        );
        if (!options?.suppressErrors) setErrorMessage("");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (!options?.suppressErrors) {
          setErrorMessage(error instanceof Error ? error.message : "Failed to load messages.");
        }
      } finally {
        if (messagesRefreshTargetRef.current === targetUserId) {
          messagesRefreshTargetRef.current = null;
        }
        if (showLoader) setLoadingMessages(false);
      }
    },
    [messageLimit],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadMessages(selectedUserId, true, { markRead: true });
    }, 0);
    return () => clearTimeout(timer);
  }, [loadMessages, selectedUserId]);

  useEffect(() => {
    const controller = new AbortController();
    async function poll() {
      if (document.visibilityState !== "visible") return;
      await refreshUsers(false, { suppressErrors: true, signal: controller.signal });
      if (selectedUserId) {
        await loadMessages(selectedUserId, false, {
          markRead: false,
          suppressErrors: true,
          signal: controller.signal,
        });
      }
    }
    void poll();
    const timer = setInterval(() => void poll(), 35000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [loadMessages, refreshUsers, selectedUserId]);

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const filteredMessages = useMemo(() => {
    const query = threadSearchValue.trim().toLowerCase();
    return query
      ? messages.filter((item) => item.message.toLowerCase().includes(query))
      : messages;
  }, [messages, threadSearchValue]);

  function togglePinned(targetUserId: string) {
    setPinnedUserIds((previous) =>
      previous.includes(targetUserId)
        ? previous.filter((item) => item !== targetUserId)
        : [...previous, targetUserId],
    );
  }

  async function submitMessage() {
    const message = draftMessage.trim();
    if (!selectedUserId || !message) return;
    setSending(true);
    setErrorMessage("");
    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipientId: selectedUserId, message }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload?.error?.message ?? "Failed to send message.");
      }
      setMessages((previous) => [...previous, payload.data as ChatMessageRecord]);
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
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (!sending && selectedUser && draftMessage.trim()) await submitMessage();
  }

  function renderUserRow(item: ChatUser) {
    const active = item._id === selectedUserId;
    const unread = item.unreadCount ?? 0;
    const pinned = pinnedUserSet.has(item._id);
    return (
      <button
        key={item._id}
        type="button"
        onClick={() => activateUser(item._id)}
        className={cn(
          "relative w-full border-b border-vega-border-soft px-1 py-3 text-left transition-colors lg:px-4",
          active ? "bg-vega-accent-soft lg:border-l-2 lg:border-l-vega-accent" : "hover:bg-vega-surface-hover",
        )}
      >
        <span className="flex items-center gap-3">
          <span className="relative inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#29225f] text-sm font-semibold text-[#eee9ff] lg:h-10 lg:w-10 lg:text-xs">
            {getUserInitial(item)}
            <span className={cn("absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-vega-bg", item.status === "active" ? "bg-[#2bd982]" : "bg-[#91a5c6]")} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-start justify-between gap-3">
              <span className="truncate text-sm font-semibold text-vega-text">{getDisplayName(item)}</span>
              <span className="shrink-0 text-xs text-vega-text-muted lg:text-[10px]" title={formatTimestamp(item.lastMessageAt)}>{formatTime(item.lastMessageAt)}</span>
            </span>
            <span className="mt-0.5 block truncate text-xs text-vega-text-muted lg:hidden">{formatRole(item.role)}</span>
            <span className="mt-1 block truncate text-sm text-vega-text-muted lg:text-xs">
              {item.lastMessage ? `${item.lastMessageFromSelf ? "You: " : ""}${item.lastMessage}` : "No messages yet"}
            </span>
          </span>
          <span className="flex shrink-0 flex-col items-center gap-2">
            {pinned ? <Pin className="h-4 w-4 fill-vega-accent text-vega-accent" aria-hidden="true" /> : null}
            {unread > 0 ? <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-vega-accent px-1.5 text-[11px] font-semibold text-white">{unread}</span> : null}
          </span>
        </span>
      </button>
    );
  }

  return (
    <section className={cn("grid min-h-0 lg:h-[calc(100vh-11rem)] lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-3", mobileThread && "-mx-3 -mb-7 -mt-4 h-[calc(100dvh-56px)] sm:-mx-5")}>
      <section className={cn("min-h-0 overflow-hidden lg:flex lg:h-full lg:flex-col lg:rounded-lg lg:border lg:border-vega-border lg:bg-vega-surface-1", showPeopleOnMobile ? "flex flex-col" : "hidden")}>
        <div className="hidden items-center justify-between border-b border-vega-border-soft px-4 py-3 lg:flex">
          <div className="flex items-center gap-2"><h2 className="text-lg font-semibold text-vega-text">Messages</h2><span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-vega-accent px-1.5 text-[11px] font-semibold text-white">{unreadConversationCount}</span></div>
          <div className="flex items-center gap-2"><button type="button" onClick={() => void refreshUsers(true)} disabled={refreshingUsers} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-vega-text-secondary hover:bg-vega-surface-hover" title="Refresh conversations" aria-label="Refresh conversations"><RefreshCw className={cn("h-4 w-4", refreshingUsers && "animate-spin")} aria-hidden="true" /></button><button type="button" onClick={() => document.getElementById("chat-user-search")?.focus()} className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-vega-accent text-white hover:bg-vega-accent-strong" title="Find a teammate" aria-label="Find a teammate"><SquarePen className="h-4 w-4" aria-hidden="true" /></button></div>
        </div>

        <div className="space-y-3 border-b border-vega-border-soft pb-3 lg:px-4 lg:pt-3">
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vega-text-muted" aria-hidden="true" /><Input id="chat-user-search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Search teammates..." className="h-11 pl-10 text-sm lg:h-9 lg:text-xs" /></div>
          <div className="grid grid-cols-3 gap-2">
            {([ ["all", "All", users.length], ["unread", "Unread", unreadConversationCount], ["pinned", "Pinned", pinnedUserIds.length] ] as const).map(([value, label, count]) => <button key={value} type="button" onClick={() => setListMode(value)} className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-full border text-sm font-medium lg:h-8 lg:text-xs", listMode === value ? "border-vega-accent bg-vega-accent text-white" : "border-vega-border bg-vega-surface-2 text-vega-text-secondary hover:bg-vega-surface-hover")}><span>{label}</span><span className={cn("inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs lg:h-5 lg:min-w-5 lg:text-[10px]", listMode === value ? "bg-white/15" : "bg-[#223148]")}>{count}</span></button>)}
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_48px] gap-2 lg:grid-cols-1"><div className="relative"><select className="h-11 w-full appearance-none rounded-md border border-vega-border bg-[#0b141f] px-3 text-sm text-vega-text lg:h-9 lg:text-xs" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)}><option value="all">All roles</option><option value="admin">Admin</option><option value="developer">Developer</option><option value="sales">Sales</option><option value="digital_marketing">Digital Marketing</option></select><ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vega-text-muted" aria-hidden="true" /></div><button type="button" onClick={() => void refreshUsers(true)} disabled={refreshingUsers} className="inline-flex h-11 items-center justify-center rounded-md border border-vega-border text-vega-text-secondary hover:bg-vega-surface-hover lg:hidden" title="Refresh conversations" aria-label="Refresh conversations"><RefreshCw className={cn("h-5 w-5", refreshingUsers && "animate-spin")} aria-hidden="true" /></button></div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{visibleUsers.length === 0 ? <p className="px-3 py-8 text-center text-sm text-vega-text-muted">No teammates match these filters.</p> : <>{pinnedUsers.length > 0 ? <div><p className="border-b border-vega-border-soft px-1 py-3 text-xs font-semibold uppercase text-vega-text-muted lg:px-4 lg:py-2 lg:text-[10px]">Pinned</p>{pinnedUsers.map(renderUserRow)}</div> : null}{recentUsers.length > 0 ? <div><p className="border-b border-vega-border-soft px-1 py-3 text-xs font-semibold uppercase text-vega-text-muted lg:px-4 lg:py-2 lg:text-[10px]">Recent</p>{recentUsers.map(renderUserRow)}</div> : null}</>}</div>
        <div className="flex items-center justify-between border-t border-vega-border-soft px-1 py-4 text-xs text-vega-text-muted lg:px-4 lg:py-3 lg:text-[10px]"><span>{users.length} teammates<span className="lg:hidden"> / {totalUnreadCount} unread messages</span></span><button type="button" onClick={() => document.getElementById("chat-user-search")?.focus()} className="font-medium text-vega-accent lg:hidden">Find a teammate</button></div>
      </section>

      <section className={cn("min-h-0 overflow-hidden lg:flex lg:h-full lg:flex-col lg:rounded-lg lg:border lg:border-vega-border lg:bg-vega-surface-1", showThreadOnMobile ? "flex flex-col" : "hidden")}>
        <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-vega-border-soft px-4 lg:h-[68px]">
          {selectedUser ? <div className="flex min-w-0 items-center gap-3">{mobileThread ? <button type="button" onClick={() => router.push(mobileBackHref)} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-vega-text-secondary hover:bg-vega-surface-hover" aria-label="Back to chats"><ArrowLeft className="h-5 w-5" aria-hidden="true" /></button> : null}<span className="relative inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#29225f] text-sm font-semibold text-[#eee9ff]">{getUserInitial(selectedUser)}<span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-vega-surface-1 bg-[#2bd982]" aria-hidden="true" /></span><div className="min-w-0"><h2 className="truncate text-base font-semibold text-vega-text">{getDisplayName(selectedUser)}</h2><p className="truncate text-xs text-vega-text-muted">{formatRole(selectedUser.role)} / Online</p></div></div> : <h2 className="text-sm font-semibold text-vega-text">Choose a teammate</h2>}
          <div className="flex items-center gap-1"><button type="button" onClick={() => setThreadSearchOpen((value) => !value)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-vega-text-secondary hover:bg-vega-surface-hover" title="Search messages" aria-label="Search messages"><Search className="h-5 w-5" aria-hidden="true" /></button>{selectedUser ? <button type="button" onClick={() => togglePinned(selectedUser._id)} className={cn("inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-vega-surface-hover", selectedUserPinned ? "text-vega-accent" : "text-vega-text-secondary")} title={selectedUserPinned ? "Unpin conversation" : "Pin conversation"} aria-label={selectedUserPinned ? "Unpin conversation" : "Pin conversation"}><Pin className={cn("h-4 w-4", selectedUserPinned && "fill-current")} aria-hidden="true" /></button> : null}<button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-vega-text-secondary hover:bg-vega-surface-hover" title="Conversation options" aria-label="Conversation options"><EllipsisVertical className="h-5 w-5" aria-hidden="true" /></button></div>
        </header>

        <div className={cn("items-center gap-2 border-b border-vega-border-soft px-4 py-2", threadSearchOpen ? "flex" : "hidden lg:flex")}><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-vega-text-muted" aria-hidden="true" /><Input value={threadSearchValue} onChange={(event) => setThreadSearchValue(event.target.value)} placeholder="Search messages..." disabled={!selectedUser} className="h-9 pl-9" /></div></div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 lg:px-5">
          {errorMessage ? <p className="mb-3 text-xs text-vega-red">{errorMessage}</p> : null}
          {selectedUser && canLoadOlderMessages ? <button type="button" onClick={() => setMessageLimit((previous) => Math.min(previous + 50, 200))} disabled={loadingMessages} className="mx-auto mb-4 text-xs font-medium text-vega-accent hover:underline">View older messages</button> : null}
          <div className="mb-5 flex items-center gap-4 text-xs text-vega-text-muted"><span className="h-px flex-1 bg-vega-border-soft" /><span className="rounded-full border border-vega-border-soft bg-vega-surface-2 px-4 py-1">Today</span><span className="h-px flex-1 bg-vega-border-soft" /></div>
          <div className="space-y-3 lg:space-y-2.5">
            {!selectedUser ? <div className="flex flex-col items-center justify-center py-16 text-center text-vega-text-muted"><MessageSquareMore className="mb-3 h-8 w-8" aria-hidden="true" /><p className="text-sm">Select a teammate to start chatting.</p></div> : loadingMessages ? <p className="py-12 text-center text-sm text-vega-text-muted">Loading messages...</p> : messages.length === 0 ? <p className="py-12 text-center text-sm text-vega-text-muted">No messages yet. Start the conversation.</p> : filteredMessages.length === 0 ? <p className="py-12 text-center text-sm text-vega-text-muted">No messages found.</p> : filteredMessages.map((item) => { const mine = userId(item.senderId) === currentUserId; return <div key={item._id} className={cn("flex items-start gap-3", mine ? "justify-end" : "justify-start")}>{!mine ? <span className="mt-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#29225f] text-xs font-semibold text-[#eee9ff]">{selectedUser ? getUserInitial(selectedUser) : "?"}</span> : null}<div className={cn("max-w-[78%] lg:max-w-[68%]", mine && "text-right")}><div className={cn("inline-block rounded-lg border px-3.5 py-2.5 text-left", mine ? "border-vega-accent bg-vega-accent text-white" : "border-vega-border-soft bg-[#1a283b] text-vega-text")}><p className="whitespace-pre-wrap text-sm leading-5">{item.message}</p></div><p className={cn("mt-1 flex items-center gap-1 text-[11px] text-vega-text-muted", mine ? "justify-end" : "justify-start")}>{formatTime(item.createdAt)}{mine ? <CheckCheck className={cn("h-3.5 w-3.5", item.readAt && "text-vega-accent")} aria-label={item.readAt ? "Read" : "Sent"} /> : null}</p></div></div>; })}
            <div ref={threadEndRef} />
          </div>
        </div>

        <form onSubmit={sendMessage} className="shrink-0 border-t border-vega-border-soft bg-vega-surface-1 p-3 lg:px-4">
          <span className="sr-only">Signed in as {currentUserLabel}</span>
          <div className="flex items-center gap-2"><button type="button" disabled title="File attachments are not available" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-vega-text-muted opacity-70" aria-label="Attach file"><Paperclip className="h-5 w-5" aria-hidden="true" /></button><div className="relative min-w-0 flex-1"><Textarea value={draftMessage} onChange={(event) => setDraftMessage(event.target.value)} onKeyDown={handleDraftKeyDown} placeholder={selectedUser ? `Message ${getDisplayName(selectedUser)}...` : "Select a teammate first"} disabled={!selectedUser || sending} className="h-11 min-h-11 resize-none rounded-full py-3 pl-4 pr-11 text-sm lg:rounded-md" maxLength={2000} /><button type="button" onClick={() => setDraftMessage((value) => `${value}:) `)} disabled={!selectedUser || sending} className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-vega-text-muted hover:bg-vega-surface-hover" title="Add emoji" aria-label="Add emoji"><Laugh className="h-5 w-5" aria-hidden="true" /></button></div><button type="submit" disabled={!selectedUser || sending || !draftMessage.trim()} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-vega-accent text-white transition-colors hover:bg-vega-accent-strong disabled:cursor-not-allowed disabled:opacity-50 lg:rounded-md" aria-label={sending ? "Sending message" : "Send message"}><Send className="h-5 w-5" aria-hidden="true" /></button></div>
          <p className="mt-2 hidden text-[10px] text-vega-text-muted lg:block">Enter to send / Shift + Enter for a new line</p>
        </form>
      </section>
    </section>
  );
}
