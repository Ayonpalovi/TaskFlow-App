import { useMemo, useState } from "react";
import Layout, { PageHeader, Badge, MetricCard } from "../../components/Layout";

const STORE_KEY = "motionholic_os_time_sessions_v1";
const TASK_TYPES = ["Editing", "Motion Graphics", "Color Grading", "Client Call", "Revisions", "Admin"];

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveStore(sessions) {
  localStorage.setItem(STORE_KEY, JSON.stringify(sessions));
}

function fmtHours(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

const emptyForm = { project: "", task_type: "Editing", minutes: "", revenue: "", date: new Date().toISOString().slice(0, 10) };

export default function TimeProfitTracker() {
  const [sessions, setSessions] = useState(loadStore);
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState("projects");

  const update = (next) => {
    setSessions(next);
    saveStore(next);
  };

  const logSession = () => {
    if (!form.project.trim() || !form.minutes) return;
    const entry = { id: `sess_${Date.now()}`, ...form, minutes: Number(form.minutes), revenue: Number(form.revenue || 0) };
    update([entry, ...sessions]);
    setForm({ ...emptyForm, project: form.project, task_type: form.task_type });
  };

  const removeSession = (id) => {
    update(sessions.filter((s) => s.id !== id));
  };

  const byProject = useMemo(() => {
    const g = {};
    sessions.forEach((s) => {
      if (!g[s.project]) g[s.project] = { project: s.project, minutes: 0, revenue: 0, sessions: 0 };
      g[s.project].minutes += s.minutes;
      g[s.project].revenue += s.revenue;
      g[s.project].sessions += 1;
    });
    return Object.values(g)
      .map((p) => ({ ...p, hourlyRate: p.minutes > 0 ? p.revenue / (p.minutes / 60) : 0 }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [sessions]);

  const totals = useMemo(() => {
    const minutes = sessions.reduce((s, x) => s + x.minutes, 0);
    const revenue = sessions.reduce((s, x) => s + x.revenue, 0);
    return { minutes, revenue, hourlyAvg: minutes > 0 ? revenue / (minutes / 60) : 0 };
  }, [sessions]);

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Time & Profit" title="Time & Profit Tracker" subtitle="Log time by session and task type to see real hourly profit per project — separate from the manual finance entries in Workflow Suite.">
        <div className="flex gap-1 bg-zinc-900/40 border border-white/10 rounded-md p-1">
          {["projects", "sessions", "reports"].map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`px-3 py-1.5 rounded text-xs font-medium capitalize ${tab === t ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"}`}>{t}</button>
          ))}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <MetricCard label="Total Hours Logged" value={fmtHours(totals.minutes)} />
        <MetricCard label="Total Revenue" value={`€${totals.revenue.toLocaleString()}`} tone="good" />
        <MetricCard label="Avg. Effective Rate" value={`€${totals.hourlyAvg.toFixed(0)}/hr`} tone="blue" />
      </div>

      <div className="mb-6 border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5">
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input className="input-field" placeholder="Project" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} />
          <select className="input-field" value={form.task_type} onChange={(e) => setForm({ ...form, task_type: e.target.value })}>
            {TASK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <input className="input-field" type="number" placeholder="Minutes" value={form.minutes} onChange={(e) => setForm({ ...form, minutes: e.target.value })} />
          <input className="input-field" type="number" placeholder="Revenue attributed (€)" value={form.revenue} onChange={(e) => setForm({ ...form, revenue: e.target.value })} />
          <button type="button" onClick={logSession} className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 text-sm font-medium">Log session</button>
        </div>
      </div>

      {tab === "projects" && (
        <div className="border border-white/10 rounded-md bg-zinc-900/20 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-zinc-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left p-3">Project</th>
                <th className="text-left p-3">Sessions</th>
                <th className="text-left p-3">Hours</th>
                <th className="text-left p-3">Revenue</th>
                <th className="text-left p-3">Effective Rate</th>
              </tr>
            </thead>
            <tbody>
              {byProject.map((p) => (
                <tr key={p.project} className="border-t border-white/5">
                  <td className="p-3">{p.project}</td>
                  <td className="p-3 text-zinc-400">{p.sessions}</td>
                  <td className="p-3 font-mono">{fmtHours(p.minutes)}</td>
                  <td className="p-3 font-mono">€{p.revenue.toLocaleString()}</td>
                  <td className="p-3"><Badge tone={p.hourlyRate >= 40 ? "good" : p.hourlyRate >= 20 ? "warn" : "bad"}>€{p.hourlyRate.toFixed(0)}/hr</Badge></td>
                </tr>
              ))}
              {byProject.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-zinc-600 text-sm">No sessions logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "sessions" && (
        <div className="border border-white/10 rounded-md bg-zinc-900/20 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-zinc-500 text-xs uppercase tracking-wide">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Project</th>
                <th className="text-left p-3">Task</th>
                <th className="text-left p-3">Duration</th>
                <th className="text-left p-3">Revenue</th>
                <th className="text-left p-3"></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-t border-white/5">
                  <td className="p-3 text-zinc-400">{s.date}</td>
                  <td className="p-3">{s.project}</td>
                  <td className="p-3"><Badge>{s.task_type}</Badge></td>
                  <td className="p-3 font-mono">{fmtHours(s.minutes)}</td>
                  <td className="p-3 font-mono">€{s.revenue.toLocaleString()}</td>
                  <td className="p-3"><button type="button" onClick={() => removeSession(s.id)} className="text-xs text-zinc-600 hover:text-red-400">Delete</button></td>
                </tr>
              ))}
              {sessions.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-zinc-600 text-sm">No sessions logged yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "reports" && (
        <div className="grid sm:grid-cols-2 gap-4">
          {TASK_TYPES.map((type) => {
            const typeSessions = sessions.filter((s) => s.task_type === type);
            const minutes = typeSessions.reduce((s, x) => s + x.minutes, 0);
            const revenue = typeSessions.reduce((s, x) => s + x.revenue, 0);
            if (minutes === 0) return null;
            return (
              <div key={type} className="border border-white/10 rounded-md bg-zinc-900/20 p-4">
                <div className="text-sm font-medium mb-2">{type}</div>
                <div className="flex items-center justify-between text-xs text-zinc-400">
                  <span>{fmtHours(minutes)}</span>
                  <span className="font-mono">€{revenue.toLocaleString()}</span>
                </div>
              </div>
            );
          })}
          {totals.minutes === 0 && <div className="text-sm text-zinc-600 text-center py-10 sm:col-span-2 border border-dashed border-white/10 rounded-md">No data to report yet.</div>}
        </div>
      )}

      <style>{`.input-field { background: rgba(24,24,27,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 10px; font-size: 14px; width: 100%; }`}</style>
    </Layout>
  );
}
