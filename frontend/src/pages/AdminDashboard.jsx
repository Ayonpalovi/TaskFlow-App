import { useEffect, useState } from "react";
import Layout, { PageHeader, MetricCard, Badge } from "../components/Layout";
import { api } from "../lib/api";
import {
  LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from "recharts";

const STATUS_COLORS = {
  available: "#71717A", active: "#3B82F6", pending: "#F59E0B",
  revision: "#EF4444", completed: "#10B981", draft: "#52525B",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [trends, setTrends] = useState(null);
  const [reqs, setReqs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [risk, setRisk] = useState([]);
  const [workload, setWorkload] = useState([]);
  const [satisfaction, setSatisfaction] = useState(null);
  const [revisions, setRevisions] = useState(null);

  const load = async () => {
    const [s, tr, t, r, dr, wl, sa, rv] = await Promise.all([
      api.get("/stats/admin"), api.get("/stats/trends"), api.get("/tasks"),
      api.get("/requests"), api.get("/stats/deadline-risk"),
      api.get("/stats/workload"), api.get("/stats/satisfaction"),
      api.get("/stats/revisions"),
    ]);
    setStats(s.data); setTrends(tr.data); setTasks(t.data);
    setReqs(r.data.filter(x => x.status === "pending"));
    setRisk(dr.data); setWorkload(wl.data); setSatisfaction(sa.data); setRevisions(rv.data);
  };
  useEffect(() => { load(); }, []);

  const approve = async (id) => { await api.post(`/requests/${id}/approve`); load(); };
  const reject  = async (id) => { await api.post(`/requests/${id}/reject`); load(); };

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Overview" title="Command Center" subtitle="Pipeline health, revenue, satisfaction, and risk." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Projects" value={stats?.total_projects ?? "—"} />
        <MetricCard label="In Progress" value={stats?.in_progress ?? "—"} tone="warn" />
        <MetricCard label="Completed" value={stats?.completed ?? "—"} tone="good" />
        <MetricCard label="Revisions" value={stats?.revisions ?? "—"} tone="bad" />
        <MetricCard label="Monthly Revenue" value={`$${(stats?.monthly_revenue ?? 0).toLocaleString()}`} />
        <MetricCard label="Monthly Profit" value={`$${(stats?.monthly_profit ?? 0).toLocaleString()}`} tone="good" />
        <MetricCard label="Editors" value={stats?.editors_count ?? "—"} />
        <MetricCard label="Clients" value={stats?.clients_count ?? "—"} />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        <div className="lg:col-span-2 border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <div className="label-xs text-zinc-400 mb-4">Revenue · Profit · Tasks (last 30 days)</div>
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
        </div>
        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <div className="label-xs text-zinc-400 mb-4">Status breakdown</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={trends?.status_breakdown || []} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name} (${value})`}>
                {(trends?.status_breakdown || []).map((s, i) => (
                  <Cell key={i} fill={STATUS_COLORS[s.name] || "#52525B"} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Risk + Workload */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30" data-testid="deadline-risk-panel">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Deadline risk</h2>
            <Badge tone={risk.length > 0 ? "bad" : "good"}>{risk.length} at risk</Badge>
          </div>
          <div className="space-y-2">
            {risk.length === 0 && <div className="text-sm text-zinc-500">All deadlines healthy.</div>}
            {risk.slice(0, 6).map(r => (
              <div key={r.task_id} className="flex items-center justify-between p-3 border border-white/10 rounded-md" data-testid={`risk-task-${r.task_id}`}
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
        </div>

        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30" data-testid="workload-panel">
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
        </div>
      </div>

      {/* Satisfaction + Revisions */}
      <div className="grid lg:grid-cols-2 gap-4 mb-6">
        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <h2 className="text-lg font-semibold mb-4">Client satisfaction</h2>
          <div className="space-y-2">
            {(satisfaction?.editors || []).slice(0, 5).map(s => (
              <div key={s.user.id} className="flex items-center justify-between py-2 border-b border-white/5">
                <div className="flex items-center gap-2 text-sm">
                  {s.user.avatar_url && <img src={s.user.avatar_url} className="w-7 h-7 rounded-md object-cover" alt="" />}
                  <span>{s.user.anime_name}</span>
                </div>
                <div className="text-right">
                  <div className="font-mono text-sm">{s.avg_rating} ★</div>
                  <div className="label-xs text-zinc-500">{s.review_count} reviews</div>
                </div>
              </div>
            ))}
            {(!satisfaction || satisfaction.editors.length === 0) && <div className="text-sm text-zinc-500">No reviews yet.</div>}
          </div>
        </div>

        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30" data-testid="revision-counter-panel">
          <h2 className="text-lg font-semibold mb-4">Revision counter</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="label-xs text-zinc-500 mb-2">Top editors (revisions)</div>
              {(revisions?.editors || []).slice(0, 5).map(r => (
                <div key={r.user.id} className="flex justify-between py-1">
                  <span className="truncate">{r.user.anime_name}</span>
                  <span className="font-mono">{r.revision_count}</span>
                </div>
              ))}
              {(!revisions || revisions.editors.length === 0) && <div className="text-zinc-500 text-xs">None</div>}
            </div>
            <div>
              <div className="label-xs text-zinc-500 mb-2">Top clients (revisions)</div>
              {(revisions?.clients || []).slice(0, 5).map(r => (
                <div key={r.user.id} className="flex justify-between py-1">
                  <span className="truncate">{r.user.real_name || r.user.anime_name}</span>
                  <span className="font-mono">{r.revision_count}</span>
                </div>
              ))}
              {(!revisions || revisions.clients.length === 0) && <div className="text-zinc-500 text-xs">None</div>}
            </div>
          </div>
        </div>
      </div>

      {/* Pending requests + recent tasks */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Pending editor requests</h2>
            <Badge tone="warn">{reqs.length}</Badge>
          </div>
          <div className="space-y-3">
            {reqs.length === 0 && <div className="text-sm text-zinc-500">No pending requests.</div>}
            {reqs.map((r) => {
              const task = tasks.find(t => t.id === r.task_id);
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 border border-white/10 rounded-md" data-testid={`request-row-${r.id}`}>
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
        </div>

        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
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
        </div>
      </div>
    </Layout>
  );
}
