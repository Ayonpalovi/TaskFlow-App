import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

const BLUE = "#0051FF";

const navItems = [
  ["Overview", "/moderator/overview", "⌂"],
  ["Projects", "/moderator/projects", "▣"],
  ["Tasks", "/moderator/tasks", "▦"],
  ["Team Workload", "/moderator/team-workload", "♧"],
  ["Client Messages", "/moderator/client-messages", "✉"],
  ["Reviews", "/moderator/reviews", "☑"],
  ["Escalations", "/moderator/escalations", "⚠"],
  ["Calendar", "/moderator/calendar", "□"],
  ["Chat", "/moderator/chat", "♧"],
  ["Profile", "/moderator/profile", "◎"],
];

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function formatDateOnly(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function firstLetter(value) {
  return String(value || "M").charAt(0).toUpperCase();
}

function Badge({ children, tone = "default" }) {
  const tones = {
    default: "border-white/10 bg-white/5 text-zinc-300",
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-200",
    good: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    warn: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    bad: "border-red-500/25 bg-red-500/10 text-red-300",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${tones[tone] || tones.default}`}>{children}</span>;
}

function Card({ title, action, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/35 p-4 shadow-2xl shadow-black/15 backdrop-blur">
      {(title || action) && <div className="mb-3 flex items-center justify-between gap-3">{title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}{action}</div>}
      {children}
    </section>
  );
}

function Stat({ label, value }) {
  return <div className="rounded-2xl border border-white/10 bg-black/25 p-4"><div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{label}</div><div className="mt-2 font-mono text-2xl font-semibold text-white">{value ?? 0}</div></div>;
}

function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">{children}</div>;
}

function useModeratorData() {
  const { user, logout } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [profile, setProfile] = useState(null);
  const [notice, setNotice] = useState("");

  const load = async () => {
    setNotice("");
    const [dashboardRes, profileRes] = await Promise.allSettled([api.get("/moderator/dashboard"), api.get("/moderator/profile")]);
    if (dashboardRes.status === "fulfilled") setDashboard(dashboardRes.value.data);
    if (profileRes.status === "fulfilled") setProfile(profileRes.value.data);
    if (dashboardRes.status === "rejected") setNotice("Operations data is not available yet.");
  };

  useEffect(() => { load(); }, []);

  const safeProfile = useMemo(() => ({
    avatar_url: profile?.avatar_url || user?.avatar_url || "",
    real_name: profile?.real_name || user?.real_name || user?.display_name || user?.email || "Moderator",
    email: profile?.email || user?.email || "—",
    status: profile?.status || user?.status || "active",
    online: profile?.online ?? true,
    assigned_departments: profile?.assigned_departments || user?.assigned_departments || user?.skills || [],
    permission_level: profile?.permission_level || "Limited operations access",
    assigned_projects: profile?.assigned_projects ?? 0,
    last_active_time: profile?.last_active_time || user?.last_seen,
    date_invited: profile?.date_invited || user?.invited_at || user?.created_at,
  }), [profile, user]);

  return { user, logout, dashboard: dashboard || {}, profile: safeProfile, notice, reload: load };
}

function ModeratorShell({ title, subtitle, children }) {
  const ctx = useModeratorData();
  const { profile, logout, notice } = ctx;

  const signOut = async () => { if (logout) await logout(); };

  return (
    <div className="min-h-screen bg-zinc-950 text-white lg:flex">
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[228px] shrink-0 flex-col border-r border-white/10 bg-zinc-950">
        <div className="h-[86px] px-5 flex items-center border-b border-white/10">
          <NavLink to="/moderator/overview" className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-md bg-black grid place-items-center overflow-hidden"><img src="/motionholic-logo.png" alt="Motionholic OS" className="w-8 h-8 object-contain" /></div>
            <div><div className="text-sm font-semibold leading-tight">Motionholic OS</div><div className="text-[10px] text-zinc-500 font-mono tracking-[0.25em] uppercase">Creative Agency OS</div></div>
          </NavLink>
        </div>
        <div className="px-5 pt-6 pb-3"><div className="text-[10px] text-zinc-600 font-mono tracking-[0.25em] uppercase">Moderator</div></div>
        <nav className="flex-1 overflow-y-auto px-3 space-y-1">
          {navItems.map(([label, to, icon]) => (
            <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm transition-all ${isActive ? "border-white bg-white/10 text-white" : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-white"}`}>
              <span className="w-4 text-center text-zinc-400">{icon}</span><span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <NavLink to="/moderator/profile" className="flex w-full items-center gap-3 text-left">
            <div className="relative"><div className="grid h-9 w-9 place-items-center rounded-full bg-zinc-800 text-sm font-medium">{firstLetter(profile.real_name)}</div><span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 bg-emerald-400" /></div>
            <div className="min-w-0"><div className="truncate text-sm font-medium">{profile.real_name}</div><div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Moderator</div></div>
          </NavLink>
          <button onClick={signOut} className="mt-4 flex items-center gap-2 text-sm text-zinc-500 hover:text-white"><span>↳</span><span>Sign out</span></button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 lg:ml-[228px]">
        <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-7 lg:py-7">
          <div className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,81,255,.22),transparent_35%),rgba(24,24,27,.42)] p-5 shadow-2xl shadow-black/20 md:flex-row md:items-center md:justify-between">
            <div><div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-zinc-500">Moderator</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>{subtitle && <p className="mt-2 text-sm text-zinc-400">{subtitle}</p>}</div>
            <Badge tone="blue">Limited Operations Access</Badge>
          </div>
          {notice && <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">{notice}</div>}
          {children(ctx)}
        </div>
      </main>
    </div>
  );
}

function ProjectsTable({ projects, compact = false }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-[10px] uppercase tracking-[0.18em] text-zinc-500"><tr><th className="py-2">Project</th><th>Client</th><th>Service</th><th>Team member</th><th>Status</th><th>Deadline</th><th></th></tr></thead>
        <tbody>{projects.slice(0, compact ? 5 : 30).map((p) => <tr key={p.id} className="border-t border-white/5"><td className="py-3 font-medium">{p.project_name || "Untitled"}</td><td className="text-zinc-400">{p.client_name || "—"}</td><td className="text-zinc-400">{p.service_type || "—"}</td><td className="text-zinc-400">{p.assigned_team_member || "Unassigned"}</td><td><Badge tone="blue">{p.current_status || "—"}</Badge></td><td className="text-zinc-400">{formatDateOnly(p.deadline)}</td><td className="text-right"><button className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5">View / Update</button></td></tr>)}</tbody>
      </table>
    </div>
  );
}

export function ModeratorOverview() {
  return <ModeratorShell title="Moderator Dashboard" subtitle="Manage daily operations with limited access.">{({ dashboard }) => {
    const overview = dashboard.overview || {};
    const workload = dashboard.team_workload || [];
    const activity = dashboard.activity_log || [];
    return <><div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Stat label="Active Projects" value={overview.active_projects} /><Stat label="Pending Reviews" value={overview.pending_approvals} /><Stat label="Urgent Deadlines" value={overview.urgent_deadlines} /><Stat label="Client Messages" value={overview.client_messages_waiting} /><Stat label="Team Availability" value={workload.filter((w) => w.availability === "Available").length} /></div><Card title="Small activity summary">{activity.length ? <div className="grid gap-2 md:grid-cols-2">{activity.slice(0, 6).map((a) => <div key={a.id || a.created_at} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"><div>{a.action || "Moderator activity"}</div><div className="mt-1 text-xs text-zinc-600">{formatDate(a.created_at)}</div></div>)}</div> : <Empty>No recent activity yet.</Empty>}</Card></>;
  }}</ModeratorShell>;
}

export function ModeratorProjects() {
  return <ModeratorShell title="Projects" subtitle="Assigned active projects and operational updates.">{({ dashboard }) => { const projects = dashboard.managed_projects || []; return <Card title="Assigned Active Projects">{projects.length ? <ProjectsTable projects={projects} /> : <Empty>No active projects assigned yet.</Empty>}</Card>; }}</ModeratorShell>;
}

export function ModeratorTasks() {
  return <ModeratorShell title="Tasks" subtitle="Operational task list across active projects.">{({ dashboard }) => { const projects = dashboard.managed_projects || []; const tasks = projects.map((p) => ({ id: p.id, title: p.project_name, project: p.project_name, assigned: p.assigned_team_member, priority: p.priority, due: p.deadline, status: p.current_status })); return <Card title="Task List">{tasks.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-[10px] uppercase tracking-[0.18em] text-zinc-500"><tr><th className="py-2">Task title</th><th>Project</th><th>Assigned team member</th><th>Priority</th><th>Due date</th><th>Status</th></tr></thead><tbody>{tasks.map((t) => <tr key={t.id} className="border-t border-white/5"><td className="py-3 font-medium">{t.title || "Project task"}</td><td className="text-zinc-400">{t.project || "—"}</td><td className="text-zinc-400">{t.assigned || "Unassigned"}</td><td><Badge>{t.priority || "medium"}</Badge></td><td className="text-zinc-400">{formatDateOnly(t.due)}</td><td><Badge tone="blue">{t.status || "—"}</Badge></td></tr>)}</tbody></table></div> : <Empty>No tasks available yet.</Empty>}</Card>; }}</ModeratorShell>;
}

export function ModeratorTeamWorkload() {
  return <ModeratorShell title="Team Workload" subtitle="Team availability, active tasks and workload health.">{({ dashboard }) => { const workload = dashboard.team_workload || []; return <Card title="Team Member List">{workload.length ? <div className="grid gap-3 md:grid-cols-2">{workload.map((w, i) => <div key={`${w.team_member_name}-${i}`} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{w.team_member_name}</div><div className="mt-1 text-sm text-zinc-500">{w.role} · {w.active_tasks} active tasks</div></div><Badge tone={w.availability === "Available" ? "good" : w.availability === "Busy" ? "warn" : "bad"}>{w.availability}</Badge></div><div className="mt-3 text-xs text-zinc-500">{w.performance_status}</div></div>)}</div> : <Empty>No team workload data yet.</Empty>}</Card>; }}</ModeratorShell>;
}

export function ModeratorClientMessages() {
  return <ModeratorShell title="Client Messages" subtitle="Client message inbox and pending replies.">{({ dashboard }) => { const comms = dashboard.client_communication || {}; const messages = comms.pending_replies || comms.recent_messages || []; return <Card title="Client Message Inbox">{messages.length ? <div className="space-y-3">{messages.map((m) => <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm"><div className="mb-1 flex justify-between gap-3"><span className="font-medium">{m.client_name || m.sender_name || "Client"}</span><span className="text-xs text-zinc-500">{formatDate(m.created_at)}</span></div><div className="text-xs text-zinc-500">{m.project_name || "Project conversation"}</div><p className="mt-2 text-zinc-300">{m.content}</p><button className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5">Reply</button></div>)}</div> : <Empty>No client messages waiting.</Empty>}</Card>; }}</ModeratorShell>;
}

export function ModeratorReviews() {
  return <ModeratorShell title="Reviews" subtitle="Internal reviews, client reviews and revision requests.">{({ dashboard }) => { const projects = (dashboard.managed_projects || []).filter((p) => ["submitted", "client_review", "revision"].includes(p.current_status)); return <Card title="Pending Reviews">{projects.length ? <div className="grid gap-3 md:grid-cols-2">{projects.map((p) => <div key={p.id} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="font-medium">{p.project_name || "Untitled"}</div><div className="mt-1 text-sm text-zinc-500">{p.client_name || "—"} · {p.service_type || "—"}</div><div className="mt-3 flex gap-2"><Badge tone="warn">{p.current_status}</Badge><button className="rounded-lg border border-emerald-500/20 px-3 py-1 text-xs text-emerald-300">Approve</button><button className="rounded-lg border border-amber-500/20 px-3 py-1 text-xs text-amber-300">Send Back</button></div></div>)}</div> : <Empty>No pending reviews.</Empty>}</Card>; }}</ModeratorShell>;
}

export function ModeratorEscalations() {
  const [form, setForm] = useState({ title: "", category: "delay", body: "" });
  return <ModeratorShell title="Escalations" subtitle="Flag issues that need Admin attention.">{({ dashboard, reload }) => { const escalations = dashboard.escalation_center || {}; const items = escalations.issues_needing_admin_attention || []; const submit = async () => { if (!form.title.trim()) return; await api.post("/moderator/escalations", form); setForm({ title: "", category: "delay", body: "" }); reload(); }; return <div className="grid gap-5 xl:grid-cols-[.75fr,1fr]"><Card title="Create Escalation Note"><div className="space-y-2"><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white"><option value="payment">Payment issue</option><option value="conflict">Client conflict</option><option value="delay">Delayed project</option><option value="team">Team member unavailable</option><option value="approval">Urgent approval needed</option></select><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Issue title" className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600" /><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Short note to Admin" rows={3} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600" /><button onClick={submit} className="w-full rounded-xl px-4 py-2 text-sm font-medium text-white" style={{ background: BLUE }}>Notify Admin</button></div></Card><Card title="Submitted Notes">{items.length ? <div className="space-y-3">{items.map((e) => <div key={e.id} className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm"><div className="font-medium text-amber-100">{e.target_email || "Escalation"}</div><div className="mt-1 text-xs text-amber-200/70">{e.metadata?.category || "issue"} · {formatDate(e.created_at)}</div></div>)}</div> : <Empty>No escalation notes yet.</Empty>}</Card></div>; }}</ModeratorShell>;
}

export function ModeratorCalendar() {
  return <ModeratorShell title="Calendar" subtitle="Deadlines, review dates, client meetings and team dates.">{({ dashboard }) => { const projects = dashboard.managed_projects || []; const items = projects.filter((p) => p.deadline); return <Card title="Upcoming Items">{items.length ? <div className="space-y-3">{items.map((p) => <div key={p.id} className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm"><div className="font-medium">{p.project_name || "Project"}</div><div className="mt-1 text-zinc-500">Deadline · {formatDateOnly(p.deadline)}</div></div>)}</div> : <Empty>No calendar items yet.</Empty>}</Card>; }}</ModeratorShell>;
}

export function ModeratorChat() {
  return <ModeratorShell title="Chat" subtitle="Internal team and Admin communication.">{({ dashboard }) => { const messages = dashboard.client_communication?.recent_messages || []; return <Card title="Conversations">{messages.length ? <div className="space-y-3">{messages.slice(0, 8).map((m) => <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm"><div className="text-xs uppercase tracking-[0.18em] text-zinc-600">{m.sender_role || "message"}</div><p className="mt-1 text-zinc-300">{m.content}</p></div>)}</div> : <Empty>No messages yet.</Empty>}</Card>; }}</ModeratorShell>;
}

export function ModeratorProfile() {
  return <ModeratorShell title="Profile" subtitle="Moderator identity, access level and account status.">{({ profile }) => <Card title="Moderator Profile"><div className="grid gap-3 md:grid-cols-2"><div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-zinc-500">Avatar</div><div className="mt-2 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-500/15 text-xl font-semibold">{firstLetter(profile.real_name)}</div><span>{profile.avatar_url ? "Uploaded" : "Default avatar"}</span></div></div><ProfileRow label="Real name" value={profile.real_name} /><ProfileRow label="Email" value={profile.email} /><ProfileRow label="Role" value="Moderator" /><ProfileRow label="Status" value={profile.status} /><ProfileRow label="Online/offline" value={profile.online ? "Online" : "Offline"} /><ProfileRow label="Assigned departments" value={(profile.assigned_departments || []).join(", ") || "—"} /><ProfileRow label="Permission level" value={profile.permission_level} /><ProfileRow label="Last active" value={formatDate(profile.last_active_time)} /><ProfileRow label="Date invited" value={formatDate(profile.date_invited)} /></div></Card>}</ModeratorShell>;
}

function ProfileRow({ label, value }) {
  return <div className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="text-xs text-zinc-500">{label}</div><div className="mt-2 text-sm text-zinc-200">{value || "—"}</div></div>;
}

export default ModeratorOverview;
