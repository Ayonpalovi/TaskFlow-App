import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NAV_ITEMS = [
  ["Overview",        "/moderator/overview",      "⌂"],
  ["Projects",        "/moderator/projects",       "▣"],
  ["Tasks",           "/moderator/tasks",          "▦"],
  ["Team Workload",   "/moderator/team-workload",  "♧"],
  ["Client Messages", "/moderator/client-messages","✉"],
  ["Reviews",         "/moderator/reviews",        "☑"],
  ["Escalations",     "/moderator/escalations",    "⚠"],
  ["Calendar",        "/moderator/calendar",       "□"],
  ["Chat",            "/moderator/chat",           "♧"],
  ["Profile",         "/moderator/profile",        "◎"],
];

function firstLetter(val) {
  return String(val || "M").charAt(0).toUpperCase();
}

function SidebarContent({ name, onClose, onSignOut }) {
  return (
    <>
      <div className="flex h-[86px] items-center border-b border-white/10 px-5 shrink-0">
        <NavLink to="/moderator/overview" onClick={onClose} className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-md bg-black">
            <img src="/motionholic-logo.png" alt="Motionholic OS" className="h-8 w-8 object-contain" />
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">Motionholic OS</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">Creative Agency OS</div>
          </div>
        </NavLink>
      </div>

      <div className="px-5 pb-3 pt-6">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">Moderator</div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3">
        {NAV_ITEMS.map(([label, to, icon]) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm transition-all ${
                isActive
                  ? "border-white bg-white/10 text-white"
                  : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-white"
              }`
            }
          >
            <span className="w-4 text-center text-zinc-400">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-white/10 p-4 shrink-0">
        <NavLink to="/moderator/profile" onClick={onClose} className="flex w-full items-center gap-3 text-left">
          <div className="relative">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-zinc-800 text-sm font-medium">
              {firstLetter(name)}
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 bg-emerald-400" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{name}</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Moderator</div>
          </div>
        </NavLink>
        <button
          onClick={onSignOut}
          className="mt-4 flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors"
        >
          <span>↳</span><span>Sign out</span>
        </button>
      </div>
    </>
  );
}

export default function ModeratorLayout({ children }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const name = user?.real_name || user?.display_name || user?.email || "Moderator";

  const signOut = async () => {
    try { if (logout) await logout(); } catch {}
    nav("/login");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white lg:flex">

      {/* ── Desktop sidebar ───────────────────────────────────────────────── */}
      <aside className="fixed left-0 top-0 hidden h-screen w-[228px] shrink-0 flex-col border-r border-white/10 bg-zinc-950 lg:flex">
        <SidebarContent name={name} onClose={() => {}} onSignOut={signOut} />
      </aside>

      {/* ── Mobile top header ─────────────────────────────────────────────── */}
      <header className="lg:hidden sticky top-0 z-40 flex h-16 items-center justify-between border-b border-white/10 bg-zinc-950/95 px-4 backdrop-blur">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={() => setMobileOpen(true)}
          className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-xl text-zinc-300 hover:bg-white/5"
        >
          ☰
        </button>
        <NavLink to="/moderator/overview" className="flex items-center gap-2">
          <img src="/motionholic-logo.png" alt="Motionholic OS" className="h-8 w-8 object-contain" />
          <span className="text-sm font-semibold">Motionholic OS</span>
        </NavLink>
        {/* Sign-out shortcut always visible on mobile */}
        <button
          type="button"
          onClick={signOut}
          aria-label="Sign out"
          className="grid h-10 w-10 place-items-center rounded-md border border-white/10 text-sm text-zinc-400 hover:bg-white/5 hover:text-white"
          title="Sign out"
        >
          ↳
        </button>
      </header>

      {/* ── Mobile drawer ─────────────────────────────────────────────────── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* backdrop */}
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
          />
          {/* panel */}
          <div className="absolute bottom-0 left-0 top-0 flex w-[280px] max-w-[85vw] flex-col border-r border-white/10 bg-zinc-950">
            <SidebarContent
              name={name}
              onClose={() => setMobileOpen(false)}
              onSignOut={signOut}
            />
          </div>
        </div>
      )}

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <main className="min-w-0 flex-1 lg:ml-[228px]">
        <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-7 lg:py-7">
          {children}
        </div>
      </main>
    </div>
  );
}
