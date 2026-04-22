import { useEffect, useState } from "react";
import Layout, { PageHeader, MetricCard, Badge } from "../components/Layout";
import { api } from "../lib/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [reqs, setReqs] = useState([]);

  const load = async () => {
    const [s, t, r] = await Promise.all([
      api.get("/stats/admin"), api.get("/tasks"), api.get("/requests"),
    ]);
    setStats(s.data); setTasks(t.data); setReqs(r.data.filter(x => x.status === "pending"));
  };
  useEffect(() => { load(); }, []);

  const approve = async (id) => { await api.post(`/requests/${id}/approve`); load(); };
  const reject  = async (id) => { await api.post(`/requests/${id}/reject`); load(); };

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Overview" title="Command Center" subtitle="Pipeline health, revenue, and pending approvals." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Total Projects" value={stats?.total_projects ?? "—"} />
        <MetricCard label="In Progress" value={stats?.in_progress ?? "—"} tone="warn" />
        <MetricCard label="Completed" value={stats?.completed ?? "—"} tone="good" />
        <MetricCard label="Revisions" value={stats?.revisions ?? "—"} tone="bad" />
        <MetricCard label="Monthly Revenue" value={`$${(stats?.monthly_revenue ?? 0).toLocaleString()}`} />
        <MetricCard label="Monthly Profit" value={`$${(stats?.monthly_profit ?? 0).toLocaleString()}`} tone="good" />
        <MetricCard label="Editors" value={stats?.editors_count ?? "—"} />
        <MetricCard label="Clients" value={stats?.clients_count ?? "—"} />
      </div>

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
