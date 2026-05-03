import { useEffect, useState } from "react";
import Layout, { PageHeader, MetricCard, Badge } from "../components/Layout";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const inputClass =
  "w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20";

const textareaClass =
  "w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20";

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
    <div className="mb-5 border border-white/10 rounded-md p-4 bg-zinc-900/30">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-semibold">Edit Project</h3>

        <button
          onClick={onCancel}
          className="text-xs text-zinc-400 hover:text-white"
        >
          Cancel
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-3 text-sm">
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
          placeholder="Aspect Ratio"
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
          placeholder="Target Audience"
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
        className="mt-4 w-full bg-white text-black rounded-md py-2 text-sm font-medium hover:bg-zinc-200 disabled:opacity-50"
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
    const { data } = await api.get("/tasks");
    setTasks(data);
  };

  useEffect(() => {
    load();
  }, []);

  const activeTasks = tasks.filter(
    (task) => task.status !== "completed" && task.status !== "draft"
  );

  const pastTasks = tasks.filter((task) => task.status === "completed");

  const openDetail = async (task, openEdit = false) => {
    try {
      const { data } = await api.get(`/tasks/${task.id}`);
      setDetail(data);
      setErr("");

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
      setDetail(null);
      setEditing(false);
      setEditForm(null);
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
    try {
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

  return (
    <Layout allowed={["client"]}>
      <PageHeader
        label={`Client / ${user?.display_name || ""}`}
        title="Your Projects"
        subtitle="Preview drafts, request revisions, edit briefs, and approve work."
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Active"
          value={activeTasks.filter((task) => task.status === "active").length}
          tone="warn"
        />

        <MetricCard
          label="In Revision"
          value={tasks.filter((task) => task.status === "revision").length}
          tone="bad"
        />

        <MetricCard label="Completed" value={pastTasks.length} tone="good" />

        <MetricCard label="Total" value={tasks.length} />
      </div>

      {err && (
        <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">
          {err}
        </div>
      )}

      <h2 className="text-lg font-semibold mb-3">Ongoing</h2>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {activeTasks.map((task) => (
          <div
            key={task.id}
            className="border border-white/10 rounded-md p-5 bg-zinc-900/30 card-hover"
            data-testid={`client-task-${task.id}`}
          >
            <div className="flex justify-between items-start mb-2">
              <Badge>{task.project_type}</Badge>

              <Badge tone={task.status === "revision" ? "bad" : "warn"}>
                {task.status === "revision"
                  ? "Revision"
                  : task.status === "pending_admin_approval"
                    ? "Pending Approval"
                    : "In Progress"}
              </Badge>
            </div>

            <div className="font-medium mb-1">{task.title}</div>

            <div className="text-xs text-zinc-500 font-mono mb-3">
              Due {task.deadline?.slice(0, 10)}
            </div>

            <div className="text-xs text-zinc-400 mb-3">
              Drafts: {(task.drafts || []).length}
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
        ))}

        {activeTasks.length === 0 && (
          <div className="col-span-full text-sm text-zinc-500 p-8 text-center">
            No ongoing projects.
          </div>
        )}
      </div>

      {pastTasks.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mb-3">Past works</h2>

          <div className="grid md:grid-cols-3 gap-4">
            {pastTasks.map((task) => (
              <div
                key={task.id}
                className="border border-white/10 rounded-md p-4 bg-zinc-900/30"
              >
                <div className="font-medium">{task.title}</div>
                <div className="text-xs text-zinc-500 mt-1">{task.project_type}</div>

                <div className="flex gap-2 mt-3">
                  <Badge tone="good">Delivered</Badge>

                  <button
                    onClick={() => openDetail(task, false)}
                    className="ml-auto text-xs px-3 py-1 rounded-md border border-white/10 hover:bg-white/5"
                  >
                    Open
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {detail && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 overflow-y-auto p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-zinc-950 border border-white/10 rounded-md max-w-4xl w-full my-6 mx-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-4 mb-5">
              <div>
                <div className="label-xs text-zinc-500 mb-1">
                  {detail.project_type}
                </div>

                <h2 className="text-2xl font-semibold">{detail.title}</h2>

                <div className="text-sm text-zinc-400 mt-1">
                  Due {detail.deadline?.slice(0, 10)} · Status: {detail.status}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={startEdit}
                  className="text-xs px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-zinc-200 hover:bg-white/10 transition-all"
                  data-testid="client-edit-project-button"
                >
                  Edit
                </button>

                <button
                  onClick={() => setDetail(null)}
                  className="text-zinc-500 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>

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

            <section className="mb-4">
              <h3 className="label-xs text-zinc-400 mb-2">Project Details</h3>

              <div className="grid md:grid-cols-2 gap-3 text-sm bg-zinc-900/50 border border-white/10 rounded-md p-4">
                <InfoRow label="Project Type" value={detail.project_type} />
                <InfoRow label="Priority" value={detail.priority} />
                <InfoRow label="Deadline" value={detail.deadline?.slice(0, 10)} />
                <InfoRow label="Status" value={detail.status} />
                <InfoRow label="Videos" value={detail.num_videos} />
                <InfoRow label="Duration" value={detail.duration} />
                <InfoRow label="Resolution" value={detail.resolution} />
                <InfoRow label="Aspect Ratio" value={detail.aspect_ratio} />
              </div>
            </section>

            <section className="mb-4">
              <h3 className="label-xs text-zinc-400 mb-2">Assets</h3>

              <div className="space-y-2 text-sm bg-zinc-900/50 border border-white/10 rounded-md p-4">
                <LinkRow label="Footages URL" url={detail.footages_url} />
                <LinkRow label="Script URL" url={detail.script_url} />
              </div>
            </section>

            <section className="mb-4">
              <h3 className="label-xs text-zinc-400 mb-2">Creative Brief</h3>

              <div className="space-y-2 text-sm bg-zinc-900/50 border border-white/10 rounded-md p-4">
                <InfoRow label="Goal" value={detail.brief_goal} />
                <InfoRow label="Target Audience" value={detail.brief_audience} />
                <InfoRow label="Style" value={detail.brief_style} />
                <InfoRow label="Hook" value={detail.brief_hook} />
                <InfoRow label="Body" value={detail.brief_body} />
                <InfoRow label="CTA" value={detail.brief_cta} />
                <InfoRow label="References" value={detail.brief_references} />
                <InfoRow label="Notes" value={detail.brief_notes} />
              </div>
            </section>

            <section className="mb-4">
              <h3 className="label-xs text-zinc-400 mb-2">Drafts</h3>

              <div className="space-y-2">
                {(detail.drafts || []).map((draft) => (
                  <div
                    key={draft.id}
                    className="border border-white/10 rounded-md p-3 text-sm"
                  >
                    <a
                      href={draft.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-400 hover:underline font-mono text-xs break-all"
                    >
                      {draft.url}
                    </a>

                    <div className="text-zinc-400 mt-1">{draft.note}</div>
                  </div>
                ))}

                {(!detail.drafts || detail.drafts.length === 0) && (
                  <div className="text-xs text-zinc-500">No draft yet.</div>
                )}
              </div>
            </section>

            {(detail.revisions || []).length > 0 && (
              <section className="mb-4">
                <h3 className="label-xs text-zinc-400 mb-2">Revision History</h3>

                {(detail.revisions || []).map((revision) => (
                  <div
                    key={revision.id}
                    className="text-sm bg-red-500/10 border border-red-500/20 rounded-md p-3 mb-2"
                  >
                    {revision.note}
                  </div>
                ))}
              </section>
            )}

            {detail.status !== "completed" && (
              <div className="border border-white/10 rounded-md p-4 bg-zinc-900/30 mb-3">
                <div className="label-xs text-zinc-400 mb-2">
                  Request a revision
                </div>

                <textarea
                  data-testid="revision-note-input"
                  rows={3}
                  className={textareaClass}
                  value={revisionText}
                  onChange={(e) => setRevisionText(e.target.value)}
                  placeholder="Describe what to change…"
                />

                <button
                  data-testid="request-revision-button"
                  disabled={!revisionText.trim()}
                  onClick={() => requestRevision(detail.id)}
                  className="w-full mt-2 border border-white/10 rounded-md py-2 text-sm hover:bg-white/5 disabled:opacity-40"
                >
                  Request revision
                </button>
              </div>
            )}

            {detail.status !== "completed" && (
              <button
                data-testid="approve-work-button"
                onClick={() => approveTask(detail)}
                className="w-full bg-emerald-500 text-black font-medium rounded-md py-3 hover:bg-emerald-400"
              >
                Approve & continue
              </button>
            )}

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
              placeholder="Share feedback…"
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
