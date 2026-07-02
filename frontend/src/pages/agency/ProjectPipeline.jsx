import { useMemo, useState } from "react";
import Layout, { PageHeader, Badge, MetricCard } from "../../components/Layout";

const STORE_KEY = "motionholic_os_pipeline_v1";
const STAGES = ["Lead", "Scoping", "Active", "Revision", "Delivered", "Invoiced"];
const STAGE_TONE = { Lead: "default", Scoping: "blue", Active: "blue", Revision: "warn", Delivered: "good", Invoiced: "good" };

function loadStore() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function saveStore(projects) {
  localStorage.setItem(STORE_KEY, JSON.stringify(projects));
}

function makeId() {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

const emptyForm = { client: "", title: "", value: "", deadline: "", stage: "Lead" };

export default function ProjectPipeline() {
  const [projects, setProjects] = useState(loadStore);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [dragId, setDragId] = useState(null);

  const update = (next) => {
    setProjects(next);
    saveStore(next);
  };

  const addProject = () => {
    if (!form.client.trim() || !form.title.trim()) return;
    const project = { id: makeId(), ...form, value: Number(form.value || 0), created_at: new Date().toISOString() };
    update([project, ...projects]);
    setForm(emptyForm);
    setShowForm(false);
  };

  const moveStage = (id, stage) => {
    update(projects.map((p) => (p.id === id ? { ...p, stage } : p)));
  };

  const removeProject = (id) => {
    update(projects.filter((p) => p.id !== id));
  };

  const grouped = useMemo(() => {
    const g = Object.fromEntries(STAGES.map((s) => [s, []]));
    projects.forEach((p) => {
      (g[p.stage] || g.Lead).push(p);
    });
    return g;
  }, [projects]);

  const totals = useMemo(() => {
    const active = projects.filter((p) => !["Invoiced"].includes(p.stage));
    const pipelineValue = active.reduce((s, p) => s + Number(p.value || 0), 0);
    const invoicedValue = projects.filter((p) => p.stage === "Invoiced").reduce((s, p) => s + Number(p.value || 0), 0);
    return { total: projects.length, active: active.length, pipelineValue, invoicedValue };
  }, [projects]);

  return (
    <Layout allowed={["admin"]}>
      <PageHeader
        label="Admin / Project Pipeline"
        title="Project Pipeline"
        subtitle="Track active client work from first contact through invoicing — drag cards between stages or use the stage buttons."
      >
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="px-3 py-2 rounded-md bg-[#0051FF] text-white text-sm font-medium hover:opacity-90"
        >
          {showForm ? "Cancel" : "+ New project"}
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <MetricCard label="Total Projects" value={totals.total} />
        <MetricCard label="In Progress" value={totals.active} tone="blue" />
        <MetricCard label="Pipeline Value" value={`€${totals.pipelineValue.toLocaleString()}`} tone="warn" />
        <MetricCard label="Invoiced Value" value={`€${totals.invoicedValue.toLocaleString()}`} tone="good" />
      </div>

      {showForm && (
        <div className="mb-6 border border-white/10 rounded-md bg-zinc-900/30 p-4 lg:p-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input className="input-field" placeholder="Client name" value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} />
            <input className="input-field" placeholder="Project title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="input-field" type="number" placeholder="Value (€)" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            <input className="input-field" type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} />
            <button type="button" onClick={addProject} className="px-3 py-2 rounded-md bg-white/10 hover:bg-white/15 text-sm font-medium">Add to pipeline</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {STAGES.map((stage) => (
          <div
            key={stage}
            data-testid={`kanban-column-${stage.toLowerCase()}`}
            className="border border-white/10 rounded-md bg-zinc-900/20 p-3 min-h-[220px]"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragId) moveStage(dragId, stage);
              setDragId(null);
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono uppercase tracking-[0.15em] text-zinc-500">{stage}</span>
              <Badge tone={STAGE_TONE[stage]}>{grouped[stage].length}</Badge>
            </div>
            <div className="flex flex-col gap-2">
              {grouped[stage].map((p) => (
                <div
                  key={p.id}
                  draggable
                  onDragStart={() => setDragId(p.id)}
                  className="border border-white/10 rounded-md bg-zinc-900/40 p-3 cursor-grab active:cursor-grabbing"
                >
                  <div className="text-sm font-medium truncate">{p.title}</div>
                  <div className="text-xs text-zinc-500 mt-0.5 truncate">{p.client}</div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-mono text-zinc-400">€{Number(p.value || 0).toLocaleString()}</span>
                    {p.deadline && <span className="text-[10px] text-zinc-500">{p.deadline}</span>}
                  </div>
                  <div className="flex items-center gap-1.5 mt-2">
                    <select
                      className="flex-1 text-xs bg-zinc-950 border border-white/10 rounded-md px-1.5 py-1"
                      value={p.stage}
                      onChange={(e) => moveStage(p.id, e.target.value)}
                    >
                      {STAGES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button type="button" onClick={() => removeProject(p.id)} className="text-zinc-600 hover:text-red-400 text-xs px-1.5" title="Remove">×</button>
                  </div>
                </div>
              ))}
              {grouped[stage].length === 0 && <div className="text-xs text-zinc-600 text-center py-6">No projects</div>}
            </div>
          </div>
        ))}
      </div>

      <style>{`.input-field { background: rgba(24,24,27,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 8px 10px; font-size: 14px; }`}</style>
    </Layout>
  );
}
