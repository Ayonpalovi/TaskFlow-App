import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

const LIVE_REFRESH_MS = 3500;

const navItems = [
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

const statusColors = {
  available: "#71717A",
  active: "#3B82F6",
  pending: "#F59E0B",
  awaiting_admin_approval: "#F59E0B",
  client_review: "#8B5CF6",
  revision: "#EF4444",
  completed: "#10B981",
  draft: "#52525B",
  rejected: "#71717A",
};

const statusLabels = {
  available: "available",
  active: "active",
  pending: "pending",
  awaiting_admin_approval: "awaiting admin approval",
  client_review: "client review",
  revision: "revision",
  completed: "completed",
  draft: "draft",
  rejected: "rejected",
};

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function groupStatus(status) {
  if (["submitted", "admin_review", "awaiting_admin_approval", "pending_admin_approval"].includes(status)) return "awaiting_admin_approval";
  return status || "available";
}

function labelStatus(status) {
  const key = groupStatus(status);
  return statusLabels[key] || key;
}

function countRevisions(task) {
  if (Array.isArray(task?.revisions)) return task.revisions.length;
  return Number(task?.revision_count || task?.revisions_count || 0);
}

function nameOf(user, fallback) {
  return user?.anime_name || user?.display_name || user?.real_name || user?.email || fallback;
}

function Card({ title, value, helper }) {
  return (
    <div className="rounded-xl border border-white/10 bg-gradient-to-br from-blue-500/5 via-zinc-900/40 to-zinc-950 p-5">
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">{title}</div>
      <div className="mt-4 font-mono text-3xl font-semibold text-blue-300">{value}</div>
      {helper && <div className="mt-2 text-xs text-zinc-500">{helper}</div>}
    </div>
  );
}

function Panel({ children, className = "" }) {
  return <div className={`rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900/40 via-zinc-900/25 to-zinc-950 p-5 ${className}`}>{children}</div>;
}

function Badge({ children }) {
  return <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-zinc-300">{children}</span>;
}

export default function ModeratorCommandOverview() {
  const { user, logout } = useAuth();
  const inFlightRef = useRef(false);
  const [tasks, setTasks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [risk, setRisk] = useState([]);
  const [editors, setEditors] = useState([]);
  const [clients, setClients] = useState([]);
  const [profile, setProfile] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const [tasksRes, requestsRes, riskRes, editorsRes, clientsRes, profileRes] = await Promise.allSettled([
        api.get("/tasks"),
        api.get("/requests"),
        api.get("/stats/deadline-risk"),
        api.get("/users?role=editor"),
        api.get("/users?role=client"),
        api.get("/moderator/profile"),
      ]);
      if (tasksRes.status === "fulfilled") setTasks(toArray(tasksRes.value.data));
      if (requestsRes.status === "fulfilled") setRequests(toArray(requestsRes.value.data));
      if (riskRes.status === "fulfilled") setRisk(toArray(riskRes.value.data));
      if (editorsRes.status === "fulfilled") setEditors(toArray(editorsRes.value.data));
      if (clientsRes.status === "fulfilled") setClients(toArray(clientsRes.value.data));
      if (profileRes.status === "fulfilled") setProfile(profileRes.value.data || null);
      setLastUpdated(new Date());
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, LIVE_REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const statusData = useMemo(() => {
    const counts = {};
    toArray(tasks).forEach((task) => {
      const key = groupStatus(task.status || task.current_status);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  const stats = useMemo(() => {
    const list = toArray(tasks);
    return {
      total: list.length,
      progress: list.filter((task) => ["active", "pending", "awaiting_admin_approval", "client_review"].includes(groupStatus(task.status))).length,
      completed: list.filter((task) => groupStatus(task.status) === "completed").length,
      revisions: list.reduce((sum, task) => sum + countRevisions(task), 0),
      pending: toArray(requests).filter((request) => request.status === "pending").length,
    };
  }, [tasks, requests]);

  const workload = useMemo(() => {
    return toArray(editors).map((editor) => {
      const assigned = toArray(tasks).filter((task) => task.assigned_editor_id === editor.id);
      const active = assigned.filter((task) => ["active", "pending", "revision"].includes(groupStatus(task.status))).length;
      return { editor, active, load: Math.min(100, active * 20) };
    });
  }, [editors, tasks]);

  const safeName = profile?.real_name || user?.real_name || user?.display_name || user?.email || "Moderator";

  return (
    <div className="min-h-screen bg-zinc-950 text-white lg:flex">
      <aside className="fixed left-0 top-0 hidden h-screen w-[228px] shrink-0 flex-col border-r border-white/10 bg-zinc-950 lg:flex">
        <div className="flex h-[86px] items-center border-b border-white/10 px-5">
          <NavLink to="/moderator/overview" className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-md bg-black"><img src="/motionholic-logo.png" alt="Motionholic OS" className="h-8 w-8 object-contain" /></div>
            <div><div className="text-sm font-semibold leading-tight">Motionholic OS</div><div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">Creative Agency OS</div></div>
          </NavLink>
        </div>
        <div className="px-5 pb-3 pt-6"><div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-600">Moderator</div></div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {navItems.map(([label, to, icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm transition-all ${isActive ? "border-white bg-white/10 text-white" : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-white"}`}>
              <span className="w-4 text-center text-zinc-400">{icon}</span><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <NavLink to="/moderator/profile" className="flex w-full items-center gap-3 text-left">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-zinc-800 text-sm font-medium">{String(safeName).charAt(0).toUpperCase()}</div>
            <div className="min-w-0"><div className="truncate text-sm font-medium">{safeName}</div><div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Moderator</div></div>
          </NavLink>
          <button onClick={async () => logout && logout()} className="mt-4 flex items-center gap-2 text-sm text-zinc-500 hover:text-white"><span>↳</span><span>Sign out</span></button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 lg:ml-[228px]">
        <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-7 lg:py-7">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div><div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Moderator / Overview</div><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Command Center</h1><p className="mt-2 text-sm text-zinc-400">Live editor performance, workload, deadline risk, requests, and recent tasks.</p></div>
            <div className="flex items-center gap-2"><Badge>Live sync</Badge><Badge>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Syncing"}</Badge></div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card title="Total Projects" value={stats.total} helper="All visible project records" />
            <Card title="In Progress" value={stats.progress} helper="Currently moving" />
            <Card title="Completed" value={stats.completed} helper="Delivered projects" />
            <Card title="Revisions" value={stats.revisions} helper="Total revision notes" />
            <Card title="Editors" value={editors.length} helper="Creative team" />
            <Card title="Clients" value={clients.length} helper="Active accounts" />
            <Card title="Pending Requests" value={stats.pending} helper="Editor requests waiting" />
            <Card title="Deadline Risk" value={risk.length} helper="Due soon or overdue" />
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <Panel className="lg:col-span-2">
              <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Editor workload</h2><Badge>{workload.length} editors</Badge></div>
              <div className="space-y-3">
                {workload.length === 0 && <div className="text-sm text-zinc-500">No workload data yet.</div>}
                {workload.map((item) => (
                  <div key={item.editor.id}>
                    <div className="mb-1 flex justify-between text-sm"><span>{nameOf(item.editor, "Unknown editor")}</span><span className="font-mono text-xs">{item.active} active</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-blue-500" style={{ width: `${item.load}%` }} /></div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-purple-300">Status breakdown</div>
              {statusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${labelStatus(name)} (${value})`}>
                      {statusData.map((item, index) => <Cell key={`${item.name}-${index}`} fill={statusColors[groupStatus(item.name)] || "#52525B"} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="text-sm text-zinc-500">No project status data yet.</div>}
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel>
              <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Pending editor requests</h2><Badge>{stats.pending}</Badge></div>
              <div className="space-y-3">
                {toArray(requests).filter((request) => request.status === "pending").length === 0 && <div className="text-sm text-zinc-500">No pending requests.</div>}
                {toArray(requests).filter((request) => request.status === "pending").slice(0, 6).map((request) => <div key={request.id} className="rounded-md border border-white/10 bg-black/20 p-3 text-sm">Request waiting for approval</div>)}
              </div>
            </Panel>

            <Panel>
              <h2 className="mb-4 text-lg font-semibold">Recent tasks</h2>
              <div className="space-y-2">
                {tasks.slice(0, 8).map((task) => (
                  <div key={task.id} className="flex items-center justify-between border-b border-white/5 py-2 text-sm">
                    <div className="min-w-0"><div className="truncate">{task.title}</div><div className="text-xs text-zinc-500">{task.project_type || "Project"} • {task.deadline ? String(task.deadline).slice(0, 10) : "No deadline"}</div></div>
                    <Badge>{labelStatus(task.status)}</Badge>
                  </div>
                ))}
                {tasks.length === 0 && <div className="text-sm text-zinc-500">No tasks yet.</div>}
              </div>
            </Panel>
          </div>
        </div>
      </main>
    </div>
  );
}
