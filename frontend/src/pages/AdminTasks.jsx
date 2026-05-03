import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api, formatApiError } from "../lib/api";

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

function TaskCard({ task, onOpen, onDragStart, riskLeft }) {
  const isRisky = riskLeft != null && riskLeft < 48;
  const isOverdue = riskLeft != null && riskLeft < 0;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onOpen(task)}
      data-testid={`task-card-${task.id}`}
      className="cursor-pointer border border-white/10 bg-zinc-900/50 rounded-md p-3 hover:bg-zinc-900 transition-all"
      style={
        isRisky
          ? {
              borderLeftWidth: 3,
              borderLeftColor: isOverdue ? "#EF4444" : "#F59E0B",
            }
          : {}
      }
    >
      <div className="text-sm font-medium truncate">{task.title}</div>

      <div className="flex gap-1.5 items-center mt-2 flex-wrap">
        <Badge>{task.project_type}</Badge>

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

        {(task.revisions || []).length > 0 && (
          <Badge tone="bad">↻ {task.revisions.length}</Badge>
        )}
      </div>

      <div className="text-xs text-zinc-500 mt-2 font-mono">
        Due {task.deadline?.slice(0, 10)}
        {isRisky && (
          <span className={isOverdue ? "text-red-400" : "text-amber-400"}>
            {" "}
            · {isOverdue ? "overdue" : "at risk"}
          </span>
        )}
      </div>
    </div>
  );
}

function buildEditForm(task) {
  return {
    title: task.title || "",
    project_type: task.project_type || "Reel",
    priority: task.priority || "medium",
    status: task.status || "available",
    deadline: task.deadline?.slice(0, 10) || "",
    num_videos: task.num_videos || 1,
    duration: task.duration || "",
    resolution: task.resolution || "",
    aspect_ratio: task.aspect_ratio || "",
    client_id: task.client_id || "",
    assigned_editor_id: task.assigned_editor_id || "",
    footages_url: task.footages_url || "",
    script_url: task.script_url || "",
    brief_goal: task.brief_goal || "",
    brief_audience: task.brief_audience || "",
    brief_style: task.brief_style || "",
    brief_hook: task.brief_hook || "",
    brief_body: task.brief_body || "",
    brief_cta: task.brief_cta || "",
    brief_references: task.brief_references || "",
    brief_notes: task.brief_notes || "",
    skill_tags: Array.isArray(task.skill_tags)
      ? task.skill_tags.join(", ")
      : task.skill_tags || "",
    revenue: task.revenue || 0,
    cost: task.cost || 0,
  };
}

function EditProjectForm({
  editForm,
  clients,
  editors,
  onChange,
  onCancel,
  onSave,
  saving,
}) {
  return (
    <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-6 mb-8">
      <div className="flex justify-between items-center mb-5">
        <div>
          <h2 className="text-xl font-semibold">Edit Project</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Update the project details, brief, assets, assignment, and budget.
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

        <select
          className={inputClass}
          value={editForm.status}
          onChange={(e) => onChange("status", e.target.value)}
        >
          {[
            "available",
            "active",
            "submitted",
            "client_review",
            "revision",
            "completed",
            "pending_admin_approval",
            "draft",
            "rejected",
          ].map((status) => (
            <option key={status}>{status}</option>
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
          className={inputClass}
          value={editForm.skill_tags}
          onChange={(e) => onChange("skill_tags", e.target.value)}
          placeholder="Skill tags, comma separated"
        />

        <select
          className={inputClass}
          value={editForm.client_id}
          onChange={(e) => onChange("client_id", e.target.value)}
        >
          <option value="">— No client selected —</option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.display_name || client.real_name || client.email}
            </option>
          ))}
        </select>

        <select
          className={inputClass}
          value={editForm.assigned_editor_id}
          onChange={(e) => onChange("assigned_editor_id", e.target.value)}
        >
          <option value="">— No editor assigned —</option>
          {editors.map((editor) => (
            <option key={editor.id} value={editor.id}>
              {editor.anime_name || editor.display_name || editor.email}
            </option>
          ))}
        </select>

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

        <input
          type="number"
          className={inputClass}
          value={editForm.revenue}
          onChange={(e) => onChange("revenue", e.target.value)}
          placeholder="Revenue"
        />

        <input
          type="number"
          className={inputClass}
          value={editForm.cost}
          onChange={(e) => onChange("cost", e.target.value)}
          placeholder="Cost"
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

export default function AdminTasks() {
  const [tasks, setTasks] = useState([]);
  const [detail, setDetail] = useState(null);
  const [editors, setEditors] = useState([]);
  const [clients, setClients] = useState([]);
  const [recs, setRecs] = useState([]);
  const [risk, setRisk] = useState({});
  const [dragOver, setDragOver] = useState(null);

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [approving, setApproving] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const [taskRes, editorRes, clientRes, riskRes] = await Promise.all([
        api.get("/tasks"),
        api.get("/users?role=editor"),
        api.get("/users?role=client"),
        api.get("/stats/deadline-risk"),
      ]);

      setTasks(taskRes.data);
      setEditors(editorRes.data);
      setClients(clientRes.data);

      const riskMap = {};
      riskRes.data.forEach((item) => {
        riskMap[item.task_id] = item.hours_left;
      });

      setRisk(riskMap);
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to load tasks.");
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
      setEditing(false);
      setEditForm(null);

      if (data.status === "available") {
        const recData = await api.get(`/tasks/${data.id}/recommendations`);
        setRecs(recData.data);
      } else {
        setRecs([]);
      }
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to open task.");
    }
  };

  const goBack = () => {
    setDetail(null);
    setEditing(false);
    setEditForm(null);
    setRecs([]);
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
        client_id: editForm.client_id || null,
        assigned_editor_id: editForm.assigned_editor_id || null,
        num_videos: Number(editForm.num_videos) || 1,
        revenue: Number(editForm.revenue) || 0,
        cost: Number(editForm.cost) || 0,
        skill_tags: editForm.skill_tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
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

  const deleteTask = async () => {
    if (!detail?.id) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${detail.title}"? This cannot be undone.`
    );

    if (!confirmDelete) return;

    try {
      setDeleting(true);
      setErr("");

      await api.delete(`/tasks/${detail.id}`);

      setDetail(null);
      setEditing(false);
      setEditForm(null);
      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to delete project.");
    } finally {
      setDeleting(false);
    }
  };

  const assign = async (editorId) => {
    if (!detail?.id) return;

    try {
      setErr("");

      await api.patch(`/tasks/${detail.id}`, {
        assigned_editor_id: editorId,
        status: "active",
      });

      const { data } = await api.get(`/tasks/${detail.id}`);
      setDetail(data);
      setRecs([]);
      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to assign editor.");
    }
  };

  const approveVideo = async () => {
    if (!detail?.id) return;

    try {
      setApproving(true);
      setErr("");

      await api.post(`/tasks/${detail.id}/admin-approve-video`);

      const { data } = await api.get(`/tasks/${detail.id}`);
      setDetail(data);
      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to approve video.");
    } finally {
      setApproving(false);
    }
  };

  const onDragStart = (e, id) => {
    e.dataTransfer.setData("text/plain", id);
  };

  const onDrop = async (e, status) => {
    e.preventDefault();
    setDragOver(null);

    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;

    try {
      await api.patch(`/tasks/${id}`, { status });
      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail) || "Failed to move task.");
    }
  };

  const columns = [
    { key: "available", label: "Available" },
    { key: "active", label: "Active" },
    { key: "submitted", label: "Awaiting Admin" },
    { key: "client_review", label: "Client Review" },
    { key: "revision", label: "Revision" },
    { key: "completed", label: "Completed" },
  ];

  if (detail) {
    return (
      <Layout allowed={["admin"]}>
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
              <button
                onClick={startEdit}
                className="px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-zinc-200"
              >
                Edit Project
              </button>

              <button
                onClick={deleteTask}
                disabled={deleting}
                className="px-4 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-sm disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
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
              clients={clients}
              editors={editors}
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
              <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-6">
                <h2 className="text-lg font-semibold mb-5">Project Details</h2>

                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <InfoRow label="Project Type" value={detail.project_type} />
                  <InfoRow label="Priority" value={detail.priority} />
                  <InfoRow label="Status" value={detail.status} />
                  <InfoRow label="Deadline" value={detail.deadline?.slice(0, 10)} />
                  <InfoRow label="Videos" value={detail.num_videos} />
                  <InfoRow label="Duration" value={detail.duration} />
                  <InfoRow label="Resolution" value={detail.resolution} />
                  <InfoRow label="Aspect Ratio" value={detail.aspect_ratio} />
                  <InfoRow label="Revenue" value={`$${detail.revenue || 0}`} />
                  <InfoRow label="Cost" value={`$${detail.cost || 0}`} />
                  <InfoRow
                    label="Assigned Editor"
                    value={
                      editors.find((editor) => editor.id === detail.assigned_editor_id)
                        ?.anime_name || "—"
                    }
                  />
                  <InfoRow
                    label="Client"
                    value={
                      clients.find((client) => client.id === detail.client_id)
                        ?.display_name ||
                      clients.find((client) => client.id === detail.client_id)
                        ?.real_name ||
                      "—"
                    }
                  />
                </div>

                {detail.status === "submitted" && (
                  <button
                    onClick={approveVideo}
                    disabled={approving}
                    className="mt-6 w-full bg-emerald-500 text-black rounded-md py-3 text-sm font-medium hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {approving ? "Approving..." : "Approve Video & Send to Client"}
                  </button>
                )}
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

              {(detail.drafts || []).length > 0 && (
                <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-6">
                  <h2 className="text-lg font-semibold mb-5">Drafts Delivered</h2>

                  {(detail.drafts || []).map((draft) => (
                    <div
                      key={draft.id}
                      className="border border-white/10 rounded-md p-4 mb-3 text-sm"
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
              )}

              {(detail.revisions || []).length > 0 && (
                <div className="border border-red-500/20 rounded-xl bg-red-500/5 p-6">
                  <h2 className="text-lg font-semibold mb-5 text-red-400">
                    Revision Requests
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
              <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-6">
                <h2 className="text-lg font-semibold mb-5">Assets</h2>

                <div className="space-y-3 text-sm">
                  <LinkRow label="Footages URL" url={detail.footages_url} />
                  <LinkRow label="Script URL" url={detail.script_url} />
                </div>
              </div>

              {detail.status === "available" && (
                <div className="border border-white/10 rounded-xl bg-zinc-900/30 p-6">
                  <h2 className="text-lg font-semibold mb-5">
                    Recommended Editors
                  </h2>

                  <div className="space-y-3">
                    {recs.slice(0, 5).map((rec, index) => (
                      <div
                        key={rec.editor.id}
                        className="border border-white/10 rounded-md p-3"
                      >
                        <div className="flex justify-between items-center gap-3">
                          <div>
                            <div className="text-sm font-medium">
                              #{index + 1} {rec.editor.anime_name}
                            </div>

                            <div className="text-xs text-zinc-500 mt-1">
                              Match {rec.skill_match}% · Perf{" "}
                              {rec.performance_score}% · Avail{" "}
                              {rec.availability}%
                            </div>
                          </div>

                          <button
                            onClick={() => assign(rec.editor.id)}
                            className="text-xs px-3 py-1.5 bg-white text-black rounded-md hover:bg-zinc-200"
                          >
                            Assign
                          </button>
                        </div>
                      </div>
                    ))}

                    {recs.length === 0 && (
                      <div className="text-xs text-zinc-500">
                        No recommendations yet.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout allowed={["admin"]}>
      <PageHeader
        label="Admin / Tasks"
        title="Project Pipeline"
        subtitle="Click a project to open its full details page. Drag cards across columns."
      />

      {err && (
        <div className="mb-5 text-sm text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-2 rounded-md">
          {err}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        {columns.map((column) => {
          const items = tasks.filter((task) => task.status === column.key);

          return (
            <div
              key={column.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(column.key);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDrop(e, column.key)}
              className={`bg-zinc-900/50 border rounded-md p-3 transition-all ${
                dragOver === column.key
                  ? "border-white/40 bg-zinc-800/50"
                  : "border-white/10"
              }`}
              data-testid={`kanban-column-${column.key}`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="label-xs text-zinc-400">{column.label}</div>

                <span className="font-mono text-xs text-zinc-500">
                  {items.length}
                </span>
              </div>

              <div className="space-y-2 min-h-[100px]">
                {items.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={openDetail}
                    onDragStart={onDragStart}
                    riskLeft={risk[task.id]}
                  />
                ))}

                {items.length === 0 && (
                  <div className="text-xs text-zinc-600 p-3 text-center border border-dashed border-white/5 rounded-md">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
