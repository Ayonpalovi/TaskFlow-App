import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Bell } from "@phosphor-icons/react";

const PUSH_PREF_KEY = "motionholic_os_browser_push_enabled";

function getNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }

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
    // Some browsers or private windows can block Notification construction.
  }
}

export default function NotificationBell() {
  const { user } = useAuth();
  const knownIdsRef = useRef(new Set());
  const hasHydratedRef = useRef(false);

  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(getNotificationPermission);
  const [pushEnabled, setPushEnabled] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(PUSH_PREF_KEY) === "true";
  });

  const pushSupported = permission !== "unsupported";

  const handleIncomingNotifications = useCallback(
    (notifications) => {
      const knownIds = knownIdsRef.current;

      if (!hasHydratedRef.current) {
        notifications.forEach((notification) => {
          if (notification?.id) knownIds.add(notification.id);
        });
        hasHydratedRef.current = true;
        return;
      }

      notifications
        .filter((notification) => !notification.read)
        .forEach((notification) => {
          if (!notification?.id || knownIds.has(notification.id)) return;

          if (pushEnabled && permission === "granted") {
            showBrowserNotification(notification);
          }

          knownIds.add(notification.id);
        });

      notifications.forEach((notification) => {
        if (notification?.id) knownIds.add(notification.id);
      });
    },
    [pushEnabled, permission]
  );

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/notifications");
      const notifications = Array.isArray(data) ? data : [];
      setItems(notifications);
      handleIncomingNotifications(notifications);
    } catch {
      // Keep previous notification state if a refresh fails.
    }
  }, [handleIncomingNotifications]);

  useEffect(() => {
    if (!user) return;
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [user, load]);

  const enableBrowserPush = async () => {
    if (!pushSupported) return;

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === "granted") {
        localStorage.setItem(PUSH_PREF_KEY, "true");
        setPushEnabled(true);
        showBrowserNotification({
          id: "motionholic-os-push-enabled",
          title: "Motionholic OS alerts enabled",
          body: "You will now get desktop alerts for new updates.",
        });
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

  const disableBrowserPush = () => {
    localStorage.removeItem(PUSH_PREF_KEY);
    setPushEnabled(false);
  };

  const unread = items.filter(i => !i.read).length;

  const markRead = async (n) => {
    if (!n.read) { await api.post(`/notifications/${n.id}/read`); load(); }
    if (n.link) window.location.href = n.link;
  };

  const markAll = async () => { await api.post("/notifications/read-all"); load(); };

  if (!user) return null;

  const notificationsBlocked = permission === "denied";
  const browserPushActive = pushEnabled && permission === "granted";

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

            <div className="p-3 border-b border-white/10 bg-white/[0.02]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">Desktop alerts</div>
                  <div className="text-xs text-zinc-500 mt-1 leading-relaxed">
                    {pushSupported
                      ? "Show native browser alerts when new unread updates arrive."
                      : "This browser does not support notification alerts."}
                  </div>
                </div>

                {browserPushActive ? (
                  <button
                    type="button"
                    onClick={disableBrowserPush}
                    className="shrink-0 text-[10px] px-3 py-1.5 rounded-md border border-white/10 text-zinc-300 hover:bg-white/5"
                  >
                    Disable
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={enableBrowserPush}
                    disabled={!pushSupported || notificationsBlocked}
                    className="shrink-0 text-[10px] px-3 py-1.5 rounded-md bg-white text-black hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Enable
                  </button>
                )}
              </div>

              {browserPushActive && (
                <div className="text-[11px] text-emerald-400 mt-2">Active — alerts are enabled for this browser.</div>
              )}

              {notificationsBlocked && (
                <div className="text-[11px] text-red-400 mt-2 leading-relaxed">
                  Browser notifications are blocked. Allow them in site settings to enable alerts.
                </div>
              )}
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
