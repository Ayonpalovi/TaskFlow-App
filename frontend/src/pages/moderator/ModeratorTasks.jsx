import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { api, formatApiError } from "../../lib/api";
import ModeratorLayout from "../../components/ModeratorLayout";

const columns = [
  { key: "available", label: "Available", statuses: ["available"], dropStatus: "available" },
  { key: "active", label: "Active", statuses: ["active"], dropStatus: "active" },
  { key: "submitted", label: "Awaiting Admin", statuses: ["submitted", "pending_admin_approval", "awaiting_admin_approval"], dropStatus: "submitted" },
  { key: "client_review", label: "Client Review", statuses: ["client_review"], dropStatus: "client_review" },
  { key: "revision", label: "Revision", statuses: ["revision"], dropStatus: "revision" },
  { key: "completed", label: "Completed", statuses: ["completed"], dropStatus: "completed" },
];

function firstLetter(value) {
  return String(value || "M").charAt(0).toUpperCase();
}

function displayName(user) {
  return user?.display_name || user?.real_name || user?.anime_name || user?.email || "Moderator";
}

function editorName(editor) {
  return editor?.anime_name || editor?.display_name || editor?.real_name || editor?.email || "Unknown editor";
}

function clientName(client) {
  return client?.display_name || client?.real_name || client?.anime_name || client?.email || "—";
}

function statusGroup(status) {
  if (["pending_admin_approval", "awaiting_admin_approval", "admin_review"].includes(status)) return "pending_admin_approval";
  return status || "available";
}

function statusText(status) {
  const labels = {
    available: "available",
    active: "active",
    submitted: "editor approval",
    pending_admin_approval: "client approval",
    awaiting_admin_approval: "client approval",
    client_review: "client review",
    revision: "revision",
    completed: "completed",
    draft: "draft",
    rejected: "rejected",
  };
  return labels[status] || labels[statusGroup(status)] || status || "unknown";
}

function riskTone(hoursLeft) {
  if (hoursLeft == null) return null;
  if (hoursLeft < 0) return "overdue";
  if (hoursLeft < 48) return "at risk";
  return null;
}

function isNotFound(error) {
  return error?.response?.status === 404 || String(error?.response?.data?.detail || "").toLowerCase() === "not found";
}

async function withFallback(primaryAction, fallbackAction) {
  try {
    return await primaryAction();
  } catch (error) {
    if (isNotFound(error) && fallbackAction) return fallbackAction();
    throw error;
  }
}

function Badge({ children, tone = "default" }) {
  const tones = {
    default: "border-white/10 bg-white/5 text-zinc-300",
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-200",
    good: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    warn: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    bad: "border-red-500/25 bg-red-500/10 text-red-300",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] ${tones[tone] || tones.default}`}>{children}</span>;
}

function InfoRow({ label, value }) {
  return <div><span className="text-zinc-500">{label}: </span><span>{value || "—"}</span></div>;
}

function LinkRow({ label, url }) {
  return (
    <div>
      <span className="text-zinc-500">{label}: </span>
      {url ? <a href={url} target="_blank" rel="noreferrer" className="break-all text-blue-400 hover:underline">{url}</a> : <span>—</span>}
    </div>
  );
}

function TaskCard({ task, onOpen, onDragStart, riskLeft }) {
  const risk = riskTone(riskLeft);
  const isOverdue = risk === "overdue";

  return (
    <div
      draggable
      onDragStart={(event) => onDragStart(event, task.id)}
      onClick={() => onOpen(task)}
      data-testid={`moderator-task-card-${task.id}`}
      className="cursor-pointer rounded-md border border-white/10 bg-zinc-900/50 p-3 transition-all hover:bg-zinc-900"
      style={risk ? { borderLeftWidth: 3, borderLeftColor: isOverdue ? "#EF4444" : "#F59E0B" } : {}}
    >
      <div className="truncate text-sm font-medium">{task.title}</div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <Badge>{task.project_type}</Badge>
        <Badge tone={task.priority === "urgent" ? "bad" : task.priority === "high" ? "warn" : "default"}>{task.priority || "medium"}</Badge>
        <Badge tone={statusGroup(task.status) === "pending_admin_approval" || task.status === "submitted" ? "warn" : "blue"}>{statusText(task.status)}</Badge>
        {(task.revisions || []).length > 0 && <Badge tone="bad">↻ {task.revisions.length}</Badge>}
      </div>
      <div className="mt-2 font-mono text-xs text-zinc-500">
        Due {task.deadline?.slice(0, 10) || "—"}
        {risk && <span className={isOverdue ? "text-red-400" : "text-amber-400"}> · {risk}</span>}
      </div>
    </div>
  );
}

export default function ModeratorTasks() {
  const { logout } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [editors, setEditors] = useState([]);
  const [clients, setClients] = useState([]);
  const [requests, setRequests] = useState([]);
  const [risk, setRisk] = useState({});
  const [detail, setDetail] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [selectedEditorId, setSelectedEditorId] = useState("");
  const [working, setWorking] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    try {
      const [taskRes, editorRes, clientRes, riskRes, requestRes] = await Promise.all([
        api.get("/tasks"),
        api.get("/users?role=editor"),
        api.get("/users?role=client"),
        api.get("/stats/deadline-risk"),
        api.get("/requests"),
      ]);
      setTasks(Array.isArray(taskRes.data) ? taskRes.data : []);
      setEditors(Array.isArray(editorRes.data) ? editorRes.data : []);
      setClients(Array.isArray(clientRes.data) ? clientRes.data : []);
      setRequests(Array.isArray(requestRes.data) ? requestRes.data : []);
      const riskMap = {};
      (Array.isArray(riskRes.data) ? riskRes.data : []).forEach((item) => { riskMap[item.task_id] = item.hours_left; });
      setRisk(riskMap);
    } catch (error) {
      setErr(formatApiError(error?.response?.data?.detail) || "Failed to load tasks.");
    }
  };

  useEffect(() => { load(); }, []);

  const editorMap = useMemo(() => new Map(editors.map((editor) => [editor.id, editor])), [editors]);
  const clientMap = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const detailRequests = useMemo(() => requests.filter((request) => request.task_id === detail?.id && request.status === "pending"), [requests, detail]);

  const patchTask = (taskId, payload) => withFallback(
    () => api.patch(`/workflow/moderator/tasks/${taskId}`, payload),
    () => api.patch(`/tasks/${taskId}`, payload)
  );

  const approveClientTask = (taskId) => withFallback(
    () => api.post(`/workflow/moderator/tasks/${taskId}/approve-client`),
    () => api.post(`/tasks/${taskId}/admin-approve`)
  );

  const rejectClientTask = (taskId) => withFallback(
    () => api.post(`/workflow/moderator/tasks/${taskId}/reject-client`),
    () => api.post(`/tasks/${taskId}/admin-reject`)
  );

  const approveEditorDraftTask = (taskId) => withFallback(
    () => api.post(`/workflow/moderator/tasks/${taskId}/approve-editor-draft`),
    () => api.post(`/tasks/${taskId}/admin-approve-video`)
  );

  const approveEditorRequest = (requestId) => withFallback(
    () => api.post(`/workflow/moderator/requests/${requestId}/approve`),
    () => api.post(`/requests/${requestId}/approve`)
  );

  const rejectEditorRequest = (requestId) => withFallback(
    () => api.post(`/workflow/moderator/requests/${requestId}/reject`),
    () => api.post(`/requests/${requestId}/reject`)
  );

  const openDetail = async (task) => {
    try {
      setErr("");
      const { data } = await api.get(`/tasks/${task.id}`);
      setDetail(data);
      setSelectedEditorId(data.assigned_editor_id || "");
    } catch (error) {
      setErr(formatApiError(error?.response?.data?.detail) || "Failed to open task.");
    }
  };

  const refreshDetail = async (taskId) => {
    const { data } = await api.get(`/tasks/${taskId}`);
    setDetail(data);
    await load();
  };


  const onDragStart = (event, id) => {
    event.dataTransfer.setData("text/plain", id);
  };

  const onDrop = async (event, status) => {
    event.preventDefault();
    setDragOver(null);
    const id = event.dataTransfer.getData("text/plain");
    if (!id) return;
    try {
      setErr("");
      await patchTask(id, { status });
      await load();
    } catch (error) {
      setErr(formatApiError(error?.response?.data?.detail) || "Failed to move task.");
    }
  };

  const runAction = async (callback, message = "Action failed.") => {
    try {
      setWorking(true);
      setErr("");
      const taskId = detail?.id;
      await callback();
      if (taskId) await refreshDetail(taskId);
    } catch (error) {
      setErr(formatApiError(error?.response?.data?.detail) || message);
    } finally {
      setWorking(false);
    }
  };

  const approveClientProject = () => runAction(() => approveClientTask(detail.id), "Failed to approve client project.");
  const rejectClientProject = () => runAction(() => rejectClientTask(detail.id), "Failed to reject client project.");
  const approveEditorDraft = () => runAction(() => approveEditorDraftTask(detail.id), "Failed to approve editor draft.");
  const approveRequest = (requestId) => runAction(() => approveEditorRequest(requestId), "Failed to approve editor request.");
  const rejectRequest = (requestId) => runAction(() => rejectEditorRequest(requestId), "Failed to reject editor request.");
  const assignSelectedEditor = () => {
    if (!selectedEditorId || !detail?.id) return;
    return runAction(() => patchTask(detail.id, { assigned_editor_id: selectedEditorId, status: "active" }), "Failed to assign editor.");
  };

  if (detail) {
    const assignedEditor = editorMap.get(detail.assigned_editor_id);
    const client = clientMap.get(detail.client_id);

    return (
      <ModeratorLayout>
          <div className="mx-auto max-w-7xl py-2">
            <div className="mb-8 flex items-start justify-between gap-4 border-b border-white/10 pb-6">
              <div>
                <button onClick={() => setDetail(null)} className="mb-5 text-sm text-zinc-400 hover:text-white">← Back to Projects</button>
                <div className="label-xs mb-2 text-zinc-500">{detail.project_type || "Project"}</div>
                <h1 className="text-4xl font-semibold tracking-tight">{detail.title}</h1>
                <p className="mt-2 text-zinc-500">Status: <span className="text-zinc-300">{statusText(detail.status)}</span></p>
              </div>
              <Badge tone={detail.status === "completed" ? "good" : statusGroup(detail.status) === "pending_admin_approval" || detail.status === "submitted" ? "warn" : "blue"}>{statusText(detail.status)}</Badge>
            </div>

            {err && <div className="mb-5 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</div>}

            <div className="grid gap-6 xl:grid-cols-3">
              <section className="space-y-6 xl:col-span-2">
                <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-6">
                  <h2 className="mb-5 text-lg font-semibold">Project Details</h2>
                  <div className="grid gap-4 text-sm md:grid-cols-2">
                    <InfoRow label="Project Type" value={detail.project_type} />
                    <InfoRow label="Priority" value={detail.priority} />
                    <InfoRow label="Status" value={statusText(detail.status)} />
                    <InfoRow label="Deadline" value={detail.deadline?.slice(0, 10)} />
                    <InfoRow label="Videos" value={detail.num_videos} />
                    <InfoRow label="Duration" value={detail.duration} />
                    <InfoRow label="Resolution" value={detail.resolution} />
                    <InfoRow label="Aspect Ratio" value={detail.aspect_ratio} />
                    <InfoRow label="Assigned Editor" value={editorName(assignedEditor)} />
                    <InfoRow label="Client" value={clientName(client)} />
                  </div>

                  {statusGroup(detail.status) === "pending_admin_approval" && (
                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                      <button onClick={approveClientProject} disabled={working} className="rounded-md bg-emerald-500 py-3 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-50">Approve Client Project</button>
                      <button onClick={rejectClientProject} disabled={working} className="rounded-md border border-red-500/20 bg-red-500/10 py-3 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50">Reject Client Project</button>
                    </div>
                  )}

                  {detail.status === "submitted" && (
                    <button onClick={approveEditorDraft} disabled={working} className="mt-6 w-full rounded-md bg-emerald-500 py-3 text-sm font-medium text-black hover:bg-emerald-400 disabled:opacity-50">
                      Approve Editor Draft & Send to Client
                    </button>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-6">
                  <h2 className="mb-5 text-lg font-semibold">Creative Brief</h2>
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

                {(detail.drafts || []).length > 0 && (
                  <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-6">
                    <h2 className="mb-5 text-lg font-semibold">Drafts Delivered</h2>
                    {(detail.drafts || []).map((draft) => (
                      <div key={draft.id} className="mb-3 rounded-md border border-white/10 p-4 text-sm">
                        <a href={draft.url} target="_blank" rel="noreferrer" className="break-all text-blue-400 hover:underline">{draft.url}</a>
                        <div className="mt-2 text-zinc-400">{draft.note}</div>
                      </div>
                    ))}
                  </div>
                )}

                {(detail.revisions || []).length > 0 && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
                    <h2 className="mb-5 text-lg font-semibold text-red-400">Revision Requests</h2>
                    {(detail.revisions || []).map((revision) => <div key={revision.id} className="mb-3 rounded-md border border-red-500/20 p-4 text-sm text-red-200">{revision.note}</div>)}
                  </div>
                )}
              </section>

              <aside className="space-y-6">
                <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-6">
                  <h2 className="mb-5 text-lg font-semibold">Assets</h2>
                  <div className="space-y-3 text-sm">
                    <LinkRow label="Footages URL" url={detail.footages_url} />
                    <LinkRow label="Script URL" url={detail.script_url} />
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-6">
                  <h2 className="mb-5 text-lg font-semibold">Assign Editor</h2>
                  <div className="space-y-3">
                    <select value={selectedEditorId} onChange={(event) => setSelectedEditorId(event.target.value)} className="w-full rounded-md border border-white/10 bg-zinc-950 px-3 py-2 text-sm text-white">
                      <option value="">— Select editor —</option>
                      {editors.map((editor) => <option key={editor.id} value={editor.id}>{editorName(editor)}</option>)}
                    </select>
                    <button onClick={assignSelectedEditor} disabled={working || !selectedEditorId} className="w-full rounded-md bg-white py-2.5 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50">Assign & Move to Active</button>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-6">
                  <h2 className="mb-5 text-lg font-semibold">Pending Editor Requests</h2>
                  <div className="space-y-3">
                    {detailRequests.map((request) => {
                      const editor = request.editor || editorMap.get(request.editor_id);
                      return (
                        <div key={request.id} className="rounded-md border border-white/10 p-3">
                          <div className="mb-3 text-sm font-medium">{editorName(editor)}</div>
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => approveRequest(request.id)} disabled={working} className="rounded-md bg-emerald-500 px-3 py-2 text-xs font-medium text-black hover:bg-emerald-400 disabled:opacity-50">Approve</button>
                            <button onClick={() => rejectRequest(request.id)} disabled={working} className="rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300 hover:bg-red-500/20 disabled:opacity-50">Reject</button>
                          </div>
                        </div>
                      );
                    })}
                    {detailRequests.length === 0 && <div className="text-xs text-zinc-500">No pending editor requests for this task.</div>}
                  </div>
                </div>
              </aside>
            </div>
          </div>
      </ModeratorLayout>
    );
  }

  return (
    <ModeratorLayout>
        <div className="mb-0">
          <div className="mb-8">
            <div className="label-xs mb-3 text-zinc-500">Moderator / Tasks</div>
            <h1 className="text-3xl font-semibold tracking-tight">Project Pipeline</h1>
            <p className="mt-3 text-sm text-zinc-400">Click a project to open its full details page. Drag cards across columns. Moderator can approve client projects, editor drafts, and editor requests.</p>
          </div>

          {err && <div className="mb-5 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">{err}</div>}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
            {columns.map((column) => {
              const items = tasks.filter((task) => column.statuses.includes(task.status));
              return (
                <div
                  key={column.key}
                  onDragOver={(event) => { event.preventDefault(); setDragOver(column.key); }}
                  onDragLeave={() => setDragOver(null)}
                  onDrop={(event) => onDrop(event, column.dropStatus)}
                  className={`rounded-md border bg-zinc-900/50 p-3 transition-all ${dragOver === column.key ? "border-white/40 bg-zinc-800/50" : "border-white/10"}`}
                  data-testid={`moderator-kanban-column-${column.key}`}
                >
                  <div className="mb-3 flex items-center justify-between px-1">
                    <div className="label-xs text-zinc-400">{column.label}</div>
                    <span className="font-mono text-xs text-zinc-500">{items.length}</span>
                  </div>
                  <div className="min-h-[100px] space-y-2">
                    {items.map((task) => <TaskCard key={task.id} task={task} onOpen={openDetail} onDragStart={onDragStart} riskLeft={risk[task.id]} />)}
                    {items.length === 0 && <div className="rounded-md border border-dashed border-white/5 p-3 text-center text-xs text-zinc-600">Drop here</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
    </ModeratorLayout>
  );
}
