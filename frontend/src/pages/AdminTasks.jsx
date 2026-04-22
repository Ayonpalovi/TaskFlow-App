import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api } from "../lib/api";

function TaskCard({ task, onOpen }) {
  return (
    <button onClick={() => onOpen(task)} data-testid={`task-card-${task.id}`}
      className="text-left w-full border border-white/10 bg-zinc-900/50 rounded-md p-3 card-hover">
      <div className="text-sm font-medium truncate">{task.title}</div>
      <div className="flex gap-2 items-center mt-2">
        <Badge>{task.project_type}</Badge>
        <Badge tone={task.priority === "urgent" ? "bad" : task.priority === "high" ? "warn" : "default"}>{task.priority}</Badge>
      </div>
      <div className="text-xs text-zinc-500 mt-2 font-mono">Due: {task.deadline?.slice(0, 10)}</div>
    </button>
  );
}

export default function AdminTasks() {
  const [tasks, setTasks] = useState([]);
  const [detail, setDetail] = useState(null);
  const [editors, setEditors] = useState([]);
  const [recs, setRecs] = useState([]);

  const load = async () => {
    const [t, u] = await Promise.all([api.get("/tasks"), api.get("/users?role=editor")]);
    setTasks(t.data); setEditors(u.data);
  };
  useEffect(() => { load(); }, []);

  const openDetail = async (t) => {
    setDetail(t);
    const { data } = await api.get(`/tasks/${t.id}/recommendations`);
    setRecs(data);
  };

  const assign = async (editorId) => {
    await api.patch(`/tasks/${detail.id}`, { assigned_editor_id: editorId, status: "active" });
    setDetail(null); load();
  };

  const columns = [
    { key: "available", label: "Available" },
    { key: "active", label: "Active" },
    { key: "revision", label: "Revision" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Tasks" title="Project Pipeline" subtitle="Kanban view of all active projects." />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map(col => {
          const items = tasks.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="bg-zinc-900/50 border border-white/10 rounded-md p-3" data-testid={`kanban-column-${col.key}`}>
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="label-xs text-zinc-400">{col.label}</div>
                <span className="font-mono text-xs text-zinc-500">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(t => <TaskCard key={t.id} task={t} onOpen={openDetail} />)}
                {items.length === 0 && <div className="text-xs text-zinc-600 p-3">No items</div>}
              </div>
            </div>
          );
        })}
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 grid place-items-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-zinc-950 border border-white/10 rounded-md max-w-3xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="label-xs text-zinc-500 mb-1">{detail.project_type}</div>
                <h2 className="text-2xl font-semibold">{detail.title}</h2>
              </div>
              <button onClick={() => setDetail(null)} className="text-zinc-500 hover:text-white" data-testid="close-task-modal">✕</button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm mb-4">
              <div><span className="text-zinc-500">Priority:</span> <Badge tone={detail.priority === "urgent" ? "bad" : "default"}>{detail.priority}</Badge></div>
              <div><span className="text-zinc-500">Deadline:</span> <span className="font-mono">{detail.deadline}</span></div>
              <div><span className="text-zinc-500">Videos:</span> <span className="font-mono">{detail.num_videos}</span></div>
              <div><span className="text-zinc-500">Duration:</span> {detail.duration || "—"}</div>
              <div><span className="text-zinc-500">Resolution:</span> {detail.resolution}</div>
              <div><span className="text-zinc-500">Aspect:</span> {detail.aspect_ratio}</div>
            </div>

            <h3 className="font-semibold mb-2 mt-4">Creative Brief</h3>
            <div className="space-y-2 text-sm bg-zinc-900/50 border border-white/10 rounded-md p-4">
              {[["Goal", detail.brief_goal], ["Audience", detail.brief_audience], ["Hook", detail.brief_hook],
                ["Body", detail.brief_body], ["CTA", detail.brief_cta], ["Style", detail.brief_style]].map(([k,v]) => (
                <div key={k}><span className="text-zinc-500">{k}: </span>{v || "—"}</div>
              ))}
            </div>

            {detail.status === "available" && (
              <>
                <h3 className="font-semibold mb-3 mt-6">Recommended Editors</h3>
                <div className="space-y-2">
                  {recs.slice(0, 5).map((r, i) => (
                    <div key={r.editor.id} className="flex items-center gap-3 p-3 border border-white/10 rounded-md">
                      <span className="font-mono text-xs text-zinc-500 w-6">#{i+1}</span>
                      <img src={r.editor.avatar_url} className="w-9 h-9 rounded-md object-cover" alt="" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{r.editor.anime_name}</div>
                        <div className="text-xs text-zinc-500">Match {r.skill_match}% · Perf {r.performance_score}%</div>
                      </div>
                      <div className="font-mono text-lg text-emerald-400">{r.overall}%</div>
                      <button data-testid={`assign-editor-${r.editor.id}`} onClick={() => assign(r.editor.id)} className="text-xs px-3 py-1.5 bg-white text-black rounded-md hover:bg-zinc-200">Assign</button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {detail.assigned_editor_id && (
              <div className="mt-4 p-3 border border-white/10 rounded-md text-sm">
                <span className="text-zinc-500">Assigned to: </span>
                {editors.find(e => e.id === detail.assigned_editor_id)?.anime_name || "—"}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
