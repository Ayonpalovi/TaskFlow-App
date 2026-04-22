import { useEffect, useState, useRef } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function ChatPage({ mode }) {
  // mode: "admin" (group + all DMs) | "editor" (group + admin DM) | "client" (admin DM only)
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [channel, setChannel] = useState(mode === "client" ? null : "group");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    api.get("/conversations").then(r => {
      setConversations(r.data);
      if (mode === "client" && r.data[0]) setChannel(`dm:${r.data[0].id}`);
    });
  }, [mode]);

  useEffect(() => {
    if (!channel) return;
    let stop = false;
    const fetchMsgs = () => api.get(`/messages?channel=${encodeURIComponent(channel)}`).then(r => { if (!stop) setMessages(r.data); });
    fetchMsgs();
    const id = setInterval(fetchMsgs, 3000);
    return () => { stop = true; clearInterval(id); };
  }, [channel]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || !channel) return;
    // Non-admin DMs: always store as dm:<own-id>
    const target = user.role !== "admin" && channel.startsWith("dm:") ? `dm:${user.id}` : channel;
    await api.post("/messages", { channel: target, content: input });
    setInput("");
    const { data } = await api.get(`/messages?channel=${encodeURIComponent(channel)}`);
    setMessages(data);
  };

  const allowed = mode === "admin" ? ["admin"] : mode === "editor" ? ["editor"] : ["client"];

  return (
    <Layout allowed={allowed}>
      <PageHeader label="Communication" title="Messages" subtitle={mode === "client" ? "Direct line to the agency admin." : "Group chat and direct messages."} />

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 h-[70vh]">
        {/* Sidebar */}
        <aside className="border border-white/10 rounded-md bg-zinc-900/30 overflow-y-auto">
          {mode !== "client" && (
            <button
              onClick={() => setChannel("group")}
              data-testid="channel-group"
              className={`w-full text-left p-3 border-b border-white/5 flex items-center gap-3 ${channel === "group" ? "bg-white/5" : "hover:bg-white/5"}`}
            >
              <div className="w-9 h-9 bg-zinc-800 rounded-md grid place-items-center text-xs">#</div>
              <div>
                <div className="text-sm font-medium">Group</div>
                <div className="label-xs text-zinc-500">Editors + Admin</div>
              </div>
            </button>
          )}
          {conversations.map(c => (
            <button
              key={c.id}
              onClick={() => setChannel(user.role === "admin" ? `dm:${c.id}` : `dm:${user.id}`)}
              data-testid={`channel-dm-${c.id}`}
              className={`w-full text-left p-3 border-b border-white/5 flex items-center gap-3 ${
                (user.role === "admin" ? channel === `dm:${c.id}` : channel === `dm:${user.id}`) ? "bg-white/5" : "hover:bg-white/5"
              }`}
            >
              <div className="relative">
                {c.avatar_url ? (
                  <img src={c.avatar_url} className={`w-9 h-9 object-cover ${c.role === "editor" ? "rounded-md" : "rounded-full"}`} alt="" />
                ) : (
                  <div className={`w-9 h-9 bg-zinc-800 grid place-items-center text-xs ${c.role === "editor" ? "rounded-md" : "rounded-full"}`}>{c.display_name?.[0]}</div>
                )}
                {c.online && <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-zinc-950 rounded-full" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{c.display_name}</div>
                <Badge tone={c.role}>{c.role}</Badge>
              </div>
            </button>
          ))}
        </aside>

        {/* Thread */}
        <div className="border border-white/10 rounded-md bg-zinc-900/30 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map(m => {
              const mine = m.sender_id === user.id;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[70%] rounded-md p-3 ${mine ? "bg-white text-black" : "bg-zinc-900 border border-white/10"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium">{m.sender_name}</span>
                      <Badge tone={m.sender_role}>{m.sender_role}</Badge>
                    </div>
                    <div className="text-sm whitespace-pre-wrap break-words">{m.content}</div>
                    <div className="text-[10px] opacity-60 mt-1 font-mono">{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && <div className="text-sm text-zinc-500 text-center py-8">No messages yet. Say hi.</div>}
            <div ref={endRef} />
          </div>
          <div className="border-t border-white/10 p-3 flex gap-2">
            <input
              data-testid="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder={channel ? "Type a message…" : "Select a conversation"}
              disabled={!channel}
              className="flex-1 bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm"
            />
            <button data-testid="chat-send-button" onClick={send} disabled={!channel || !input.trim()} className="bg-white text-black rounded-md px-4 text-sm font-medium hover:bg-zinc-200 disabled:opacity-40">Send</button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
