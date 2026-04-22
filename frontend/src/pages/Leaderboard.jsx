import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api } from "../lib/api";

export default function Leaderboard({ allowed }) {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.get("/leaderboard").then(r => setRows(r.data)); }, []);

  const tone = (v) => v >= 90 ? "good" : v >= 70 ? "warn" : "bad";

  return (
    <Layout allowed={allowed}>
      <PageHeader label="Leaderboard / 30-day" title="Editor Rankings" subtitle="Updated daily based on on-time, acceptance, revision & response rates." />

      <div className="space-y-2">
        {rows.map((r, i) => (
          <div key={r.editor.id} className="border border-white/10 rounded-md bg-zinc-900/30 p-4 flex items-center gap-4 card-hover" data-testid={`leaderboard-row-${r.rank}`}>
            <div className="font-mono text-2xl w-10 text-center" style={{ color: i === 0 ? "#F59E0B" : i === 1 ? "#A1A1AA" : i === 2 ? "#D97706" : "#52525B" }}>
              #{r.rank}
            </div>
            <div className="relative">
              {r.editor.avatar_url ? (
                <img src={r.editor.avatar_url} className="w-12 h-12 rounded-md object-cover" alt="" />
              ) : (
                <div className="w-12 h-12 rounded-md bg-zinc-800 grid place-items-center text-xs">{r.editor.anime_name?.[0]}</div>
              )}
              {r.editor.online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-zinc-950 rounded-full" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium">{r.editor.anime_name}</div>
              <div className="text-xs text-zinc-500 flex gap-3 flex-wrap mt-1">
                <span>On-time <span className={`font-mono ${r.on_time_rate >= 90 ? "text-emerald-400" : r.on_time_rate >= 70 ? "text-amber-400" : "text-red-400"}`}>{r.on_time_rate}%</span></span>
                <span>Accept <span className={`font-mono ${r.acceptance_rate >= 90 ? "text-emerald-400" : r.acceptance_rate >= 70 ? "text-amber-400" : "text-red-400"}`}>{r.acceptance_rate}%</span></span>
                <span>Vids/wk <span className="font-mono text-white">{r.videos_per_week}</span></span>
                <span>Rev <span className="font-mono">{r.revision_rate}%</span></span>
                <span>★ <span className="font-mono">{r.avg_rating}</span></span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono text-3xl font-semibold" style={{ color: r.score >= 80 ? "#10B981" : r.score >= 60 ? "#F59E0B" : "#EF4444" }}>{r.score}</div>
              <Badge tone={tone(r.score)}>score</Badge>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="text-sm text-zinc-500 p-8 text-center">No editors yet.</div>}
      </div>
    </Layout>
  );
}
