import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import DeadlineBar from "../components/DeadlineBar";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function EditorProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [editingVids, setEditingVids] = useState(false);
  const [vids, setVids] = useState([]);
  const [tasks, setTasks] = useState([]);

  const load = async () => {
    const [p, t] = await Promise.all([api.get("/me/profile"), api.get("/tasks")]);
    setProfile(p.data);
    setVids(p.data.top_videos || []);
    setTasks(t.data);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const saveVids = async () => {
    await api.put("/me/top-videos", { videos: vids });
    setEditingVids(false); load();
  };

  const addVid = () => { if (vids.length < 5) setVids([...vids, { url: "", title: "" }]); };
  const removeVid = (i) => setVids(vids.filter((_, idx) => idx !== i));
  const updateVid = (i, k, v) => setVids(vids.map((x, idx) => idx === i ? { ...x, [k]: v } : x));

  const burnoutTone = profile?.burnout === "high" ? "bad" : profile?.burnout === "medium" ? "warn" : "good";
  const inp = "w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm";

  if (!profile) return <Layout allowed={["editor"]}><div className="text-zinc-500 text-sm">Loading…</div></Layout>;

  const badgeDefs = profile.badge_defs || {};
  const ongoing = tasks.filter(t => ["active", "submitted", "revision", "client_review"].includes(t.status));

  return (
    <Layout allowed={["editor"]}>
      <PageHeader label={`Editor / Profile`} title={profile.anime_name} subtitle="Your gamified workspace — XP, level, badges, top videos." />

      <div className="grid lg:grid-cols-3 gap-4 mb-6">
        {/* XP/Level card */}
        <div className="lg:col-span-2 border border-white/10 rounded-md p-6 bg-zinc-900/30" data-testid="xp-card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="label-xs text-zinc-500">Level {profile.level}</div>
              <div className="text-3xl font-bold mt-1">{profile.level_name}</div>
            </div>
            <div className="text-right">
              <div className="font-mono text-3xl text-white">{profile.xp}</div>
              <div className="label-xs text-zinc-500">XP</div>
            </div>
          </div>
          <div className="flex justify-between text-xs text-zinc-400 mb-2">
            <span>Lv {profile.level}</span>
            <span>{profile.level_progress_pct}% to next level</span>
            <span>Lv {profile.level + 1}</span>
          </div>
          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500 via-emerald-400 to-amber-400 transition-all"
              style={{ width: `${profile.level_progress_pct}%` }} data-testid="xp-progress-bar" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-xs text-zinc-400">
            <div>+10 XP per delivery</div>
            <div>+5 XP on-time bonus</div>
            <div>−5 XP if late</div>
          </div>
        </div>

        {/* Burnout */}
        <div className="border border-white/10 rounded-md p-6 bg-zinc-900/30" data-testid="burnout-card">
          <div className="label-xs text-zinc-500 mb-3">Burnout Risk</div>
          <div className="text-3xl font-bold capitalize mb-3"
            style={{ color: profile.burnout === "high" ? "#EF4444" : profile.burnout === "medium" ? "#F59E0B" : "#10B981" }}>
            {profile.burnout}
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden mb-3">
            <div className="h-full"
              style={{
                width: profile.burnout === "high" ? "90%" : profile.burnout === "medium" ? "55%" : "20%",
                backgroundColor: profile.burnout === "high" ? "#EF4444" : profile.burnout === "medium" ? "#F59E0B" : "#10B981",
              }} />
          </div>
          <div className="text-xs text-zinc-400">
            {profile.burnout === "high" && "Take a break — too many active loads."}
            {profile.burnout === "medium" && "Watch your queue — pacing matters."}
            {profile.burnout === "low" && "Healthy pace. Keep shipping."}
          </div>
        </div>
      </div>

      {/* Badges */}
      <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30 mb-6" data-testid="badges-card">
        <h2 className="text-lg font-semibold mb-4">Achievements</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {Object.entries(badgeDefs).map(([key, b]) => {
            const unlocked = (profile.badges || []).includes(key);
            return (
              <div key={key} className={`text-center p-4 border rounded-md transition-all ${unlocked ? "border-amber-500/30 bg-amber-500/5" : "border-white/10 bg-zinc-900/20 opacity-40"}`} data-testid={`badge-${key}`}>
                <div className="text-3xl mb-2">{b.icon}</div>
                <div className="text-xs font-medium">{b.name}</div>
                <div className="text-[10px] text-zinc-500 mt-1">{unlocked ? "Unlocked" : "Locked"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top videos */}
      <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30 mb-6" data-testid="top-videos-card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Top Edited Videos</h2>
          <div className="flex gap-2">
            <span className="label-xs text-zinc-500">{vids.length}/5</span>
            {!editingVids && <button onClick={() => setEditingVids(true)} data-testid="edit-videos-btn" className="text-xs px-3 py-1 border border-white/10 rounded-md hover:bg-white/5">Edit</button>}
            {editingVids && (
              <>
                <button onClick={() => { setEditingVids(false); setVids(profile.top_videos || []); }} className="text-xs px-3 py-1 border border-white/10 rounded-md hover:bg-white/5">Cancel</button>
                <button onClick={saveVids} data-testid="save-videos-btn" className="text-xs px-3 py-1 bg-white text-black rounded-md hover:bg-zinc-200">Save</button>
              </>
            )}
          </div>
        </div>
        {!editingVids && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {vids.length === 0 && <div className="col-span-full text-sm text-zinc-500 text-center py-6">No top videos yet. Add up to 5 of your best work.</div>}
            {vids.map((v, i) => (
              <div key={i} className="border border-white/10 rounded-md overflow-hidden bg-black">
                <div className="aspect-video bg-zinc-900">
                  {v.url && <iframe src={driveEmbedUrl(v.url)} className="w-full h-full" title={v.title} allowFullScreen />}
                </div>
                <div className="p-2 text-xs">{v.title || "Untitled"}</div>
              </div>
            ))}
          </div>
        )}
        {editingVids && (
          <div className="space-y-2">
            {vids.map((v, i) => (
              <div key={i} className="flex gap-2 items-start">
                <input className={inp} placeholder="Title" value={v.title} onChange={e => updateVid(i, "title", e.target.value)} />
                <input className={inp} placeholder="Google Drive share URL" value={v.url} onChange={e => updateVid(i, "url", e.target.value)} />
                <button onClick={() => removeVid(i)} className="px-3 py-2 text-red-400 border border-white/10 rounded-md hover:bg-red-500/10 text-xs">Remove</button>
              </div>
            ))}
            {vids.length < 5 && <button onClick={addVid} className="text-xs px-3 py-2 border border-dashed border-white/10 rounded-md hover:bg-white/5 w-full">+ Add video ({vids.length}/5)</button>}
          </div>
        )}
      </div>

      {/* Ongoing tasks with deadline bars */}
      <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
        <h2 className="text-lg font-semibold mb-4">Active deadlines</h2>
        {ongoing.length === 0 && <div className="text-sm text-zinc-500">No active tasks.</div>}
        <div className="space-y-3">
          {ongoing.map(t => (
            <div key={t.id} className="border border-white/10 rounded-md p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-sm font-medium">{t.title}</div>
                  <div className="text-xs text-zinc-500">{t.project_type}</div>
                </div>
                <Badge tone={t.status === "revision" ? "bad" : "warn"}>{t.status}</Badge>
              </div>
              <DeadlineBar deadline={t.deadline} status={t.status} />
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

function driveEmbedUrl(url) {
  if (!url) return "";
  const m = url.match(/\/d\/([^/]+)/) || url.match(/id=([^&]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return url;
}
