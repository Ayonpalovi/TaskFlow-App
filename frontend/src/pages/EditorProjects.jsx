import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api } from "../lib/api";

export default function EditorProjects() {
  const [tasks, setTasks] = useState([]);
  const [detail, setDetail] = useState(null);
  const [draftUrl, setDraftUrl] = useState("");
  const [draftNote, setDraftNote] = useState("");

  const load = async () => {
    const { data } = await api.get("/tasks");
    setTasks(data);
  };
  useEffect(() => { load(); }, []);

  const submitDraft = async () => {
    await api.post(`/tasks/${detail.id}/drafts`, { url: draftUrl, note: draftNote });
    setDraftUrl(""); setDraftNote("");
    const { data } = await api.get(`/tasks/${detail.id}`);
    setDetail(data); load();
  };

  const columns = [
    { key: "active", label: "Active" },
    { key: "pending", label: "Pending" },
    { key: "revision", label: "Revision" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <Layout allowed={["editor"]}>
      <PageHeader label="Editor / Projects" title="My Projects" subtitle="Active, revisions, pending and delivered work." />

      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map(col => {
          const items = tasks.filter(t => t.status === col.key);
          return (
            <div key={col.key} className="bg-zinc-900/50 border border-white/10 rounded-md p-3" data-testid={`editor-kanban-${col.key}`}>
              <div className="flex justify-between mb-3 px-1">
                <div className="label-xs text-zinc-400">{col.label}</div>
                <span className="font-mono text-xs text-zinc-500">{items.length}</span>
              </div>
              <div className="space-y-2">
                {items.map(t => (
                  <button key={t.id} onClick={() => setDetail(t)} className="text-left w-full border border-white/10 bg-zinc-900/50 rounded-md p-3 card-hover" data-testid={`editor-task-${t.id}`}>
                    <div className="text-sm font-medium truncate">{t.title}</div>
                    <div className="text-xs text-zinc-500 mt-1">{t.project_type}</div>
                    <div className="text-xs text-zinc-500 font-mono mt-1">Due {t.deadline?.slice(0,10)}</div>
                    {col.key === "revision" && <Badge tone="bad">Revise</Badge>}
                  </button>
                ))}
                {items.length === 0 && <div className="text-xs text-zinc-600 p-3">Empty</div>}
              </div>
            </div>
          );
        })}
      </div>

      {detail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 grid place-items-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-zinc-950 border border-white/10 rounded-md max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-1">{detail.title}</h2>
            <div className="text-sm text-zinc-400 mb-4">{detail.project_type} · Due {detail.deadline?.slice(0,10)}</div>

            <h3 className="label-xs text-zinc-400 mb-2">Creative Brief</h3>
            <div className="space-y-1 text-sm bg-zinc-900/50 border border-white/10 rounded-md p-4 mb-4">
              {[["Goal", detail.brief_goal],["Hook", detail.brief_hook],["Audience", detail.brief_audience],["CTA", detail.brief_cta],["Style", detail.brief_style]].map(([k,v]) => (
                <div key={k}><span className="text-zinc-500">{k}: </span>{v || "—"}</div>
              ))}
            </div>

            {(detail.revisions || []).length > 0 && (
              <div className="mb-4">
                <h3 className="label-xs text-zinc-400 mb-2">Revision requests</h3>
                {(detail.revisions || []).map(r => (
                  <div key={r.id} className="text-sm bg-red-500/10 border border-red-500/20 rounded-md p-3 mb-2">{r.note}</div>
                ))}
              </div>
            )}

            <h3 className="label-xs text-zinc-400 mb-2">Drafts delivered</h3>
            <div className="space-y-2 mb-4">
              {(detail.drafts || []).map(d => (
                <div key={d.id} className="border border-white/10 rounded-md p-3 text-sm">
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-mono text-xs">{d.url}</a>
                  <div className="text-zinc-400 mt-1">{d.note}</div>
                </div>
              ))}
              {(!detail.drafts || detail.drafts.length === 0) && <div className="text-xs text-zinc-500">No drafts yet.</div>}
            </div>

            <div className="border border-white/10 rounded-md p-4 bg-zinc-900/30">
              <div className="label-xs text-zinc-400 mb-2">Submit draft</div>
              <input data-testid="draft-url-input" placeholder="Draft URL" value={draftUrl} onChange={e => setDraftUrl(e.target.value)} className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm mb-2" />
              <textarea data-testid="draft-note-input" placeholder="Notes (optional)" value={draftNote} onChange={e => setDraftNote(e.target.value)} rows={2} className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm mb-2" />
              <button data-testid="submit-draft-button" onClick={submitDraft} className="w-full bg-white text-black rounded-md py-2 text-sm font-medium hover:bg-zinc-200">Submit draft</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
