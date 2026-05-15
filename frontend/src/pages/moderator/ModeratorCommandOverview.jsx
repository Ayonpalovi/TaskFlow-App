import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";

const LIVE_REFRESH_MS = 3500;

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

const STATUS_LABELS = {
  available: "available",
  active: "active",
  pending: "pending",
  submitted: "awaiting admin approval",
  awaiting_admin_approval: "awaiting admin approval",
  pending_admin_approval: "awaiting admin approval",
  admin_review: "awaiting admin approval",
  client_review: "client review",
  revision: "revision",
  completed: "completed",
  draft: "draft",
  rejected: "rejected",
};

const STATUS_COLORS = {
  available: "#71717A",
  active: "#3B82F6",
  pending: "#F59E0B",
  submitted: "#F59E0B",
  awaiting_admin_approval: "#F59E0B",
  pending_admin_approval: "#F59E0B",
  admin_review: "#F59E0B",
  client_review: "#8B5CF6",
  revision: "#EF4444",
  completed: "#10B981",
  draft: "#52525B",
  rejected: "#71717A",
};

const metricThemes = {
  blue: { border: "rgba(59,130,246,.30)", glow: "rgba(59,130,246,.10)", text: "text-blue-300", dot: "bg-blue-400" },
  amber: { border: "rgba(245,158,11,.34)", glow: "rgba(245,158,11,.11)", text: "text-amber-300", dot: "bg-amber-400" },
  emerald: { border: "rgba(16,185,129,.30)", glow: "rgba(16,185,129,.10)", text: "text-emerald-300", dot: "bg-emerald-400" },
  red: { border: "rgba(239,68,68,.32)", glow: "rgba(239,68,68,.10)", text: "text-red-300", dot: "bg-red-400" },
  purple: { border: "rgba(168,85,247,.30)", glow: "rgba(168,85,247,.10)", text: "text-purple-300", dot: "bg-purple-400" },
  cyan: { border: "rgba(6,182,212,.30)", glow: "rgba(6,182,212,.10)", text: "text-cyan-300", dot: "bg-cyan-400" },
  zinc: { border: "rgba(255,255,255,.12)", glow: "rgba(255,255,255,.045)", text: "text-zinc-100", dot: "bg-zinc-400" },
};

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function firstLetter(value) {
  return String(value || "M").charAt(0).toUpperCase();
}

function safeDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value) {
  const parsed = safeDate(value);
  if (!parsed) return "—";
  return parsed.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function statusGroup(status) {
  if (["submitted", "admin_review", "awaiting_admin_approval", "pending_admin_approval"].includes(status)) {
    return "awaiting_admin_approval";
  }
  return status || "available";
}

function statusLabel(value) {
  const key = statusGroup(value);
  return STATUS_LABELS[key] || STATUS_LABELS[value] || value || "unknown";
}

function editorName(editor) {
  return editor?.anime_name || editor?.display_name || editor?.real_name || editor?.email || "Unknown editor";
}

function clientName(client) {
  return client?.real_name || client?.display_name || client?.anime_name || client?.email || "Unknown client";
}

function buildUserMap(users) {
  return new Map(toArray(users).filter((user) => user?.id).map((user) => [user.id, user]));
}

function countRevisions(task) {
  if (Array.isArray(task?.revisions)) return task.revisions.length;
  return Number(task?.revision_count || task?.revisions_count || 0);
}

function buildDaily(tasks) {
  const rows = [];
  const today = new Date();
  for (let i = 29; i >= 0; i -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const date = day.toISOString().slice(0, 10);
    const dayTasks = toArray(tasks).filter((task) => {
      const stamp = String(task.created_at || task.updated_at || "").slice(0, 10);
      return stamp === date;
    });

    rows.push({
      date,
      tasks: dayTasks.length,
      active: dayTasks.filter((task) => ["active", "pending"].includes(statusGroup(task.status))).length,
      reviews: dayTasks.filter((task) => ["awaiting_admin_approval", "client_review"].includes(statusGroup(task.status))).length,
      revisions: dayTasks.reduce((sum, task) => sum + countRevisions(task), 0),
      completed: dayTasks.filter((task) => statusGroup(task.status) === "completed").length,
    });
  }
  return rows;
}

function buildStatusBreakdown(tasks) {
  const counts = {};
  toArray(tasks).forEach((task) => {
    const key = statusGroup(task.status || task.current_status);
    counts[key] = (counts[key] || 0) + 1;
  });
  const order = ["available", "active", "pending", "awaiting_admin_approval", "client_review", "revision", "completed", "draft", "rejected"];
  return order
    .filter((key) => counts[key] || key === "active" || key === "completed" || key === "revision")
    .map((key) => ({ name: key, value: counts[key] || 0 }));
}

function buildStats(tasks, editors, clients, requests, risk) {
  const list = toArray(tasks);
  return {
    total_projects: list.length,
    in_progress: list.filter((task) => ["active", "pending", "submitted", "awaiting_admin_approval", "client_review"].includes(statusGroup(task.status))).length,
    completed: list.filter((task) => statusGroup(task.status) === "completed").length,
    revisions: list.reduce((sum, task) => sum + countRevisions(task), 0),
    editors_count: toArray(editors).length,
    clients_count: toArray(clients).length,
    pending_requests: toArray(requests).filter((request) => request.status === "pending").length,
    deadline_risk: toArray(risk).length,
  };
}

function buildWorkload(editors, tasks) {
  return toArray(editors)
    .map((editor) => {
      const assigned = toArray(tasks).filter((task) => task.assigned_editor_id === editor.id);
      const active = assigned.filter((task) => statusGroup(task.status) === "active").length;
      const revision = assigned.filter((task) => statusGroup(task.status) === "revision").length;
      const pending = assigned.filter((task) => ["pending", "awaiting_admin_approval", "submitted"].includes(statusGroup(task.status))).length;
      const total = active + revision + pending;
      const load_pct = Math.min(100, Math.round((total / 5) * 100));

      return {
        editor,
        active,
        revision,
        pending,
        total,
        load_pct,
        status: load_pct >= 100 ? "overloaded" : load_pct >= 70 ? "busy" : "available",
      };
    })
    .sort((a, b) => b.total - a.total || editorName(a.editor).localeCompare(editorName(b.editor)));
}

function buildSatisfaction(editors, reviews) {
  const ratingsByEditor = new Map();
  toArray(reviews).forEach((review) => {
    if (!review?.editor_id || !Number(review.rating)) return;
    const ratings = ratingsByEditor.get(review.editor_id) || [];
    ratings.push(Number(review.rating));
    ratingsByEditor.set(review.editor_id, ratings);
  });

  return toArray(editors)
    .map((editor) => {
      const ratings = ratingsByEditor.get(editor.id) || [];
      const avg = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;
      return { user: editor, avg_rating: Number(avg.toFixed(2)), review_count: ratings.length };
    })
    .filter((row) => row.review_count > 0)
    .sort((a, b) => b.avg_rating - a.avg_rating || b.review_count - a.review_count);
}

function buildRevisions(tasks, editors, clients) {
  const editorMap = buildUserMap(editors);
  const clientMap = buildUserMap(clients);
  const byEditor = new Map();
  const byClient = new Map();

  toArray(tasks).forEach((task) => {
    const revisions = countRevisions(task);
    if (!revisions) return;
    if (task.assigned_editor_id) byEditor.set(task.assigned_editor_id, (byEditor.get(task.assigned_editor_id) || 0) + revisions);
    if (task.client_id) byClient.set(task.client_id, (byClient.get(task.client_id) || 0) + revisions);
  });

  const editorsRows = Array.from(byEditor.entries())
    .map(([id, revision_count]) => ({ user: editorMap.get(id) || { id, anime_name: "Unknown editor" }, revision_count }))
    .sort((a, b) => b.revision_count - a.revision_count);

  const clientRows = Array.from(byClient.entries())
    .map(([id, revision_count]) => ({ user: clientMap.get(id) || { id, real_name: "Unknown client" }, revision_count }))
    .sort((a, b) => b.revision_count - a.revision_count);

  return { editors: editorsRows, clients: clientRows };
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

function SoftMetricCard({ label, value, color = "zinc", helper }) {
  const theme = metricThemes[color] || metricThemes.zinc;

  return (
    <div
      className="relative min-h-[112px] overflow-hidden rounded-xl border bg-zinc-900/30 p-5 card-hover"
      style={{
        borderColor: theme.border,
        background: `linear-gradient(135deg, ${theme.glow}, rgba(24,24,27,.44) 58%, rgba(9,9,11,.74))`,
      }}
    >
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: theme.border }} />
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="label-xs text-zinc-500">{label}</div>
        <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
      </div>
      <div className={`font-mono text-3xl font-semibold tracking-tight ${theme.text}`}>{value}</div>
      {helper && <div className="mt-2 text-xs text-zinc-600">{helper}</div>}
    </div>
  );
}

function Panel({ children, className = "", border = "border-white/10", gradient = "from-zinc-900/30 to-zinc-950", ...props }) {
  return (
    <div {...props} className={`rounded-xl border ${border} bg-gradient-to-br ${gradient} p-5 ${className}`}>
      {children}
    </div>
  );
}

function Empty({ children, className = "" }) {
  return <div className={`rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500 ${className}`}>{children}</div>;
}

export default function ModeratorCommandOverview() {
  const { user, logout } = useAuth();
  const inFlightRef = useRef(false);
  const [tasks, setTasks] = useState([]);
  const [requests, setRequests] = useState([]);
  const [risk, setRisk] = useState([]);
  const [editors, setEditors] = useState([]);
  const [clients, setClients] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [profile, setProfile] = useState(null);
  const [mvp, setMvp] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedEditorId, setSelectedEditorId] = useState("");

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      const [tasksRes, requestsRes, riskRes, editorsRes, clientsRes, reviewsRes, profileRes, mvpRes] = await Promise.allSettled([
        api.get("/tasks"),
        api.get("/requests"),
        api.get("/stats/deadline-risk"),
        api.get("/users?role=editor"),
        api.get("/users?role=client"),
        api.get("/reviews"),
        api.get("/moderator/profile"),
        api.get("/mvp/current"),
      ]);

      if (tasksRes.status === "fulfilled") setTasks(toArray(tasksRes.value.data));
      if (requestsRes.status === "fulfilled") setRequests(toArray(requestsRes.value.data));
      if (riskRes.status === "fulfilled") setRisk(toArray(riskRes.value.data));
      if (editorsRes.status === "fulfilled") setEditors(toArray(editorsRes.value.data));
      if (clientsRes.status === "fulfilled") setClients(toArray(clientsRes.value.data));
      if (reviewsRes.status === "fulfilled") setReviews(toArray(reviewsRes.value.data));
      if (profileRes.status === "fulfilled") setProfile(profileRes.value.data || null);
      if (mvpRes.status === "fulfilled") setMvp(mvpRes.value.data || null);
      setLastUpdated(new Date());
    } finally {
      inFlightRef.current = false;
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, LIVE_REFRESH_MS);
    const refreshOnFocus = () => load();
    const refreshOnVisible = () => {
      if (document.visibilityState === "visible") load();
    };

    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("online", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("online", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [load]);

  const editorMap = useMemo(() => buildUserMap(editors), [editors]);
  const clientMap = useMemo(() => buildUserMap(clients), [clients]);
  const safeProfile = useMemo(
    () => ({
      real_name: profile?.real_name || user?.real_name || user?.display_name || user?.email || "Moderator",
      email: profile?.email || user?.email || "—",
    }),
    [profile, user]
  );

  const stats = useMemo(() => buildStats(tasks, editors, clients, requests, risk), [tasks, editors, clients, requests, risk]);
  const statusData = useMemo(() => buildStatusBreakdown(tasks), [tasks]);
  
  const trendData = useMemo(() => buildDaily(tasks), [tasks]);
  const workload = useMemo(() => buildWorkload(editors, tasks), [editors, tasks]);
  const satisfactionRows = useMemo(() => buildSatisfaction(editors, reviews), [editors, reviews]);
  const revisionRows = useMemo(() => buildRevisions(tasks, editors, clients), [tasks, editors, clients]);

  const pendingRequests = useMemo(() => {
    return toArray(requests)
      .filter((request) => request.status === "pending")
      .map((request) => ({
        ...request,
        editor: request.editor || editorMap.get(request.editor_id),
        task: tasks.find((task) => task.id === request.task_id),
      }));
  }, [requests, editorMap, tasks]);

  const editorRadarData = useMemo(() => {
    const satisfactionMap = new Map(satisfactionRows.map((item) => [item.user.id, item]));
    const revisionMap = new Map(revisionRows.editors.map((item) => [item.user.id, item]));

    return workload
      .map((item) => {
        const editorId = item.editor.id;
        const sat = satisfactionMap.get(editorId);
        const rev = revisionMap.get(editorId);
        const completedCount = toArray(tasks).filter((task) => task.assigned_editor_id === editorId && statusGroup(task.status) === "completed").length;
        const loadScore = Math.max(0, Math.min(100, 100 - Number(item.load_pct || 0)));
        const ratingScore = Math.min(100, Number(sat?.avg_rating || 0) * 20);
        const deliveryScore = Math.min(100, completedCount * 20);
        const revisionScore = Math.max(0, 100 - Number(rev?.revision_count || 0) * 20);
        const overall = Math.round((loadScore + ratingScore + deliveryScore + revisionScore) / 4);

        return {
          id: editorId,
          editor: editorName(item.editor),
          workload: loadScore,
          rating: ratingScore,
          output: deliveryScore,
          revision: revisionScore,
          overall,
          activeTasks: item.total || 0,
          loadPct: item.load_pct || 0,
          avgRating: sat?.avg_rating || 0,
          reviewCount: sat?.review_count || 0,
          revisionCount: rev?.revision_count || 0,
          status: item.status,
        };
      })
      .sort((a, b) => b.overall - a.overall || a.editor.localeCompare(b.editor));
  }, [workload, satisfactionRows, revisionRows.editors, tasks]);

  useEffect(() => {
    if (!editorRadarData.length) return;
    if (!selectedEditorId || !editorRadarData.some((item) => item.id === selectedEditorId)) {
      setSelectedEditorId(editorRadarData[0].id);
    }
  }, [editorRadarData, selectedEditorId]);

  const selectedEditorPerformance = useMemo(() => {
    return editorRadarData.find((item) => item.id === selectedEditorId) || editorRadarData[0] || null;
  }, [editorRadarData, selectedEditorId]);

  const selectedEditorRadar = useMemo(() => {
    if (!selectedEditorPerformance) return [];
    return [
      { metric: "Workload", value: selectedEditorPerformance.workload },
      { metric: "Rating", value: selectedEditorPerformance.rating },
      { metric: "Output", value: selectedEditorPerformance.output },
      { metric: "Low Revisions", value: selectedEditorPerformance.revision },
      { metric: "Overall", value: selectedEditorPerformance.overall },
    ];
  }, [selectedEditorPerformance]);

  const signOut = async () => {
    if (logout) await logout();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white lg:flex">
      <aside className="fixed left-0 top-0 hidden h-screen w-[228px] shrink-0 flex-col border-r border-white/10 bg-zinc-950 lg:flex">
        <div className="flex h-[86px] items-center border-b border-white/10 px-5">
          <NavLink to="/moderator/overview" className="flex items-center gap-3">
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
          {navItems.map(([label, to, icon]) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-md border-l-2 px-3 py-2.5 text-sm transition-all ${
                  isActive ? "border-white bg-white/10 text-white" : "border-transparent text-zinc-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <span className="w-4 text-center text-zinc-400">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <NavLink to="/moderator/profile" className="flex w-full items-center gap-3 text-left">
            <div className="relative">
              <div className="grid h-9 w-9 place-items-center rounded-full bg-zinc-800 text-sm font-medium">{firstLetter(safeProfile.real_name)}</div>
              <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-zinc-950 bg-emerald-400" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium">{safeProfile.real_name}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Moderator</div>
            </div>
          </NavLink>
          <button onClick={signOut} className="mt-4 flex items-center gap-2 text-sm text-zinc-500 hover:text-white">
            <span>↳</span>
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 lg:ml-[228px]">
        <div className="mx-auto max-w-[1480px] px-4 py-5 sm:px-6 lg:px-7 lg:py-7">
          <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Moderator / Overview</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Command Center</h1>
              <p className="mt-2 text-sm text-zinc-400">Live editor performance, workload, deadline risk, satisfaction, revisions, requests, and recent tasks.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="good">Live sync</Badge>
              <Badge>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Syncing…"}</Badge>
            </div>
          </div>

          {mvp?.editor && (
            <div className="mb-6 flex items-center gap-4 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-900/30 to-zinc-950 p-5" data-testid="moderator-mvp-card">
              <div className="text-5xl">👑</div>
              <div className="min-w-0 flex-1">
                <div className="label-xs mb-1 text-amber-400">MVP of the Month</div>
                <div className="text-2xl font-bold">{editorName(mvp.editor)}</div>
                <div className="text-sm text-zinc-400">{mvp.reason}</div>
              </div>
              <div className="text-right">
                <div className="font-mono text-3xl text-amber-400">{mvp.score}</div>
                <div className="label-xs text-zinc-500">score</div>
              </div>
            </div>
          )}

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <SoftMetricCard label="Total Projects" value={stats.total_projects} color="purple" helper="All visible project records" />
            <SoftMetricCard label="In Progress" value={stats.in_progress} color="amber" helper="Currently moving" />
            <SoftMetricCard label="Completed" value={stats.completed} color="emerald" helper="Delivered projects" />
            <SoftMetricCard label="Revisions" value={stats.revisions} color="red" helper="Total revision notes" />
            <SoftMetricCard label="Editors" value={stats.editors_count} color="cyan" helper="Creative team" />
            <SoftMetricCard label="Clients" value={stats.clients_count} color="zinc" helper="Active accounts" />
            <SoftMetricCard label="Pending Requests" value={stats.pending_requests} color="blue" helper="Editor requests waiting" />
            <SoftMetricCard label="Deadline Risk" value={stats.deadline_risk} color={stats.deadline_risk > 0 ? "red" : "emerald"} helper="Due soon or overdue" />
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <Panel className="lg:col-span-2" border="border-blue-500/15" gradient="from-blue-500/5 via-zinc-900/30 to-zinc-950">
              <div className="label-xs mb-4 text-blue-300">Operations Trend (last 30 days)</div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                  <XAxis dataKey="date" stroke="#71717A" fontSize={10} tickFormatter={(date) => date?.slice(5)} />
                  <YAxis stroke="#71717A" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", borderRadius: 6 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="tasks" stroke="#F59E0B" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="active" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="reviews" stroke="#8B5CF6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="revisions" stroke="#EF4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="completed" stroke="#10B981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>

            <Panel border="border-purple-500/15" gradient="from-purple-500/5 via-zinc-900/30 to-zinc-950">
              <Panel border="border-purple-500/15" gradient="from-purple-500/5 via-zinc-900/30 to-zinc-950">
  <div className="label-xs mb-4 text-purple-300">Status breakdown</div>

  <ResponsiveContainer width="100%" height={210}>
    <PieChart>
      <Pie
        data={visibleStatusData}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        outerRadius={72}
        label={false}
        labelLine={false}
        isAnimationActive={false}
      >
        {visibleStatusData.map((item, index) => (
          <Cell
            key={`${item.name}-${index}`}
            fill={STATUS_COLORS[statusGroup(item.name)] || "#52525B"}
          />
        ))}
      </Pie>
    </PieChart>
  </ResponsiveContainer>

  {visibleStatusData.length > 0 ? (
    <div className="mt-3 grid grid-cols-2 gap-2">
      {visibleStatusData.map((item) => (
        <div
          key={item.name}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs"
        >
          <span
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: STATUS_COLORS[statusGroup(item.name)] || "#52525B" }}
          />
          <span className="truncate text-zinc-300">{statusLabel(item.name)}</span>
          <span className="ml-auto font-mono text-zinc-400">({item.value})</span>
        </div>
      ))}
    </div>
  ) : (
    <Empty>No project status data yet.</Empty>
  )}
</Panel>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={statusData.filter((item) => Number(item.value || 0) > 0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${statusLabel(name)} (${value})`}>
                    {statusData.filter((item) => Number(item.value || 0) > 0).map((item, index) => (
                      <Cell key={`${item.name}-${index}`} fill={STATUS_COLORS[statusGroup(item.name)] || "#52525B"} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              {statusData.every((item) => Number(item.value || 0) === 0) && <Empty>No project status data yet.</Empty>}
            </Panel>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr,.9fr]">
            <Panel border="border-cyan-500/15" gradient="from-cyan-500/5 via-zinc-900/30 to-zinc-950">
              <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Editor Performance Overview</h2>
                  <p className="mt-1 text-sm text-zinc-500">Moderator can track each editor with the same radar-style analytics as the admin overview.</p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={selectedEditorId}
                    onChange={(event) => setSelectedEditorId(event.target.value)}
                    className="rounded-md border border-cyan-500/20 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-cyan-400 focus:outline-none"
                  >
                    {editorRadarData.map((item) => (
                      <option key={item.id} value={item.id}>{item.editor}</option>
                    ))}
                  </select>
                  <Badge tone="blue">Radar</Badge>
                </div>
              </div>

              {selectedEditorRadar.length === 0 ? (
                <Empty className="p-8 text-center">No editor performance data yet.</Empty>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
                    <div className="rounded-lg border border-cyan-500/15 bg-black/20 p-3"><div className="label-xs text-zinc-500">Editor</div><div className="truncate text-sm font-semibold">{selectedEditorPerformance.editor}</div></div>
                    <div className="rounded-lg border border-cyan-500/15 bg-black/20 p-3"><div className="label-xs text-zinc-500">Overall</div><div className="font-mono text-cyan-300">{selectedEditorPerformance.overall}</div></div>
                    <div className="rounded-lg border border-cyan-500/15 bg-black/20 p-3"><div className="label-xs text-zinc-500">Active</div><div className="font-mono text-blue-300">{selectedEditorPerformance.activeTasks}</div></div>
                    <div className="rounded-lg border border-cyan-500/15 bg-black/20 p-3"><div className="label-xs text-zinc-500">Rating</div><div className="font-mono text-purple-300">{Number(selectedEditorPerformance.avgRating || 0).toFixed(1)} ★</div></div>
                    <div className="rounded-lg border border-cyan-500/15 bg-black/20 p-3"><div className="label-xs text-zinc-500">Revisions</div><div className="font-mono text-amber-300">{selectedEditorPerformance.revisionCount}</div></div>
                  </div>

                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={selectedEditorRadar} outerRadius={105}>
                      <PolarGrid stroke="#27272A" />
                      <PolarAngleAxis dataKey="metric" tick={{ fill: "#A1A1AA", fontSize: 11 }} />
                      <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fill: "#71717A", fontSize: 10 }} stroke="#3F3F46" />
                      <Radar name={selectedEditorPerformance.editor} dataKey="value" stroke="#06B6D4" fill="#06B6D4" fillOpacity={0.22} strokeWidth={2} />
                      <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", borderRadius: 6 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </>
              )}
            </Panel>

            <Panel border="border-cyan-500/15" gradient="from-cyan-500/5 via-zinc-900/30 to-zinc-950">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Select editor</h2>
                <Badge>{editorRadarData.length} editors</Badge>
              </div>
              <div className="space-y-3">
                {editorRadarData.length === 0 && <div className="text-sm text-zinc-500">No editors to compare yet.</div>}
                {editorRadarData.map((item) => {
                  const selected = item.id === selectedEditorId;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setSelectedEditorId(item.id)}
                      className={`w-full rounded-lg border bg-black/20 p-3 text-left transition-all ${selected ? "border-cyan-400/60 shadow-[0_0_25px_rgba(6,182,212,.12)]" : "border-white/10 hover:border-cyan-500/30"}`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-medium">{item.editor}</span>
                        <span className={`font-mono ${selected ? "text-cyan-300" : "text-zinc-400"}`}>{item.overall}</span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-[10px] text-zinc-500">
                        <span>Work {item.workload}</span>
                        <span>Rate {item.rating}</span>
                        <span>Out {item.output}</span>
                        <span>Rev {item.revision}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Panel>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Panel border="border-red-500/15" gradient="from-red-500/5 via-zinc-900/30 to-zinc-950" data-testid="moderator-deadline-risk-panel">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Deadline risk</h2>
                <Badge tone={risk.length > 0 ? "bad" : "good"}>{risk.length} at risk</Badge>
              </div>
              <div className="space-y-2">
                {risk.length === 0 && <div className="text-sm text-zinc-500">All deadlines healthy.</div>}
                {risk.slice(0, 6).map((item) => (
                  <div
                    key={item.task_id}
                    className="flex items-center justify-between rounded-md border border-white/10 bg-black/20 p-3"
                    style={{ borderLeftWidth: 3, borderLeftColor: item.risk === "overdue" ? "#EF4444" : item.risk === "high" ? "#F59E0B" : "#3B82F6" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm">{item.title}</div>
                      <div className="font-mono text-xs text-zinc-500">Due {String(item.deadline || "").slice(0, 10)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm" style={{ color: item.risk === "overdue" ? "#EF4444" : item.risk === "high" ? "#F59E0B" : "#3B82F6" }}>
                        {Number(item.hours_left) < 0 ? `${Math.abs(Number(item.hours_left)).toFixed(1)}h late` : `${Number(item.hours_left || 0).toFixed(1)}h left`}
                      </div>
                      <Badge tone={item.risk === "overdue" || item.risk === "high" ? "bad" : "warn"}>{item.risk}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel border="border-emerald-500/15" gradient="from-emerald-500/5 via-zinc-900/30 to-zinc-950" data-testid="moderator-workload-panel">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Editor workload</h2>
                <Badge>{workload.length} editors</Badge>
              </div>
              <div className="space-y-3">
                {workload.length === 0 && <div className="text-sm text-zinc-500">No workload data yet.</div>}
                {workload.map((item) => (
                  <div key={item.editor.id} className="flex items-center gap-3">
                    {item.editor.avatar_url && <img src={item.editor.avatar_url} className="h-9 w-9 rounded-md object-cover" alt="" />}
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="truncate">{editorName(item.editor)}</span>
                        <span className="font-mono text-xs">{item.total} active</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${item.load_pct}%`,
                            backgroundColor: item.load_pct >= 100 ? "#EF4444" : item.load_pct >= 70 ? "#F59E0B" : "#10B981",
                          }}
                        />
                      </div>
                    </div>
                    <Badge tone={item.status === "overloaded" ? "bad" : item.status === "busy" ? "warn" : "good"}>{item.status}</Badge>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Panel border="border-purple-500/15" gradient="from-purple-500/5 via-zinc-900/30 to-zinc-950">
              <h2 className="mb-4 text-lg font-semibold">Client satisfaction</h2>
              <div className="space-y-2">
                {satisfactionRows.slice(0, 5).map((item) => (
                  <div key={item.user.id} className="flex items-center justify-between border-b border-white/5 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      {item.user.avatar_url && <img src={item.user.avatar_url} className="h-7 w-7 rounded-md object-cover" alt="" />}
                      <span>{editorName(item.user)}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm text-purple-300">{item.avg_rating} ★</div>
                      <div className="label-xs text-zinc-500">{item.review_count} reviews</div>
                    </div>
                  </div>
                ))}
                {satisfactionRows.length === 0 && <div className="text-sm text-zinc-500">No reviews yet.</div>}
              </div>
            </Panel>

            <Panel border="border-amber-500/15" gradient="from-amber-500/5 via-zinc-900/30 to-zinc-950" data-testid="moderator-revision-counter-panel">
              <h2 className="mb-4 text-lg font-semibold">Revision counter</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="label-xs mb-2 text-amber-300">Top editors (revisions)</div>
                  {revisionRows.editors.slice(0, 5).map((item) => (
                    <div key={item.user.id} className="flex justify-between py-1">
                      <span className="truncate">{editorName(item.user)}</span>
                      <span className="font-mono">{item.revision_count}</span>
                    </div>
                  ))}
                  {revisionRows.editors.length === 0 && <div className="text-xs text-zinc-500">None</div>}
                </div>
                <div>
                  <div className="label-xs mb-2 text-amber-300">Top clients (revisions)</div>
                  {revisionRows.clients.slice(0, 5).map((item) => (
                    <div key={item.user.id} className="flex justify-between py-1">
                      <span className="truncate">{clientName(item.user)}</span>
                      <span className="font-mono">{item.revision_count}</span>
                    </div>
                  ))}
                  {revisionRows.clients.length === 0 && <div className="text-xs text-zinc-500">None</div>}
                </div>
              </div>
            </Panel>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel border="border-blue-500/15" gradient="from-blue-500/5 via-zinc-900/30 to-zinc-950">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Pending editor requests</h2>
                <Badge tone="warn">{pendingRequests.length}</Badge>
              </div>
              <div className="space-y-3">
                {pendingRequests.length === 0 && <div className="text-sm text-zinc-500">No pending requests.</div>}
                {pendingRequests.map((request) => (
                  <div key={request.id} className="flex items-center gap-3 rounded-md border border-white/10 bg-black/20 p-3">
                    {request.editor?.avatar_url && <img src={request.editor.avatar_url} className="h-9 w-9 rounded-md object-cover" alt="" />}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{editorName(request.editor)}</div>
                      <div className="truncate text-xs text-zinc-500">Requested: {request.task?.title || "—"}</div>
                    </div>
                    <div className="text-right">
                      <Badge tone="warn">pending</Badge>
                      <div className="mt-1 text-[10px] text-zinc-600">Admin approval</div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel border="border-zinc-700/40" gradient="from-zinc-900/40 via-zinc-900/30 to-zinc-950">
              <h2 className="mb-4 text-lg font-semibold">Recent tasks</h2>
              <div className="space-y-2">
                {tasks.slice(0, 8).map((task) => (
                  <div key={task.id} className="flex items-center justify-between border-b border-white/5 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{task.title}</div>
                      <div className="text-xs text-zinc-500">{task.project_type}</div>
                    </div>
                    <Badge tone={statusGroup(task.status) === "completed" ? "good" : statusGroup(task.status) === "revision" ? "bad" : statusGroup(task.status) === "available" ? "default" : "warn"}>{statusLabel(task.status)}</Badge>
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
