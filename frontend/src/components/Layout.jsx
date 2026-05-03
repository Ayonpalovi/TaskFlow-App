import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const adminNav = [
  { label: "Overview", path: "/admin", icon: "⌂" },
  { label: "Approvals", path: "/admin/approvals", icon: "☑" },
  { label: "Tasks", path: "/admin/tasks", icon: "▦" },
  { label: "Create Task", path: "/admin/create", icon: "▣" },
  { label: "Team", path: "/admin/users", icon: "♧" },
  { label: "Payments", path: "/admin/payments", icon: "$" },
  { label: "Calendar", path: "/admin/calendar", icon: "□" },
  { label: "Leaderboard", path: "/admin/leaderboard", icon: "♕" },
  { label: "Chat", path: "/admin/chat", icon: "♧" },
];

const editorNav = [
  { label: "Dashboard", path: "/editor", icon: "⌂" },
  { label: "Profile", path: "/editor/profile", icon: "◎" },
  { label: "Available", path: "/editor/available", icon: "▱" },
  { label: "My Projects", path: "/editor/projects", icon: "▣" },
  { label: "Performance", path: "/editor/performance", icon: "▥" },
  { label: "Leaderboard", path: "/editor/leaderboard", icon: "♕" },
  { label: "Chat", path: "/editor/chat", icon: "♧" },
];

const clientNav = [
  { label: "Dashboard", path: "/client", icon: "⌂" },
  { label: "Create Project", path: "/client/create", icon: "+" },
  { label: "Project Hub", path: "/client/panel", icon: "▣" },
  { label: "Projects", path: "/client/projects", icon: "▱" },
  { label: "Message Admin", path: "/client/chat", icon: "♧" },
];

function getNavByRole(role) {
  if (role === "admin") return adminNav;
  if (role === "editor") return editorNav;
  if (role === "client") return clientNav;
  return [];
}

function getRoleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "editor") return "Editor";
  if (role === "client") return "Client";
  return "User";
}

function getDisplayName(user) {
  return (
    user?.display_name ||
    user?.real_name ||
    user?.anime_name ||
    user?.email ||
    "User"
  );
}

function getInitial(user) {
  return getDisplayName(user).charAt(0).toUpperCase();
}

function formatTime(value) {
  if (!value) return "";

  try {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function NotificationPanel({ open, onClose, onUnreadChange }) {
  const panelRef = useRef(null);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = async () => {
    try {
      setLoading(true);

      const res = await api.get("/notifications");
      const items = Array.isArray(res.data) ? res.data : [];

      setNotifications(items);

      if (typeof onUnreadChange === "function") {
        onUnreadChange(items.filter((item) => !item.read).length);
      }
    } catch {
      setNotifications([]);

      if (typeof onUnreadChange === "function") {
        onUnreadChange(0);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleClickOutside = (event) => {
      if (panelRef.current && !panelRef.current.contains(event.target)) {
        onClose();
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open, onClose]);

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      await loadNotifications();
    } catch {
      // ignore
    }
  };

  const markOneRead = async (notification) => {
    if (!notification?.id || notification.read) return;

    try {
      await api.post(`/notifications/${notification.id}/read`);

      setNotifications((prev) => {
        const updated = prev.map((item) =>
          item.id === notification.id ? { ...item, read: true } : item
        );

        if (typeof onUnreadChange === "function") {
          onUnreadChange(updated.filter((item) => !item.read).length);
        }

        return updated;
      });
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      className="fixed z-50 left-[248px] bottom-6 w-[430px] max-w-[calc(100vw-270px)] max-h-[72vh] rounded-2xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/60 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
        <div>
          <div className="text-sm font-semibold">Notifications</div>
          <div className="text-[11px] text-zinc-500 font-mono uppercase tracking-[0.2em]">
            Latest updates
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={markAllRead}
            className="text-[11px] text-zinc-400 hover:text-white uppercase tracking-[0.15em]"
          >
            Mark all read
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-md border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white"
            aria-label="Close notifications"
          >
            ×
          </button>
        </div>
      </div>

      <div className="overflow-y-auto max-h-[calc(72vh-58px)]">
        {loading && (
          <div className="p-6 text-sm text-zinc-500 text-center">
            Loading notifications...
          </div>
        )}

        {!loading && notifications.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-2xl mb-2">🔕</div>
            <div className="text-sm text-zinc-400">No notifications yet</div>
            <div className="text-xs text-zinc-600 mt-1">
              You are all caught up.
            </div>
          </div>
        )}

        {!loading &&
          notifications.map((notification) => {
            const itemContent = (
              <div
                onClick={() => markOneRead(notification)}
                className={`px-4 py-4 border-b border-white/5 hover:bg-white/5 transition-all cursor-pointer ${
                  notification.read ? "opacity-60" : "opacity-100"
                }`}
              >
                <div className="flex gap-3">
                  <div
                    className={`mt-1 w-2.5 h-2.5 rounded-full shrink-0 ${
                      notification.read ? "bg-zinc-700" : "bg-blue-500"
                    }`}
                  />

                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-zinc-100 font-medium leading-snug">
                      {notification.title || "Notification"}
                    </div>

                    {notification.body && (
                      <div className="text-xs text-zinc-400 mt-1 leading-relaxed">
                        {notification.body}
                      </div>
                    )}

                    <div className="text-[11px] text-zinc-600 font-mono mt-2">
                      {formatTime(notification.created_at)}
                    </div>
                  </div>
                </div>
              </div>
            );

            if (notification.link) {
              return (
                <Link
                  key={notification.id}
                  to={notification.link}
                  onClick={() => {
                    markOneRead(notification);
                    onClose();
                  }}
                >
                  {itemContent}
                </Link>
              );
            }

            return (
              <div key={notification.id}>
                {itemContent}
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default function Layout({ children, allowed = [] }) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const nav = getNavByRole(user?.role);

  const loadUnreadCount = async () => {
    if (!user) return;

    try {
      const res = await api.get("/notifications");
      const items = Array.isArray(res.data) ? res.data : [];
      setUnreadCount(items.filter((item) => !item.read).length);
    } catch {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    loadUnreadCount();

    const timer = setInterval(loadUnreadCount, 30000);

    return () => clearInterval(timer);
  }, [user?.id]);

  useEffect(() => {
    setNotificationsOpen(false);
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-zinc-950 text-zinc-500">
        <div className="text-sm font-mono">loading…</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowed.length > 0 && !allowed.includes(user.role)) {
    return <Navigate to={`/${user.role}`} replace />;
  }

  const handleLogout = async () => {
    try {
      if (typeof logout === "function") {
        await logout();
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex overflow-hidden">
      <aside className="w-[228px] shrink-0 h-screen border-r border-white/10 bg-zinc-950 flex flex-col">
        <div className="h-[86px] px-5 flex items-center border-b border-white/10">
          <Link to={`/${user.role}`} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-black grid place-items-center overflow-hidden">
              <img
                src="/motionholic-logo.png"
                alt="Motionholic OS"
                className="w-8 h-8 object-contain"
              />
            </div>

            <div>
              <div className="text-sm font-semibold leading-tight">
                Motionholic OS
              </div>
              <div className="text-[10px] text-zinc-500 font-mono tracking-[0.25em] uppercase">
                Creative Agency OS
              </div>
            </div>
          </Link>
        </div>

        <div className="px-5 pt-6 pb-3">
          <div className="text-[10px] text-zinc-600 font-mono tracking-[0.25em] uppercase">
            {getRoleLabel(user.role)}
          </div>
        </div>

        <nav className="px-3 space-y-1 flex-1 overflow-y-auto">
          {nav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === `/${user.role}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all border-l-2 ${
                  isActive
                    ? "bg-white/10 text-white border-white"
                    : "text-zinc-400 hover:text-white hover:bg-white/5 border-transparent"
                }`
              }
            >
              <span className="w-4 text-center text-zinc-400">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="relative">
                <div className="w-9 h-9 rounded-full bg-zinc-800 grid place-items-center text-sm font-medium">
                  {getInitial(user)}
                </div>

                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-zinc-950" />
              </div>

              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {getDisplayName(user)}
                </div>

                <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.2em]">
                  {user.role}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setNotificationsOpen((prev) => !prev)}
              className="relative w-9 h-9 rounded-md border border-white/10 hover:bg-white/5 grid place-items-center text-zinc-400 hover:text-white"
              title="Notifications"
            >
              <span>🔔</span>

              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] grid place-items-center font-medium">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-all"
          >
            <span>↳</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0 h-screen overflow-y-auto">
        <div className="px-7 py-7">{children}</div>
      </main>

      <NotificationPanel
        open={notificationsOpen}
        onClose={() => {
          setNotificationsOpen(false);
          loadUnreadCount();
        }}
        onUnreadChange={setUnreadCount}
      />
    </div>
  );
}

export function PageHeader({ label, title, subtitle, children }) {
  return (
    <div className="mb-8 flex items-start justify-between gap-4">
      <div>
        {label && (
          <div className="label-xs text-zinc-500 mb-2">{label}</div>
        )}

        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>

        {subtitle && (
          <p className="text-sm text-zinc-400 mt-2 max-w-2xl">{subtitle}</p>
        )}
      </div>

      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

export function Badge({ children, tone = "default" }) {
  const tones = {
    default: "bg-zinc-800 text-zinc-300 border-white/10",
    good: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    warn: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    bad: "bg-red-500/10 text-red-400 border-red-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs ${
        tones[tone] || tones.default
      }`}
    >
      {children}
    </span>
  );
}

export function MetricCard({ label, value, tone = "default", subtitle }) {
  const valueTone = {
    default: "text-white",
    good: "text-emerald-400",
    warn: "text-amber-400",
    bad: "text-red-400",
    blue: "text-blue-400",
  };

  return (
    <div className="border border-white/10 rounded-md bg-zinc-900/30 p-5">
      <div className="label-xs text-zinc-500 mb-4">{label}</div>

      <div
        className={`font-mono text-3xl font-semibold ${
          valueTone[tone] || valueTone.default
        }`}
      >
        {value}
      </div>

      {subtitle && (
        <div className="text-xs text-zinc-500 mt-2">{subtitle}</div>
      )}
    </div>
  );
}
