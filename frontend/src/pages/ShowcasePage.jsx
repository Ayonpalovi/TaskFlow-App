import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";

export default function ShowcasePage() {
  const [editors, setEditors] = useState([]);
  useEffect(() => { api.get("/showcase").then(r => setEditors(r.data)); }, []);

  const tone = (v) => v >= 90 ? "#10B981" : v >= 70 ? "#F59E0B" : "#EF4444";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="border-b border-white/10 sticky top-0 bg-zinc-950/80 backdrop-blur-xl z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white rounded-md grid place-items-center">
              <span className="font-mono text-black font-bold text-sm">TF</span>
            </div>
            <div>
              <div className="font-semibold text-sm">TaskFlow</div>
              <div className="label-xs text-zinc-500">Editor Showcase</div>
            </div>
          </div>
          <Link to="/login" data-testid="showcase-signin-link" className="text-sm px-4 py-2 bg-white text-black rounded-md hover:bg-zinc-200 transition-all">Agency sign-in</Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-16 pb-10">
        <div className="label-xs text-zinc-500 mb-3">Anonymous · Verified · Ranked</div>
        <h1 className="text-5xl font-bold tracking-tight mb-4 max-w-2xl">Meet our editors. <span className="text-zinc-500">Identity protected.</span></h1>
        <p className="text-zinc-400 max-w-2xl text-lg">Every editor here passes blind brief tests, ships under deadline, and is ranked weekly. Hire by craft, not by name.</p>
      </section>

      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {editors.map((e, i) => (
            <div key={e.anime_name} className="border border-white/10 rounded-md bg-zinc-900/30 p-5 card-hover" data-testid={`showcase-card-${i}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="relative">
                  {e.avatar_url ? (
                    <img src={e.avatar_url} className="w-16 h-16 rounded-md object-cover" alt="" />
                  ) : (
                    <div className="w-16 h-16 rounded-md bg-zinc-800 grid place-items-center text-xl font-mono">{e.anime_name?.[0]}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-mono text-xl font-semibold" style={{ color: tone(e.score) }}>{e.score}</div>
                  <div className="label-xs text-zinc-500">score</div>
                </div>
              </div>
              <div className="font-medium text-lg mb-1">{e.anime_name}</div>
              <div className="flex flex-wrap gap-1 mb-4">
                {e.skills.slice(0, 4).map(s => <span key={s} className="text-xs px-2 py-0.5 bg-zinc-800 rounded">{s}</span>)}
              </div>
              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/5 text-center">
                <div>
                  <div className="font-mono text-sm" style={{ color: tone(e.on_time_rate) }}>{e.on_time_rate}%</div>
                  <div className="label-xs text-zinc-500 mt-0.5">on time</div>
                </div>
                <div>
                  <div className="font-mono text-sm">{e.avg_rating || "—"} ★</div>
                  <div className="label-xs text-zinc-500 mt-0.5">rating</div>
                </div>
                <div>
                  <div className="font-mono text-sm">{e.completed_tasks}</div>
                  <div className="label-xs text-zinc-500 mt-0.5">shipped</div>
                </div>
              </div>
            </div>
          ))}
          {editors.length === 0 && <div className="col-span-full text-center text-sm text-zinc-500 py-12">No editors live yet.</div>}
        </div>
      </section>

      <footer className="border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-8 flex justify-between items-center text-xs text-zinc-500">
          <div className="font-mono">© TaskFlow Agency OS</div>
          <Link to="/login" className="hover:text-white transition-all">Sign in →</Link>
        </div>
      </footer>
    </div>
  );
}
