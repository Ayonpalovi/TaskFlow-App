import { useEffect, useMemo, useState } from "react";
import Layout, { Badge, PageHeader } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";

const CAN_PERMISSIONS = [
  "View active projects",
  "Assign projects to editors",
  "Update project status",
  "Review uploaded files",
  "Manage deadlines",
  "Reply to client messages",
  "Approve normal revision requests",
  "Send work back to team members",
  "View team workload",
  "View project progress",
  "Create internal notes",
  "Notify Admin about important issues",
];

const CANNOT_PERMISSIONS = [
  "Delete users permanently",
  "Delete clients permanently",
  "Delete project history",
  "Change payment settings",
  "View full revenue/profit dashboard unless Admin allows it",
  "Change platform settings",
  "Invite another Admin",
  "Transfer ownership",
  "Remove or edit the Owner/Admin account",
  "Change role permissions",
];

function Panel({ title, subtitle, children }) {
  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5 shadow-2xl shadow-black/20">
      {title && <h2 className="text-lg font-semibold">{title}</h2>}
      {subtitle && <p className="mt-1 mb-4 text-sm text-zinc-500">{subtitle}</p>}
      {!subtitle && title && <div className="mb-4" />}
      {children}
    </section>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="label-xs text-zinc-500">{label}</div>
      <div className="mt-3 text-3xl font-semibold">{value ?? 0}</div>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-600">{label}</div>
      <div className="mt-1 text-sm text-zinc-200">{value || "—"}</div>
    </div>
  );
}

function EmptyState({ children }) {
  return <div className="rounded-xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-zinc-500">{children}</div>;
}

function formatShortDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export default function ModeratorDashboard() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [profile, setProfile] = useState(null);
  const [apiNote, setApiNote] = useState("");

  useEffect(() => {
    let mounted = true;

    api.get("/moderator/dashboard")
      .then((res) => mounted && setDashboard(res.data))
      .catch(() => mounted && setApiNote("Live operations data will appear here once the backend deployment finishes."));

    api.get("/moderator/profile")
      .then((res) => mounted && setProfile(res.data))
      .catch(() => mounted && setProfile(null));

    return () => { mounted = false; };
  }, []);

  const safeProfile = useMemo(() => ({
    avatar_url: profile?.avatar_url || user?.avatar_url || "",
    real_name: profile?.real_name || user?.real_name || user?.display_name || user?.email || "Moderator",
    email: profile?.email || user?.email || "—",
    role: "Moderator",
    status: profile?.status || user?.status || "active",
    online: profile?.online ?? true,
    assigned_departments: profile?.assigned_departments || user?.assigned_departments || user?.skills || [],
    permission_level: profile?.permission_level || "Limited management access",
    assigned_projects: profile?.assigned_projects ?? 0,
    tasks_managed: profile?.tasks_managed ?? 0,
    client_conversations_handled: profile?.client_conversations_handled ?? 0,
    team_members_supervised: profile?.team_members_supervised ?? 0,
    recent_activity_log: profile?.recent_activity_log || [],
    escalation_notes_to_admin: profile?.escalation_notes_to_admin || [],
    date_invited: profile?.date_invited || user?.invited_at || user?.created_at,
    last_active_time: profile?.last_active_time || user?.last_seen,
  }), [profile, user]);

  const overview = dashboard?.overview || {};
  const projects = dashboard?.managed_projects || [];
  const workload = dashboard?.team_workload || [];
  const comms = dashboard?.client_communication || {};
  const escalations = dashboard?.escalation_center || {};
  const activity = dashboard?.activity_log || safeProfile.recent_activity_log || [];

  return (
    <Layout allowed={["moderator"]}>
      <PageHeader
        label="Moderator / Operations"
        title="Moderator Dashboard"
        subtitle="A limited management profile below Admin level and above normal team members."
      />

      {apiNote && <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">{apiNote}</div>}

      <div className="mb-5 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,81,255,.25),transparent_35%),rgba(24,24,27,.45)] p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            {safeProfile.avatar_url ? (
              <img src={safeProfile.avatar_url} alt="Moderator avatar" className="h-16 w-16 rounded-2xl object-cover" />
            ) : (
              <div className="grid h-16 w-16 place-items-center rounded-2xl bg-blue-500/20 text-2xl font-semibold">
                {(safeProfile.real_name || "M").charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Moderator Profile</div>
              <div className="mt-1 text-2xl font-semibold">{safeProfile.real_name}</div>
              <div className="text-sm text-zinc-400">{safeProfile.email}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">Role: Moderator</Badge>
            <Badge tone={safeProfile.status === "deactivated" ? "bad" : "good"}>{safeProfile.status}</Badge>
            <Badge>{safeProfile.online ? "Online" : "Offline"}</Badge>
            <Badge>{safeProfile.permission_level}</Badge>
          </div>
        </div>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-5">
        <Metric label="Active projects" value={overview.active_projects} />
        <Metric label="Pending approvals" value={overview.pending_approvals} />
        <Metric label="Urgent deadlines" value={overview.urgent_deadlines} />
        <Metric label="Revision requests" value={overview.revision_requests} />
        <Metric label="Client messages waiting" value={overview.client_messages_waiting} />
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-[.8fr,1.2fr]">
        <Panel title="Moderator Profile Details" subtitle="Core identity, access level, activity and responsibility summary.">
          <div className="grid gap-3 md:grid-cols-2">
            <Detail label="Avatar" value={safeProfile.avatar_url ? "Uploaded" : "Default avatar"} />
            <Detail label="Real name" value={safeProfile.real_name} />
            <Detail label="Email" value={safeProfile.email} />
            <Detail label="Role" value="Moderator" />
            <Detail label="Status" value={safeProfile.status} />
            <Detail label="Online / Offline" value={safeProfile.online ? "Online" : "Offline"} />
            <Detail label="Assigned departments/services" value={(safeProfile.assigned_departments || []).join(", ") || "Not assigned yet"} />
            <Detail label="Permission level" value={safeProfile.permission_level} />
            <Detail label="Assigned projects" value={safeProfile.assigned_projects} />
            <Detail label="Tasks managed" value={safeProfile.tasks_managed} />
            <Detail label="Client conversations handled" value={safeProfile.client_conversations_handled} />
            <Detail label="Team members supervised" value={safeProfile.team_members_supervised} />
            <Detail label="Date invited" value={formatShortDate(safeProfile.date_invited)} />
            <Detail label="Last active time" value={formatShortDate(safeProfile.last_active_time)} />
          </div>
        </Panel>

        <div className="grid gap-5 md:grid-cols-2">
          <Panel title="Moderator Can" subtitle="Allowed limited management actions.">
            <div className="space-y-2">
              {CAN_PERMISSIONS.map((item) => <div key={item} className="rounded-xl border border-emerald-500/15 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">✓ {item}</div>)}
            </div>
          </Panel>
          <Panel title="Moderator Cannot" subtitle="Owner/Admin level actions remain protected.">
            <div className="space-y-2">
              {CANNOT_PERMISSIONS.map((item) => <div key={item} className="rounded-xl border border-red-500/15 bg-red-500/10 px-3 py-2 text-sm text-red-200">✕ {item}</div>)}
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr,.65fr]">
        <div className="space-y-5">
          <Panel title="1. Overview" subtitle="High-level operational status for the Moderator.">
            <div className="grid gap-3 md:grid-cols-5">
              <Detail label="Active projects" value={overview.active_projects ?? 0} />
              <Detail label="Pending approvals" value={overview.pending_approvals ?? 0} />
              <Detail label="Urgent deadlines" value={overview.urgent_deadlines ?? 0} />
              <Detail label="Revision requests" value={overview.revision_requests ?? 0} />
              <Detail label="Client messages waiting" value={overview.client_messages_waiting ?? 0} />
            </div>
          </Panel>

          <Panel title="2. Managed Projects" subtitle="Projects the Moderator can monitor, assign and update.">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left label-xs text-zinc-500">
                  <tr><th className="py-3">Project name</th><th>Client name</th><th>Service type</th><th>Assigned team member</th><th>Current status</th><th>Deadline</th></tr>
                </thead>
                <tbody>
                  {projects.map((p) => (
                    <tr key={p.id} className="border-t border-white/5">
                      <td className="py-3 font-medium">{p.project_name || "Untitled"}</td>
                      <td className="text-zinc-400">{p.client_name || "—"}</td>
                      <td className="text-zinc-400">{p.service_type || "—"}</td>
                      <td className="text-zinc-400">{p.assigned_team_member || "Unassigned"}</td>
                      <td><Badge tone="blue">{p.current_status || "—"}</Badge></td>
                      <td className="text-zinc-400">{p.deadline?.slice?.(0,10) || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {projects.length === 0 && <EmptyState>No managed projects yet. Active projects will appear here with client name, service type, assigned team member, status and deadline.</EmptyState>}
            </div>
          </Panel>

          <Panel title="3. Team Workload" subtitle="Editor workload and availability overview.">
            <div className="grid gap-3 md:grid-cols-2">
              {workload.map((w, i) => (
                <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="font-medium">{w.team_member_name}</div>
                  <div className="mt-1 text-sm text-zinc-500">{w.role} · {w.active_tasks} active tasks</div>
                  <div className="mt-3 flex flex-wrap gap-2"><Badge>{w.availability}</Badge><Badge tone="blue">{w.performance_status}</Badge></div>
                </div>
              ))}
            </div>
            {workload.length === 0 && <EmptyState>No team workload data yet. Team member name, role, active tasks, availability and performance status will appear here.</EmptyState>}
          </Panel>

          <Panel title="4. Client Communication" subtitle="Recent messages, pending replies and important client notes.">
            <div className="space-y-3">
              {(comms.recent_messages || []).map((m) => <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm"><span className="text-zinc-500">{m.sender_role}: </span>{m.content}</div>)}
            </div>
            {(comms.recent_messages || []).length === 0 && <EmptyState>No recent messages yet. Pending replies and important client notes will show here.</EmptyState>}
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="5. Escalation Center" subtitle="Issues that need Admin attention.">
            <div className="space-y-3">
              {(escalations.issues_needing_admin_attention || []).map((e) => <div key={e.id} className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">{e.target_email || "Admin attention needed"}</div>)}
            </div>
            {(escalations.issues_needing_admin_attention || []).length === 0 && <EmptyState>No escalation notes yet. Payment problems, conflict reports and delay reports will appear here.</EmptyState>}
          </Panel>

          <Panel title="Payment-related Problems">
            {(escalations.payment_related_problems || []).length === 0 ? <EmptyState>No payment-related problems reported.</EmptyState> : null}
          </Panel>

          <Panel title="Conflict or Delay Reports">
            {(escalations.conflict_or_delay_reports || []).length === 0 ? <EmptyState>No conflict or delay reports.</EmptyState> : null}
          </Panel>

          <Panel title="6. Activity Log" subtitle="What changed, which project was assigned, status updates and timestamps.">
            <div className="space-y-3">
              {activity.slice(0, 12).map((a) => (
                <div key={a.id || a.created_at} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm">
                  <div>{a.action || "Moderator activity"}</div>
                  <div className="text-xs text-zinc-500">{formatShortDate(a.created_at)}</div>
                </div>
              ))}
            </div>
            {activity.length === 0 && <EmptyState>No recent activity yet. Assignments, status updates, internal notes and Admin escalations will be listed here.</EmptyState>}
          </Panel>
        </div>
      </div>
    </Layout>
  );
}
