import { useEffect, useMemo, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api } from "../lib/api";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis
} from "recharts";

const STATUS_COLORS = {
  available: "#71717A", active: "#3B82F6", pending: "#F59E0B",
  revision: "#EF4444", completed: "#10B981", draft: "#52525B",
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

function SoftMetricCard({ label, value, color = "zinc", helper }) {
  const theme = metricThemes[color] || metricThemes.zinc;

  return (
    <div
      className="relative overflow-hidden border rounded-xl p-5 bg-zinc-900/30 min-h-[112px] card-hover"
      style={{
        borderColor: theme.border,
        background: `linear-gradient(135deg, ${theme.glow}, rgba(24,24,27,.44) 58%, rgba(9,9,11,.74))`,
      }}
    >
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: theme.border }} />
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="label-xs text-zinc-500">{label}</div>
        <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
      </div>
      <div className={`font-mono text-3xl font-semibold tracking-tight ${theme.text}`}>{value}</div>
      {helper && <div className="text-xs text-zinc-600 mt-2">{helper}</div>}
    </div>
  );
}

function Panel({ children, className = "", border = "border-white/10", gradient = "from-zinc-900/30 to-zinc-950" }) {
  return (
    <div className={`border ${border} rounded-xl p-5 bg-gradient-to-br ${gradient} ${className}`}>
      {children}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState(null);
  const [reqs, setReqs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [risk, setRisk] = useState([]);
  const [workload, setWorkload] = useState([]);
  const [satisfaction, setSatisfaction] = useState(null);
  const [revisions, setRevisions] = useState(null);
  const [mvp, setMvp] = useState(null);
  const [selectedEditorId, setSelectedEditorId] = useState("");

  const load = async () => {
    const [s, tr, t, r, dr, wl, sa, rv, m] = await Promise.all([
      api.get("/stats/admin"), api.get("/stats/trends"), api.get("/tasks"),
      api.get("/requests"), api.get("/stats/deadline-risk"),
      api.get("/stats/workload"), api.get("/stats/satisfaction"),
      api.get("/stats/revisions"), api.get("/mvp/current"),
    ]);
    setStats(s.data); setTrends(tr.data); setTasks(t.data);
    setReqs(r.data.filter(x => x.status === "pending"));
    setRisk(dr.data); setWorkload(wl.data); setSatisfaction(sa.data); setRevisions(rv.data);
    setMvp(m.data);
  };
  useEffect(() => { load(); }, []);

  const approve = async (id) => { await api.post(`/requests/${id}/approve`); load(); };
  const reject  = async (id) => { await api.post(`/requests/${id}/reject`); load(); };

  const editorRadarData = useMemo(() => {
    const satisfactionMap = new Map((satisfaction?.editors || []).map((item) => [item.user.id, item]));
    const revisionMap = new Map((revisions?.editors || []).map((item) => [item.user.id, item]));

    return workload.map((item) => {
      const editorId = item.editor.id;
      const sat = satisfactionMap.get(editorId);
      const rev = revisionMap.get(editorId);
      const loadScore = Math.max(0, Math.min(100, 100 - Number(item.load_pct || 0)));
      const ratingScore = Math.min(100, Number(sat?.avg_rating || 0) * 20);
      const deliveryScore = Math.min(100, Number(item.total || 0) * 20);
      const revisionScore = Math.max(0, 100 - Number(rev?.revision_count || 0) * 20);
      const overall = Math.round((loadScore + ratingScore + deliveryScore + revisionScore) / 4);

      return {
        id: editorId,
        editor: item.editor.anime_name,
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

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Overview" title="Command Center" subtitle="Pipeline health, revenue, satisfaction, and risk." />

      {/* MVP of the Month */}
      {mvp && mvp.editor && (
        <div className="border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-zinc-900/30 to-zinc-950 rounded-xl p-5 mb-6 flex items-center gap-4" data-testid="mvp-card">
          <div className="text-5xl">👑</div>
          <div className="flex-1 min-w-0">
            <div className="label-xs text-amber-400 mb-1">MVP of the Month</div>
            <div className="text-2xl font-bold">{mvp.editor.anime_name}</div>
            <div className="text-sm text-zinc-400">{mvp.reason}</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-3xl text-amber-400">{mvp.score}</div>
            <div className="label-xs text-zinc-500">score</div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <SoftMetricCard label="Total Projects" value={stats?.total_projects ?? "—"} color="purple" helper="All project records" />
        <SoftMetricCard label="In Progress" value={stats?.in_progress ?? "—"} color="amber" helper="Currently moving" />
        <SoftMetricCard label="Completed" value={stats?.completed ?? "—"} color="emerald" helper="Delivered projects" />
        <SoftMetricCard label="Revisions" value={stats?.revisions ?? "—"} color="red" helper="Needs changes" />
        <SoftMetricCard label="Monthly Revenue" value={`$${(stats?.monthly_revenue ?? 0).toLocaleString()}`} color="blue" helper="This month" />
        <SoftMetricCard label="Monthly Profit" value={`$${(stats?.monthly_profit ?? 0).toLocaleString()}`} color="emerald" helper="After costs" />
        <SoftMetricCard label="Editors" value={stats?.editors_count ?? "—"} color="cyan" helper="Creative team" />
        <SoftMetricCard label="Clients" value={stats?.clients_count ?? "—"} color="zinc" helper="Active accounts" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <Panel className="lg:col-span-2" border="border-blue-500/15" gradient="from-blue-500/5 via-zinc-900/30 to-zinc-950">
          <div className="label-xs text-blue-300 mb-4">Revenue · Profit · Tasks (last 30 days)</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={trends?.daily || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
              <XAxis dataKey="date" stroke="#71717A" fontSize={10} tickFormatter={(d) => d?.slice(5)} />
              <YAxis stroke="#71717A" fontSize={10} />
              <Tooltip contentStyle={{ backgroundColor: "#18181B", border: "1px solid #27272A", borderRadius: 6 }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="profit" stroke="#3B82F6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tasks" stroke="#F59E0B" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>
        <Panel border="border-purple-500/15" gradient="from-purple-500/5 via-zinc-900/30 to-zinc-950">
          <div className="label-xs text-purple-300 mb-4">Status breakdown</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={trends?.status_breakdown || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                {(trends?.status_breakdown || []).map((s, i) => (
                  <Cell key={i} fill={STATUS_COLORS[s.name] || "#52525B"} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Editor Radar */}
      <div className="grid lg:grid-cols-[1.1fr,.9fr] gap-4 mb-6">
        <Panel border="border-cyan-500/15" gradient="from-cyan-500/5 via-zinc-900/30 to-zinc-950">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-semibold">Editor Performance Overview</h2>
              <p className="text-sm text-zinc-500 mt-1">Select one editor to view their radar performance individually.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={selectedEditorId}
                onChange={(event) => setSelectedEditorId(event.target.value)}
                className="bg-zinc-950 border border-cyan-500/20 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-400"
              >
                {editorRadarData.map((item) => (
                  <option key={item.id} value={item.id}>{item.editor}</option>
                ))}
              </select>
              <Badge tone="blue">Radar</Badge>
            </div>
          </div>
          {selectedEditorRadar.length === 0 ? (
            <div className="border border-dashed border-cyan-500/20 rounded-lg p-8 text-center text-sm text-zinc-500">No editor performance data yet.</div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
                <div className="rounded-lg border border-cyan-500/15 bg-black/20 p-3"><div className="label-xs text-zinc-500">Editor</div><div className="text-sm font-semibold truncate">{selectedEditorPerformance.editor}</div></div>
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
          <div className="flex items-center justify-between mb-4">
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
                  className={`w-full text-left border rounded-lg p-3 bg-black/20 transition-all ${selected ? "border-cyan-400/60 shadow-[0_0_25px_rgba(6,182,212,.12)]" : "border-white/10 hover:border-cyan-500/30"}`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <span className="text-sm font-medium truncate">{item.editor}</span>
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

      {/* Risk + Workload */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Panel border="border-red-500/15" gradient="from-red-500/5 via-zinc-900/30 to-zinc-950" data-testid="deadline-risk-panel">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Deadline risk</h2>
            <Badge tone={risk.length > 0 ? "bad" : "good"}>{risk.length} at risk</Badge>
          </div>
          <div className="space-y-2">
            {risk.length === 0 && <div className="text-sm text-zinc-500">All deadlines healthy.</div>}
            {risk.slice(0, 6).map(r => (
              <div key={r.task_id} className="flex items-center justify-between p-3 border border-white/10 rounded-md bg-black/20" data-testid={`risk-task-${r.task_id}`}
                style={{ borderLeftWidth: 3, borderLeftColor: r.risk === "overdue" ? "#EF4444" : r.risk === "high" ? "#F59E0B" : "#3B82F6" }}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm truncate">{r.title}</div>
                  <div className="text-xs text-zinc-500 font-mono">Due {r.deadline?.slice(0, 10)}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm" style={{ color: r.risk === "overdue" ? "#EF4444" : r.risk === "high" ? "#F59E0B" : "#3B82F6" }}>
                    {r.hours_left < 0 ? `${Math.abs(r.hours_left).toFixed(1)}h late` : `${r.hours_left.toFixed(1)}h left`}
                  </div>
                  <Badge tone={r.risk === "overdue" || r.risk === "high" ? "bad" : "warn"}>{r.risk}</Badge>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel border="border-emerald-500/15" gradient="from-emerald-500/5 via-zinc-900/30 to-zinc-950" data-testid="workload-panel">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Editor workload</h2>
            <Badge>{workload.length} editors</Badge>
          </div>
          <div className="space-y-3">
            {workload.map(w => (
              <div key={w.editor.id} className="flex items-center gap-3" data-testid={`workload-${w.editor.id}`}>
                {w.editor.avatar_url && <img src={w.editor.avatar_url} className="w-9 h-9 rounded-md object-cover" alt="" />}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between text-sm mb-1">
                    <span className="truncate">{w.editor.anime_name}</span>
                    <span className="font-mono text-xs">{w.total} active</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full transition-all" style={{
                      width: `${w.load_pct}%`,
                      backgroundColor: w.load_pct >= 100 ? "#EF4444" : w.load_pct >= 70 ? "#F59E0B" : "#10B981",
                    }} />
                  </div>
                </div>
                <Badge tone={w.status === "overloaded" ? "bad" : w.status === "busy" ? "warn" : "good"}>{w.status}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Satisfaction + Revisions */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <Panel border="border-purple-500/15" gradient="from-purple-500/5 via-zinc-900/30 to-zinc-950">
          <h2 className="text-lg font-semibold mb-4">Client satisfaction</h2>
          <div className="space-y-2">
            {(satisfaction?.editors || []).slice(0, 5).map(s => (
              <div key={s.user.id} className="flex items-center justify-between py-2 border-b border-white/5">
                <div className="flex items-center gap-2 text-sm">
                  {s.user.avatar_url && <img src={s.user.avatar_url} className="w-7 h-7 rounded-md object-cover" alt="" />}
                  <span>{s.user.anime_name}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm text-purple-300">{s.avg_rating} ★</div>
                  <div className="label-xs text-zinc-500">{s.review_count} reviews</div>
                </div>
              </div>
            ))}
            {(!satisfaction || satisfaction.editors.length === 0) && <div className="text-sm text-zinc-500">No reviews yet.</div>}
          </div>
        </Panel>

        <Panel border="border-amber-500/15" gradient="from-amber-500/5 via-zinc-900/30 to-zinc-950" data-testid="revision-counter-panel">
          <h2 className="text-lg font-semibold mb-4">Revision counter</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="label-xs text-amber-300 mb-2">Top editors (revisions)</div>
              {(revisions?.editors || []).slice(0, 5).map(r => (
                <div key={r.user.id} className="flex justify-between py-1">
                  <span className="truncate">{r.user.anime_name}</span>
                  <span className="font-mono">{r.revision_count}</span>
                </div>
              ))}
              {(!revisions || revisions.editors.length === 0) && <div className="text-zinc-500 text-xs">None</div>}
            </div>
            <div>
              <div className="label-xs text-amber-300 mb-2">Top clients (revisions)</div>
              {(revisions?.clients || []).slice(0, 5).map(r => (
                <div key={r.user.id} className="flex justify-between py-1">
                  <span className="truncate">{r.user.real_name || r.user.anime_name}</span>
                  <span className="font-mono">{r.revision_count}</span>
                </div>
              ))}
              {(!revisions || revisions.clients.length === 0) && <div className="text-zinc-500 text-xs">None</div>}
            </div>
          </div>
        </Panel>
      </div>

      {/* Pending requests + recent tasks */}
      <div className="grid lg:grid-cols-2 gap-6">
        <Panel border="border-blue-500/15" gradient="from-blue-500/5 via-zinc-900/30 to-zinc-950">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Pending editor requests</h2>
            <Badge tone="warn">{reqs.length}</Badge>
          </div>
          <div className="space-y-3">
            {reqs.length === 0 && <div className="text-sm text-zinc-500">No pending requests.</div>}
            {reqs.map((r) => {
              const task = tasks.find(t => t.id === r.task_id);
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 border border-white/10 rounded-md bg-black/20" data-testid={`request-row-${r.id}`}>
                  {r.editor?.avatar_url && <img src={r.editor.avatar_url} className="w-9 h-9 rounded-md object-cover" alt="" />}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.editor?.anime_name || r.editor_anime_name}</div>
                    <div className="text-xs text-zinc-500 truncate">Requested: {task?.title || "—"}</div>
                  </div>
                  <button data-testid={`approve-request-${r.id}`} onClick={() => approve(r.id)} className="text-xs px-3 py-1.5 bg-white text-black rounded-md hover:bg-zinc-200">Approve</button>
                  <button data-testid={`reject-request-${r.id}`} onClick={() => reject(r.id)} className="text-xs px-3 py-1.5 border border-white/10 rounded-md hover:bg-white/5">Reject</button>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel border="border-zinc-700/40" gradient="from-zinc-900/40 via-zinc-900/30 to-zinc-950">
          <h2 className="text-lg font-semibold mb-4">Recent tasks</h2>
          <div className="space-y-2">
            {tasks.slice(0, 8).map((t) => (
              <div key={t.id} className="flex items-center justify-between py-2 border-b border-white/5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{t.title}</div>
                  <div className="text-xs text-zinc-500">{t.project_type}</div>
                </div>
                <Badge tone={t.status === "completed" ? "good" : t.status === "revision" ? "bad" : t.status === "available" ? "default" : "warn"}>{t.status}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </Layout>
  );
}
