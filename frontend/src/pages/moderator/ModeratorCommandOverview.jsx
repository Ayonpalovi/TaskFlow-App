import { useEffect, useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";

const BLUE = "#0051FF";
const navItems = [["Overview", "/moderator/overview", "⌂"], ["Projects", "/moderator/projects", "▣"], ["Tasks", "/moderator/tasks", "▦"], ["Team Workload", "/moderator/team-workload", "♧"], ["Client Messages", "/moderator/client-messages", "✉"], ["Reviews", "/moderator/reviews", "☑"], ["Escalations", "/moderator/escalations", "⚠"], ["Calendar", "/moderator/calendar", "□"], ["Chat", "/moderator/chat", "♧"], ["Profile", "/moderator/profile", "◎"]];
const STATUS_COLORS = { active: "#3B82F6", submitted: "#F59E0B", client_review: "#8B5CF6", revision: "#EF4444", completed: "#10B981", available: "#71717A" };
const metricThemes = { blue: ["rgba(59,130,246,.30)", "rgba(59,130,246,.10)", "text-blue-300", "bg-blue-400"], amber: ["rgba(245,158,11,.34)", "rgba(245,158,11,.11)", "text-amber-300", "bg-amber-400"], emerald: ["rgba(16,185,129,.30)", "rgba(16,185,129,.10)", "text-emerald-300", "bg-emerald-400"], red: ["rgba(239,68,68,.32)", "rgba(239,68,68,.10)", "text-red-300", "bg-red-400"], purple: ["rgba(168,85,247,.30)", "rgba(168,85,247,.10)", "text-purple-300", "bg-purple-400"], cyan: ["rgba(6,182,212,.30)", "rgba(6,182,212,.10)", "text-cyan-300", "bg-cyan-400"], zinc: ["rgba(255,255,255,.12)", "rgba(255,255,255,.045)", "text-zinc-100", "bg-zinc-400"] };

function formatMoney(value) { return `$${Number(value || 0).toLocaleString()}`; }
function formatDate(value) { if (!value) return "—"; try { return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return "—"; } }
function firstLetter(value) { return String(value || "M").charAt(0).toUpperCase(); }

function Badge({ children, tone = "default" }) {
  const tones = { default: "border-white/10 bg-white/5 text-zinc-300", blue: "border-blue-500/25 bg-blue-500/10 text-blue-200", good: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300", warn: "border-amber-500/25 bg-amber-500/10 text-amber-300", bad: "border-red-500/25 bg-red-500/10 text-red-300" };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${tones[tone] || tones.default}`}>{children}</span>;
}

function MetricCard({ label, value, color = "zinc", helper, locked, onRequest }) {
  const [border, glow, text, dot] = metricThemes[color] || metricThemes.zinc;
  return <div className="relative min-h-[112px] overflow-hidden rounded-xl border p-5 bg-zinc-900/30" style={{ borderColor: border, background: `linear-gradient(135deg, ${glow}, rgba(24,24,27,.44) 58%, rgba(9,9,11,.74))` }}><div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: border }} /><div className="mb-4 flex items-center justify-between gap-3"><div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{label}</div><span className={`h-2 w-2 rounded-full ${dot}`} /></div>{locked ? <div><div className="font-mono text-2xl font-semibold text-zinc-500">Locked</div><button onClick={onRequest} className="mt-2 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] text-zinc-300 hover:bg-white/5">Request 6h access</button></div> : <div className={`font-mono text-3xl font-semibold tracking-tight ${text}`}>{value}</div>}{helper && <div className="mt-2 text-xs text-zinc-600">{helper}</div>}</div>;
}

function Panel({ title, children, className = "" }) { return <div className={`rounded-xl border border-white/10 bg-gradient-to-br from-zinc-900/30 to-zinc-950 p-5 ${className}`}>{title && <div className="mb-4 text-[10px] uppercase tracking-[0.22em] text-zinc-500">{title}</div>}{children}</div>; }

function Empty({ children }) { return <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">{children}</div>; }

export default function ModeratorCommandOverview() {
  const { user, logout } = useAuth();
  const [dashboard, setDashboard] = useState({});
  const [profile, setProfile] = useState(null);
  const [finance, setFinance] = useState({ finance_access: { allowed: false }, daily: [] });
  const [notice, setNotice] = useState("");

  const load = async () => {
    const [dashRes, profileRes, financeRes] = await Promise.allSettled([api.get("/moderator/dashboard"), api.get("/moderator/profile"), api.get("/moderator/finance-access")]);
    if (dashRes.status === "fulfilled") setDashboard(dashRes.value.data || {});
    if (profileRes.status === "fulfilled") setProfile(profileRes.value.data || null);
    if (financeRes.status === "fulfilled") setFinance(financeRes.value.data || { finance_access: { allowed: false }, daily: [] });
  };

  useEffect(() => { load(); }, []);

  const safeProfile = useMemo(() => ({ real_name: profile?.real_name || user?.real_name || user?.display_name || user?.email || "Moderator", email: profile?.email || user?.email || "—" }), [profile, user]);
  const overview = dashboard.overview || {};
  const projects = dashboard.managed_projects || [];
  const workload = dashboard.team_workload || [];
  const activity = dashboard.activity_log || [];
  const messages = dashboard.client_communication?.pending_replies || dashboard.client_communication?.recent_messages || [];
  const accessAllowed = !!finance?.finance_access?.allowed;
  const statusData = useMemo(() => {
    const counts = {};
    projects.forEach((p) => { const key = p.current_status || "unknown"; counts[key] = (counts[key] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [projects]);

  const requestFinance = async () => {
    try {
      await api.post("/moderator/finance-access/request");
      setNotice("Request sent to Admin. Revenue and profit will unlock for 6 hours after approval.");
    } catch {
      setNotice("Could not send finance access request yet.");
    }
  };

  const signOut = async () => { if (logout) await logout(); };

  return <div className="min-h-screen bg-zinc-950 text-white lg:flex"><aside className="hidden lg:flex fixed left-0 top-0 h-screen w-[228px] shrink-0 flex-col border-r border-white/10 bg-zinc-950"><div className="h-[86px] px-5 flex items-center border-b border-white/10"><NavLink to="/moderator/overview" className="flex items-center gap-3"><div className="w-9 h-9 rounded-md bg-black grid place-items-center overflow-hidden"><img src="/motionholic-logo.png" alt="Motionholic OS" className="w-8 h-8 object-contain" /></div><div><div className="text-sm font-semibold leading-tight">Motionholic OS</div><div className="text-[10px] text-zinc-500 font-mono tracking-[0.25em] uppercase">Creative Agency OS</div></div></NavLink></div><div className="px-5 pt-6 pb-3"><div className="text-[10px] text-zinc-600 font-mono tracking-[0.25em] uppercase">Moderator</div></div><nav className="flex-1 overflow-y-auto px-3 space-y-1">{navItems.map(([label, to, icon]) => <NavLink key={to} to={to} className={({ isActive }) => `flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm transition-all ${isActive ? "border-white bg-white/10 text-white" : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-white"}`}><span className="w-4 text-center text-zinc-400">{icon}</span><span>{label}</span></NavLink>)}</nav><div className="border-t border-white/10 p-4"><NavLink to="/moderator/profile" className="flex w-full items-center gap-3 text-left"><div className="relative"><div className="grid h-9 w-9 place-items-center rounded-full bg-zinc-800 text-sm font-medium">{firstLetter(safeProfile.real_name)}</div><span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 bg-emerald-400" /></div><div className="min-w-0"><div className="truncate text-sm font-medium">{safeProfile.real_name}</div><div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Moderator</div></div></NavLink><button onClick={signOut} className="mt-4 flex items-center gap-2 text-sm text-zinc-500 hover:text-white"><span>↳</span><span>Sign out</span></button></div></aside><main className="min-w-0 flex-1 lg:ml-[228px]"><div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-7 lg:py-7"><div className="mb-6"><div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Moderator / Overview</div><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Command Center</h1><p className="mt-2 text-sm text-zinc-400">Operations health, review flow, workload, and risk.</p></div>{notice && <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">{notice}</div>}<div className="mb-6 rounded-xl border border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-zinc-900/30 to-zinc-950 p-5 flex items-center gap-4"><div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/15 text-2xl">🛡️</div><div className="flex-1"><div className="text-[10px] uppercase tracking-[0.25em] text-blue-300">Operations Manager</div><div className="mt-1 text-2xl font-bold">{safeProfile.real_name}</div><div className="text-sm text-zinc-400">Limited access · Daily agency operations</div></div><div className="hidden text-right sm:block"><Badge tone="blue">Limited Operations Access</Badge>{accessAllowed && <div className="mt-2 text-xs text-emerald-300">Finance visible until {formatDate(finance.finance_access.expires_at)}</div>}</div></div><div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4"><MetricCard label="Total Projects" value={projects.length} color="purple" helper="Visible project records" /><MetricCard label="In Progress" value={overview.active_projects ?? 0} color="amber" helper="Currently moving" /><MetricCard label="Completed" value={projects.filter((p) => p.current_status === "completed").length} color="emerald" helper="Delivered projects" /><MetricCard label="Revisions" value={overview.revision_requests ?? 0} color="red" helper="Needs changes" /><MetricCard label="Monthly Revenue" value={formatMoney(finance.monthly_revenue)} color="blue" helper={accessAllowed ? "6-hour approved view" : "Admin approval required"} locked={!accessAllowed} onRequest={requestFinance} /><MetricCard label="Monthly Profit" value={formatMoney(finance.monthly_profit)} color="emerald" helper={accessAllowed ? "6-hour approved view" : "Admin approval required"} locked={!accessAllowed} onRequest={requestFinance} /><MetricCard label="Team Available" value={workload.filter((w) => w.availability === "Available").length} color="cyan" helper="Ready team members" /><MetricCard label="Client Messages" value={overview.client_messages_waiting ?? messages.length ?? 0} color="zinc" helper="Waiting replies" /></div><div className="mb-6 grid gap-4 lg:grid-cols-3"><Panel title={accessAllowed ? "Revenue · Profit · Tasks (last 30 days)" : "Operations Trend (finance locked)"} className="lg:col-span-2 border-blue-500/15"><ResponsiveContainer width="100%" height={260}><LineChart data={accessAllowed ? finance.daily || [] : []}><CartesianGrid strokeDasharray="3 3" stroke="#27272A" /><XAxis dataKey="date" stroke="#71717A" fontSize={10} tickFormatter={(d) => d?.slice(5)} /><YAxis stroke="#71717A" fontSize={10} /><Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", borderRadius: 6 }} />{accessAllowed && <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} dot={false} />}{accessAllowed && <Line type="monotone" dataKey="profit" stroke="#3B82F6" strokeWidth={2} dot={false} />}<Line type="monotone" dataKey="tasks" stroke="#F59E0B" strokeWidth={2} dot={false} /></LineChart></ResponsiveContainer>{!accessAllowed && <div className="mt-3"><Empty>Revenue and profit are hidden. Request 6-hour access from Admin.</Empty></div>}</Panel><Panel title="Status Breakdown" className="border-purple-500/15"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>{statusData.map((s, i) => <Cell key={i} fill={STATUS_COLORS[s.name] || "#52525B"} />)}</Pie></PieChart></ResponsiveContainer>{statusData.length === 0 && <Empty>No project status data yet.</Empty>}</Panel></div><div className="grid gap-4 lg:grid-cols-2"><Panel title="Team Workload">{workload.length ? workload.slice(0, 5).map((w) => <div key={w.team_member_name} className="mb-2 flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"><span>{w.team_member_name}</span><span className="text-zinc-500">{w.active_tasks} active · {w.availability}</span></div>) : <Empty>No team workload data yet.</Empty>}</Panel><Panel title="Recent Activity">{activity.length ? activity.slice(0, 6).map((a) => <div key={a.id || a.created_at} className="mb-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm"><div>{a.action || "Moderator activity"}</div><div className="text-xs text-zinc-600">{formatDate(a.created_at)}</div></div>) : <Empty>No recent activity yet.</Empty>}</Panel></div></div></main></div>;
}
