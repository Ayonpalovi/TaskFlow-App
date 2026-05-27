import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, formatApiError } from "../../lib/api";
import ModeratorLayout from "../../components/ModeratorLayout";

function Field({ label, children }) {
  return (
    <div>
      <label className="label-xs mb-1.5 block text-zinc-400">{label}</label>
      {children}
    </div>
  );
}

async function createModeratorTask(payload) {
  try {
    return await api.post("/workflow/moderator/tasks", payload);
  } catch (error) {
    if (error?.response?.status === 404) {
      return api.post("/tasks", payload);
    }
    throw error;
  }
}

export default function ModeratorCreateTask() {
  const nav = useNavigate();

  const [clients, setClients] = useState([]);
  const [editors, setEditors] = useState([]);
  const [health, setHealth] = useState(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [f, setF] = useState({
    title: "",
    client_id: "",
    project_type: "Reel",
    priority: "medium",
    deadline: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    num_videos: 1,
    duration: "60s",
    resolution: "1080p",
    aspect_ratio: "9:16",
    footages_url: "",
    script_url: "",
    brief_goal: "",
    brief_audience: "",
    brief_style: "",
    brief_hook: "",
    brief_body: "",
    brief_cta: "",
    brief_references: "",
    brief_notes: "",
    skill_tags: "",
    assigned_editor_id: "",
    revenue: 0,
    cost: 0,
    is_draft: false,
  });

  const inp = "w-full rounded-md border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-white/20";

  const updateField = (key, value) => {
    setF((prev) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    Promise.all([api.get("/users?role=client"), api.get("/users?role=editor")])
      .then(([clientRes, editorRes]) => {
        setClients(Array.isArray(clientRes.data) ? clientRes.data : []);
        setEditors(Array.isArray(editorRes.data) ? editorRes.data : []);
      })
      .catch(() => setErr("Failed to load clients or editors."));
  }, []);

  const scoreBrief = async () => {
    try {
      setErr("");
      const skills = f.skill_tags.split(",").map((s) => s.trim()).filter(Boolean);
      const { data } = await api.post("/brief/score", { ...f, skill_tags: skills });
      setHealth(data);
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to score brief.");
    }
  };

  const submit = async (isDraft) => {
    setErr("");
    setBusy(true);

    try {
      const payload = {
        ...f,
        skill_tags: f.skill_tags.split(",").map((s) => s.trim()).filter(Boolean),
        client_id: f.client_id || null,
        assigned_editor_id: f.assigned_editor_id || null,
        is_draft: isDraft,
        revenue: Number(f.revenue) || 0,
        cost: Number(f.cost) || 0,
        num_videos: Number(f.num_videos) || 1,
      };

      await createModeratorTask(payload);
      nav("/moderator/tasks");
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to create project.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModeratorLayout>
          <div className="mb-6 flex flex-col gap-4 border-b border-white/10 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="label-xs mb-3 text-zinc-500">Moderator / Create</div>
              <h1 className="text-3xl font-semibold tracking-tight">New Project Brief</h1>
              <p className="mt-3 text-sm text-zinc-400">Create a new task for the pipeline just like the admin create task page.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => submit(true)} disabled={busy} className="rounded-md border border-white/10 px-4 py-2 text-sm hover:bg-white/5 disabled:opacity-50">Save Draft</button>
              <button onClick={() => submit(false)} disabled={busy} className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50">Publish</button>
            </div>
          </div>

          {err && <div className="mb-4 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</div>}

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <section className="rounded-md border border-white/10 bg-zinc-900/30 p-5">
                <h3 className="label-xs mb-4 text-zinc-400">Task Details</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Title"><input data-testid="moderator-task-title-input" className={inp} value={f.title} onChange={(e) => updateField("title", e.target.value)} /></Field>
                  <Field label="Client">
                    <select className={inp} value={f.client_id} onChange={(e) => updateField("client_id", e.target.value)}>
                      <option value="">— Select —</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.display_name || c.real_name || c.email}</option>)}
                    </select>
                  </Field>
                  <Field label="Project Type">
                    <select className={inp} value={f.project_type} onChange={(e) => updateField("project_type", e.target.value)}>
                      {["Reel", "Ad", "Podcast", "Documentary", "Vlog", "YouTube", "Short", "UI/UX", "Graphics Design", "Web Development", "Digital Marketing"].map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </Field>
                  <Field label="Priority"><select className={inp} value={f.priority} onChange={(e) => updateField("priority", e.target.value)}>{["low", "medium", "high", "urgent"].map((o) => <option key={o}>{o}</option>)}</select></Field>
                  <Field label="Deadline"><input type="date" className={inp} value={f.deadline} onChange={(e) => updateField("deadline", e.target.value)} /></Field>
                  <Field label="Revenue ($)"><input type="number" className={inp} value={f.revenue} onChange={(e) => updateField("revenue", e.target.value)} /></Field>
                  <Field label="Cost ($)"><input type="number" className={inp} value={f.cost} onChange={(e) => updateField("cost", e.target.value)} /></Field>
                </div>
              </section>

              <section className="rounded-md border border-white/10 bg-zinc-900/30 p-5">
                <h3 className="label-xs mb-4 text-zinc-400">Deliverables</h3>
                <div className="grid gap-4 md:grid-cols-4">
                  <Field label="Videos"><input type="number" className={inp} value={f.num_videos} onChange={(e) => updateField("num_videos", e.target.value)} /></Field>
                  <Field label="Duration"><input className={inp} value={f.duration} onChange={(e) => updateField("duration", e.target.value)} /></Field>
                  <Field label="Resolution"><input className={inp} value={f.resolution} onChange={(e) => updateField("resolution", e.target.value)} /></Field>
                  <Field label="Aspect Ratio"><input className={inp} value={f.aspect_ratio} onChange={(e) => updateField("aspect_ratio", e.target.value)} /></Field>
                </div>
              </section>

              <section className="rounded-md border border-white/10 bg-zinc-900/30 p-5">
                <h3 className="label-xs mb-4 text-zinc-400">Assets (URLs)</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Footages URL"><input className={inp} placeholder="https://…" value={f.footages_url} onChange={(e) => updateField("footages_url", e.target.value)} /></Field>
                  <Field label="Script URL"><input className={inp} placeholder="https://…" value={f.script_url} onChange={(e) => updateField("script_url", e.target.value)} /></Field>
                </div>
              </section>

              <section className="rounded-md border border-white/10 bg-zinc-900/30 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="label-xs text-zinc-400">Creative Brief</h3>
                  <button onClick={scoreBrief} className="rounded-md border border-white/10 px-3 py-1.5 text-xs hover:bg-white/5">Score brief</button>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Goal"><textarea rows={2} className={inp} value={f.brief_goal} onChange={(e) => updateField("brief_goal", e.target.value)} /></Field>
                  <Field label="Target Audience"><textarea rows={2} className={inp} value={f.brief_audience} onChange={(e) => updateField("brief_audience", e.target.value)} /></Field>
                  <Field label="Style"><textarea rows={2} className={inp} value={f.brief_style} onChange={(e) => updateField("brief_style", e.target.value)} /></Field>
                  <Field label="Hook"><textarea rows={2} className={inp} value={f.brief_hook} onChange={(e) => updateField("brief_hook", e.target.value)} /></Field>
                  <Field label="Body"><textarea rows={2} className={inp} value={f.brief_body} onChange={(e) => updateField("brief_body", e.target.value)} /></Field>
                  <Field label="CTA"><textarea rows={2} className={inp} value={f.brief_cta} onChange={(e) => updateField("brief_cta", e.target.value)} /></Field>
                  <Field label="References"><textarea rows={2} className={inp} value={f.brief_references} onChange={(e) => updateField("brief_references", e.target.value)} /></Field>
                  <Field label="Notes"><textarea rows={2} className={inp} value={f.brief_notes} onChange={(e) => updateField("brief_notes", e.target.value)} /></Field>
                </div>
              </section>

              <section className="rounded-md border border-white/10 bg-zinc-900/30 p-5">
                <h3 className="label-xs mb-4 text-zinc-400">Assignment</h3>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Skill Tags (comma separated)"><input className={inp} value={f.skill_tags} onChange={(e) => updateField("skill_tags", e.target.value)} placeholder="reels, motion, color-grading" /></Field>
                  <Field label="Assign Editor (optional — leave blank for open market)">
                    <select className={inp} value={f.assigned_editor_id} onChange={(e) => updateField("assigned_editor_id", e.target.value)}>
                      <option value="">— Open market (editors request) —</option>
                      {editors.map((ed) => <option key={ed.id} value={ed.id}>{ed.anime_name || ed.display_name || ed.email}</option>)}
                    </select>
                  </Field>
                </div>
              </section>
            </div>

            <aside className="space-y-4">
              <div className="sticky top-6 rounded-md border border-white/10 bg-zinc-900/30 p-5">
                <div className="label-xs mb-3 text-zinc-400">Brief Health Score</div>
                <div className="mb-2 font-mono text-5xl font-semibold" style={{ color: health ? health.score >= 80 ? "#10B981" : health.score >= 60 ? "#F59E0B" : "#EF4444" : "#71717A" }}>
                  {health ? `${health.score}%` : "—"}
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full transition-all" style={{ width: `${health?.score || 0}%`, backgroundColor: health?.score >= 80 ? "#10B981" : health?.score >= 60 ? "#F59E0B" : "#EF4444" }} />
                </div>
                {health?.suggestions?.length > 0 && <div className="mt-4 space-y-1.5">{health.suggestions.map((s, i) => <div key={i} className="border-l-2 border-amber-500/50 pl-2 text-xs text-zinc-400">{s}</div>)}</div>}
                {!health && <div className="mt-2 text-xs text-zinc-500">Click “Score brief” to analyze.</div>}
              </div>
            </aside>
          </div>
    </ModeratorLayout>
  );
}
