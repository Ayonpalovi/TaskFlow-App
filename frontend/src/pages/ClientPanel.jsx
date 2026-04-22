import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api, formatApiError } from "../lib/api";

const SECTIONS = [
  { key: "preview", label: "Preview Drafts" },
  { key: "revise", label: "Request Revision" },
  { key: "approve", label: "Approve Work" },
  { key: "past", label: "Past Works" },
  { key: "review", label: "Reviews" },
];

export default function ClientPanel() {
  const [tasks, setTasks] = useState([]);
  const [active, setActive] = useState("preview");
  const [detail, setDetail] = useState(null);
  const [revisionText, setRevisionText] = useState("");
  const [reviewModal, setReviewModal] = useState(null);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");
  const [reviews, setReviews] = useState([]);
  const [err, setErr] = useState("");

  const load = async () => {
    const [t, r] = await Promise.all([api.get("/tasks"), api.get("/reviews")]);
    setTasks(t.data); setReviews(r.data);
  };
  useEffect(() => { load(); }, []);

  const inProgress = tasks.filter(t => t.status === "active" || t.status === "pending");
  const inRevision = tasks.filter(t => t.status === "revision");
  const past = tasks.filter(t => t.status === "completed");
  const draftsAvailable = tasks.filter(t => (t.drafts || []).length > 0 && t.status !== "completed");

  const submitRevision = async () => {
    setErr("");
    try {
      await api.post(`/tasks/${detail.id}/revision`, { note: revisionText });
      setRevisionText(""); setDetail(null); load();
    } catch (e) { setErr(formatApiError(e?.response?.data?.detail)); }
  };
  const approveWork = async (t) => {
    await api.post(`/tasks/${t.id}/approve`);
    setDetail(null); setReviewModal(t); load();
  };
  const submitReview = async () => {
    await api.post(`/tasks/${reviewModal.id}/review`, { rating, feedback });
    setReviewModal(null); setRating(5); setFeedback(""); load();
  };

  return (
    <Layout allowed={["client"]}>
      <PageHeader label="Client / Panel" title="Project Hub" subtitle="Preview drafts, revise, approve, browse past works, and review." />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-white/10 overflow-x-auto">
        {SECTIONS.map(s => (
          <button
            key={s.key}
            onClick={() => setActive(s.key)}
            data-testid={`tab-${s.key}`}
            className={`px-4 py-3 text-sm transition-all whitespace-nowrap border-b-2 ${active === s.key ? "border-white text-white" : "border-transparent text-zinc-400 hover:text-white"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {active === "preview" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="preview-section">
          {draftsAvailable.length === 0 && <div className="col-span-full text-sm text-zinc-500 p-8 text-center">No drafts available yet.</div>}
          {draftsAvailable.map(t => (
            <div key={t.id} className="border border-white/10 rounded-md p-5 bg-zinc-900/30 card-hover">
              <div className="flex justify-between items-start mb-2">
                <Badge>{t.project_type}</Badge>
                <Badge tone="warn">{(t.drafts || []).length} draft(s)</Badge>
              </div>
              <div className="font-medium mb-2">{t.title}</div>
              <div className="space-y-2 mb-3">
                {(t.drafts || []).slice(-2).map(d => (
                  <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="block text-xs text-blue-400 hover:underline truncate font-mono" data-testid={`draft-link-${d.id}`}>{d.url}</a>
                ))}
              </div>
              <button onClick={() => setDetail(t)} className="w-full bg-white text-black rounded-md py-2 text-sm font-medium hover:bg-zinc-200" data-testid={`open-preview-${t.id}`}>Open</button>
            </div>
          ))}
        </div>
      )}

      {active === "revise" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="revise-section">
          {inProgress.concat(inRevision).length === 0 && <div className="col-span-full text-sm text-zinc-500 p-8 text-center">No active projects to revise.</div>}
          {inProgress.concat(inRevision).map(t => (
            <div key={t.id} className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
              <div className="flex justify-between items-start mb-2">
                <Badge>{t.project_type}</Badge>
                <Badge tone={t.status === "revision" ? "bad" : "warn"}>{t.status}</Badge>
              </div>
              <div className="font-medium mb-1">{t.title}</div>
              <div className="text-xs text-zinc-500 font-mono mb-3">↻ {(t.revisions || []).length} revisions</div>
              <button onClick={() => setDetail(t)} className="w-full border border-white/10 rounded-md py-2 text-sm hover:bg-white/5">Request revision</button>
            </div>
          ))}
        </div>
      )}

      {active === "approve" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="approve-section">
          {draftsAvailable.length === 0 && <div className="col-span-full text-sm text-zinc-500 p-8 text-center">No drafts ready for approval.</div>}
          {draftsAvailable.map(t => (
            <div key={t.id} className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
              <div className="font-medium mb-2">{t.title}</div>
              <div className="text-xs text-zinc-500 mb-3">{(t.drafts || []).length} draft(s) submitted</div>
              <button onClick={() => approveWork(t)} className="w-full bg-emerald-500 text-black rounded-md py-2 text-sm font-medium hover:bg-emerald-400" data-testid={`quick-approve-${t.id}`}>Approve & continue</button>
            </div>
          ))}
        </div>
      )}

      {active === "past" && (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="past-section">
          {past.length === 0 && <div className="col-span-full text-sm text-zinc-500 p-8 text-center">No completed works yet.</div>}
          {past.map(t => (
            <div key={t.id} className="border border-white/10 rounded-md p-5 bg-zinc-900/30">
              <div className="flex justify-between items-start mb-2">
                <Badge tone="good">Delivered</Badge>
                <span className="font-mono text-xs text-zinc-500">{t.completed_at?.slice(0, 10)}</span>
              </div>
              <div className="font-medium mb-1">{t.title}</div>
              <div className="text-xs text-zinc-500 mb-2">{t.project_type} · {t.num_videos} video(s)</div>
              {(t.drafts || []).slice(-1).map(d => (
                <a key={d.id} href={d.url} target="_blank" rel="noreferrer" className="block text-xs text-blue-400 hover:underline truncate font-mono">{d.url}</a>
              ))}
            </div>
          ))}
        </div>
      )}

      {active === "review" && (
        <div className="space-y-3" data-testid="review-section">
          {reviews.length === 0 && <div className="text-sm text-zinc-500 p-8 text-center">No reviews left yet. Approve a project to leave one.</div>}
          {reviews.map(r => {
            const t = tasks.find(x => x.id === r.task_id);
            return (
              <div key={r.id} className="border border-white/10 rounded-md p-4 bg-zinc-900/30">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">{t?.title || "Project"}</div>
                    <div className="text-xs text-zinc-500 font-mono">{r.created_at?.slice(0, 10)}</div>
                  </div>
                  <div className="text-amber-400 font-mono text-lg">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)}</div>
                </div>
                {r.feedback && <div className="text-sm text-zinc-300 mt-2">{r.feedback}</div>}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail modal: preview + revise */}
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
              <button data-testid="request-revision-button" disabled={!revisionText.trim()} onClick={submitRevision} className="w-full border border-white/10 rounded-md py-2 text-sm hover:bg-white/5 disabled:opacity-40">Request revision</button>
            </div>

            <button data-testid="approve-work-button" onClick={() => approveWork(detail)} className="w-full bg-emerald-500 text-black font-medium rounded-md py-3 hover:bg-emerald-400">Approve & continue</button>
            {err && <div className="mt-2 text-red-400 text-sm">{err}</div>}
          </div>
        </div>
      )}

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
