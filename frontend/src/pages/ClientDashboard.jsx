import { useEffect, useMemo, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const inputClass =
  "w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20";

const textareaClass =
  "w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20";

const statStyles = {
  active: {
    label: "text-blue-300",
    value: "text-blue-300",
    dot: "bg-blue-400",
    border: "rgba(59, 130, 246, 0.30)",
    glow: "rgba(59, 130, 246, 0.10)",
    helper: "Projects moving now",
  },
  revision: {
    label: "text-amber-300",
    value: "text-amber-300",
    dot: "bg-amber-400",
    border: "rgba(245, 158, 11, 0.34)",
    glow: "rgba(245, 158, 11, 0.11)",
    helper: "Needs changes",
  },
  completed: {
    label: "text-emerald-300",
    value: "text-emerald-300",
    dot: "bg-emerald-400",
    border: "rgba(34, 197, 94, 0.30)",
    glow: "rgba(34, 197, 94, 0.10)",
    helper: "Delivered work",
  },
  total: {
    label: "text-purple-300",
    value: "text-purple-300",
    dot: "bg-purple-400",
    border: "rgba(168, 85, 247, 0.30)",
    glow: "rgba(168, 85, 247, 0.10)",
    helper: "All projects",
  },
};

const statusStyles = {
  active: {
    border: "rgba(59, 130, 246, 0.30)",
    glow: "rgba(59, 130, 246, 0.09)",
    label: "In Progress",
    badgeTone: "blue",
    title: "text-blue-100",
  },
  submitted: {
    border: "rgba(245, 158, 11, 0.32)",
    glow: "rgba(245, 158, 11, 0.10)",
    label: "Awaiting Admin",
    badgeTone: "warn",
    title: "text-amber-100",
  },
  client_review: {
    border: "rgba(168, 85, 247, 0.32)",
    glow: "rgba(168, 85, 247, 0.10)",
    label: "Ready to Review",
    badgeTone: "blue",
    title: "text-purple-100",
  },
  pending_admin_approval: {
    border: "rgba(245, 158, 11, 0.32)",
    glow: "rgba(245, 158, 11, 0.10)",
    label: "Pending Approval",
    badgeTone: "warn",
    title: "text-amber-100",
  },
  revision: {
    border: "rgba(239, 68, 68, 0.32)",
    glow: "rgba(239, 68, 68, 0.10)",
    label: "Revision",
    badgeTone: "bad",
    title: "text-red-100",
  },
  completed: {
    border: "rgba(20, 184, 166, 0.30)",
    glow: "rgba(20, 184, 166, 0.10)",
    label: "Delivered",
    badgeTone: "good",
    title: "text-emerald-100",
  },
  default: {
    border: "rgba(255, 255, 255, 0.10)",
    glow: "rgba(255, 255, 255, 0.04)",
    label: "Project",
    badgeTone: "default",
    title: "text-white",
  },
};

function getStatusStyle(status) {
  return statusStyles[status] || statusStyles.default;
}

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

function ClientStatCard({ type, label, value }) {
  const style = statStyles[type];

  return (
    <div
      className="relative overflow-hidden rounded-xl border p-5 bg-zinc-900/30 min-h-[112px] card-hover"
      style={{
        borderColor: style.border,
        background: `linear-gradient(135deg, ${style.glow}, rgba(24, 24, 27, 0.44) 58%, rgba(9, 9, 11, 0.74))`,
      }}
    >
      <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: style.border }} />
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className={`label-xs ${style.label}`}>{label}</div>
        <span className={`w-2 h-2 rounded-full ${style.dot}`} />
      </div>
      <div className={`font-mono text-4xl font-semibold tracking-tight ${style.value}`}>{value}</div>
      <div className="text-xs text-zinc-600 mt-2">{style.helper}</div>
    </div>
  );
}

function ProjectInfoPill({ label, value }) {
  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">{label}</div>
      <div className="text-sm text-zinc-200 mt-1 truncate">{value || "—"}</div>
    </div>
  );
}

function buildEditForm(project) {
  return {
    title: project.title || "",
    project_type: project.project_type || "Reel",
    priority: project.priority || "medium",
    deadline: project.deadline?.slice(0, 10) || "",
    num_videos: project.num_videos || 1,
    duration: project.duration || "",
    resolution: project.resolution || "",
    aspect_ratio: project.aspect_ratio || "",
    footages_url: project.footages_url || "",
    script_url: project.script_url || "",
    brief_goal: project.brief_goal || "",
    brief_audience: project.brief_audience || "",
    brief_style: project.brief_style || "",
    brief_hook: project.brief_hook || "",
    brief_body: project.brief_body || "",
    brief_cta: project.brief_cta || "",
    brief_references: project.brief_references || "",
    brief_notes: project.brief_notes || "",
  };
}

function EditProjectForm({ editForm, onChange, onCancel, onSave, saving }) {
  return (
    <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-6 mb-8">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-xl font-semibold">Edit Project</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Update your brief, assets, deadline, and project details.
          </p>
        </div>

        <button
          onClick={onCancel}
          className="text-sm text-zinc-400 hover:text-white"
        >
          Cancel
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <input
          className={inputClass}
          value={editForm.title}
          onChange={(e) => onChange("title", e.target.value)}
          placeholder="Title"
        />

        <select
          className={inputClass}
          value={editForm.project_type}
          onChange={(e) => onChange("project_type", e.target.value)}
        >
          {["Reel", "Ad", "Podcast", "Documentary", "Vlog", "YouTube", "Short"].map(
            (type) => (
              <option key={type}>{type}</option>
            )
          )}
        </select>

        <select
          className={inputClass}
          value={editForm.priority}
          onChange={(e) => onChange("priority", e.target.value)}
        >
          {["low", "medium", "high", "urgent"].map((priority) => (
            <option key={priority}>{priority}</option>
          ))}
        </select>

        <input
          type="date"
          className={inputClass}
          value={editForm.deadline}
          onChange={(e) => onChange("deadline", e.target.value)}
        />

        <input
          type="number"
          className={inputClass}
          value={editForm.num_videos}
          onChange={(e) => onChange("num_videos", e.target.value)}
          placeholder="Number of videos"
        />

        <input
          className={inputClass}
          value={editForm.duration}
          onChange={(e) => onChange("duration", e.target.value)}
          placeholder="Duration"
        />

        <input
          className={inputClass}
          value={editForm.resolution}
          onChange={(e) => onChange("resolution", e.target.value)}
          placeholder="Resolution"
        />

        <input
          className={inputClass}
          value={editForm.aspect_ratio}
          onChange={(e) => onChange("aspect_ratio", e.target.value)}
          placeholder="Aspect ratio"
        />

        <input
          className={`${inputClass} md:col-span-2`}
          value={editForm.footages_url}
          onChange={(e) => onChange("footages_url", e.target.value)}
          placeholder="Footages URL"
        />

        <input
          className={`${inputClass} md:col-span-2`}
          value={editForm.script_url}
          onChange={(e) => onChange("script_url", e.target.value)}
          placeholder="Script URL"
        />

        <textarea
          className={`${textareaClass} md:col-span-2`}
          rows={2}
          value={editForm.brief_goal}
          onChange={(e) => onChange("brief_goal", e.target.value)}
          placeholder="Goal"
        />

        <textarea
          className={`${textareaClass} md:col-span-2`}
          rows={2}
          value={editForm.brief_audience}
          onChange={(e) => onChange("brief_audience", e.target.value)}
          placeholder="Target audience"
        />

        <textarea
          className={`${textareaClass} md:col-span-2`}
          rows={2}
          value={editForm.brief_style}
          onChange={(e) => onChange("brief_style", e.target.value)}
          placeholder="Style"
        />

        <textarea
          className={`${textareaClass} md:col-span-2`}
          rows={2}
          value={editForm.brief_hook}
          onChange={(e) => onChange("brief_hook", e.target.value)}
          placeholder="Hook"
        />

        <textarea
          className={`${textareaClass} md:col-span-2`}
          rows={2}
          value={editForm.brief_body}
          onChange={(e) => onChange("brief_body", e.target.value)}
          placeholder="Body"
        />

        <textarea
          className={`${textareaClass} md:col-span-2`}
          rows={2}
          value={editForm.brief_cta}
          onChange={(e) => onChange("brief_cta", e.target.value)}
          placeholder="CTA"
        />

        <textarea
          className={`${textareaClass} md:col-span-2`}
          rows={2}
          value={editForm.brief_references}
          onChange={(e) => onChange("brief_references", e.target.value)}
          placeholder="References"
        />

        <textarea
          className={`${textareaClass} md:col-span-2`}
          rows={2}
          value={editForm.brief_notes}
          onChange={(e) => onChange("brief_notes", e.target.value)}
          placeholder="Notes"
        />
      </div>

      <button
        onClick={onSave}
        disabled={saving}
        className="mt-5 w-full bg-white text-black rounded-md py-3 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Changes"}
      </button>
    </div>
  );
}

export default function ClientDashboard() {
  const { user } = useAuth();

  const [tasks, setTasks] = useState([]);
  const [detail, setDetail] = useState(null);
  const [revisionText, setRevisionText] = useState("");

  const [reviewModal, setReviewModal] = useState(null);
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState("");

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const { data } = await api.get("/tasks");
      setTasks(data);
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to load projects.");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const activeTasks = tasks.filter(
    (task) => task.status !== "completed" && task.status !== "draft"
  );

  const pastTasks = tasks.filter((task) => task.status === "completed");
  const activeCount = tasks.filter((task) => ["active", "submitted", "client_review", "pending_admin_approval"].includes(task.status)).length;
  const revisionCount = tasks.filter((task) => task.status === "revision").length;
  const completedCount = pastTasks.length;
  const totalCount = tasks.length;

  const projectSummary = useMemo(() => {
    if (!tasks.length) return "No active work yet";
    if (revisionCount) return `${revisionCount} project${revisionCount > 1 ? "s" : ""} need revision`;
    if (activeCount) return `${activeCount} project${activeCount > 1 ? "s" : ""} moving forward`;
    return `${completedCount} delivered project${completedCount === 1 ? "" : "s"}`;
  }, [tasks.length, revisionCount, activeCount, completedCount]);

  const openDetail = async (task, openEdit = false) => {
    try {
      setErr("");

      const { data } = await api.get(`/tasks/${task.id}`);

      setDetail(data);

      if (openEdit) {
        setEditForm(buildEditForm(data));
        setEditing(true);
      } else {
        setEditForm(null);
        setEditing(false);
      }
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to open project.");
    }
  };

  const goBack = () => {
    setDetail(null);
    setEditing(false);
    setEditForm(null);
    setRevisionText("");
  };

  const startEdit = () => {
    if (!detail) return;

    setEditForm(buildEditForm(detail));
    setEditing(true);
  };

  const updateEditForm = (key, value) => {
    setEditForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const saveEdit = async () => {
    if (!detail?.id || !editForm) return;

    try {
      setSavingEdit(true);
      setErr("");

      const payload = {
        ...editForm,
        num_videos: Number(editForm.num_videos) || 1,
      };

      const { data } = await api.patch(`/tasks/${detail.id}`, payload);

      setDetail(data);
      setEditing(false);
      setEditForm(null);
      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to save changes.");
    } finally {
      setSavingEdit(false);
    }
  };

  const requestRevision = async (id) => {
    try {
      setErr("");

      await api.post(`/tasks/${id}/revision`, {
        note: revisionText,
      });

      setRevisionText("");

      const { data } = await api.get(`/tasks/${id}`);
      setDetail(data);

      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to request revision.");
    }
  };

  const approveTask = async (task) => {
    try {
      setErr("");

      await api.post(`/tasks/${task.id}/approve`);

      setDetail(null);
      setEditing(false);
      setEditForm(null);
      setReviewModal(task);

      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to approve project.");
    }
  };

  const submitReview = async () => {
    if (!reviewModal?.id) return;

    try {
      setErr("");

      await api.post(`/tasks/${reviewModal.id}/review`, {
        rating,
        feedback,
      });

      setReviewModal(null);
      setRating(5);
      setFeedback("");
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to submit review.");
    }
  };

  if (detail) {
    return (
      <Layout allowed={["client"]}>
        <div className="max-w-7xl mx-auto pb-20">
          <div className="flex items-start justify-between gap-4 mb-8 border-b border-white/10 pb-6">
            <div>
              <button
                onClick={goBack}
                className="text-sm text-zinc-400 hover:text-white mb-5"
              >
                ← Back to Projects
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

            <div className="flex items-center gap-2">
              {detail.status !== "completed" && (
                <button
                  onClick={startEdit}
                  className="px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-zinc-200"
                >
                  Edit Project
                </button>
              )}

              <button
                onClick={goBack}
                className="px-4 py-2 rounded-md border border-white/10 text-sm hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>

          {err && (
            <div className="mb-5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">
              {err}
            </div>
          )}

          {editing && editForm && (
            <EditProjectForm
              editForm={editForm}
              onChange={updateEditForm}
              onCancel={() => {
                setEditing(false);
                setEditForm(null);
              }}
              onSave={saveEdit}
              saving={savingEdit}
            />
          )}

          <div className="grid xl:grid-cols-3 gap-6">
            <section className="xl:col-span-2 space-y-6">
              <div className="border border-blue-500/20 rounded-xl bg-gradient-to-br from-blue-500/10 via-zinc-900/30 to-zinc-950 p-6">
                <h2 className="text-lg font-semibold mb-5 text-blue-100">Project Details</h2>

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

              <div className="border border-purple-500/20 rounded-xl bg-gradient-to-br from-purple-500/10 via-zinc-900/30 to-zinc-950 p-6">
                <h2 className="text-lg font-semibold mb-5 text-purple-100">Creative Brief</h2>

                <div className="space-y-3 text-sm">
                  <InfoRow label="Goal" value={detail.brief_goal} />
                  <InfoRow label="Audience" value={detail.brief_audience} />
                  <InfoRow label="Style" value={detail.brief_style} />
                  <InfoRow label="Hook" value={detail.brief_hook} />
                  <InfoRow label="Body" value={detail.brief_body} />
                  <InfoRow label="CTA" value={detail.brief_cta} />
                  <InfoRow label="References" value={detail.brief_references} />
                  <InfoRow label="Notes" value={detail.brief_notes} />
                </div>
              </div>

              <div className="border border-cyan-500/20 rounded-xl bg-gradient-to-br from-cyan-500/10 via-zinc-900/30 to-zinc-950 p-6">
                <h2 className="text-lg font-semibold mb-5 text-cyan-100">Drafts Delivered</h2>

                {(detail.drafts || []).length > 0 ? (
                  <div className="space-y-3">
                    {(detail.drafts || []).map((draft) => (
                      <div
                        key={draft.id}
                        className="border border-cyan-500/20 rounded-md p-4 text-sm bg-black/20"
                      >
                        <a
                          href={draft.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-400 hover:underline break-all"
                        >
                          {draft.url}
                        </a>

                        <div className="text-zinc-400 mt-2">{draft.note}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-zinc-500">No drafts yet.</div>
                )}
              </div>

              {(detail.revisions || []).length > 0 && (
                <div className="border border-red-500/20 rounded-xl bg-red-500/5 p-6">
                  <h2 className="text-lg font-semibold mb-5 text-red-400">
                    Revision History
                  </h2>

                  {(detail.revisions || []).map((revision) => (
                    <div
                      key={revision.id}
                      className="border border-red-500/20 rounded-md p-4 mb-3 text-sm text-red-200"
                    >
                      {revision.note}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <aside className="space-y-6">
              <div className="border border-emerald-500/20 rounded-xl bg-gradient-to-br from-emerald-500/10 via-zinc-900/30 to-zinc-950 p-6">
                <h2 className="text-lg font-semibold mb-5 text-emerald-100">Assets</h2>

                <div className="space-y-3 text-sm">
                  <LinkRow label="Footages URL" url={detail.footages_url} />
                  <LinkRow label="Script URL" url={detail.script_url} />
                </div>
              </div>

              {detail.status !== "completed" && (
                <div className="border border-amber-500/20 rounded-xl bg-gradient-to-br from-amber-500/10 via-zinc-900/30 to-zinc-950 p-6">
                  <h2 className="text-lg font-semibold mb-5 text-amber-100">
                    Request Revision
                  </h2>

                  <textarea
                    data-testid="revision-note-input"
                    rows={4}
                    className={textareaClass}
                    value={revisionText}
                    onChange={(e) => setRevisionText(e.target.value)}
                    placeholder="Describe what should be changed..."
                  />

                  <button
                    data-testid="request-revision-button"
                    disabled={!revisionText.trim()}
                    onClick={() => requestRevision(detail.id)}
                    className="w-full mt-3 border border-amber-500/20 rounded-md py-2 text-sm hover:bg-amber-500/10 disabled:opacity-40"
                  >
                    Request Revision
                  </button>
                </div>
              )}

              {detail.status !== "completed" && (
                <div className="border border-emerald-500/20 rounded-xl bg-emerald-500/5 p-6">
                  <h2 className="text-lg font-semibold mb-3 text-emerald-400">
                    Approve Work
                  </h2>

                  <p className="text-sm text-zinc-400 mb-4">
                    Approve the project when you are happy with the delivered draft.
                  </p>

                  <button
                    data-testid="approve-work-button"
                    onClick={() => approveTask(detail)}
                    className="w-full bg-emerald-500 text-black font-medium rounded-md py-3 hover:bg-emerald-400"
                  >
                    Approve & Continue
                  </button>
                </div>
              )}
            </aside>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout allowed={["client"]}>
      <PageHeader
        label={`Client / ${user?.display_name || ""}`}
        title="Your Projects"
        subtitle="Preview drafts, request revisions, edit briefs, and approve work."
      />

      <div className="mb-6 border border-blue-500/20 rounded-xl bg-gradient-to-br from-blue-500/10 via-zinc-900/30 to-zinc-950 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="label-xs text-blue-300 mb-2">Project Status Overview</div>
            <h2 className="text-xl font-semibold text-white">{projectSummary}</h2>
          </div>
          <div className="text-xs text-zinc-500">Synced with your active Motionholic OS project pipeline.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <ClientStatCard label="Active" value={activeCount} type="active" />
        <ClientStatCard label="In Revision" value={revisionCount} type="revision" />
        <ClientStatCard label="Completed" value={completedCount} type="completed" />
        <ClientStatCard label="Total" value={totalCount} type="total" />
      </div>

      {err && (
        <div className="mb-5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">
          {err}
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Ongoing</h2>
        <span className="text-xs text-zinc-600">{activeTasks.length} active item{activeTasks.length === 1 ? "" : "s"}</span>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {activeTasks.map((task) => {
          const statusStyle = getStatusStyle(task.status);
          return (
            <div
              key={task.id}
              className="relative overflow-hidden border rounded-xl p-5 bg-zinc-900/30 card-hover"
              data-testid={`client-task-${task.id}`}
              style={{
                borderColor: statusStyle.border,
                background: `linear-gradient(135deg, ${statusStyle.glow}, rgba(24, 24, 27, 0.44) 58%, rgba(9, 9, 11, 0.74))`,
              }}
            >
              <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: statusStyle.border }} />
              <div className="flex justify-between items-start mb-4 gap-3">
                <Badge>{task.project_type}</Badge>
                <Badge tone={statusStyle.badgeTone}>{statusStyle.label}</Badge>
              </div>

              <div className={`font-semibold text-lg mb-1 ${statusStyle.title}`}>{task.title}</div>
              <div className="text-xs text-zinc-500 font-mono mb-4">
                Due {task.deadline?.slice(0, 10) || "No deadline"}
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <ProjectInfoPill label="Drafts" value={(task.drafts || []).length} />
                <ProjectInfoPill label="Videos" value={task.num_videos || 1} />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => openDetail(task, false)}
                  className="w-full bg-white text-black rounded-md py-2 text-sm font-medium hover:bg-zinc-200"
                  data-testid={`open-client-task-${task.id}`}
                >
                  Open
                </button>

                <button
                  onClick={() => openDetail(task, true)}
                  className="w-full border border-white/10 rounded-md py-2 text-sm hover:bg-white/5"
                  data-testid={`edit-client-task-${task.id}`}
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}

        {activeTasks.length === 0 && (
          <div className="col-span-full border border-dashed border-blue-500/20 rounded-xl bg-blue-500/5 text-sm text-zinc-500 p-10 text-center">
            No ongoing projects.
          </div>
        )}
      </div>

      {pastTasks.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-emerald-100">Past Works</h2>
            <span className="text-xs text-emerald-400/70">{pastTasks.length} delivered</span>
          </div>

          <div className="grid md:grid-cols-3 gap-4">
            {pastTasks.map((task) => {
              const statusStyle = getStatusStyle("completed");
              return (
                <div
                  key={task.id}
                  className="relative overflow-hidden border rounded-xl p-4 bg-zinc-900/30 card-hover"
                  style={{
                    borderColor: statusStyle.border,
                    background: `linear-gradient(135deg, ${statusStyle.glow}, rgba(24, 24, 27, 0.44) 58%, rgba(9, 9, 11, 0.74))`,
                  }}
                >
                  <div className="absolute inset-y-0 left-0 w-[3px]" style={{ background: statusStyle.border }} />
                  <div className="font-medium text-emerald-100">{task.title}</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {task.project_type}
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Badge tone="good">Delivered</Badge>

                    <button
                      onClick={() => openDetail(task, false)}
                      className="ml-auto text-xs px-3 py-1 rounded-md border border-emerald-500/20 hover:bg-emerald-500/10"
                    >
                      Open
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {reviewModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 grid place-items-center p-4">
          <div className="bg-zinc-950 border border-white/10 rounded-md max-w-md w-full p-6">
            <h2 className="text-xl font-semibold mb-2">Rate this delivery</h2>

            <p className="text-sm text-zinc-400 mb-4">{reviewModal.title}</p>

            <div className="flex gap-2 justify-center mb-4">
              {[1, 2, 3, 4, 5].map((number) => (
                <button
                  key={number}
                  data-testid={`rating-${number}`}
                  onClick={() => setRating(number)}
                  className="text-4xl"
                  style={{
                    color: number <= rating ? "#F59E0B" : "#27272A",
                  }}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              data-testid="review-feedback"
              rows={3}
              className={textareaClass}
              placeholder="Share feedback..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
            />

            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setReviewModal(null)}
                className="flex-1 border border-white/10 rounded-md py-2 text-sm hover:bg-white/5"
              >
                Skip
              </button>

              <button
                data-testid="submit-review-button"
                onClick={submitReview}
                className="flex-1 bg-white text-black rounded-md py-2 text-sm font-medium hover:bg-zinc-200"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
