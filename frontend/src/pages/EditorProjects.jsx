import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api, formatApiError } from "../lib/api";

const inputClass =
  "w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20";

const textareaClass =
  "w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20";

const columns = [
  { key: "available", label: "Available", empty: "No available projects" },
  { key: "active", label: "Active", empty: "No active projects" },
  { key: "submitted", label: "Awaiting Admin", empty: "No drafts awaiting admin" },
  { key: "client_review", label: "Client Review", empty: "No projects with client" },
  { key: "revision", label: "Revision", empty: "No revisions" },
  { key: "completed", label: "Completed", empty: "No completed projects" },
];

function InfoRow({ label, value }) {
  return (
    <div>
      <span className="text-zinc-500">{label}: </span>
      <span>{value || "—"}</span>
    </div>
  );
}

function LinkRow({ label, url }) {
  return (
    <div>
      <span className="text-zinc-500">{label}: </span>
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-blue-400 hover:underline break-all"
        >
          {url}
        </a>
      ) : (
        <span>—</span>
      )}
    </div>
  );
}

function statusTone(status) {
  if (status === "revision") return "bad";
  if (status === "completed") return "good";
  if (status === "submitted" || status === "client_review") return "warn";
  if (status === "active") return "blue";
  return "default";
}

function ProjectCard({ task, onOpen }) {
  return (
    <div
      onClick={() => onOpen(task)}
      className="cursor-pointer border border-white/10 rounded-md p-4 bg-zinc-900/30 hover:bg-zinc-900/60 transition-all card-hover"
      data-testid={`editor-project-${task.id}`}
    >
      <div className="flex justify-between items-start gap-3 mb-2">
        <div className="font-medium truncate">{task.title}</div>

        <Badge
          tone={
            task.priority === "urgent"
              ? "bad"
              : task.priority === "high"
                ? "warn"
                : "default"
          }
        >
          {task.priority}
        </Badge>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-3">
        <Badge>{task.project_type}</Badge>
        <Badge tone={statusTone(task.status)}>{task.status}</Badge>
        {(task.revisions || []).length > 0 && (
          <Badge tone="bad">↻ {task.revisions.length}</Badge>
        )}
      </div>

      <div className="text-xs text-zinc-500 font-mono">
        Due {task.deadline?.slice(0, 10)}
      </div>

      <div className="text-xs text-zinc-400 mt-2">
        Drafts: {(task.drafts || []).length}
      </div>
    </div>
  );
}

export default function EditorProjects() {
  const [tasks, setTasks] = useState([]);
  const [detail, setDetail] = useState(null);

  const [draftUrl, setDraftUrl] = useState("");
  const [draftNote, setDraftNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [err, setErr] = useState("");

  const load = async () => {
    try {
      setErr("");
      const { data } = await api.get("/tasks");
      setTasks(data);
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to load projects.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openDetail = async (task) => {
    try {
      setErr("");
      const { data } = await api.get(`/tasks/${task.id}`);
      setDetail(data);
      setDraftUrl("");
      setDraftNote("");
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to open project.");
    }
  };

  const goBack = () => {
    setDetail(null);
    setDraftUrl("");
    setDraftNote("");
  };

  const submitDraft = async () => {
    if (!detail?.id || !draftUrl.trim()) return;

    try {
      setSubmitting(true);
      setErr("");

      await api.post(`/tasks/${detail.id}/submit`, {
        video_url: draftUrl.trim(),
        note: draftNote.trim(),
      });

      const { data } = await api.get(`/tasks/${detail.id}`);
      setDetail(data);
      setDraftUrl("");
      setDraftNote("");
      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to submit draft.");
    } finally {
      setSubmitting(false);
    }
  };

  if (detail) {
    return (
      <Layout allowed={["editor"]}>
        <div className="max-w-7xl mx-auto pb-20">
          <div className="flex items-start justify-between gap-4 mb-8 border-b border-white/10 pb-6">
            <div>
              <button
                onClick={goBack}
                className="text-sm text-zinc-400 hover:text-white mb-5"
              >
                ← Back to Synced Pipeline
              </button>

              <div className="label-xs text-zinc-500 mb-2">
                {detail.project_type || "Project"}
              </div>

              <h1 className="text-4xl font-semibold tracking-tight">
                {detail.title}
              </h1>

              <p className="text-zinc-500 mt-2">
                Status: <span className="text-zinc-300">{detail.status}</span>
              </p>
            </div>

            <button
              onClick={goBack}
              className="px-4 py-2 rounded-md border border-white/10 text-sm hover:bg-white/5"
            >
              Close
            </button>
          </div>

          {err && (
            <div className="mb-5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">
              {err}
            </div>
          )}

          <div className="grid xl:grid-cols-3 gap-6">
            <section className="xl:col-span-2 space-y-6">
              <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-6">
                <div className="flex items-start justify-between gap-4 mb-5">
                  <div>
                    <h2 className="text-lg font-semibold">Project Details</h2>
                    <p className="text-xs text-zinc-500 mt-1">Pipeline status is synced with Admin. Editors can view only; Admin controls movement.</p>
                  </div>
                  <Badge tone={statusTone(detail.status)}>{detail.status}</Badge>
                </div>

                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <InfoRow label="Project Type" value={detail.project_type} />
                  <InfoRow label="Priority" value={detail.priority} />
                  <InfoRow label="Status" value={detail.status} />
                  <InfoRow label="Deadline" value={detail.deadline?.slice(0, 10)} />
                  <InfoRow label="Videos" value={detail.num_videos} />
                  <InfoRow label="Duration" value={detail.duration} />
                  <InfoRow label="Resolution" value={detail.resolution} />
                  <InfoRow label="Aspect Ratio" value={detail.aspect_ratio} />
                </div>
              </div>

              <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-6">
                <h2 className="text-lg font-semibold mb-5">Creative Brief</h2>

                <div className="space-y-3 text-sm">
                  <InfoRow label="Goal" value={detail.brief_goal} />
                  <InfoRow label="Audience" value={detail.brief_audience} />
                  <InfoRow label="Style" value={detail.brief_style} />
                  <InfoRow label="Hook" value={detail.brief_hook} />
                  <InfoRow label="Body" value={detail.brief_body} />
                  <InfoRow label="CTA" value={detail.brief_cta} />
                  <InfoRow label="References" value={detail.brief_references} />
                  <InfoRow label="Notes" value={detail.brief_notes} />

                  <div>
                    <span className="text-zinc-500">Skill Tags: </span>
                    {detail.skill_tags?.length ? (
                      <span className="inline-flex flex-wrap gap-1">
                        {detail.skill_tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300"
                          >
                            {tag}
                          </span>
                        ))}
                      </span>
                    ) : (
                      <span>—</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-6">
                <h2 className="text-lg font-semibold mb-5">Assets</h2>
                <div className="space-y-3 text-sm">
                  <LinkRow label="Footages URL" url={detail.footages_url} />
                  <LinkRow label="Script URL" url={detail.script_url} />
                </div>
              </div>

              <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-6">
                <h2 className="text-lg font-semibold mb-5">Drafts Delivered</h2>

                {(detail.drafts || []).length > 0 ? (
                  <div className="space-y-3">
                    {(detail.drafts || []).map((draft) => (
                      <div key={draft.id} className="border border-white/10 rounded-md p-4 text-sm">
                        <a href={draft.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline break-all">
                          {draft.url}
                        </a>
                        {draft.note && <div className="text-zinc-400 mt-2">{draft.note}</div>}
                        <div className="text-xs text-zinc-600 mt-2 font-mono">
                          Uploaded {draft.uploaded_at?.slice(0, 10)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500">No drafts yet.</div>
                )}
              </div>

              {(detail.revisions || []).length > 0 && (
                <div className="border border-red-500/20 rounded-xl bg-red-500/5 p-6">
                  <h2 className="text-lg font-semibold mb-5 text-red-400">Revision Requests</h2>
                  {(detail.revisions || []).map((revision) => (
                    <div key={revision.id} className="border border-red-500/20 rounded-md p-4 mb-3 text-sm text-red-200">
                      {revision.note}
                      <div className="text-xs text-red-300/60 mt-2 font-mono">
                        {revision.created_at?.slice(0, 10)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-6">
              {detail.status !== "completed" && (
                <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-6">
                  <h2 className="text-lg font-semibold mb-2">Submit Draft</h2>
                  <p className="text-xs text-zinc-500 mb-5">Submitting a draft sends it to Admin review. The board stage updates after Admin action.</p>

                  <div className="space-y-3">
                    <input data-testid="draft-url-input" className={inputClass} value={draftUrl} onChange={(e) => setDraftUrl(e.target.value)} placeholder="Draft URL" />
                    <textarea data-testid="draft-note-input" rows={4} className={textareaClass} value={draftNote} onChange={(e) => setDraftNote(e.target.value)} placeholder="Notes for admin/client..." />
                    <button data-testid="submit-draft-button" onClick={submitDraft} disabled={submitting || !draftUrl.trim()} className="w-full bg-white text-black rounded-md py-3 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50">
                      {submitting ? "Submitting..." : "Submit Draft"}
                    </button>
                  </div>
                </div>
              )}

              <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-6">
                <h2 className="text-lg font-semibold mb-5">Read-only Pipeline</h2>
                <div className="space-y-3 text-sm">
                  <InfoRow label="Current Status" value={detail.status} />
                  <InfoRow label="Priority" value={detail.priority} />
                  <InfoRow label="Deadline" value={detail.deadline?.slice(0, 10)} />
                  <InfoRow label="Draft Count" value={(detail.drafts || []).length} />
                  <InfoRow label="Revision Count" value={(detail.revisions || []).length} />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout allowed={["editor"]}>
      <PageHeader
        label="Editor / Synced Pipeline"
        title="My Projects"
        subtitle="Synced with the Admin project pipeline. Editors can view project stages, but only Admin can move cards."
      />

      {err && (
        <div className="mb-5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">
          {err}
        </div>
      )}

      <div className="mb-4 text-xs text-zinc-500 border border-white/10 rounded-md bg-zinc-900/30 px-4 py-3">
        Read-only view: stage changes are controlled from the Admin Tasks pipeline.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        {columns.map((column) => {
          const items = tasks.filter((task) => task.status === column.key);

          return (
            <section
              key={column.key}
              className="border border-white/10 rounded-md bg-zinc-900/30 p-4"
              data-testid={`kanban-column-${column.key}`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="label-xs text-zinc-400">{column.label}</div>
                <span className="font-mono text-xs text-zinc-500">{items.length}</span>
              </div>

              <div className="space-y-3 min-h-[120px]">
                {items.map((task) => (
                  <ProjectCard key={task.id} task={task} onOpen={openDetail} />
                ))}

                {items.length === 0 && (
                  <div className="text-xs text-zinc-600 p-3 text-center border border-dashed border-white/5 rounded-md">
                    {column.empty}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </Layout>
  );
}
