import { useEffect, useMemo, useRef, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const REACTIONS = ["👍", "🔥", "💀", "😂", "😭"];

const MODERATOR_NAV = [
  ["Overview", "/moderator/overview", "⌂"],
  ["Projects", "/moderator/projects", "▣"],
  ["Tasks", "/moderator/tasks", "▦"],
  ["Create Task", "/moderator/create", "▣"],
  ["Team Workload", "/moderator/team-workload", "♧"],
  ["Client Messages", "/moderator/client-messages", "✉"],
  ["Reviews", "/moderator/reviews", "☑"],
  ["Escalations", "/moderator/escalations", "⚠"],
  ["Calendar", "/moderator/calendar", "□"],
  ["Chat", "/moderator/chat", "♧"],
  ["Profile", "/moderator/profile", "◎"],
];

function firstLetter(value) {
  return String(value || "M").charAt(0).toUpperCase();
}

function displayName(user) {
  return user?.display_name || user?.real_name || user?.anime_name || user?.email || "User";
}

function channelFor(user, conversation) {
  if (!conversation) return null;
  if (conversation.id === "group") return "group";
  return `dm:${conversation.id}`;
}

function roleTone(role) {
  if (role === "admin") return "bad";
  if (role === "moderator") return "blue";
  if (role === "editor") return "good";
  if (role === "client") return "warn";
  return "default";
}

function conversationSubtitle(mode, role) {
  if (mode === "moderator") return "DM admins, moderators, editors, and clients";
  if (role === "admin") return "DM admins, moderators, editors, and clients";
  if (role === "editor") return "Admin/moderator DMs and editor group chat";
  if (role === "client") return "Direct messages with admin and moderator";
  return "Direct messages";
}

function ReactionRow({ msg, onReact }) {
  const reactions = msg.reactions || {};
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {Object.entries(reactions).map(([emoji, users]) => (
        <button
          key={emoji}
          onClick={() => onReact(msg.id, emoji)}
          data-testid={`reaction-${msg.id}-${emoji}`}
          className="flex items-center gap-1 rounded-md border border-white/10 bg-zinc-900/80 px-1.5 py-0.5 text-xs hover:bg-zinc-800"
        >
          <span>{emoji}</span><span className="font-mono text-zinc-400">{users.length}</span>
        </button>
      ))}
    </div>
  );
}

function MessageBubble({ msg, mine, onReact }) {
  const [showPicker, setShowPicker] = useState(false);
  return (
    <div className={`group flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className="relative max-w-[78%]">
        <div className={`rounded-2xl p-3 ${mine ? "bg-white text-black" : "border border-white/10 bg-zinc-900"}`}>
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-medium">{msg.sender_name}</span>
            <Badge tone={roleTone(msg.sender_role)}>{msg.sender_role}</Badge>
          </div>
          {msg.type === "voice" && msg.audio_data ? (
            <audio controls src={msg.audio_data} className="mt-1 max-w-full" data-testid={`voice-${msg.id}`} />
          ) : (
            <div className="whitespace-pre-wrap break-words text-sm">{msg.content}</div>
          )}
          <div className="mt-1 font-mono text-[10px] opacity-60">
            {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <ReactionRow msg={msg} onReact={onReact} />
        <div className={`absolute -top-3 ${mine ? "left-0" : "right-0"} opacity-0 transition-all group-hover:opacity-100`}>
          <button onClick={() => setShowPicker(!showPicker)} data-testid={`react-btn-${msg.id}`} className="rounded-md border border-white/10 bg-zinc-900 px-2 py-0.5 text-xs hover:bg-zinc-800">+</button>
          {showPicker && (
            <div className="absolute left-0 top-7 z-10 flex gap-1 rounded-md border border-white/10 bg-zinc-950 p-1.5 shadow-xl">
              {REACTIONS.map((emoji) => (
                <button key={emoji} onClick={() => { onReact(msg.id, emoji); setShowPicker(false); }} className="text-lg transition-transform hover:scale-125">{emoji}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationButton({ conversation, active, onClick }) {
  return (
    <button
      onClick={onClick}
      data-testid={`channel-${conversation.id}`}
      className={`flex w-full items-center gap-3 border-b border-white/5 p-3 text-left ${active ? "bg-white/5" : "hover:bg-white/5"}`}
    >
      <div className="relative">
        {conversation.avatar_url ? (
          <img src={conversation.avatar_url} className={`h-9 w-9 object-cover ${conversation.role === "editor" ? "rounded-md" : "rounded-full"}`} alt="" />
        ) : (
          <div className={`grid h-9 w-9 place-items-center bg-zinc-800 text-xs ${conversation.role === "editor" ? "rounded-md" : "rounded-full"}`}>
            {firstLetter(conversation.display_name || conversation.real_name)}
          </div>
        )}
        {conversation.online && <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-zinc-950 bg-emerald-500" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{conversation.display_name || conversation.real_name || conversation.email}</div>
        <Badge tone={roleTone(conversation.role)}>{conversation.role}</Badge>
      </div>
    </button>
  );
}

function ChatWorkspace({ mode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);
  const pollRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);

  const activeChannel = useMemo(() => channelFor(user, selected), [user, selected]);

  const fetchConversations = async () => {
    const { data } = await api.get("/workflow/chat/conversations");
    const list = Array.isArray(data) ? data : [];
    const withGroup = user?.role === "editor"
      ? [{ id: "group", role: "group", display_name: "Editors Group", subtitle: "Editor-only group chat" }, ...list]
      : list;
    setConversations(withGroup);
    setSelected((current) => {
      if (current && withGroup.some((item) => item.id === current.id)) return current;
      return withGroup[0] || null;
    });
  };

  const fetchMessages = async (channel = activeChannel) => {
    if (!channel) return;
    const { data } = await api.get(`/workflow/chat/messages?channel=${encodeURIComponent(channel)}`);
    setMessages(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    if (!user) return;
    fetchConversations().catch(() => setConversations([]));
  }, [user?.id]);

  useEffect(() => {
    if (!activeChannel) return;
    setLoading(true);
    fetchMessages(activeChannel).finally(() => setLoading(false));
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchMessages(activeChannel).catch(() => {}), 2500);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [activeChannel]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    const content = input.trim();
    if (!content || !activeChannel || sending) return;
    setSending(true);
    try {
      await api.post("/workflow/chat/messages", { channel: activeChannel, content });
      setInput("");
      await fetchMessages(activeChannel);
    } catch (error) {
      const detail = error?.response?.data?.detail;
      alert(typeof detail === "string" ? detail : "Could not send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const onReact = async (messageId, emoji) => {
    try {
      const { data } = await api.post(`/workflow/chat/messages/${messageId}/reactions`, { emoji });
      setMessages((prev) => prev.map((msg) => msg.id === messageId ? { ...msg, reactions: data.reactions } : msg));
    } catch {}
  };

  const toggleRecord = async () => {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (event) => chunksRef.current.push(event.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const buf = await blob.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        if (b64.length > 700000) {
          alert("Voice note too long (max ~30s).");
          setRecording(false);
          return;
        }
        const dataUrl = `data:${rec.mimeType || "audio/webm"};base64,${b64}`;
        await api.post("/workflow/chat/messages/voice", { channel: activeChannel, audio_data: dataUrl, duration_sec: 0 });
        await fetchMessages(activeChannel);
        setRecording(false);
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 30000);
    } catch {
      alert("Microphone access denied or unavailable.");
    }
  };

  return (
    <div className="grid h-[72vh] grid-cols-1 gap-4 lg:grid-cols-[310px_1fr]">
      <aside className="overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/30">
        <div className="border-b border-white/10 p-4">
          <div className="text-sm font-semibold">Conversations</div>
          <div className="mt-1 text-xs text-zinc-500">
            {conversationSubtitle(mode, user?.role)}
          </div>
        </div>
        <div className="max-h-full overflow-y-auto">
          {conversations.map((conversation) => (
            <ConversationButton
              key={conversation.id}
              conversation={conversation}
              active={selected?.id === conversation.id}
              onClick={() => setSelected(conversation)}
            />
          ))}
          {conversations.length === 0 && <div className="p-4 text-sm text-zinc-500">No conversations yet.</div>}
        </div>
      </aside>

      <section className="flex overflow-hidden rounded-2xl border border-white/10 bg-zinc-900/30">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-white/10 p-4">
            <div>
              <div className="text-sm font-semibold">{selected?.display_name || selected?.real_name || "Select a conversation"}</div>
              <div className="mt-1 text-xs text-zinc-500">{selected?.id === "group" ? "Editor-only group chat" : selected?.role ? `Direct message · ${selected.role}` : "Choose someone to start"}</div>
            </div>
            {selected?.role && <Badge tone={roleTone(selected.role)}>{selected.role}</Badge>}
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto p-4">
            {loading && <div className="py-8 text-center text-sm text-zinc-500">Loading messages...</div>}
            {!loading && messages.map((msg) => <MessageBubble key={msg.id} msg={msg} mine={msg.sender_id === user.id} onReact={onReact} />)}
            {!loading && messages.length === 0 && <div className="py-8 text-center text-sm text-zinc-500">No messages yet.</div>}
            <div ref={endRef} />
          </div>

          <div className="flex items-center gap-2 border-t border-white/10 p-3">
            <button
              onClick={toggleRecord}
              data-testid="voice-record-button"
              disabled={!activeChannel}
              className={`rounded-md px-3 py-2 text-sm transition-all ${recording ? "animate-pulse bg-red-500 text-white" : "border border-white/10 bg-zinc-900 hover:bg-zinc-800"}`}
              title={recording ? "Stop recording" : "Record voice note"}
            >
              {recording ? "● Stop" : "🎙"}
            </button>
            <input
              data-testid="chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && !event.shiftKey && (event.preventDefault(), send())}
              placeholder={activeChannel ? "Type a message…" : "Select a conversation"}
              disabled={!activeChannel || sending}
              className="flex-1 rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm"
            />
            <button data-testid="chat-send-button" onClick={send} disabled={!activeChannel || !input.trim() || sending} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-40">
              {sending ? "Sending…" : "Send"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ModeratorShell({ children }) {
  const { user, logout } = useAuth();
  const signOut = async () => { if (logout) await logout(); };

  return (
    <div className="min-h-screen bg-zinc-950 text-white lg:flex">
      <aside className="fixed left-0 top-0 hidden h-screen w-[228px] shrink-0 flex-col border-r border-white/10 bg-zinc-950 lg:flex">
        <div className="flex h-[86px] items-center border-b border-white/10 px-5">
          <a href="/moderator/overview" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-md bg-black"><img src="/motionholic-logo.png" alt="Motionholic OS" className="h-8 w-8 object-contain" /></div>
            <div><div className="text-sm font-semibold leading-tight">Motionholic OS</div><div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">Creative Agency OS</div></div>
          </a>
        </div>
        <div className="px-5 pb-3 pt-6"><div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">Moderator</div></div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {MODERATOR_NAV.map(([label, to, icon]) => (
            <a key={to} href={to} className={`flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm transition-all ${window.location.pathname === to ? "border-white bg-white/10 text-white" : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-white"}`}>
              <span className="w-4 text-center text-zinc-400">{icon}</span><span>{label}</span>
            </a>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <a href="/moderator/profile" className="flex w-full items-center gap-3 text-left">
            <div className="relative"><div className="grid h-9 w-9 place-items-center rounded-full bg-zinc-800 text-sm font-medium">{firstLetter(displayName(user))}</div><span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 bg-emerald-400" /></div>
            <div className="min-w-0"><div className="truncate text-sm font-medium">{displayName(user)}</div><div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Moderator</div></div>
          </a>
          <button onClick={signOut} className="mt-4 flex items-center gap-2 text-sm text-zinc-500 hover:text-white"><span>↳</span><span>Sign out</span></button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 lg:ml-[228px]">
        <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-7 lg:py-7">{children}</div>
      </main>
    </div>
  );
}

export default function ChatPage({ mode }) {
  const { user } = useAuth();
  const title = mode === "moderator" ? "Moderator Chat" : "Messages";
  const subtitle = mode === "moderator"
    ? "Direct messages with admins, moderators, editors, and clients."
    : mode === "client"
      ? "Direct line to the agency admin and moderator."
      : mode === "editor"
        ? "Direct line to admin/moderators, plus the editor-only group chat."
        : "Direct messages with admins, moderators, editors, and clients.";

  if (mode === "moderator") {
    return (
      <ModeratorShell>
        <PageHeader label="Moderator / Chat" title={title} subtitle={subtitle}>
          <Badge tone="blue">Moderator messaging</Badge>
        </PageHeader>
        {user && <ChatWorkspace mode={mode} />}
      </ModeratorShell>
    );
  }

  const allowed = mode === "admin" ? ["admin"] : mode === "editor" ? ["editor"] : ["client"];
  return (
    <Layout allowed={allowed}>
      <PageHeader label="Communication" title={title} subtitle={subtitle}>
        <Badge tone="good">live polling</Badge>
      </PageHeader>
      {user && <ChatWorkspace mode={mode} />}
    </Layout>
  );
}
