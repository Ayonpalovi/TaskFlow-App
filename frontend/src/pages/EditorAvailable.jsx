import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api, formatApiError } from "../lib/api";

export default function EditorAvailable() {
  const [items, setItems] = useState([]);
  const [msg, setMsg] = useState("");

  const load = async () => {
    const { data } = await api.get("/tasks?status=available");
    setItems(data);
  };
  useEffect(() => { load(); }, []);

  const request = async (id) => {
    setMsg("");
    try {
      await api.post(`/tasks/${id}/request`);
      setMsg("Request submitted. Expires in 12 hours.");
      load();
    } catch (e) { setMsg(formatApiError(e?.response?.data?.detail)); }
  };

  const timeLeft = (expiresAt) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt) - Date.now();
    if (diff <= 0) return "expired";
    const h = Math.floor(diff / 3600000); const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m left`;
  };

  return (
    <Layout allowed={["editor"]}>
      <PageHeader label="Editor / Available" title="Open Briefs" subtitle="Request a brief within 12 hours. Admin approves assignments." />
      {msg && <div className="mb-4 text-sm text-zinc-300 bg-white/5 border border-white/10 px-3 py-2 rounded-md">{msg}</div>}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(t => (
          <div key={t.id} className="border border-white/10 rounded-md p-5 bg-zinc-900/30 card-hover" data-testid={`available-task-${t.id}`}>
            <div className="flex justify-between items-start mb-3">
              <Badge>{t.project_type}</Badge>
              <Badge tone={t.priority === "urgent" ? "bad" : t.priority === "high" ? "warn" : "default"}>{t.priority}</Badge>
            </div>
            <div className="font-mono text-xs text-zinc-500 mb-1">Deadline {t.deadline?.slice(0, 10)}</div>
            <div className="text-sm text-zinc-400 mb-3">{t.num_videos} video(s) · {t.duration || "flex"}</div>
            <div className="flex flex-wrap gap-1 mb-4">
              {(t.skill_tags || []).map(s => <span key={s} className="text-xs px-2 py-0.5 bg-zinc-800 rounded">{s}</span>)}
            </div>
            {t.my_request ? (
              <button disabled className="w-full border border-white/10 rounded-md py-2 text-xs text-zinc-400">
                Requested · {timeLeft(t.my_request.expires_at)}
              </button>
            ) : (
              <button data-testid={`request-task-${t.id}`} onClick={() => request(t.id)} className="w-full bg-white text-black rounded-md py-2 text-sm font-medium hover:bg-zinc-200 transition-all">
                Request brief
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && <div className="col-span-full text-sm text-zinc-500 p-8 text-center">No open briefs right now.</div>}
      </div>
    </Layout>
  );
}
