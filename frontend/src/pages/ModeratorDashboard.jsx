import { useEffect, useMemo, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api, formatApiError } from "../lib/api";

const statusTone = (status) => {
  if (status === "completed") return "good";
  if (status === "revision") return "bad";
  if (status === "submitted") return "warn";
  if (status === "client_review") return "blue";
  return "default";
};

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export default function ModeratorDashboard() {
  const [data, setData] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [sendBackNote, setSendBackNote] = useState("");
  const [adminAlert, setAdminAlert] = useState({ title: "", body: "" });
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const activeMode = !!data?.absence_mode?.active;
  const permissions = data?.absence_mode?.allowed_permissions || [];
  const can = (key) => permissions.includes(key);

  const load = async () => {
    const { data: dashboard } = await api.get("/moderator/dashboard");
    setData(dashboard);
    if (selectedTask?.id) {
      setSelectedTask(dashboard.tasks.find((task) => task.id === selectedTask.id) || null);
    }
  };

  useEffect(() => {
    load().catch((error) => setErr(formatApiError(error?.response?.data?.detail || error.message)));
    const timer = setInterval(() => load().catch(() => {}), 30000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tasks = data?.tasks || [];
  const workload = data?.workload || [];
  const clientProgress = data?.client_progress || [];
  const editors = data?.editors || [];
  const pendingRequests = data?.pending_requests || [];

  const metrics = useMemo(() => {
    return {
      active: tasks.filter((task) => task.status === "active").length,
      submitted: tasks.filter((task) => task.status === "submitted").length,
      revision: tasks.filter((task) => task.status === "revision").length,
      clientReview: tasks.filter((task) => task.status === "client_review").length,
    };
  }, [tasks]);

  const updateTask = async (taskId, payload) => {
    setErr("");
    setNotice("");
    try {
      setBusy(true);
      const { data: updated } = await api.patch(`/moderator/tasks/${taskId}`, payload);
      setSelectedTask(updated);
      setNotice("Project updated successfully.");
      await load();
    } catch (error) {
      setErr(formatApiError(error?.response?.data?.detail || error.message));
    } finally {
      setBusy(false);
    }
  };

  const approveVideo = async (taskId) => {
    setErr("");
    setNotice("");
    try {
      setBusy(true);
      await api.post(`/moderator/tasks/${taskId}/approve-video`);
      setNotice("Uploaded file approved and sent to client review.");
      await load();
    } catch (error) {
      setErr(formatApiError(error?.response?.data?.detail || error.message));
    } finally {
      setBusy(false);
    }
  };

  const sendBack = async (taskId) => {
    setErr("");
    setNotice("");
    try {
      setBusy(true);
      await api.post(`/moderator/tasks/${taskId}/send-back`, { note: sendBackNote });
      setSendBackNote("");
      setNotice("Task sent back to the team member.");
      await load();
    } catch (error) {
      setErr(formatApiError(error?.response?.data?.detail || error.message));
    } finally {
      setBusy(false);
    }
  };

  const approveRequest = async (id) => {
    await api.post(`/moderator/requests/${id}/approve`);
    await load();
  };

  const rejectRequest = async (id) => {
    await api.post(`/moderator/requests/${id}/reject`);
    await load();
  };

  const loadMessages = async (client) => {
    setSelectedClient(client);
    setMessageText("");
    try {
      const { data: msgData } = await api.get(`/moderator/messages?client_id=${client.client.id}`);
      setMessages(Array.isArray(msgData) ? msgData : []);
    } catch (error) {
      setErr(formatApiError(error?.response?.data?.detail || error.message));
    }
  };

  const sendMessage = async () => {
    if (!selectedClient || !messageText.trim()) return;
    await api.post("/moderator/messages", { client_id: selectedClient.client.id, content: messageText.trim() });
    setMessageText("");
    await loadMessages(selectedClient);
  };

  const notifyAdmin = async () => {
    if (!adminAlert.title.trim()) return;
    await api.post("/moderator/notify-admin", adminAlert);
    setAdminAlert({ title: "", body: "" });
    setNotice("Owner/Admin has been notified.");
  };

  const input = "w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500";

  return (
    <Layout allowed={["moderator"]}>
      <PageHeader
        label="Moderator / Operations"
        title="Agency Manager Dashboard"
        subtitle="A limited operations dashboard for keeping projects moving while the Owner/Admin is absent."
      />

      {activeMode && (
        <div className="mb-5 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-blue-100">
          <div className="font-semibold">Absence Mode Active — Moderator is managing operations.</div>
          <div className="mt-1 text-xs text-blue-200/70">Ends: {formatDate(data?.absence_mode?.ends_at)} {data?.absence_mode?.note ? `· Note: ${data.absence_mode.note}` : ""}</div>
        </div>
      )}

      {!activeMode && (
        <div className="mb-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-4 text-amber-100">
          Absence Mode is not active. Moderator controls are locked until the Owner/Admin enables access.
        </div>
      )}

      {notice && <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100">{notice}</div>}
      {err && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</div>}

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5"><div className="label-xs text-zinc-500">Active</div><div className="mt-3 font-mono text-3xl text-blue-300">{metrics.active}</div></div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5"><div className="label-xs text-zinc-500">Submitted</div><div className="mt-3 font-mono text-3xl text-amber-300">{metrics.submitted}</div></div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5"><div className="label-xs text-zinc-500">Revision</div><div className="mt-3 font-mono text-3xl text-red-300">{metrics.revision}</div></div>
        <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5"><div className="label-xs text-zinc-500">Client Review</div><div className="mt-3 font-mono text-3xl text-purple-300">{metrics.clientReview}</div></div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr,.8fr]">
        <section className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Active projects</h2>
              <Badge>{tasks.length} projects</Badge>
            </div>
            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
              {tasks.map((task) => (
                <button key={task.id} onClick={() => setSelectedTask(task)} className={`w-full rounded-xl border p-4 text-left transition-all ${selectedTask?.id === task.id ? "border-blue-500/50 bg-blue-500/10" : "border-white/10 bg-black/20 hover:border-blue-500/30"}`}>
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{task.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">{task.project_type} · Due {task.deadline?.slice(0, 10) || "—"}</div>
                    </div>
                    <div className="flex gap-2"><Badge tone={statusTone(task.status)}>{task.status}</Badge><Badge>{task.priority || "medium"}</Badge></div>
                  </div>
                </button>
              ))}
              {tasks.length === 0 && <div className="text-sm text-zinc-500">No projects available.</div>}
            </div>
          </div>

          {selectedTask && (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5">
              <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="label-xs text-zinc-500">Selected project</div>
                  <h2 className="mt-2 text-xl font-semibold">{selectedTask.title}</h2>
                  <div className="mt-1 text-sm text-zinc-500">No payment or owner-level controls are shown here.</div>
                </div>
                <Badge tone={statusTone(selectedTask.status)}>{selectedTask.status}</Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {can("update_status") && (
                  <label className="text-sm text-zinc-300">
                    <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-zinc-500">Status</span>
                    <select className={input} value={selectedTask.status || "active"} onChange={(e) => updateTask(selectedTask.id, { status: e.target.value })} disabled={busy}>
                      {["available", "active", "submitted", "client_review", "revision", "completed"].map((status) => <option key={status}>{status}</option>)}
                    </select>
                  </label>
                )}

                {can("manage_deadlines") && (
                  <label className="text-sm text-zinc-300">
                    <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-zinc-500">Deadline</span>
                    <input type="date" className={input} value={selectedTask.deadline?.slice(0, 10) || ""} onChange={(e) => updateTask(selectedTask.id, { deadline: e.target.value })} disabled={busy} />
                  </label>
                )}

                {can("assign_projects") && (
                  <label className="text-sm text-zinc-300 md:col-span-2">
                    <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-zinc-500">Assign editor</span>
                    <select className={input} value={selectedTask.assigned_editor_id || ""} onChange={(e) => updateTask(selectedTask.id, { assigned_editor_id: e.target.value })} disabled={busy}>
                      <option value="">No editor assigned</option>
                      {editors.map((editor) => <option key={editor.id} value={editor.id}>{editor.anime_name || editor.display_name || editor.real_name}</option>)}
                    </select>
                  </label>
                )}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
                  <div className="mb-2 font-medium">Uploaded files</div>
                  {(selectedTask.drafts || []).map((draft) => (
                    <a key={draft.id} href={draft.url} target="_blank" rel="noreferrer" className="block truncate text-blue-300 hover:underline">{draft.url}</a>
                  ))}
                  {(selectedTask.drafts || []).length === 0 && <div className="text-zinc-500">No uploaded drafts yet.</div>}
                  {can("review_files") && selectedTask.status === "submitted" && (
                    <button disabled={busy} onClick={() => approveVideo(selectedTask.id)} className="mt-4 w-full rounded-xl bg-emerald-400 px-4 py-2 text-sm font-medium text-black hover:bg-emerald-300 disabled:opacity-50">Approve file</button>
                  )}
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm">
                  <div className="mb-2 font-medium">Send back to team</div>
                  <textarea className={input} rows={3} value={sendBackNote} onChange={(e) => setSendBackNote(e.target.value)} placeholder="Write what needs to be fixed..." />
                  {can("send_back") && <button disabled={busy} onClick={() => sendBack(selectedTask.id)} className="mt-3 w-full rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-200 hover:bg-amber-500/20 disabled:opacity-50">Send back</button>}
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Team workload</h2><Badge>{workload.length}</Badge></div>
            <div className="space-y-3">
              {workload.map((row) => (
                <div key={row.editor.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3 text-sm"><span>{row.editor.anime_name || row.editor.display_name}</span><Badge tone={row.status === "overloaded" ? "bad" : row.status === "busy" ? "warn" : "good"}>{row.status}</Badge></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800"><div className="h-full bg-blue-500" style={{ width: `${row.load_pct}%` }} /></div>
                  <div className="mt-2 text-xs text-zinc-500">{row.total} current items</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5">
            <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Client progress</h2><Badge>{clientProgress.length}</Badge></div>
            <div className="space-y-3">
              {clientProgress.map((row) => (
                <button key={row.client.id} onClick={() => loadMessages(row)} className={`w-full rounded-xl border p-3 text-left ${selectedClient?.client?.id === row.client.id ? "border-blue-500/50 bg-blue-500/10" : "border-white/10 bg-black/20 hover:border-blue-500/30"}`}>
                  <div className="mb-1 text-sm font-medium">{row.client.display_name || row.client.real_name}</div>
                  <div className="text-xs text-zinc-500">{row.in_progress} in progress · {row.revision} revisions · {row.completed} completed</div>
                </button>
              ))}
            </div>
          </div>

          {selectedClient && (
            <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5">
              <h2 className="text-lg font-semibold">Client messages</h2>
              <div className="mt-4 max-h-64 space-y-3 overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-3">
                {messages.map((message) => (
                  <div key={message.id} className="text-sm"><span className="text-zinc-500">{message.sender_role}: </span>{message.content}</div>
                ))}
                {messages.length === 0 && <div className="text-sm text-zinc-500">No messages yet.</div>}
              </div>
              {can("reply_clients") && <div className="mt-3 flex gap-2"><input className={input} value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Reply to client..." /><button onClick={sendMessage} className="rounded-xl bg-white px-4 text-sm font-medium text-black hover:bg-zinc-200">Send</button></div>}
            </div>
          )}

          <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5">
            <h2 className="text-lg font-semibold">Pending editor requests</h2>
            <div className="mt-4 space-y-3">
              {pendingRequests.map((request) => (
                <div key={request.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="text-sm font-medium">{request.editor?.anime_name || request.editor_anime_name}</div>
                  <div className="mb-3 text-xs text-zinc-500">{request.task?.title || "Project request"}</div>
                  {can("assign_projects") && <div className="flex gap-2"><button onClick={() => approveRequest(request.id)} className="flex-1 rounded-lg bg-white py-1.5 text-xs text-black">Approve</button><button onClick={() => rejectRequest(request.id)} className="flex-1 rounded-lg border border-white/10 py-1.5 text-xs">Reject</button></div>}
                </div>
              ))}
              {pendingRequests.length === 0 && <div className="text-sm text-zinc-500">No pending requests.</div>}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5">
            <h2 className="text-lg font-semibold">Notify Owner/Admin</h2>
            <div className="mt-3 space-y-3">
              <input className={input} value={adminAlert.title} onChange={(e) => setAdminAlert({ ...adminAlert, title: e.target.value })} placeholder="Important issue title" />
              <textarea className={input} rows={3} value={adminAlert.body} onChange={(e) => setAdminAlert({ ...adminAlert, body: e.target.value })} placeholder="Explain what happened..." />
              {can("notify_admin") && <button onClick={notifyAdmin} className="w-full rounded-xl border border-blue-500/20 bg-blue-500/10 py-2 text-sm text-blue-100 hover:bg-blue-500/20">Notify Owner/Admin</button>}
            </div>
          </div>
        </aside>
      </div>
    </Layout>
  );
}
