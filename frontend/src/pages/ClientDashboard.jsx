import { useEffect, useState } from "react";
import Layout, { PageHeader, MetricCard, Badge } from "../components/Layout";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

export default function ClientDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [detail, setDetail] = useState(null);
  const [revisionText, setRevisionText] = useState("");
  const [reviewModal, setReviewModal] = useState(null);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [err, setErr] = useState("");

  const load = async () => {
    const { data } = await api.get("/tasks");
    setTasks(data);
  };
  useEffect(() => { load(); }, []);

  const activeTasks = tasks.filter(t => t.status !== "completed" && t.status !== "draft");
  const pastTasks = tasks.filter(t => t.status === "completed");

  const requestRevision = async (id) => {
    try {
      await api.post(`/tasks/${id}/revision`, { note: revisionText });
      setRevisionText(""); setDetail(null); load();
    } catch (e) { setErr(formatApiError(e?.response?.data?.detail)); }
  };

  const approveTask = async (t) => {
    await api.post(`/tasks/${t.id}/approve`);
    setDetail(null);
    setReviewModal(t);
    load();
  };

  const submitReview = async () => {
    await api.post(`/tasks/${reviewModal.id}/review`, { rating, feedback });
    setReviewModal(null); setRating(5); setFeedback("");
  };

  return (
    <Layout allowed={["client"]}>
      <PageHeader label={`Client / ${user?.display_name || ""}`} title="Your Projects" subtitle="Preview drafts, request revisions, and approve work." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Active" value={activeTasks.filter(t => t.status === "active").length} tone="warn" />
        <MetricCard label="In Revision" value={tasks.filter(t => t.status === "revision").length} tone="bad" />
        <MetricCard label="Completed" value={pastTasks.length} tone="good" />
        <MetricCard label="Total" value={tasks.length} />
      </div>

      <h2 className="text-lg font-semibold mb-3">Ongoing</h2>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {activeTasks.map(t => (
          <div key={t.id} className="border border-white/10 rounded-md p-5 bg-zinc-900/30 card-hover" data-testid={`client-task-${t.id}`}>
            <div className="flex justify-between items-start mb-2">
              <Badge>{t.project_type}</Badge>
              <Badge tone={t.status === "revision" ? "bad" : "warn"}>{t.status === "revision" ? "Revision" : "In Progress"}</Badge>
            </div>
            <div className="font-medium mb-1">{t.title}</div>
            <div className="text-xs text-zinc-500 font-mono mb-3">Due {t.deadline?.slice(0,10)}</div>
            <div className="text-xs text-zinc-400 mb-3">Drafts: {(t.drafts || []).length}</div>
            <button onClick={() => setDetail(t)} className="w-full bg-white text-black rounded-md py-2 text-sm font-medium hover:bg-zinc-200" data-testid={`open-client-task-${t.id}`}>Open</button>
          </div>
        ))}
        {activeTasks.length === 0 && <div className="col-span-full text-sm text-zinc-500 p-8 text-center">No ongoing projects.</div>}
      </div>

      {pastTasks.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3">Past works</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {pastTasks.map(t => (
              <div key={t.id} className="border border-white/10 rounded-md p-4 bg-zinc-900/30">
                <div className="font-medium">{t.title}</div>
                <div className="text-xs text-zinc-500 mt-1">{t.project_type}</div>
                <Badge tone="good">Delivered</Badge>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 grid place-items-center p-4" onClick={() => setDetail(null)}>
          <div className="bg-zinc-950 border border-white/10 rounded-md max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-semibold mb-1">{detail.title}</h2>
            <div className="text-sm text-zinc-400 mb-4">{detail.project_type}</div>

            <h3 className="label-xs text-zinc-400 mb-2">Drafts</h3>
            <div className="space-y-2 mb-4">
              {(detail.drafts || []).map(d => (
                <div key={d.id} className="border border-white/10 rounded-md p-3 text-sm">
                  <a href={d.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline font-mono text-xs">{d.url}</a>
                  <div className="text-zinc-400 mt-1">{d.note}</div>
                </div>
              ))}
              {(!detail.drafts || detail.drafts.length === 0) && <div className="text-xs text-zinc-500">No draft yet.</div>}
            </div>

            <div className="border border-white/10 rounded-md p-4 bg-zinc-900/30 mb-3">
              <div className="label-xs text-zinc-400 mb-2">Request a revision</div>
              <textarea data-testid="revision-note-input" rows={3} className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm mb-2" value={revisionText} onChange={e => setRevisionText(e.target.value)} placeholder="Describe what to change…" />
              <button data-testid="request-revision-button" disabled={!revisionText.trim()} onClick={() => requestRevision(detail.id)} className="w-full border border-white/10 rounded-md py-2 text-sm hover:bg-white/5 disabled:opacity-40">Request revision</button>
            </div>

            <button data-testid="approve-work-button" onClick={() => approveTask(detail)} className="w-full bg-emerald-500 text-black font-medium rounded-md py-3 hover:bg-emerald-400">Approve & continue</button>
            {err && <div className="mt-2 text-red-400 text-sm">{err}</div>}
          </div>
        </div>
      )}

      {/* Review modal */}
      {reviewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 grid place-items-center p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-md max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-2">Rate this delivery</h2>
            <p className="text-sm text-zinc-400 mb-4">{reviewModal.title}</p>
            <div className="flex gap-2 justify-center mb-4">
              {[1,2,3,4,5].map(n => (
                <button key={n} data-testid={`rating-${n}`} onClick={() => setRating(n)} className="text-4xl" style={{ color: n <= rating ? "#F59E0B" : "#27272A" }}>★</button>
              ))}
            </div>
            <textarea data-testid="review-feedback" rows={3} className="w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm mb-3" placeholder="Share feedback…" value={feedback} onChange={e => setFeedback(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => setReviewModal(null)} className="flex-1 border border-white/10 rounded-md py-2 text-sm hover:bg-white/5">Skip</button>
              <button data-testid="submit-review-button" onClick={submitReview} className="flex-1 bg-white text-black rounded-md py-2 text-sm font-medium hover:bg-zinc-200">Submit</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
