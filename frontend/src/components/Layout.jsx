import { useCallback, useEffect, useState } from "react";
import { Link, NavLink, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const adminNav = [
  { label: "Overview", path: "/admin", icon: "⌂" },
  { label: "Workflow Suite", path: "/admin/workflow", icon: "✦" },
  { label: "Approvals", path: "/admin/approvals", icon: "☑" },
  { label: "Tasks", path: "/admin/tasks", icon: "▦" },
  { label: "Create Task", path: "/admin/create", icon: "▣" },
  { label: "Team", path: "/admin/users", icon: "♧" },
  { label: "Payments", path: "/admin/payments", icon: "$" },
  { label: "Calendar", path: "/admin/calendar", icon: "□" },
  { label: "Leaderboard", path: "/admin/leaderboard", icon: "♕" },
  { label: "Chat", path: "/admin/chat", icon: "♧" },
];

const moderatorNav = [
  { label: "Overview", path: "/moderator/overview", icon: "⌂" },
  { label: "Workflow Suite", path: "/moderator/workflow", icon: "✦" },
  { label: "Projects", path: "/moderator/projects", icon: "▣" },
  { label: "Tasks", path: "/moderator/tasks", icon: "▦" },
  { label: "Create Task", path: "/moderator/create", icon: "▣" },
  { label: "Team Workload", path: "/moderator/team-workload", icon: "♧" },
  { label: "Client Messages", path: "/moderator/client-messages", icon: "✉" },
  { label: "Reviews", path: "/moderator/reviews", icon: "☑" },
  { label: "Escalations", path: "/moderator/escalations", icon: "⚠" },
  { label: "Calendar", path: "/moderator/calendar", icon: "□" },
  { label: "Chat", path: "/moderator/chat", icon: "♧" },
  { label: "Profile", path: "/moderator/profile", icon: "◎" },
];

const editorNav = [
  { label: "Dashboard", path: "/editor", icon: "⌂" },
  { label: "Workflow Suite", path: "/editor/workflow", icon: "✦" },
  { label: "Profile", path: "/editor/profile", icon: "◎" },
  { label: "Available", path: "/editor/available", icon: "▱" },
  { label: "My Projects", path: "/editor/projects", icon: "▣" },
  { label: "Performance", path: "/editor/performance", icon: "▥" },
  { label: "Leaderboard", path: "/editor/leaderboard", icon: "♕" },
  { label: "Chat", path: "/editor/chat", icon: "♧" },
];

const clientNav = [
  { label: "Dashboard", path: "/client", icon: "⌂" },
  { label: "Workflow Suite", path: "/client/workflow", icon: "✦" },
  { label: "Create Project", path: "/client/create", icon: "+" },
  { label: "Project Hub", path: "/client/panel", icon: "▣" },
  { label: "Projects", path: "/client/projects", icon: "▱" },
  { label: "Message Admin", path: "/client/chat", icon: "♧" },
];

const PUSH_PREF_KEY = "motionholic_os_layout_push_enabled";

function getNav(role) {
  if (role === "admin") return adminNav;
  if (role === "moderator") return moderatorNav;
  if (role === "editor") return editorNav;
  if (role === "client") return clientNav;
  return [];
}

function roleLabel(role) {
  if (role === "admin") return "Admin";
  if (role === "moderator") return "Moderator";
  if (role === "editor") return "Editor";
  if (role === "client") return "Client";
  return "User";
}

function displayName(user) {
  return user?.display_name || user?.real_name || user?.anime_name || user?.email || "User";
}

function userInitial(user) {
  return displayName(user).charAt(0).toUpperCase();
}

function formatDate(value) {
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

function getNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function showBrowserNotification(notification) {
  if (getNotificationPermission() !== "granted") return;

  try {
    const alert = new Notification(notification.title || "Motionholic OS update", {
      body: notification.body || "Open Motionholic OS to view the latest update.",
      icon: "/motionholic-logo.png",
      badge: "/motionholic-logo.png",
      tag: notification.id || notification.type || "motionholic-os-notification",
    });

    alert.onclick = () => {
      window.focus();
      if (notification.link) window.location.href = notification.link;
      alert.close();
    };
  } catch {
    // Native browser alerts are optional and may be blocked in private windows.
  }
}

function NavItems({ nav, userRole, onNavigate }) {
  return (
    <nav className="px-3 space-y-1">
      {nav.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          end={item.path === `/${userRole}`}
          onClick={onNavigate}
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
  );
}

function BrowserAlertsCard({ pushEnabled, permission, onEnable, onDisable }) {
  if (permission === "unsupported") {
    return (
      <div className="px-5 py-4 border-b border-white/10 bg-zinc-900/40">
        <div className="text-sm font-medium">Desktop alerts unavailable</div>
        <p className="text-xs text-zinc-500 mt-1">This browser does not support notification alerts.</p>
      </div>
    );
  }

  const active = pushEnabled && permission === "granted";
  const blocked = permission === "denied";

  return (
    <div className="px-5 py-4 border-b border-white/10 bg-zinc-900/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Desktop alerts</div>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
            Show browser alerts when new unread notifications arrive while Motionholic OS is open.
          </p>
          {active && <div className="text-[11px] text-emerald-400 mt-2">Active for this browser.</div>}
          {blocked && (
            <div className="text-[11px] text-red-400 mt-2">
              Notifications are blocked. Allow them in browser site settings.
            </div>
          )}
        </div>

        {active ? (
          <button onClick={onDisable} className="text-[10px] px-3 py-1.5 rounded-md border border-white/10 text-zinc-300 hover:bg-white/5">
            Disable
          </button>
        ) : (
          <button
            onClick={onEnable}
            disabled={blocked}
            className="text-[10px] px-3 py-1.5 rounded-md bg-white text-black hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Enable
          </button>
        )}
      </div>
    </div>
  );
}

function NotificationsPanel({ open, onClose, onUnreadChange, pushEnabled, permission, onEnablePush, onDisablePush }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/notifications");
      const data = Array.isArray(res.data) ? res.data : [];
      setItems(data);
      if (onUnreadChange) onUnreadChange(data.filter((n) => !n.read).length);
    } catch {
      setItems([]);
      if (onUnreadChange) onUnreadChange(0);
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    if (open) loadNotifications();
  }, [open, loadNotifications]);

  const markAllRead = async () => {
    try {
      await api.post("/notifications/read-all");
      await loadNotifications();
    } catch {
      // ignore
    }
  };

  const markRead = async (notification) => {
    if (!notification?.id || notification.read) return;
    try {
      await api.post(`/notifications/${notification.id}/read`);
      const updated = items.map((item) => item.id === notification.id ? { ...item, read: true } : item);
      setItems(updated);
      if (onUnreadChange) onUnreadChange(updated.filter((n) => !n.read).length);
    } catch {
      // ignore
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close notifications overlay" className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-[420px] bg-zinc-950 border-l border-white/10 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-white/10">
          <div>
            <div className="text-sm font-semibold">Notifications</div>
            <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.2em] mt-1">Latest updates</div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={markAllRead} className="text-[10px] text-zinc-400 hover:text-white uppercase tracking-wider">Mark all read</button>
            <button type="button" onClick={onClose} className="w-8 h-8 rounded-md border border-white/10 hover:bg-white/5 text-zinc-400 hover:text-white">×</button>
          </div>
        </div>
        <BrowserAlertsCard pushEnabled={pushEnabled} permission={permission} onEnable={onEnablePush} onDisable={onDisablePush} />
        <div className="flex-1 overflow-y-auto">
          {loading && <div className="p-6 text-sm text-zinc-500 text-center">Loading notifications...</div>}
          {!loading && items.length === 0 && <div className="p-8 text-center"><div className="text-2xl mb-2">🔕</div><div className="text-sm text-zinc-400">No notifications yet</div><div className="text-xs text-zinc-600 mt-1">You are all caught up.</div></div>}
          {!loading && items.map((notification) => {
            const content = (
              <div onClick={() => markRead(notification)} className={`px-5 py-4 border-b border-white/5 hover:bg-white/5 cursor-pointer ${notification.read ? "opacity-60" : "opacity-100"}`}>
                <div className="flex gap-3">
                  <div className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${notification.read ? "bg-zinc-700" : "bg-blue-500"}`} />
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-100 leading-snug font-medium">{notification.title || "Notification"}</div>
                    {notification.body && <div className="text-xs text-zinc-400 mt-1 leading-relaxed">{notification.body}</div>}
                    <div className="text-[11px] text-zinc-600 font-mono mt-2">{formatDate(notification.created_at)}</div>
                  </div>
                </div>
              </div>
            );
            if (notification.link) {
              return <Link key={notification.id} to={notification.link} onClick={() => { markRead(notification); onClose(); }}>{content}</Link>;
            }
            return <div key={notification.id}>{content}</div>;
          })}
        </div>
      </div>
    </div>
  );
}

function UserFooter({ user, unreadCount, onNotifications, onLogout }) {
  return (
    <div className="border-t border-white/10 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative">
            <div className="w-9 h-9 rounded-full bg-zinc-800 grid place-items-center text-sm font-medium">{userInitial(user)}</div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-zinc-950" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{displayName(user)}</div>
            <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.2em]">{user.role}</div>
          </div>
        </div>
        <button type="button" onClick={onNotifications} className="relative w-9 h-9 rounded-md border border-white/10 hover:bg-white/5 grid place-items-center text-zinc-400 hover:text-white" title="Notifications">
          🔔
          {unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] grid place-items-center font-medium">{unreadCount > 9 ? "9+" : unreadCount}</span>}
        </button>
      </div>
      <button type="button" onClick={onLogout} className="mt-4 flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-all"><span>↳</span><span>Sign out</span></button>
    </div>
  );
}

export default function Layout({ children, allowed = [] }) {
  const { user, loading, logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [permission, setPermission] = useState(getNotificationPermission);
  const [pushEnabled, setPushEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(PUSH_PREF_KEY) === "true";
  });
  const [knownNotificationIds, setKnownNotificationIds] = useState(new Set());
  const nav = getNav(user?.role);

  const loadUnreadCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await api.get("/notifications");
      const data = Array.isArray(res.data) ? res.data : [];
      setUnreadCount(data.filter((n) => !n.read).length);
      const nextKnown = new Set(knownNotificationIds);
      const hasExisting = nextKnown.size > 0;
      data.forEach((notification) => {
        if (!notification?.id) return;
        if (hasExisting && !nextKnown.has(notification.id) && !notification.read && pushEnabled && permission === "granted") showBrowserNotification(notification);
        nextKnown.add(notification.id);
      });
      setKnownNotificationIds(nextKnown);
    } catch {
      setUnreadCount(0);
    }
  }, [user, knownNotificationIds, pushEnabled, permission]);

  const enablePush = async () => {
    if (permission === "unsupported") return;
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === "granted") {
        localStorage.setItem(PUSH_PREF_KEY, "true");
        setPushEnabled(true);
        showBrowserNotification({ id: "motionholic-os-alerts-enabled", title: "Motionholic OS alerts enabled", body: "Desktop alerts are now active for this browser." });
      } else {
        localStorage.removeItem(PUSH_PREF_KEY);
        setPushEnabled(false);
      }
    } catch {
      localStorage.removeItem(PUSH_PREF_KEY);
      setPushEnabled(false);
      setPermission(getNotificationPermission());
    }
  };

  const disablePush = () => {
    localStorage.removeItem(PUSH_PREF_KEY);
    setPushEnabled(false);
  };

  useEffect(() => {
    loadUnreadCount();
    const timer = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(timer);
  }, [loadUnreadCount]);

  useEffect(() => {
    setMobileMenuOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  if (loading) return <div className="min-h-screen grid place-items-center bg-zinc-950 text-zinc-500"><div className="text-sm font-mono">loading…</div></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowed.length > 0 && !allowed.includes(user.role)) return <Navigate to={`/${user.role}`} replace />;

  const handleLogout = async () => {
    try { if (logout) await logout(); } catch { /* ignore */ }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white lg:flex">
      <aside className="hidden lg:flex w-[228px] shrink-0 h-screen border-r border-white/10 bg-zinc-950 flex-col fixed left-0 top-0">
        <div className="h-[86px] px-5 flex items-center border-b border-white/10">
          <Link to={`/${user.role}`} className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-black grid place-items-center overflow-hidden"><img src="/motionholic-logo.png" alt="Motionholic OS" className="w-8 h-8 object-contain" /></div>
            <div><div className="text-sm font-semibold leading-tight">Motionholic OS</div><div className="text-[10px] text-zinc-500 font-mono tracking-[0.25em] uppercase">Creative Agency OS</div></div>
          </Link>
        </div>
        <div className="px-5 pt-6 pb-3"><div className="text-[10px] text-zinc-600 font-mono tracking-[0.25em] uppercase">{roleLabel(user.role)}</div></div>
        <div className="flex-1 overflow-y-auto"><NavItems nav={nav} userRole={user.role} /></div>
        <UserFooter user={user} unreadCount={unreadCount} onNotifications={() => setNotificationsOpen(true)} onLogout={handleLogout} />
      </aside>

      <header className="lg:hidden sticky top-0 z-40 h-16 bg-zinc-950/95 backdrop-blur border-b border-white/10 px-4 flex items-center justify-between">
        <button type="button" onClick={() => setMobileMenuOpen(true)} className="w-10 h-10 rounded-md border border-white/10 grid place-items-center text-zinc-300">☰</button>
        <Link to={`/${user.role}`} className="flex items-center gap-2"><img src="/motionholic-logo.png" alt="Motionholic OS" className="w-8 h-8 object-contain" /><span className="text-sm font-semibold">Motionholic OS</span></Link>
        <button type="button" onClick={() => setNotificationsOpen(true)} className="relative w-10 h-10 rounded-md border border-white/10 grid place-items-center text-zinc-300">🔔{unreadCount > 0 && <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[10px] grid place-items-center font-medium">{unreadCount > 9 ? "9+" : unreadCount}</span>}</button>
      </header>

      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button type="button" aria-label="Close mobile menu" className="absolute inset-0 bg-black/60" onClick={() => setMobileMenuOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-[285px] max-w-[85vw] bg-zinc-950 border-r border-white/10 flex flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2"><img src="/motionholic-logo.png" alt="Motionholic OS" className="w-8 h-8 object-contain" /><div><div className="text-sm font-semibold">Motionholic OS</div><div className="text-[10px] text-zinc-500 uppercase tracking-[0.2em]">{roleLabel(user.role)}</div></div></div>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="w-8 h-8 rounded-md border border-white/10 text-zinc-400">×</button>
            </div>
            <div className="flex-1 overflow-y-auto py-4"><NavItems nav={nav} userRole={user.role} onNavigate={() => setMobileMenuOpen(false)} /></div>
            <UserFooter user={user} unreadCount={unreadCount} onNotifications={() => { setMobileMenuOpen(false); setNotificationsOpen(true); }} onLogout={handleLogout} />
          </div>
        </div>
      )}

      <main className="lg:ml-[228px] flex-1 min-w-0"><div className="px-4 py-5 sm:px-6 lg:px-7 lg:py-7">{children}</div></main>
      <NotificationsPanel open={notificationsOpen} onClose={() => { setNotificationsOpen(false); loadUnreadCount(); }} onUnreadChange={setUnreadCount} pushEnabled={pushEnabled} permission={permission} onEnablePush={enablePush} onDisablePush={disablePush} />
    </div>
  );
}

export function PageHeader({ label, title, subtitle, children }) {
  return (
    <div className="mb-6 lg:mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        {label && <div className="label-xs text-zinc-500 mb-2">{label}</div>}
        <h1 className="text-2xl lg:text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-400 mt-2 max-w-2xl">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}

export function Badge({ children, tone = "default" }) {
  const tones = { default: "bg-zinc-800 text-zinc-300 border-white/10", good: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20", warn: "bg-amber-500/10 text-amber-400 border-amber-500/20", bad: "bg-red-500/10 text-red-400 border-red-500/20", blue: "bg-blue-500/10 text-blue-400 border-blue-500/20" };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs ${tones[tone] || tones.default}`}>{children}</span>;
}

export function MetricCard({ label, value, tone = "default", subtitle }) {
  const valueTone = { default: "text-white", good: "text-emerald-400", warn: "text-amber-400", bad: "text-red-400", blue: "text-blue-400" };
  return <div className="border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5"><div className="label-xs text-zinc-500 mb-3 lg:mb-4">{label}</div><div className={`font-mono text-2xl lg:text-3xl font-semibold ${valueTone[tone] || valueTone.default}`}>{value}</div>{subtitle && <div className="text-xs text-zinc-500 mt-2">{subtitle}</div>}</div>;
}
