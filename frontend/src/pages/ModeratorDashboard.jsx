import { useEffect, useState } from "react";
import Layout, { Badge, PageHeader } from "../components/Layout";
import { api, formatApiError } from "../lib/api";

function Panel({ title, children }) {
  return <section className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5 shadow-2xl shadow-black/20">{title && <h2 className="mb-4 text-lg font-semibold">{title}</h2>}{children}</section>;
}

function Metric({ label, value }) {
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-5"><div className="label-xs text-zinc-500">{label}</div><div className="mt-3 text-3xl font-semibold">{value ?? 0}</div></div>;
}

export default function ModeratorDashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [profile, setProfile] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    Promise.all([api.get("/moderator/dashboard"), api.get("/moderator/profile")])
      .then(([d, p]) => { setDashboard(d.data); setProfile(p.data); })
      .catch((e) => setErr(formatApiError(e?.response?.data?.detail || e.message)));
  }, []);

  const overview = dashboard?.overview || {};
  const projects = dashboard?.managed_projects || [];
  const workload = dashboard?.team_workload || [];
  const comms = dashboard?.client_communication || {};
  const escalations = dashboard?.escalation_center || {};
  const activity = dashboard?.activity_log || [];

  return (
    <Layout allowed={["moderator"]}>
      <PageHeader label="Moderator / Operations" title="Moderator Dashboard" subtitle="Limited management access for project operations, team workload, client communication, and escalation notes." />
      {err && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</div>}

      <div className="mb-5 rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(0,81,255,.25),transparent_35%),rgba(24,24,27,.45)] p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-2xl object-cover" /> : <div className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/20 text-xl font-semibold">{(profile?.real_name || "M").charAt(0)}</div>}
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500">Moderator Profile</div>
              <div className="mt-1 text-xl font-semibold">{profile?.real_name || "Moderator"}</div>
              <div className="text-sm text-zinc-400">{profile?.email || "Limited management access"}</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2"><Badge tone="blue">Role: Moderator</Badge><Badge>{profile?.status || "active"}</Badge><Badge>{profile?.online ? "Online" : "Offline"}</Badge><Badge>{profile?.permission_level || "Limited management access"}</Badge></div>
        </div>
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-5"><Metric label="Active projects" value={overview.active_projects} /><Metric label="Pending approvals" value={overview.pending_approvals} /><Metric label="Urgent deadlines" value={overview.urgent_deadlines} /><Metric label="Revision requests" value={overview.revision_requests} /><Metric label="Client messages" value={overview.client_messages_waiting} /></div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr,.65fr]">
        <div className="space-y-5">
          <Panel title="Managed Projects"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="text-left label-xs text-zinc-500"><tr><th className="py-3">Project name</th><th>Client</th><th>Service</th><th>Team member</th><th>Status</th><th>Deadline</th></tr></thead><tbody>{projects.map((p) => <tr key={p.id} className="border-t border-white/5"><td className="py-3 font-medium">{p.project_name || "Untitled"}</td><td className="text-zinc-400">{p.client_name}</td><td className="text-zinc-400">{p.service_type}</td><td className="text-zinc-400">{p.assigned_team_member}</td><td><Badge tone="blue">{p.current_status || "—"}</Badge></td><td className="text-zinc-400">{p.deadline?.slice?.(0,10) || "—"}</td></tr>)}</tbody></table>{projects.length === 0 && <div className="py-6 text-sm text-zinc-500">No managed projects yet.</div>}</div></Panel>
          <Panel title="Team Workload"><div className="grid gap-3 md:grid-cols-2">{workload.map((w, i) => <div key={i} className="rounded-xl border border-white/10 bg-black/20 p-4"><div className="font-medium">{w.team_member_name}</div><div className="mt-1 text-sm text-zinc-500">{w.role} · {w.active_tasks} active tasks</div><div className="mt-3 flex gap-2"><Badge>{w.availability}</Badge><Badge tone="blue">{w.performance_status}</Badge></div></div>)}</div>{workload.length === 0 && <div className="text-sm text-zinc-500">No team workload data yet.</div>}</Panel>
          <Panel title="Client Communication"><div className="space-y-3">{(comms.recent_messages || []).map((m) => <div key={m.id} className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm"><span className="text-zinc-500">{m.sender_role}: </span>{m.content}</div>)}{(comms.recent_messages || []).length === 0 && <div className="text-sm text-zinc-500">No recent client messages.</div>}</div></Panel>
        </div>
        <div className="space-y-5">
          <Panel title="Profile Details"><div className="space-y-3 text-sm text-zinc-300"><p><span className="text-zinc-500">Assigned departments:</span> {(profile?.assigned_departments || []).join(", ") || "—"}</p><p><span className="text-zinc-500">Assigned projects:</span> {profile?.assigned_projects ?? 0}</p><p><span className="text-zinc-500">Tasks managed:</span> {profile?.tasks_managed ?? 0}</p><p><span className="text-zinc-500">Conversations handled:</span> {profile?.client_conversations_handled ?? 0}</p><p><span className="text-zinc-500">Team supervised:</span> {profile?.team_members_supervised ?? 0}</p><p><span className="text-zinc-500">Date invited:</span> {profile?.date_invited?.slice?.(0,10) || "—"}</p><p><span className="text-zinc-500">Last active:</span> {profile?.last_active_time?.slice?.(0,16) || "—"}</p></div></Panel>
          <Panel title="Escalation Center"><div className="space-y-3">{(escalations.issues_needing_admin_attention || []).map((e) => <div key={e.id} className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-100">{e.target_email || "Admin attention needed"}</div>)}{(escalations.issues_needing_admin_attention || []).length === 0 && <div className="text-sm text-zinc-500">No escalations yet.</div>}</div></Panel>
          <Panel title="Activity Log"><div className="space-y-3">{activity.slice(0, 10).map((a) => <div key={a.id} className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm"><div>{a.action}</div><div className="text-xs text-zinc-500">{a.created_at?.slice?.(0,16) || "—"}</div></div>)}{activity.length === 0 && <div className="text-sm text-zinc-500">No activity yet.</div>}</div></Panel>
        </div>
      </div>
    </Layout>
  );
}
