import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";
import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const LIVE_REFRESH_MS = 1000;

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
  submitted: "#06B6D4",
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
  submitted: "submitted",
  client_review: "client review",
  revision: "revision",
  completed: "completed",
  draft: "draft",
  rejected: "rejected",
};

const badgeTone = {
  default: "border-white/10 bg-white/5 text-zinc-300",
  good: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
  warn: "border-amber-500/20 bg-amber-500/10 text-amber-300",
  bad: "border-red-500/20 bg-red-500/10 text-red-300",
  blue: "border-blue-500/20 bg-blue-500/10 text-blue-300",
  cyan: "border-cyan-500/20 bg-cyan-500/10 text-cyan-300",
  purple: "border-purple-500/20 bg-purple-500/10 text-purple-300",
};

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function groupStatus(status) {
  if (["admin_review", "awaiting_admin_approval", "pending_admin_approval"].includes(status)) return "awaiting_admin_approval";
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

function nameOf(user, fallback = "Unknown") {
  return user?.anime_name || user?.display_name || user?.real_name || user?.email || fallback;
}

function metricColor(status) {
  if (status === "overloaded" || status === "revision") return "bad";
  if (["busy", "pending", "awaiting_admin_approval", "submitted", "client_review"].includes(status)) return "warn";
  if (["completed", "available"].includes(status)) return "good";
  return "default";
}

function taskDate(task) {
  const raw = task?.created_at || task?.updated_at || task?.deadline;
  if (!raw) return null;
  return String(raw).slice(0, 10);
}

function isPendingProject(status) {
  return ["available", "pending", "awaiting_admin_approval", "submitted", "client_review"].includes(groupStatus(status));
}

function Card({ title, value, helper, tone = "blue" }) {
  const toneClass = {
    blue: "from-blue-500/10 border-blue-500/20 text-blue-300",
    cyan: "from-cyan-500/10 border-cyan-500/20 text-cyan-300",
    purple: "from-purple-500/10 border-purple-500/20 text-purple-300",
    emerald: "from-emerald-500/10 border-emerald-500/20 text-emerald-300",
    amber: "from-amber-500/10 border-amber-500/20 text-amber-300",
    red: "from-red-500/10 border-red-500/20 text-red-300",
    zinc: "from-zinc-500/10 border-white/10 text-zinc-100",
  }[tone] || "from-blue-500/10 border-blue-500/20 text-blue-300";

  return (
    <div className={`rounded-xl border bg-gradient-to-br ${toneClass} via-zinc-900/40 to-zinc-950 p-5`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-500">{title}</div>
      <div className="mt-4 font-mono text-3xl font-semibold">{value}</div>
      {helper && <div className="mt-2 text-xs text-zinc-500">{helper}</div>}
    </div>
  );
}

function Panel({ children, className = "", border = "border-white/10", gradient = "from-zinc-900/40 via-zinc-900/25 to-zinc-950" }) {
  return <div className={`rounded-xl border ${border} bg-gradient-to-br ${gradient} p-5 ${className}`}>{children}</div>;
}

function Badge({ children, tone = "default" }) {
  return <span className={`rounded-full border px-2.5 py-1 text-[11px] ${badgeTone[tone] || badgeTone.default}`}>{children}</span>;
}

function StatusBreakdownPanel({ statusData }) {
  return (
    <Panel border="border-purple-500/15" gradient="from-purple-500/5 via-zinc-900/30 to-zinc-950">
      <div className="mb-4 flex items-center justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-purple-300">Status breakdown</div>
        <Badge>{statusData.length} statuses</Badge>
      </div>
      {statusData.length > 0 ? (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={82} label={({ name, value }) => `${labelStatus(name)} (${value})`}>
              {statusData.map((item, index) => <Cell key={`${item.name}-${index}`} fill={statusColors[groupStatus(item.name)] || "#52525B"} />)}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", borderRadius: 6 }} />
          </PieChart>
        </ResponsiveContainer>
      ) : <div className="text-sm text-zinc-500">No project status data yet.</div>}
    </Panel>
  );
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
  const [lastUpdated, setLastUpdated] = useState(null);
  const [selectedEditorId, setSelectedEditorId] = useState("");

  const load = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      const [tasksRes, requestsRes, riskRes, editorsRes, clientsRes, reviewsRes, profileRes] = await Promise.allSettled([
        api.get("/tasks"),
        api.get("/requests"),
        api.get("/stats/deadline-risk"),
        api.get("/users?role=editor"),
        api.get("/users?role=client"),
        api.get("/reviews"),
        api.get("/moderator/profile"),
      ]);

      if (tasksRes.status === "fulfilled") setTasks(toArray(tasksRes.value.data));
      if (requestsRes.status === "fulfilled") setRequests(toArray(requestsRes.value.data));
      if (riskRes.status === "fulfilled") setRisk(toArray(riskRes.value.data));
      if (editorsRes.status === "fulfilled") setEditors(toArray(editorsRes.value.data));
      if (clientsRes.status === "fulfilled") setClients(toArray(clientsRes.value.data));
      if (reviewsRes.status === "fulfilled") setReviews(toArray(reviewsRes.value.data));
      if (profileRes.status === "fulfilled") setProfile(profileRes.value.data || null);
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
    document.addEventListener("visibilitychange", refreshOnVisible);

    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnVisible);
    };
  }, [load]);

  const editorById = useMemo(() => new Map(toArray(editors).map((editor) => [editor.id, editor])), [editors]);
  const clientById = useMemo(() => new Map(toArray(clients).map((client) => [client.id, client])), [clients]);
  const pendingRequests = useMemo(() => toArray(requests).filter((request) => request.status === "pending"), [requests]);

  const statusData = useMemo(() => {
    const counts = {};
    toArray(tasks).forEach((task) => {
      const key = groupStatus(task.status || task.current_status);
      counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [tasks]);

  const projectAnalytics = useMemo(() => {
    const today = new Date();
    const days = {};
    for (let i = 29; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(today.getDate() - i);
      const key = date.toISOString().slice(0, 10);
      days[key] = { date: key, total_projects: 0, completed_projects: 0, pending_projects: 0 };
    }

    toArray(tasks).forEach((task) => {
      const day = taskDate(task);
      if (!day || !days[day]) return;
      days[day].total_projects += 1;
      if (groupStatus(task.status) === "completed") days[day].completed_projects += 1;
      if (isPendingProject(task.status)) days[day].pending_projects += 1;
    });

    return Object.values(days);
  }, [tasks]);

  const stats = useMemo(() => {
    const list = toArray(tasks);
    const progressStatuses = new Set(["active", "pending", "submitted", "client_review", "awaiting_admin_approval"]);
    return {
      total: list.length,
      progress: list.filter((task) => progressStatuses.has(groupStatus(task.status))).length,
      completed: list.filter((task) => groupStatus(task.status) === "completed").length,
      revisions: list.reduce((sum, task) => sum + countRevisions(task), 0),
      editors: editors.length,
      clients: clients.length,
      pending: pendingRequests.length,
      deadlineRisk: risk.length,
    };
  }, [tasks, editors.length, clients.length, pendingRequests.length, risk.length]);

  const workload = useMemo(() => {
    return toArray(editors).map((editor) => {
      const assigned = toArray(tasks).filter((task) => task.assigned_editor_id === editor.id);
      const active = assigned.filter((task) => groupStatus(task.status) === "active").length;
      const revision = assigned.filter((task) => groupStatus(task.status) === "revision").length;
      const pending = assigned.filter((task) => groupStatus(task.status) === "pending").length;
      const total = active + revision + pending;
      const loadPct = Math.min(100, Math.round((total / 5) * 100));
      return {
        editor,
        active,
        revision,
        pending,
        total,
        load_pct: loadPct,
        status: loadPct >= 100 ? "overloaded" : loadPct >= 70 ? "busy" : "available",
      };
    }).sort((a, b) => b.total - a.total);
  }, [editors, tasks]);

  const satisfaction = useMemo(() => {
    const byEditor = new Map();
    const byClient = new Map();

    toArray(reviews).forEach((review) => {
      if (review.editor_id) byEditor.set(review.editor_id, [...(byEditor.get(review.editor_id) || []), Number(review.rating || 0)]);
      if (review.client_id) byClient.set(review.client_id, [...(byClient.get(review.client_id) || []), Number(review.rating || 0)]);
    });

    const buildRows = (ratingMap, userMap) => Array.from(ratingMap.entries())
      .map(([id, ratings]) => {
        const userRecord = userMap.get(id) || { id, anime_name: "Unknown" };
        const avg = ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : 0;
        return { user: userRecord, avg_rating: Number(avg.toFixed(2)), review_count: ratings.length };
      })
      .sort((a, b) => b.avg_rating - a.avg_rating);

    return {
      editors: buildRows(byEditor, editorById),
      clients: buildRows(byClient, clientById),
    };
  }, [reviews, editorById, clientById]);

  const revisions = useMemo(() => {
    const byEditor = new Map();
    const byClient = new Map();

    toArray(tasks).forEach((task) => {
      const revs = countRevisions(task);
      if (!revs) return;
      if (task.assigned_editor_id) byEditor.set(task.assigned_editor_id, (byEditor.get(task.assigned_editor_id) || 0) + revs);
      if (task.client_id) byClient.set(task.client_id, (byClient.get(task.client_id) || 0) + revs);
    });

    const buildRows = (revisionMap, userMap) => Array.from(revisionMap.entries())
      .map(([id, revisionCount]) => ({ user: userMap.get(id) || { id, anime_name: "Unknown" }, revision_count: revisionCount }))
      .sort((a, b) => b.revision_count - a.revision_count);

    return {
      editors: buildRows(byEditor, editorById),
      clients: buildRows(byClient, clientById),
    };
  }, [tasks, editorById, clientById]);

  const editorRadarData = useMemo(() => {
    const satisfactionMap = new Map(satisfaction.editors.map((item) => [item.user.id, item]));
    const revisionMap = new Map(revisions.editors.map((item) => [item.user.id, item]));

    return workload.map((item) => {
      const editorId = item.editor.id;
      const sat = satisfactionMap.get(editorId);
      const rev = revisionMap.get(editorId);
      const workloadScore = Math.max(0, Math.min(100, 100 - Number(item.load_pct || 0)));
      const ratingScore = Math.min(100, Number(sat?.avg_rating || 0) * 20);
      const outputScore = Math.min(100, Number(item.total || 0) * 20);
      const revisionScore = Math.max(0, 100 - Number(rev?.revision_count || 0) * 20);
      const overall = Math.round((workloadScore + ratingScore + outputScore + revisionScore) / 4);

      return {
        id: editorId,
        editor: nameOf(item.editor, "Unknown editor"),
        workload: workloadScore,
        rating: ratingScore,
        output: outputScore,
        revision: revisionScore,
        overall,
        activeTasks: item.total || 0,
        loadPct: item.load_pct || 0,
        avgRating: sat?.avg_rating || 0,
        reviewCount: sat?.review_count || 0,
        revisionCount: rev?.revision_count || 0,
        status: item.status,
      };
    }).sort((a, b) => b.overall - a.overall);
  }, [workload, satisfaction, revisions]);

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

  const safeName = profile?.real_name || user?.real_name || user?.display_name || user?.email || "Moderator";

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
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Moderator / Overview</div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Command Center</h1>
              <p className="mt-2 text-sm text-zinc-400">Live editor performance, workload, deadline risk, requests, and recent tasks.</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="good">Real-time sync</Badge>
              <Badge>{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : "Syncing"}</Badge>
            </div>
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <Card title="Total Projects" value={stats.total} helper="All visible project records" tone="purple" />
            <Card title="In Progress" value={stats.progress} helper="Currently moving" tone="amber" />
            <Card title="Completed" value={stats.completed} helper="Delivered projects" tone="emerald" />
            <Card title="Revisions" value={stats.revisions} helper="Total revision notes" tone="red" />
            <Card title="Editors" value={stats.editors} helper="Creative team" tone="cyan" />
            <Card title="Clients" value={stats.clients} helper="Active accounts" tone="zinc" />
            <Card title="Pending Requests" value={stats.pending} helper="Editor requests waiting" tone="blue" />
            <Card title="Deadline Risk" value={stats.deadlineRisk} helper="Due soon or overdue" tone={stats.deadlineRisk > 0 ? "red" : "emerald"} />
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-3">
            <Panel className="lg:col-span-2" border="border-blue-500/15" gradient="from-blue-500/5 via-zinc-900/30 to-zinc-950">
              <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.25em] text-blue-300">Projects · Completed · Pending (last 30 days)</div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={projectAnalytics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                  <XAxis dataKey="date" stroke="#71717A" fontSize={10} tickFormatter={(date) => String(date).slice(5)} />
                  <YAxis stroke="#71717A" fontSize={10} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", borderRadius: 6 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="total_projects" name="total projects" stroke="#3B82F6" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="completed_projects" name="completed projects" stroke="#10B981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pending_projects" name="pending projects" stroke="#F59E0B" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Panel>
            <StatusBreakdownPanel statusData={statusData} />
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-[1.1fr,.9fr]">
            <Panel border="border-cyan-500/15" gradient="from-cyan-500/5 via-zinc-900/30 to-zinc-950">
              <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Editor Performance Overview</h2>
                  <p className="mt-1 text-sm text-zinc-500">Select one editor to view their radar performance individually.</p>
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
                  <Badge tone="cyan">Radar</Badge>
                </div>
              </div>

              {selectedEditorRadar.length === 0 ? (
                <div className="rounded-lg border border-dashed border-cyan-500/20 p-8 text-center text-sm text-zinc-500">No editor performance data yet.</div>
              ) : (
                <>
                  <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
                    <div className="rounded-lg border border-cyan-500/15 bg-black/20 p-3"><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Editor</div><div className="truncate text-sm font-semibold">{selectedEditorPerformance.editor}</div></div>
                    <div className="rounded-lg border border-cyan-500/15 bg-black/20 p-3"><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Overall</div><div className="font-mono text-cyan-300">{selectedEditorPerformance.overall}</div></div>
                    <div className="rounded-lg border border-cyan-500/15 bg-black/20 p-3"><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Active</div><div className="font-mono text-blue-300">{selectedEditorPerformance.activeTasks}</div></div>
                    <div className="rounded-lg border border-cyan-500/15 bg-black/20 p-3"><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Rating</div><div className="font-mono text-purple-300">{Number(selectedEditorPerformance.avgRating || 0).toFixed(1)} ★</div></div>
                    <div className="rounded-lg border border-cyan-500/15 bg-black/20 p-3"><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">Revisions</div><div className="font-mono text-amber-300">{selectedEditorPerformance.revisionCount}</div></div>
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
            <Panel border="border-red-500/15" gradient="from-red-500/5 via-zinc-900/30 to-zinc-950">
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
                      <div className="font-mono text-xs text-zinc-500">Due {item.deadline?.slice(0, 10)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm" style={{ color: item.risk === "overdue" ? "#EF4444" : item.risk === "high" ? "#F59E0B" : "#3B82F6" }}>
                        {item.hours_left < 0 ? `${Math.abs(item.hours_left).toFixed(1)}h late` : `${item.hours_left.toFixed(1)}h left`}
                      </div>
                      <Badge tone={item.risk === "overdue" || item.risk === "high" ? "bad" : "warn"}>{item.risk}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel border="border-emerald-500/15" gradient="from-emerald-500/5 via-zinc-900/30 to-zinc-950">
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
                        <span className="truncate">{nameOf(item.editor, "Unknown editor")}</span>
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
                    <Badge tone={metricColor(item.status)}>{item.status}</Badge>
                  </div>
                ))}
              </div>
            </Panel>
          </div>

          <div className="mb-6 grid gap-4 lg:grid-cols-2">
            <Panel border="border-purple-500/15" gradient="from-purple-500/5 via-zinc-900/30 to-zinc-950">
              <h2 className="mb-4 text-lg font-semibold">Client satisfaction</h2>
              <div className="space-y-2">
                {satisfaction.editors.slice(0, 5).map((item) => (
                  <div key={item.user.id} className="flex items-center justify-between border-b border-white/5 py-2">
                    <div className="flex items-center gap-2 text-sm">
                      {item.user.avatar_url && <img src={item.user.avatar_url} className="h-7 w-7 rounded-md object-cover" alt="" />}
                      <span>{nameOf(item.user, "Unknown editor")}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm text-purple-300">{item.avg_rating} ★</div>
                      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">{item.review_count} reviews</div>
                    </div>
                  </div>
                ))}
                {satisfaction.editors.length === 0 && <div className="text-sm text-zinc-500">No reviews yet.</div>}
              </div>
            </Panel>

            <Panel border="border-amber-500/15" gradient="from-amber-500/5 via-zinc-900/30 to-zinc-950">
              <h2 className="mb-4 text-lg font-semibold">Revision counter</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">Top editors (revisions)</div>
                  {revisions.editors.slice(0, 5).map((item) => (
                    <div key={item.user.id} className="flex justify-between py-1">
                      <span className="truncate">{nameOf(item.user, "Unknown editor")}</span>
                      <span className="font-mono">{item.revision_count}</span>
                    </div>
                  ))}
                  {revisions.editors.length === 0 && <div className="text-xs text-zinc-500">None</div>}
                </div>
                <div>
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-amber-300">Top clients (revisions)</div>
                  {revisions.clients.slice(0, 5).map((item) => (
                    <div key={item.user.id} className="flex justify-between py-1">
                      <span className="truncate">{nameOf(item.user, "Unknown client")}</span>
                      <span className="font-mono">{item.revision_count}</span>
                    </div>
                  ))}
                  {revisions.clients.length === 0 && <div className="text-xs text-zinc-500">None</div>}
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
                {pendingRequests.slice(0, 6).map((request) => {
                  const task = tasks.find((item) => item.id === request.task_id);
                  const editor = editorById.get(request.editor_id);
                  return (
                    <div key={request.id} className="flex items-center gap-3 rounded-md border border-white/10 bg-black/20 p-3">
                      {editor?.avatar_url && <img src={editor.avatar_url} className="h-9 w-9 rounded-md object-cover" alt="" />}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{nameOf(editor, request.editor_anime_name || "Unknown editor")}</div>
                        <div className="truncate text-xs text-zinc-500">Requested: {task?.title || "—"}</div>
                      </div>
                      <Badge tone="warn">waiting</Badge>
                    </div>
                  );
                })}
              </div>
            </Panel>

            <Panel border="border-zinc-700/40" gradient="from-zinc-900/40 via-zinc-900/30 to-zinc-950">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recent tasks</h2>
                <Badge>{tasks.length}</Badge>
              </div>
              <div className="space-y-2">
                {tasks.slice(0, 8).map((task) => (
                  <div key={task.id} className="flex items-center justify-between border-b border-white/5 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{task.title}</div>
                      <div className="text-xs text-zinc-500">{task.project_type || "Project"}</div>
                    </div>
                    <Badge tone={metricColor(groupStatus(task.status))}>{labelStatus(task.status)}</Badge>
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
