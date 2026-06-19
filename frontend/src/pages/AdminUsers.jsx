import { useEffect, useMemo, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api, formatApiError } from "../lib/api";

const BLUE = "#0051FF";

function statusTone(status) {
  if (status === "active") return "good";
  if (status === "invited") return "blue";
  if (status === "deactivated") return "bad";
  return "default";
}

function roleBucket(role) {
  if (role === "moderator") return "moderator";
  if (role === "editor") return "editor";
  return "client";
}

const ROLE_SECTIONS = [
  { key: "editor", label: "Editors" },
  { key: "moderator", label: "Moderators" },
  { key: "client", label: "Clients" },
];

function RoleTag({ role }) {
  const styles = {
    editor: "border-blue-500/25 bg-blue-500/10 text-blue-300",
    client: "border-violet-500/25 bg-violet-500/10 text-violet-300",
    moderator: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
  };
  const label = role === "moderator" ? "moderator" : role === "editor" ? "editor" : "client";
  const title = role === "moderator" ? "Moderator account" : role === "editor" ? "Editor account" : "Client account";

  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium lowercase ${styles[label]}`} title={title}>
      {label}
    </span>
  );
}

function RoleSelect({ value, onChange, className, testId }) {
  return (
    <select data-testid={testId} className={className} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="editor">Editor</option>
      <option value="client">Client</option>
      <option value="moderator">Moderator</option>
    </select>
  );
}

function isUserOnline(user) {
  if (typeof user?.online === "boolean") return user.online;
  if (!user?.last_seen) return false;

  try {
    const lastSeen = new Date(user.last_seen).getTime();
    return Date.now() - lastSeen < 2 * 60 * 1000;
  } catch {
    return false;
  }
}

function formatLastSeen(value) {
  if (!value) return "Never active";

  try {
    const diff = Date.now() - new Date(value).getTime();
    const minutes = Math.max(0, Math.round(diff / 60000));

    if (minutes < 1) return "Active now";
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.round(hours / 24);
    return `${days}d ago`;
  } catch {
    return "Unknown";
  }
}

const blankForm = { email: "", real_name: "", role: "editor", skills: "", avatar_url: "", charge_per_project: 0 };

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [f, setF] = useState(blankForm);
  const [editF, setEditF] = useState(blankForm);

  const load = async () => {
    const { data } = await api.get("/users");
    setUsers(data.filter((u) => u.role !== "admin"));
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  const visibleUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const status = u.status || "active";
      const matchesStatus = filter === "all" || status === filter;
      const haystack = `${u.real_name || ""} ${u.email || ""} ${u.anime_name || ""} ${u.role || ""}`.toLowerCase();
      return matchesStatus && (!q || haystack.includes(q));
    });
  }, [users, filter, query]);

  const invite = async () => {
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      const payload = {
        ...f,
        skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean),
        charge_per_project: f.role === "editor" ? Number(f.charge_per_project || 0) : 0,
      };
      const { data } = await api.post("/account/users/invite", payload);
      setOpen(false);
      setF(blankForm);

      if (data?.email_sent) {
        setNotice(`Invite email sent successfully to ${payload.email}.`);
      } else if (data?.invite_url) {
        setNotice(`Email was not sent. Check Resend/email provider settings, or manually copy this setup link: ${data.invite_url}`);
      } else {
        setNotice("Account invite created successfully.");
      }

      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail || e.message));
    } finally {
      setBusy(false);
    }
  };

  const openEdit = (user) => {
    setErr("");
    setNotice("");
    setEditingUser(user);
    setEditF({
      email: user.email || "",
      real_name: user.real_name || "",
      role: user.role || "editor",
      skills: (user.skills || []).join(", "),
      avatar_url: user.avatar_url || "",
      charge_per_project: user.charge_per_project || 0,
    });
  };

  const saveEdit = async () => {
    if (!editingUser?.id) return;
    setErr("");
    setNotice("");
    setBusy(true);
    try {
      const payload = {
        ...editF,
        skills: editF.skills.split(",").map((s) => s.trim()).filter(Boolean),
        charge_per_project: editF.role === "editor" ? Number(editF.charge_per_project || 0) : 0,
      };
      await api.patch(`/account/users/${editingUser.id}`, payload);
      setEditingUser(null);
      setEditF(blankForm);
      setNotice(`${payload.email} was updated successfully.`);
      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail || e.message));
    } finally {
      setBusy(false);
    }
  };

  const deactivate = async (user) => {
    const ok = confirm("Are you sure you want to deactivate this user? Their access will be blocked, but project history will stay safe.");
    if (!ok) return;
    setErr("");
    setNotice("");
    try {
      await api.delete(`/account/users/${user.id}/deactivate`);
      setNotice(`${user.email} has been deactivated. Project history was kept safe.`);
      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail || e.message));
    }
  };

  const reactivate = async (user) => {
    setErr("");
    setNotice("");
    try {
      await api.post(`/account/users/${user.id}/reactivate`);
      setNotice(`${user.email} has been reactivated.`);
      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail || e.message));
    }
  };

  const deleteUser = async (user) => {
    const firstConfirm = confirm(`Permanently delete ${user.email}? This removes the login account. Use this only when someone has left your agency.`);
    if (!firstConfirm) return;

    const secondConfirm = confirm("Final confirmation: this cannot be undone from the dashboard. Existing project records will stay, but the account login will be removed.");
    if (!secondConfirm) return;

    setErr("");
    setNotice("");
    try {
      await api.delete(`/account/users/${user.id}/delete`);
      setNotice(`${user.email} has been permanently deleted.`);
      await load();
    } catch (e) {
      setErr(formatApiError(e?.response?.data?.detail || e.message));
    }
  };

  const copyInvite = async (user) => {
    if (!user.invite_url) {
      setNotice("Invite links are only shown right after creating a new invite.");
      return;
    }
    await navigator.clipboard.writeText(user.invite_url);
    setNotice("Invite link copied.");
  };

  const inp = "w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500";

  const renderUserCard = (u) => {
    const status = u.status || "active";
    const online = status !== "deactivated" && isUserOnline(u);
    const skills = u.skills || [];
    return (
      <div key={u.id} data-testid={`user-row-${u.id}`} className="relative card-hover flex flex-col border border-white/10 rounded-2xl bg-zinc-900/30 p-5">
        <button onClick={() => openEdit(u)} data-testid={`edit-user-${u.id}`} title="Edit profile" className="absolute top-4 right-4 w-8 h-8 rounded-full border border-white/10 grid place-items-center text-zinc-300 hover:text-white hover:border-blue-500/40">↗</button>

        <div className="flex items-center gap-3 pr-10">
          <div className="relative shrink-0">
            {u.avatar_url ? (
              <img src={u.avatar_url} className={`w-12 h-12 object-cover ${u.role === "editor" ? "rounded-xl" : "rounded-full"}`} alt="" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-zinc-800 grid place-items-center text-base text-zinc-300">
                {(u.anime_name || u.real_name || u.email || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-zinc-950 ${online ? "bg-emerald-400" : "bg-zinc-600"}`} title={online ? "Online" : "Offline"} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{u.anime_name}</div>
            <div className="text-sm text-zinc-400 truncate">{u.real_name || "—"}</div>
          </div>
        </div>

        <div className="mt-3 text-xs text-zinc-500 font-mono truncate">{u.email}</div>

        <div className="mt-4">
          <div className="label-xs text-zinc-500 mb-2">Skills</div>
          <div className="flex flex-wrap gap-1.5">
            {skills.length === 0 && <span className="text-xs text-zinc-600">—</span>}
            {skills.map((s, i) => (
              <span key={i} className="inline-flex items-center rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-zinc-300">{s}</span>
            ))}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <RoleTag role={u.role} />
          <Badge tone={statusTone(status)}>{status}</Badge>
          <span className={`inline-flex items-center gap-1.5 text-xs ${online ? "text-emerald-400" : "text-zinc-500"}`}>
            <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-400" : "bg-zinc-600"}`} />
            {online ? "Online" : formatLastSeen(u.last_seen)}
          </span>
        </div>

        <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-3 flex-wrap">
          {status === "deactivated" ? (
            <button onClick={() => reactivate(u)} className="text-xs text-emerald-400 hover:text-emerald-300">Reactivate</button>
          ) : (
            <button onClick={() => deactivate(u)} data-testid={`deactivate-user-${u.id}`} className="text-xs text-amber-400 hover:text-amber-300">Deactivate</button>
          )}
          <button onClick={() => deleteUser(u)} data-testid={`delete-user-${u.id}`} className="text-xs text-red-400 hover:text-red-300">Delete</button>
          {status === "invited" && <button onClick={() => copyInvite(u)} className="text-xs text-blue-400 hover:text-blue-300">Copy invite</button>}
        </div>
      </div>
    );
  };

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Team" title="Team & Clients" subtitle="Invite editors by email, deactivate accounts safely, or delete accounts when someone leaves the agency.">
        <button data-testid="create-user-button" onClick={() => setOpen(true)} className="px-4 py-2 text-white text-sm font-medium rounded-xl shadow-[0_0_28px_rgba(0,81,255,.22)]" style={{ background: BLUE }}>+ Invite Account</button>
      </PageHeader>

      {err && <div className="mb-4 border border-red-500/20 bg-red-500/10 text-red-300 rounded-xl px-4 py-3 text-sm">{err}</div>}
      {notice && <div className="mb-4 border border-blue-500/20 bg-blue-500/10 text-blue-200 rounded-xl px-4 py-3 text-sm break-all">{notice}</div>}

      <div className="grid md:grid-cols-[1fr,220px] gap-3 mb-4">
        <input className={inp} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email, anon name, role…" />
        <select className={inp} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          <option value="invited">Invited</option>
          <option value="active">Active</option>
          <option value="deactivated">Deactivated</option>
        </select>
      </div>

      <div className="space-y-8">
        {ROLE_SECTIONS.map((group) => {
          const groupUsers = visibleUsers.filter((u) => roleBucket(u.role) === group.key);
          if (groupUsers.length === 0) return null;
          return (
            <section key={group.key} data-testid={`team-section-${group.key}`}>
              <div className="flex items-center gap-3 mb-4">
                <h2 className="text-lg font-semibold">{group.label}</h2>
                <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full border border-white/10 bg-white/5 text-xs font-mono text-zinc-300">{groupUsers.length}</span>
              </div>
              <div className="grid sm:grid-cols-2 2xl:grid-cols-3 gap-4">
                {groupUsers.map((u) => renderUserCard(u))}
              </div>
            </section>
          );
        })}
        {visibleUsers.length === 0 && (
          <div className="p-8 text-center text-zinc-500 border border-white/10 rounded-2xl bg-zinc-900/30">No users match this view.</div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={() => setOpen(false)}>
          <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl shadow-black/50" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5">
              <div className="label-xs text-zinc-500 mb-2">Secure invite</div>
              <h3 className="text-xl font-semibold">Invite Account</h3>
              <p className="text-sm text-zinc-500 mt-1">No manual password. The user sets their own password from the invite link.</p>
            </div>
            <div className="space-y-3">
              <input data-testid="new-user-email" className={inp} placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
              <input data-testid="new-user-name" className={inp} placeholder="Real Name" value={f.real_name} onChange={(e) => setF({ ...f, real_name: e.target.value })} />
              <RoleSelect testId="new-user-role" className={inp} value={f.role} onChange={(role) => setF({ ...f, role })} />
              <input className={inp} placeholder="Skills / Departments (comma separated)" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} />
              <input className={inp} placeholder="Avatar URL (optional)" value={f.avatar_url} onChange={(e) => setF({ ...f, avatar_url: e.target.value })} />
              {f.role === "editor" && <input type="number" className={inp} placeholder="Editor Charge Per Project (€)" value={f.charge_per_project} onChange={(e) => setF({ ...f, charge_per_project: e.target.value })} />}
              {err && <div className="text-red-400 text-sm">{err}</div>}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setOpen(false)} className="flex-1 border border-white/10 rounded-xl py-2 text-sm hover:bg-white/5">Cancel</button>
                <button data-testid="submit-create-user" onClick={invite} disabled={busy} className="flex-1 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50" style={{ background: BLUE }}>{busy ? "Sending…" : "Send Invite"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingUser && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={() => setEditingUser(null)}>
          <div className="bg-zinc-950 border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl shadow-black/50" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5">
              <div className="label-xs text-zinc-500 mb-2">Admin edit</div>
              <h3 className="text-xl font-semibold">Edit Profile</h3>
              <p className="text-sm text-zinc-500 mt-1">Update account details without deleting project history.</p>
            </div>
            <div className="space-y-3">
              <input className={inp} placeholder="Email" value={editF.email} onChange={(e) => setEditF({ ...editF, email: e.target.value })} />
              <input className={inp} placeholder="Real Name" value={editF.real_name} onChange={(e) => setEditF({ ...editF, real_name: e.target.value })} />
              <RoleSelect className={inp} value={editF.role} onChange={(role) => setEditF({ ...editF, role })} />
              <input className={inp} placeholder="Skills / Departments (comma separated)" value={editF.skills} onChange={(e) => setEditF({ ...editF, skills: e.target.value })} />
              <input className={inp} placeholder="Avatar URL (optional)" value={editF.avatar_url} onChange={(e) => setEditF({ ...editF, avatar_url: e.target.value })} />
              {editF.role === "editor" && <input type="number" className={inp} placeholder="Editor Charge Per Project (€)" value={editF.charge_per_project} onChange={(e) => setEditF({ ...editF, charge_per_project: e.target.value })} />}
              {err && <div className="text-red-400 text-sm">{err}</div>}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setEditingUser(null)} className="flex-1 border border-white/10 rounded-xl py-2 text-sm hover:bg-white/5">Cancel</button>
                <button onClick={saveEdit} disabled={busy} className="flex-1 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50" style={{ background: BLUE }}>{busy ? "Saving…" : "Save Changes"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
