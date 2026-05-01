import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Bell } from "@phosphor-icons/react";

export default function NotificationBell() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try { const { data } = await api.get("/notifications"); setItems(data); } catch {}
  };

  useEffect(() => {
    if (!user) return;
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [user]);

  const unread = items.filter(i => !i.read).length;

  const markRead = async (n) => {
    if (!n.read) { await api.post(`/notifications/${n.id}/read`); load(); }
    if (n.link) window.location.href = n.link;
  };

  const markAll = async () => { await api.post("/notifications/read-all"); load(); };

  if (!user) return null;
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} data-testid="notification-bell" className="relative p-2 hover:bg-white/5 rounded-md transition-all">
        <Bell size={18} weight="regular" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full min-w-[16px] h-4 grid place-items-center px-1 font-mono">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-950 border border-white/10 rounded-md shadow-2xl z-40 max-h-[70vh] overflow-y-auto" data-testid="notification-dropdown">
            <div className="flex justify-between items-center p-3 border-b border-white/10">
              <span className="text-sm font-medium">Notifications</span>
              {unread > 0 && <button onClick={markAll} className="label-xs text-zinc-400 hover:text-white">Mark all read</button>}
            </div>
            {items.length === 0 && <div className="p-6 text-center text-sm text-zinc-500">No notifications yet.</div>}
            {items.map(n => (
              <button
                key={n.id}
                onClick={() => markRead(n)}
                data-testid={`notification-${n.id}`}
                className={`w-full text-left p-3 border-b border-white/5 hover:bg-white/5 transition-all ${!n.read ? "bg-white/[0.02]" : ""}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    {n.body && <div className="text-xs text-zinc-400 mt-0.5 truncate">{n.body}</div>}
                    <div className="label-xs text-zinc-600 mt-1 font-mono">{new Date(n.created_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</div>
                  </div>
                  {!n.read && <div className="w-2 h-2 bg-blue-500 rounded-full mt-1 shrink-0" />}
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
