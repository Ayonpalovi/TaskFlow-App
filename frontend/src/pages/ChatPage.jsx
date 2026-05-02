import { useEffect, useState, useRef } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api, API } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const REACTIONS = ["👍", "🔥", "💀", "😂", "😭"];

function ReactionRow({ msg, onReact }) {
  const reactions = msg.reactions || {};
  const hasAny = Object.keys(reactions).length > 0;
  return (
    <div className="flex flex-wrap gap-1 mt-1.5">
      {Object.entries(reactions).map(([emoji, users]) => (
        <button
          key={emoji}
          onClick={() => onReact(msg.id, emoji)}
          data-testid={`reaction-${msg.id}-${emoji}`}
          className="text-xs px-1.5 py-0.5 bg-zinc-900/80 border border-white/10 rounded-md hover:bg-zinc-800 flex items-center gap-1"
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
    <div className={`flex ${mine ? "justify-end" : "justify-start"} group`}>
      <div className="relative max-w-[70%]">
        <div className={`rounded-md p-3 ${mine ? "bg-white text-black" : "bg-zinc-900 border border-white/10"}`}>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium">{msg.sender_name}</span>
            <Badge tone={msg.sender_role}>{msg.sender_role}</Badge>
          </div>
          {msg.type === "voice" && msg.audio_data ? (
            <audio controls src={msg.audio_data} className="max-w-full mt-1" data-testid={`voice-${msg.id}`} />
          ) : (
            <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>
          )}
          <div className="text-[10px] opacity-60 mt-1 font-mono">{new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
        </div>
        <ReactionRow msg={msg} onReact={onReact} />
        <div className={`absolute -top-3 ${mine ? "left-0" : "right-0"} opacity-0 group-hover:opacity-100 transition-all`}>
          <button onClick={() => setShowPicker(!showPicker)} data-testid={`react-btn-${msg.id}`} className="text-xs bg-zinc-900 border border-white/10 rounded-md px-2 py-0.5 hover:bg-zinc-800">+</button>
          {showPicker && (
            <div className="absolute top-7 left-0 bg-zinc-950 border border-white/10 rounded-md p-1.5 flex gap-1 shadow-xl z-10">
              {REACTIONS.map(e => (
                <button key={e} onClick={() => { onReact(msg.id, e); setShowPicker(false); }} className="text-lg hover:scale-125 transition-transform">{e}</button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ChatPage({ mode }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [channel, setChannel] = useState(mode === "client" ? null : "group");
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [wsConnected, setWsConnected] = useState(false);
  const [recording, setRecording] = useState(false);
  const wsRef = useRef(null);
  const endRef = useRef(null);
  const pollRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    if (!user) return;
    api.get("/conversations").then(r => {
      setConversations(r.data);
      if (mode === "client" && r.data[0]) setChannel(`dm:${r.data[0].id}`);
    });
  }, [mode, user]);

  useEffect(() => {
    if (!channel) return;
    let stop = false;
    const cleanup = () => {
      if (wsRef.current) { try { wsRef.current.close(); } catch {} wsRef.current = null; }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };

    const fetchMsgs = () => api.get(`/messages?channel=${encodeURIComponent(channel)}`).then(r => { if (!stop) setMessages(r.data); }).catch(() => {});
    fetchMsgs();

    const startPolling = () => { pollRef.current = setInterval(fetchMsgs, 3000); };

    try {
      const token = localStorage.getItem("taskflow_token");
      if (!token) { startPolling(); return; }
      const wsUrl = API.replace(/^http/, "ws").replace(/\/api$/, "") + `/api/ws?token=${encodeURIComponent(token)}&channel=${encodeURIComponent(channel)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      ws.onopen = () => setWsConnected(true);
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg]);
        } catch {}
      };
      ws.onclose = () => { setWsConnected(false); if (!stop && !pollRef.current) startPolling(); };
      ws.onerror = () => { setWsConnected(false); if (!pollRef.current) startPolling(); };
    } catch { startPolling(); }

    // also poll occasionally to refresh reactions even with WS
    const reactPoll = setInterval(fetchMsgs, 8000);
    return () => { stop = true; cleanup(); clearInterval(reactPoll); };
  }, [channel]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const send = async () => {
    if (!input.trim() || !channel || !user) return;
    const target = user.role !== "admin" && channel.startsWith("dm:") ? `dm:${user.id}` : channel;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ content: input }));
      setInput("");
    } else {
      await api.post("/messages", { channel: target, content: input });
      setInput("");
      const { data } = await api.get(`/messages?channel=${encodeURIComponent(channel)}`);
      setMessages(data);
    }
  };

  const onReact = async (mid, emoji) => {
    try {
      const { data } = await api.post(`/messages/${mid}/reactions`, { emoji });
      setMessages(prev => prev.map(m => m.id === mid ? { ...m, reactions: data.reactions } : m));
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
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const buf = await blob.arrayBuffer();
        // Convert to base64
        let binary = "";
        const bytes = new Uint8Array(buf);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const b64 = btoa(binary);
        const dataUrl = `data:${rec.mimeType || "audio/webm"};base64,${b64}`;
        if (b64.length > 700000) {
          alert("Voice note too long (max ~30s).");
          setRecording(false);
          return;
        }
        const target = user.role !== "admin" && channel.startsWith("dm:") ? `dm:${user.id}` : channel;
        await api.post("/messages/voice", { channel: target, audio_data: dataUrl, duration_sec: 0 });
        const { data } = await api.get(`/messages?channel=${encodeURIComponent(channel)}`);
        setMessages(data);
        setRecording(false);
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
      // auto-stop after 30s
      setTimeout(() => { if (rec.state === "recording") rec.stop(); }, 30000);
    } catch (e) {
      alert("Microphone access denied or unavailable.");
    }
  };

  const allowed = mode === "admin" ? ["admin"] : mode === "editor" ? ["editor"] : ["client"];
  if (!user) return <Layout allowed={allowed}>{null}</Layout>;

  return (
    <Layout allowed={allowed}>
      <PageHeader label="Communication" title="Messages" subtitle={mode === "client" ? "Direct line to the agency admin." : "Group chat and direct messages."}>
        <Badge tone={wsConnected ? "good" : "default"} data-testid="ws-status">{wsConnected ? "● live" : "○ polling"}</Badge>
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4 h-[70vh]">
        <aside className="border border-white/10 rounded-md bg-zinc-900/30 overflow-y-auto">
          {mode !== "client" && (
            <button onClick={() => setChannel("group")} data-testid="channel-group"
              className={`w-full text-left p-3 border-b border-white/5 flex items-center gap-3 ${channel === "group" ? "bg-white/5" : "hover:bg-white/5"}`}>
              <div className="w-9 h-9 bg-zinc-800 rounded-md grid place-items-center text-xs">#</div>
              <div><div className="text-sm font-medium">Group</div><div className="label-xs text-zinc-500">Editors + Admin</div></div>
            </button>
          )}
          {conversations.map(c => (
            <button key={c.id}
              onClick={() => setChannel(user.role === "admin" ? `dm:${c.id}` : `dm:${user.id}`)}
              data-testid={`channel-dm-${c.id}`}
              className={`w-full text-left p-3 border-b border-white/5 flex items-center gap-3 ${
                (user.role === "admin" ? channel === `dm:${c.id}` : channel === `dm:${user.id}`) ? "bg-white/5" : "hover:bg-white/5"
              }`}>
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

        <div className="border border-white/10 rounded-md bg-zinc-900/30 flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map(m => <MessageBubble key={m.id} msg={m} mine={m.sender_id === user.id} onReact={onReact} />)}
            {messages.length === 0 && <div className="text-sm text-zinc-500 text-center py-8">No messages yet.</div>}
            <div ref={endRef} />
          </div>
          <div className="border-t border-white/10 p-3 flex gap-2 items-center">
            <button
              onClick={toggleRecord}
              data-testid="voice-record-button"
              className={`px-3 py-2 rounded-md text-sm transition-all ${recording ? "bg-red-500 text-white animate-pulse" : "bg-zinc-900 border border-white/10 hover:bg-zinc-800"}`}
              title={recording ? "Stop recording" : "Record voice note"}
            >
              {recording ? "● Stop" : "🎙"}
            </button>
            <input
              data-testid="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder={channel ? "Type a message…" : "Select a conversation"}
              disabled={!channel}
              className="flex-1 bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm"
            />
            <button data-testid="chat-send-button" onClick={send} disabled={!channel || !input.trim()} className="bg-white text-black rounded-md px-4 py-2 text-sm font-medium hover:bg-zinc-200 disabled:opacity-40">Send</button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
