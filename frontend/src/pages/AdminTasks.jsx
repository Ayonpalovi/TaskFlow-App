import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api } from "../lib/api";

const inputClass =
  "w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20";

const textareaClass =
  "w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/20";

function TaskCard({ task, onOpen, onDragStart, riskLeft }) {
  const isRisky = riskLeft != null && riskLeft < 48;
  const isOverdue = riskLeft != null && riskLeft < 0;

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task.id)}
      onClick={() => onOpen(task)}
      data-testid={`task-card-${task.id}`}
      className="cursor-grab active:cursor-grabbing border border-white/10 bg-zinc-900/50 rounded-md p-3 card-hover"
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

      <div className="text-xs text-zinc-500 mt-2 font-mono flex items-center gap-1">
        Due {task.deadline?.slice(0, 10)}
        {isRisky && (
          <span className={isOverdue ? "text-red-400" : "text-amber-400"}>
            · {isOverdue ? "overdue" : "at risk"}
          </span>
        )}
      </div>
    </div>
  );
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
            (x) => (
              <option key={x}>{x}</option>
            ),
          )}
        </select>

        <select
          className={inputClass}
          value={editForm.priority}
          onChange={(e) => onChange("priority", e.target.value)}
        >
          {["low", "medium", "high", "urgent"].map((x) => (
            <option key={x}>{x}</option>
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
          ].map((x) => (
            <option key={x}>{x}</option>
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
          placeholder="Videos"
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
              {editor.anime_name || editor.display_name}
            </option>
          ))}
        </select>

        <input
          className={inputClass}
          value={editForm.skill_tags}
          onChange={(e) => onChange("skill_tags", e.target.value)}
          placeholder="Skill tags, comma separated"
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

export default function AdminTasks() {
  const [tasks, setTasks] = useState([]);
  const [detail, setDetail] = useState(null);
  const [editors, setEditors] = useState([]);
  const [clients, setClients] = useState([]);
  const [recs, setRecs] = useState([]);
  const [risk, setRisk] = useState({});
  const [dragOver, setDragOver] = useState(null);

  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    const [t, editorsRes, clientsRes, r] = await Promise.all([
      api.get("/tasks"),
      api.get("/users?role=editor"),
      api.get("/users?role=client"),
      api.get("/stats/deadline-risk"),
    ]);

    setTasks(t.data);
    setEditors(editorsRes.data);
    setClients(clientsRes.data);

    const rmap = {};
    r.data.forEach((x) => {
      rmap[x.task_id] = x.hours_left;
    });
    setRisk(rmap);
  };

  useEffect(() => {
    load();
  }, []);

  const openDetail = async (task) => {
    try {
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
    } catch (error) {
      alert("Failed to open project details.");
    }
  };

  const assign = async (editorId) => {
    await api.patch(`/tasks/${detail.id}`, {
      assigned_editor_id: editorId,
      status: "active",
    });

    setDetail(null);
    setEditing(false);
    setEditForm(null);
    load();
  };

  const deleteTask = async () => {
    if (!detail?.id) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${detail.title}"? This cannot be undone.`,
    );

    if (!confirmDelete) return;

    try {
      setDeleting(true);
      await api.delete(`/tasks/${detail.id}`);
      setDetail(null);
      setEditing(false);
      setEditForm(null);
      await load();
    } catch (error) {
      alert("Failed to delete project. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  const startEdit = () => {
    setEditForm({
      title: detail.title || "",
      project_type: detail.project_type || "Reel",
      priority: detail.priority || "medium",
      status: detail.status || "available",
      deadline: detail.deadline?.slice(0, 10) || "",
      num_videos: detail.num_videos || 1,
      duration: detail.duration || "",
      resolution: detail.resolution || "",
      aspect_ratio: detail.aspect_ratio || "",
      client_id: detail.client_id || "",
      assigned_editor_id: detail.assigned_editor_id || "",
      footages_url: detail.footages_url || "",
      script_url: detail.script_url || "",
      brief_goal: detail.brief_goal || "",
      brief_audience: detail.brief_audience || "",
      brief_style: detail.brief_style || "",
      brief_hook: detail.brief_hook || "",
      brief_body: detail.brief_body || "",
      brief_cta: detail.brief_cta || "",
      brief_references: detail.brief_references || "",
      brief_notes: detail.brief_notes || "",
      skill_tags: Array.isArray(detail.skill_tags)
        ? detail.skill_tags.join(", ")
        : detail.skill_tags || "",
      revenue: detail.revenue || 0,
      cost: detail.cost || 0,
    });

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
    } catch (error) {
      alert("Failed to save changes. Please try again.");
    } finally {
      setSavingEdit(false);
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

    await api.patch(`/tasks/${id}`, { status });
    load();
  };

  const columns = [
    { key: "available", label: "Available" },
    { key: "active", label: "Active" },
    { key: "submitted", label: "Awaiting Admin" },
    { key: "client_review", label: "Client Review" },
    { key: "revision", label: "Revision" },
    { key: "completed", label: "Completed" },
  ];

  return (
    <Layout allowed={["admin"]}>
      <PageHeader
        label="Admin / Tasks"
        title="Project Pipeline"
        subtitle="Drag cards across columns. Red border = at risk."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4">
        {columns.map((col) => {
          const items = tasks.filter((t) => t.status === col.key);

          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(col.key);
              }}
              onDragLeave={() => setDragOver(null)}
              onDrop={(e) => onDrop(e, col.key)}
              className={`bg-zinc-900/50 border rounded-md p-3 transition-all ${
                dragOver === col.key
                  ? "border-white/40 bg-zinc-800/50"
                  : "border-white/10"
              }`}
              data-testid={`kanban-column-${col.key}`}
            >
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="label-xs text-zinc-400">{col.label}</div>
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

      {detail && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 grid place-items-center p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-zinc-950 border border-white/10 rounded-md max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-4 mb-4">
              <div>
                <div className="label-xs text-zinc-500 mb-1">
                  {detail.project_type}
                </div>
                <h2 className="text-2xl font-semibold">{detail.title}</h2>
                <div className="text-xs text-zinc-500 font-mono mt-1">
                  Status: {detail.status}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={startEdit}
                  className="text-xs px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-zinc-200 hover:bg-white/10 transition-all"
                  data-testid="edit-task-button"
                >
                  Edit
                </button>

                <button
                  onClick={deleteTask}
                  disabled={deleting}
                  className="text-xs px-3 py-1.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                  data-testid="delete-task-button"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>

                <button
                  onClick={() => setDetail(null)}
                  className="text-zinc-500 hover:text-white"
                  data-testid="close-task-modal"
                >
                  ✕
                </button>
              </div>
            </div>

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

            <div className="grid md:grid-cols-2 gap-3 text-sm mb-4">
              <InfoRow label="Project Type" value={detail.project_type} />

              <div>
                <span className="text-zinc-500">Priority:</span>{" "}
                <Badge tone={detail.priority === "urgent" ? "bad" : "default"}>
                  {detail.priority}
                </Badge>
              </div>

              <InfoRow label="Status" value={detail.status} />
              <InfoRow label="Deadline" value={detail.deadline?.slice(0, 10)} />
              <InfoRow label="Videos" value={detail.num_videos} />
              <InfoRow label="Duration" value={detail.duration} />
              <InfoRow label="Resolution" value={detail.resolution} />
              <InfoRow label="Aspect Ratio" value={detail.aspect_ratio} />

              <InfoRow
                label="Revenue"
                value={
                  detail.revenue !== undefined && detail.revenue !== null
                    ? `$${detail.revenue}`
                    : "—"
                }
              />

              <InfoRow
                label="Cost"
                value={
                  detail.cost !== undefined && detail.cost !== null
                    ? `$${detail.cost}`
                    : "—"
                }
              />

              <InfoRow
                label="Revisions"
                value={(detail.revisions || []).length}
              />

              <InfoRow
                label="Assigned Editor"
                value={
                  editors.find((e) => e.id === detail.assigned_editor_id)
                    ?.anime_name || "—"
                }
              />

              <InfoRow
                label="Client"
                value={
                  clients.find((c) => c.id === detail.client_id)?.display_name ||
                  clients.find((c) => c.id === detail.client_id)?.real_name ||
                  "—"
                }
              />
            </div>

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
            </section>

            {(detail.revisions || []).length > 0 && (
              <section className="mb-4">
                <h3 className="label-xs text-zinc-400 mb-2">
                  Revision Requests
                </h3>

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

            {(detail.drafts || []).length > 0 && (
              <section className="mb-4">
                <h3 className="label-xs text-zinc-400 mb-2">Drafts</h3>

                {(detail.drafts || []).map((draft) => (
                  <div
                    key={draft.id}
                    className="text-sm border border-white/10 rounded-md p-3 mb-2"
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
              </section>
            )}

            {detail.status === "available" && (
              <>
                <h3 className="font-semibold mb-3 mt-6">Recommended Editors</h3>

                <div className="space-y-2">
                  {recs.slice(0, 5).map((rec, index) => (
                    <div
                      key={rec.editor.id}
                      className="flex items-center gap-3 p-3 border border-white/10 rounded-md"
                    >
                      <span className="font-mono text-xs text-zinc-500 w-6">
                        #{index + 1}
                      </span>

                      {rec.editor.avatar_url && (
                        <img
                          src={rec.editor.avatar_url}
                          className="w-9 h-9 rounded-md object-cover"
                          alt=""
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">
                          {rec.editor.anime_name}
                        </div>
                        <div className="text-xs text-zinc-500">
                          Match {rec.skill_match}% · Perf{" "}
                          {rec.performance_score}% · Avail {rec.availability}%
                        </div>
                      </div>

                      <div className="font-mono text-lg text-emerald-400">
                        {rec.overall}%
                      </div>

                      <button
                        data-testid={`assign-editor-${rec.editor.id}`}
                        onClick={() => assign(rec.editor.id)}
                        className="text-xs px-3 py-1.5 bg-white text-black rounded-md hover:bg-zinc-200"
                      >
                        Assign
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                <button
                  onClick={startEdit}
                  className="px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-zinc-200 transition-all"
                  data-testid="edit-task-button-bottom"
                >
                  Edit Project
                </button>
            
                <button
                  onClick={deleteTask}
                  disabled={deleting}
                  className="px-4 py-2 rounded-md bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50 text-sm"
                >
                  {deleting ? "Deleting..." : "Delete Project"}
                </button>
              </div>
            
              <button
                onClick={() => setDetail(null)}
                className="px-4 py-2 rounded-md border border-white/10 text-sm hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
