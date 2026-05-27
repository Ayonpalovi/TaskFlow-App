import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import ModeratorLayout from "../components/ModeratorLayout";

const BLUE = "#0051FF";

const canList = [
  "View active projects",
  "Assign projects to team members",
  "Update project status",
  "Review uploaded files",
  "Manage deadlines",
  "Reply to client messages",
  "Approve normal revision requests",
  "Send work back to team members",
  "View team workload",
  "Add internal notes",
  "Escalate issues to Admin",
];

const cannotList = [
  "Delete users permanently",
  "Delete clients permanently",
  "Delete project history",
  "Change payment settings",
  "Change platform settings",
  "View full revenue/profit dashboard",
  "Invite another Admin",
  "Transfer ownership",
  "Remove or edit Owner/Admin account",
  "Change role permissions",
];

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

function Card({ id, title, action, children, className = "" }) {
  return (
    <section id={id} className={`rounded-2xl border border-white/10 bg-zinc-900/35 p-4 shadow-2xl shadow-black/15 backdrop-blur ${className}`}>
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="text-[10px] uppercase tracking-[0.22em] text-zinc-500">{label}</div>
      <div className="mt-2 font-mono text-2xl font-semibold text-white">{value ?? 0}</div>
    </div>
  );
}

function Empty({ children }) {
  return <div className="rounded-xl border border-dashed border-white/10 bg-black/20 px-4 py-3 text-sm text-zinc-500">{children}</div>;
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

function formatDateOnly(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function firstLetter(value) {
  return String(value || "M").charAt(0).toUpperCase();
}

export default function ModeratorDashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [profile, setProfile] = useState(null);
  const [notice, setNotice] = useState("");
  const [selectedProject, setSelectedProject] = useState(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({ status: "", deadline: "", assigned_editor_id: "", internal_note: "" });
  const [escalation, setEscalation] = useState({ title: "", category: "delay", body: "" });

  const load = async () => {
    setNotice("");
    const [dashboardRes, profileRes] = await Promise.allSettled([
      api.get("/moderator/dashboard"),
      api.get("/moderator/profile"),
    ]);
    if (dashboardRes.status === "fulfilled") setDashboard(dashboardRes.value.data);
    if (profileRes.status === "fulfilled") setProfile(profileRes.value.data);
    if (dashboardRes.status === "rejected") setNotice("Operations data is not available yet.");
  };

  useEffect(() => { load(); }, []);

  const safeProfile = useMemo(() => ({
    avatar_url: profile?.avatar_url || user?.avatar_url || "",
    real_name: profile?.real_name || user?.real_name || user?.display_name || user?.email || "Moderator",
    email: profile?.email || user?.email || "—",
    status: profile?.status || user?.status || "active",
    online: profile?.online ?? true,
    assigned_departments: profile?.assigned_departments || user?.assigned_departments || user?.skills || [],
    permission_level: profile?.permission_level || "Limited operations access",
    assigned_projects: profile?.assigned_projects ?? 0,
    tasks_managed: profile?.tasks_managed ?? 0,
    client_conversations_handled: profile?.client_conversations_handled ?? 0,
    team_members_supervised: profile?.team_members_supervised ?? 0,
    date_invited: profile?.date_invited || user?.invited_at || user?.created_at,
    last_active_time: profile?.last_active_time || user?.last_seen,
  }), [profile, user]);

  const overview = dashboard?.overview || {};
  const projects = dashboard?.managed_projects || [];
  const editors = dashboard?.editors || [];
  const workload = dashboard?.team_workload || [];
  const comms = dashboard?.client_communication || {};
  const escalations = dashboard?.escalation_center || {};
  const activity = dashboard?.activity_log || [];
  const pendingReviews = projects.filter((p) => ["submitted", "client_review", "revision"].includes(p.current_status));

  const openProject = (project) => {
    setSelectedProject(project);
    setUpdateForm({ status: project.current_status || "active", deadline: project.deadline?.slice?.(0, 10) || "", assigned_editor_id: project.assigned_editor_id || "", internal_note: "" });
  };

  const saveProject = async () => {
    if (!selectedProject?.id) return;
    try {
      await api.patch(`/moderator/projects/${selectedProject.id}`, {
        status: updateForm.status || undefined,
        deadline: updateForm.deadline || undefined,
        assigned_editor_id: updateForm.assigned_editor_id || undefined,
        internal_note: updateForm.internal_note || undefined,
      });
      setSelectedProject(null);
      await load();
    } catch (error) {
      setNotice(formatApiError(error?.response?.data?.detail || error.message));
    }
  };

  const createEscalation = async () => {
    if (!escalation.title.trim()) return;
    try {
      await api.post("/moderator/escalations", escalation);
      setEscalation({ title: "", category: "delay", body: "" });
      await load();
    } catch (error) {
      setNotice(formatApiError(error?.response?.data?.detail || error.message));
    }
  };

  return (
    <ModeratorLayout>
          <div id="overview" className="mb-6 flex flex-col gap-4 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,81,255,.22),transparent_35%),rgba(24,24,27,.42)] p-5 shadow-2xl shadow-black/20 md:flex-row md:items-center md:justify-between">
            <div><div className="mb-2 text-[10px] uppercase tracking-[0.25em] text-zinc-500">Operations</div><h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Moderator Dashboard</h1><p className="mt-2 text-sm text-zinc-400">Manage daily operations with limited access.</p></div>
            <div className="flex flex-wrap gap-2"><Badge tone="blue">Limited Operations Access</Badge><button onClick={() => setProfileOpen(true)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 hover:bg-white/10">Profile</button><button onClick={() => setRulesOpen(true)} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-zinc-300 hover:bg-white/10">Access rules</button></div>
          </div>

          {notice && <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">{notice}</div>}

          <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Stat label="Active Projects" value={overview.active_projects} /><Stat label="Pending Reviews" value={overview.pending_approvals} /><Stat label="Urgent Deadlines" value={overview.urgent_deadlines} /><Stat label="Client Messages" value={overview.client_messages_waiting} /><Stat label="Team Availability" value={workload.filter((w) => w.availability === "Available").length} /></div>

          <div className="grid gap-5 xl:grid-cols-[1.35fr,.65fr]">
            <div className="space-y-5">
              <Card id="projects" title="Active Projects"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left text-[10px] uppercase tracking-[0.18em] text-zinc-500"><tr><th className="py-2">Project</th><th>Client</th><th>Service</th><th>Team member</th><th>Status</th><th>Deadline</th><th></th></tr></thead><tbody>{projects.slice(0, 8).map((project) => <tr key={project.id} className="border-t border-white/5"><td className="py-3 font-medium">{project.project_name || "Untitled"}</td><td className="text-zinc-400">{project.client_name || "—"}</td><td className="text-zinc-400">{project.service_type || "—"}</td><td className="text-zinc-400">{project.assigned_team_member || "Unassigned"}</td><td><Badge tone="blue">{project.current_status || "—"}</Badge></td><td className="text-zinc-400">{formatDateOnly(project.deadline)}</td><td className="text-right"><button onClick={() => openProject(project)} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300 hover:bg-white/5">View / Update</button></td></tr>)}</tbody></table></div>{projects.length === 0 && <Empty>No active projects yet.</Empty>}</Card>
              <Card id="reviews" title="Pending Reviews"><div className="grid gap-3 md:grid-cols-2">{pendingReviews.slice(0, 4).map((project) => <button key={project.id} onClick={() => openProject(project)} className="rounded-xl border border-white/10 bg-black/20 p-4 text-left hover:border-blue-500/30"><div className="font-medium">{project.project_name || "Untitled"}</div><div className="mt-1 text-sm text-zinc-500">{project.client_name || "—"} · {project.service_type || "—"}</div><div className="mt-3"><Badge tone="warn">{project.current_status}</Badge></div></button>)}</div>{pendingReviews.length === 0 && <Empty>No pending reviews.</Empty>}</Card>
              <Card id="workload" title="Team Workload"><div className="grid gap-3 md:grid-cols-2">{workload.slice(0, 6).map((item, index) => <div key={`${item.team_member_name}-${index}`} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-medium">{item.team_member_name}</div><div className="mt-1 text-sm text-zinc-500">{item.role} · {item.active_tasks} active tasks</div></div><Badge tone={item.availability === "Available" ? "good" : item.availability === "Busy" ? "warn" : "bad"}>{item.availability}</Badge></div><div className="mt-3 text-xs text-zinc-500">{item.performance_status}</div></div>)}</div>{workload.length === 0 && <Empty>No team workload data yet.</Empty>}</Card>
              <Card id="messages" title="Client Messages"><div className="space-y-3">{(comms.pending_replies || comms.recent_messages || []).slice(0, 5).map((message) => <div key={message.id} className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm"><div className="mb-1 text-xs uppercase tracking-[0.18em] text-zinc-600">{message.sender_role || "client"}</div><div className="text-zinc-300">{message.content}</div></div>)}</div>{(comms.pending_replies || comms.recent_messages || []).length === 0 && <Empty>No client messages waiting.</Empty>}</Card>
            </div>

            <div className="space-y-5">
              <Card id="profile" title="Profile Snapshot" action={<button onClick={() => setProfileOpen(true)} className="text-xs text-blue-300 hover:text-blue-200">View</button>}><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-500/15 text-lg font-semibold">{firstLetter(safeProfile.real_name)}</div><div className="min-w-0"><div className="truncate font-medium">{safeProfile.real_name}</div><div className="truncate text-sm text-zinc-500">{safeProfile.email}</div></div></div><div className="mt-4 grid gap-2 text-sm"><div className="flex justify-between"><span className="text-zinc-500">Status</span><span>{safeProfile.status}</span></div><div className="flex justify-between"><span className="text-zinc-500">Online</span><span>{safeProfile.online ? "Online" : "Offline"}</span></div><div className="flex justify-between"><span className="text-zinc-500">Permission</span><span>Limited</span></div><div className="flex justify-between"><span className="text-zinc-500">Last active</span><span>{formatDate(safeProfile.last_active_time)}</span></div></div></Card>
              <Card id="escalations" title="Escalation Notes"><div className="space-y-2"><select value={escalation.category} onChange={(e) => setEscalation({ ...escalation, category: e.target.value })} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white"><option value="payment">Payment issue</option><option value="conflict">Client conflict</option><option value="delay">Delayed project</option><option value="team">Team member unavailable</option><option value="approval">Urgent approval needed</option></select><input value={escalation.title} onChange={(e) => setEscalation({ ...escalation, title: e.target.value })} placeholder="Issue title" className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600" /><textarea value={escalation.body} onChange={(e) => setEscalation({ ...escalation, body: e.target.value })} placeholder="Short note to Admin" rows={3} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600" /><button onClick={createEscalation} className="w-full rounded-xl px-4 py-2 text-sm font-medium text-white" style={{ background: BLUE }}>Notify Admin</button></div><div className="mt-4 space-y-2">{(escalations.issues_needing_admin_attention || []).slice(0, 3).map((item) => <div key={item.id} className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-100">{item.target_email}</div>)}</div>{(escalations.issues_needing_admin_attention || []).length === 0 && <div className="mt-3"><Empty>No escalation notes.</Empty></div>}</Card>
              <Card id="calendar" title="Calendar"><Empty>No urgent calendar items.</Empty></Card>
              <Card id="activity" title="Activity Log"><div className="space-y-2">{activity.slice(0, 7).map((item) => <div key={item.id || item.created_at} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"><div className="text-zinc-300">{item.action || "Moderator activity"}</div><div className="mt-1 text-xs text-zinc-600">{formatDate(item.created_at)}</div></div>)}</div>{activity.length === 0 && <Empty>No recent activity.</Empty>}</Card>
            </div>
          </div>
        </div>

      {selectedProject && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setSelectedProject(null)}><div className="w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="mb-5"><div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Project operations</div><h3 className="mt-2 text-xl font-semibold">{selectedProject.project_name || "Untitled project"}</h3><p className="mt-1 text-sm text-zinc-500">Update status, deadline, assignment or internal note.</p></div><div className="space-y-3"><select value={updateForm.status} onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value })} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white"><option value="active">Active</option><option value="submitted">Submitted</option><option value="client_review">Client review</option><option value="revision">Revision</option><option value="completed">Completed</option></select><select value={updateForm.assigned_editor_id} onChange={(e) => setUpdateForm({ ...updateForm, assigned_editor_id: e.target.value })} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white"><option value="">Unassigned</option>{editors.map((editor) => <option key={editor.id} value={editor.id}>{editor.name || editor.anime_name || editor.email}</option>)}</select><input type="date" value={updateForm.deadline} onChange={(e) => setUpdateForm({ ...updateForm, deadline: e.target.value })} className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white" /><textarea value={updateForm.internal_note} onChange={(e) => setUpdateForm({ ...updateForm, internal_note: e.target.value })} rows={3} placeholder="Internal note" className="w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600" /><div className="flex gap-2 pt-2"><button onClick={() => setSelectedProject(null)} className="flex-1 rounded-xl border border-white/10 py-2 text-sm hover:bg-white/5">Cancel</button><button onClick={saveProject} className="flex-1 rounded-xl py-2 text-sm font-medium text-white" style={{ background: BLUE }}>Save update</button></div></div></div></div>}
      {profileOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setProfileOpen(false)}><div className="w-full max-w-xl rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="mb-5 flex items-start justify-between gap-4"><div><div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Moderator profile</div><h3 className="mt-2 text-xl font-semibold">{safeProfile.real_name}</h3><p className="mt-1 text-sm text-zinc-500">{safeProfile.email}</p></div><button onClick={() => setProfileOpen(false)} className="rounded-lg border border-white/10 px-3 py-1 text-sm text-zinc-400 hover:bg-white/5">Close</button></div><div className="grid gap-3 sm:grid-cols-2 text-sm"><div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Avatar</span><div>{safeProfile.avatar_url ? "Uploaded" : "Default"}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Role</span><div>Moderator</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Status</span><div>{safeProfile.status}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Online / Offline</span><div>{safeProfile.online ? "Online" : "Offline"}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Assigned departments</span><div>{(safeProfile.assigned_departments || []).join(", ") || "—"}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Assigned projects</span><div>{safeProfile.assigned_projects}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Permission level</span><div>{safeProfile.permission_level}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Last active</span><div>{formatDate(safeProfile.last_active_time)}</div></div><div className="rounded-xl border border-white/10 bg-black/20 p-3"><span className="text-zinc-500">Date invited</span><div>{formatDate(safeProfile.date_invited)}</div></div></div></div></div>}
      {rulesOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setRulesOpen(false)}><div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}><div className="mb-5 flex items-start justify-between gap-4"><div><div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Access rules</div><h3 className="mt-2 text-xl font-semibold">Limited operations access</h3></div><button onClick={() => setRulesOpen(false)} className="rounded-lg border border-white/10 px-3 py-1 text-sm text-zinc-400 hover:bg-white/5">Close</button></div><div className="grid gap-4 md:grid-cols-2"><div><div className="mb-2 text-sm font-medium text-emerald-300">Can</div><div className="space-y-1.5">{canList.map((item) => <div key={item} className="rounded-lg border border-emerald-500/15 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">✓ {item}</div>)}</div></div><div><div className="mb-2 text-sm font-medium text-red-300">Cannot</div><div className="space-y-1.5">{cannotList.map((item) => <div key={item} className="rounded-lg border border-red-500/15 bg-red-500/10 px-3 py-2 text-xs text-red-100">✕ {item}</div>)}</div></div></div></div></div>}
    </ModeratorLayout>
  );
}
