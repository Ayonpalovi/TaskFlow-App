import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  House, Kanban, Users, ChatsCircle, Trophy, ChartBar,
  VideoCamera, FolderOpen, ClipboardText, SignOut, CalendarBlank,
} from "@phosphor-icons/react";

const NAV = {
  admin: [
    { to: "/admin", icon: House, label: "Overview", end: true },
    { to: "/admin/tasks", icon: Kanban, label: "Tasks" },
    { to: "/admin/create", icon: ClipboardText, label: "Create Task" },
    { to: "/admin/users", icon: Users, label: "Team" },
    { to: "/admin/calendar", icon: CalendarBlank, label: "Calendar" },
    { to: "/admin/leaderboard", icon: Trophy, label: "Leaderboard" },
    { to: "/admin/chat", icon: ChatsCircle, label: "Chat" },
  ],
  editor: [
    { to: "/editor", icon: House, label: "Dashboard", end: true },
    { to: "/editor/available", icon: FolderOpen, label: "Available" },
    { to: "/editor/projects", icon: VideoCamera, label: "My Projects" },
    { to: "/editor/performance", icon: ChartBar, label: "Performance" },
    { to: "/editor/leaderboard", icon: Trophy, label: "Leaderboard" },
    { to: "/editor/chat", icon: ChatsCircle, label: "Chat" },
  ],
  client: [
    { to: "/client", icon: House, label: "Dashboard", end: true },
    { to: "/client/panel", icon: VideoCamera, label: "Project Hub" },
    { to: "/client/projects", icon: FolderOpen, label: "Projects" },
    { to: "/client/chat", icon: ChatsCircle, label: "Message Admin" },
  ],
};

export default function Sidebar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const items = NAV[user.role] || [];

  const onLogout = async () => {
    await logout();
    nav("/login");
  };

  return (
    <aside className="w-64 shrink-0 bg-zinc-950 border-r border-white/10 h-screen sticky top-0 flex flex-col" data-testid="sidebar">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white rounded-md grid place-items-center">
            <span className="font-mono text-black font-bold text-sm">TF</span>
          </div>
          <div>
            <div className="font-semibold text-sm">TaskFlow</div>
            <div className="label-xs text-zinc-500">Agency OS</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        <div className="label-xs text-zinc-600 px-3 py-3">{user.role}</div>
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            data-testid={`nav-${it.label.toLowerCase().replace(/\s/g, "-")}`}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-all ${
                isActive
                  ? "bg-white/5 text-white border-l-2 border-white"
                  : "text-zinc-400 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <it.icon size={18} weight="regular" />
            <span>{it.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-white/10">
        <div className="flex items-center gap-3 p-2 mb-2">
          <div className="relative">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className={`w-9 h-9 object-cover ${user.role === "editor" ? "rounded-md" : "rounded-full"}`} />
            ) : (
              <div className={`w-9 h-9 bg-zinc-800 grid place-items-center ${user.role === "editor" ? "rounded-md" : "rounded-full"}`}>
                <span className="text-xs font-medium">{user.display_name?.[0] || "U"}</span>
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-zinc-950 rounded-full" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium truncate">{user.display_name}</div>
            <div className="label-xs text-zinc-500">{user.role}</div>
          </div>
        </div>
        <button
          data-testid="logout-button"
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-white/5 rounded-md transition-all"
        >
          <SignOut size={16} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
