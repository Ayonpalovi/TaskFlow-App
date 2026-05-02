import { useEffect, useState } from "react";
import Layout, { PageHeader, MetricCard, Badge } from "../components/Layout";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function EditorDashboard() {
  const { user } = useAuth();
  const [perf, setPerf] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [available, setAvailable] = useState([]);
  const [profile, setProfile] = useState(null);
  const [mvp, setMvp] = useState(null);

  useEffect(() => {
    api.get("/performance/me").then(r => setPerf(r.data));
    api.get("/tasks").then(r => setTasks(r.data));
    api.get("/tasks?status=available").then(r => setAvailable(r.data));
    api.get("/me/profile").then(r => setProfile(r.data));
    api.get("/mvp/current").then(r => setMvp(r.data));
  }, []);

  const tone = (v) => v >= 90 ? "good" : v >= 70 ? "warn" : "bad";

  return (
    <Layout allowed={["editor"]}>
      <PageHeader label={`Editor / ${user?.anime_name || ""}`} title="Your Workspace" subtitle="Active tasks, performance, and open requests." />

      {profile && (
        <div className="border border-white/10 bg-zinc-900/30 rounded-md p-5 mb-6 flex items-center gap-4" data-testid="xp-banner">
          <div className="text-3xl">{profile.level >= 20 ? "👑" : profile.level >= 10 ? "🎬" : profile.level >= 5 ? "🥋" : "🎯"}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="label-xs text-zinc-500">Lv {profile.level} · {profile.level_name}</span>
              <span className="label-xs text-amber-400">{profile.burnout === "high" ? "🔥 Burnout: High" : profile.burnout === "medium" ? "⚠ Burnout: Medium" : "✓ Healthy"}</span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all" style={{ width: `${profile.level_progress_pct}%` }} />
            </div>
            <div className="flex justify-between text-xs mt-1 text-zinc-500"><span>{profile.xp} XP</span><span>{profile.level_progress_pct}% to Lv {profile.level + 1}</span></div>
          </div>
        </div>
      )}

      {mvp && mvp.editor && mvp.editor.id === user?.id && (
        <div className="border border-amber-500/30 bg-amber-500/10 rounded-md p-4 mb-6 text-center" data-testid="mvp-self-card">
          <div className="text-2xl">👑 You're MVP of the Month</div>
          <div className="text-sm text-zinc-400 mt-1">{mvp.reason}</div>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard label="On-time Rate" value={`${perf?.on_time_rate ?? 0}%`} tone={tone(perf?.on_time_rate ?? 0)} />
        <MetricCard label="Acceptance" value={`${perf?.acceptance_rate ?? 0}%`} tone={tone(perf?.acceptance_rate ?? 0)} />
        <MetricCard label="Videos / Week" value={perf?.videos_per_week ?? 0} />
        <MetricCard label="Score" value={perf?.score ?? 0} tone={tone(perf?.score ?? 0)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <h2 className="text-lg font-semibold mb-4">Your ongoing projects</h2>
          <div className="space-y-2">
            {tasks.length === 0 && <div className="text-sm text-zinc-500">No assigned tasks.</div>}
            {tasks.map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 border border-white/10 rounded-md">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{t.title}</div>
                  <div className="text-xs text-zinc-500 font-mono">Due {t.deadline?.slice(0,10)}</div>
                </div>
                <Badge tone={t.status === "revision" ? "bad" : t.status === "active" ? "warn" : "default"}>{t.status}</Badge>
              </div>
            ))}
          </div>
        </div>
        <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
          <h2 className="text-lg font-semibold mb-4">New briefs up for grabs</h2>
          <div className="space-y-2">
            {available.length === 0 && <div className="text-sm text-zinc-500">No open briefs right now.</div>}
            {available.slice(0, 5).map(t => (
              <div key={t.id} className="flex items-center gap-3 p-3 border border-white/10 rounded-md">
                <div className="flex-1">
                  <div className="text-sm font-medium">{t.project_type}</div>
                  <div className="text-xs text-zinc-500 font-mono">Due {t.deadline?.slice(0,10)} · {t.num_videos} video(s)</div>
                </div>
                <Badge tone={t.priority === "urgent" ? "bad" : "default"}>{t.priority}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
