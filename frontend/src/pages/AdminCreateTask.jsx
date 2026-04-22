import { useEffect, useState } from "react";
import Layout, { PageHeader } from "../components/Layout";
import { api, formatApiError } from "../lib/api";
import { useNavigate } from "react-router-dom";

export default function AdminCreateTask() {
  const nav = useNavigate();
  const [clients, setClients] = useState([]);
  const [editors, setEditors] = useState([]);
  const [health, setHealth] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [f, setF] = useState({
    title: "", client_id: "", project_type: "Reel", priority: "medium",
    deadline: new Date(Date.now() + 7*24*3600*1000).toISOString().slice(0, 10),
    num_videos: 1, duration: "60s", resolution: "1080p", aspect_ratio: "9:16",
    footages_url: "", script_url: "",
    brief_goal: "", brief_audience: "", brief_style: "", brief_hook: "",
    brief_body: "", brief_cta: "", brief_references: "", brief_notes: "",
    skill_tags: "", assigned_editor_id: "", revenue: 0, cost: 0, is_draft: false,
  });

  useEffect(() => {
    Promise.all([api.get("/users?role=client"), api.get("/users?role=editor")])
      .then(([c, e]) => { setClients(c.data); setEditors(e.data); });
  }, []);

  const scoreBrief = async () => {
    const skills = f.skill_tags.split(",").map(s => s.trim()).filter(Boolean);
    const { data } = await api.post("/brief/score", { ...f, skill_tags: skills });
    setHealth(data);
  };

  const submit = async (isDraft) => {
    setErr(""); setBusy(true);
    try {
      const payload = {
        ...f,
        skill_tags: f.skill_tags.split(",").map(s => s.trim()).filter(Boolean),
        client_id: f.client_id || null,
        assigned_editor_id: f.assigned_editor_id || null,
        is_draft: isDraft,
        revenue: Number(f.revenue) || 0,
        cost: Number(f.cost) || 0,
        num_videos: Number(f.num_videos) || 1,
      };
      await api.post("/tasks", payload);
      nav("/admin/tasks");
    } catch (e) { setErr(formatApiError(e?.response?.data?.detail)); }
    finally { setBusy(false); }
  };

  const Field = ({ label, children }) => (
    <div>
      <label className="label-xs text-zinc-400 block mb-1.5">{label}</label>
      {children}
    </div>
  );
  const inp = "w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20";

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Create" title="New Project Brief" subtitle="Assemble a full creative brief and assign an editor.">
        <button data-testid="save-draft-button" onClick={() => submit(true)} disabled={busy} className="px-4 py-2 border border-white/10 rounded-md text-sm hover:bg-white/5">Save Draft</button>
        <button data-testid="publish-task-button" onClick={() => submit(false)} disabled={busy} className="px-4 py-2 bg-white text-black rounded-md text-sm font-medium hover:bg-zinc-200">Publish</button>
      </PageHeader>

      {err && <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">{err}</div>}

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
            <h3 className="label-xs text-zinc-400 mb-4">Task Details</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Title"><input data-testid="task-title-input" className={inp} value={f.title} onChange={e => setF({ ...f, title: e.target.value })} /></Field>
              <Field label="Client">
                <select data-testid="task-client-select" className={inp} value={f.client_id} onChange={e => setF({ ...f, client_id: e.target.value })}>
                  <option value="">— Select —</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.display_name}</option>)}
                </select>
              </Field>
              <Field label="Project Type">
                <select data-testid="task-type-select" className={inp} value={f.project_type} onChange={e => setF({ ...f, project_type: e.target.value })}>
                  {["Reel","Ad","Podcast","Documentary","Vlog","YouTube","Short"].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Priority">
                <select data-testid="task-priority-select" className={inp} value={f.priority} onChange={e => setF({ ...f, priority: e.target.value })}>
                  {["low","medium","high","urgent"].map(o => <option key={o}>{o}</option>)}
                </select>
              </Field>
              <Field label="Deadline"><input data-testid="task-deadline-input" type="date" className={inp} value={f.deadline} onChange={e => setF({ ...f, deadline: e.target.value })} /></Field>
              <Field label="Revenue ($)"><input type="number" className={inp} value={f.revenue} onChange={e => setF({ ...f, revenue: e.target.value })} /></Field>
              <Field label="Cost ($)"><input type="number" className={inp} value={f.cost} onChange={e => setF({ ...f, cost: e.target.value })} /></Field>
            </div>
          </section>

          <section className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
            <h3 className="label-xs text-zinc-400 mb-4">Deliverables</h3>
            <div className="grid md:grid-cols-4 gap-4">
              <Field label="Videos"><input type="number" className={inp} value={f.num_videos} onChange={e => setF({ ...f, num_videos: e.target.value })} /></Field>
              <Field label="Duration"><input className={inp} value={f.duration} onChange={e => setF({ ...f, duration: e.target.value })} /></Field>
              <Field label="Resolution"><input className={inp} value={f.resolution} onChange={e => setF({ ...f, resolution: e.target.value })} /></Field>
              <Field label="Aspect Ratio"><input className={inp} value={f.aspect_ratio} onChange={e => setF({ ...f, aspect_ratio: e.target.value })} /></Field>
            </div>
          </section>

          <section className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
            <h3 className="label-xs text-zinc-400 mb-4">Assets (URLs)</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Footages URL"><input className={inp} placeholder="https://…" value={f.footages_url} onChange={e => setF({ ...f, footages_url: e.target.value })} /></Field>
              <Field label="Script URL"><input className={inp} placeholder="https://…" value={f.script_url} onChange={e => setF({ ...f, script_url: e.target.value })} /></Field>
            </div>
          </section>

          <section className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
            <div className="flex justify-between items-center mb-4">
              <h3 className="label-xs text-zinc-400">Creative Brief</h3>
              <button data-testid="score-brief-button" onClick={scoreBrief} className="text-xs px-3 py-1.5 border border-white/10 rounded-md hover:bg-white/5">Score brief</button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Goal"><textarea rows={2} className={inp} value={f.brief_goal} onChange={e => setF({ ...f, brief_goal: e.target.value })} /></Field>
              <Field label="Target Audience"><textarea rows={2} className={inp} value={f.brief_audience} onChange={e => setF({ ...f, brief_audience: e.target.value })} /></Field>
              <Field label="Style"><textarea rows={2} className={inp} value={f.brief_style} onChange={e => setF({ ...f, brief_style: e.target.value })} /></Field>
              <Field label="Hook"><textarea rows={2} className={inp} value={f.brief_hook} onChange={e => setF({ ...f, brief_hook: e.target.value })} /></Field>
              <Field label="Body"><textarea rows={2} className={inp} value={f.brief_body} onChange={e => setF({ ...f, brief_body: e.target.value })} /></Field>
              <Field label="CTA"><textarea rows={2} className={inp} value={f.brief_cta} onChange={e => setF({ ...f, brief_cta: e.target.value })} /></Field>
              <Field label="References"><textarea rows={2} className={inp} value={f.brief_references} onChange={e => setF({ ...f, brief_references: e.target.value })} /></Field>
              <Field label="Notes"><textarea rows={2} className={inp} value={f.brief_notes} onChange={e => setF({ ...f, brief_notes: e.target.value })} /></Field>
            </div>
          </section>

          <section className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
            <h3 className="label-xs text-zinc-400 mb-4">Assignment</h3>
            <div className="grid md:grid-cols-2 gap-4">
              <Field label="Skill Tags (comma separated)"><input className={inp} value={f.skill_tags} onChange={e => setF({ ...f, skill_tags: e.target.value })} placeholder="reels, motion, color-grading" /></Field>
              <Field label="Assign Editor (optional — leave blank for open market)">
                <select data-testid="task-assign-editor-select" className={inp} value={f.assigned_editor_id} onChange={e => setF({ ...f, assigned_editor_id: e.target.value })}>
                  <option value="">— Open market (editors request) —</option>
                  {editors.map(ed => <option key={ed.id} value={ed.id}>{ed.anime_name}</option>)}
                </select>
              </Field>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="border border-white/10 rounded-md p-5 bg-zinc-900/30 sticky top-6">
            <div className="label-xs text-zinc-400 mb-3">Brief Health Score</div>
            <div className="font-mono text-5xl font-semibold mb-2" style={{ color: health ? (health.score >= 80 ? "#10B981" : health.score >= 60 ? "#F59E0B" : "#EF4444") : "#71717A" }}>
              {health ? `${health.score}%` : "—"}
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full transition-all" style={{ width: `${health?.score || 0}%`, backgroundColor: health?.score >= 80 ? "#10B981" : health?.score >= 60 ? "#F59E0B" : "#EF4444" }} />
            </div>
            {health?.suggestions?.length > 0 && (
              <div className="mt-4 space-y-1.5">
                {health.suggestions.map((s, i) => (
                  <div key={i} className="text-xs text-zinc-400 border-l-2 border-amber-500/50 pl-2">{s}</div>
                ))}
              </div>
            )}
            {!health && <div className="text-xs text-zinc-500 mt-2">Click "Score brief" to analyze.</div>}
          </div>
        </aside>
      </div>
    </Layout>
  );
}
