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

function RoleTag({ role }) {
  const isEditor = role === "editor";

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium lowercase ${
        isEditor
          ? "border-blue-500/25 bg-blue-500/10 text-blue-300"
          : "border-violet-500/25 bg-violet-500/10 text-violet-300"
      }`}
      title={isEditor ? "Editor account" : "Client account"}
    >
      {isEditor ? "editor" : "client"}
    </span>
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

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [f, setF] = useState({ email: "", real_name: "", role: "editor", skills: "", avatar_url: "", charge_per_project: 0 });

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
        charge_per_project: Number(f.charge_per_project || 0),
      };
      const { data } = await api.post("/account/users/invite", payload);
      setOpen(false);
      setF({ email: "", real_name: "", role: "editor", skills: "", avatar_url: "", charge_per_project: 0 });
      setNotice(data?.invite_url ? `Invite created. Copy setup link: ${data.invite_url}` : "Account invite created successfully.");
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

      <div className="border border-white/10 rounded-2xl bg-zinc-900/30 overflow-hidden shadow-2xl shadow-black/20">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-left label-xs text-zinc-400">
              <th className="p-3">Anon Name</th>
              <th className="p-3">Real Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Skills</th>
              <th className="p-3">Status</th>
              <th className="p-3">Online</th>
              <th className="p-3">Access</th>
            </tr>
          </thead>
          <tbody>
            {visibleUsers.map((u) => {
              const status = u.status || "active";
              const online = status !== "deactivated" && isUserOnline(u);
              return (
                <tr key={u.id} className="border-t border-white/5" data-testid={`user-row-${u.id}`}>
                  <td className="p-3 flex items-center gap-2">
                    <div className="relative shrink-0">
                      {u.avatar_url ? (
                        <img src={u.avatar_url} className={`w-7 h-7 object-cover ${u.role === "editor" ? "rounded-md" : "rounded-full"}`} alt="" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-zinc-800 grid place-items-center text-xs text-zinc-300">
                          {(u.anime_name || u.real_name || u.email || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-zinc-950 ${online ? "bg-emerald-400" : "bg-zinc-600"}`} title={online ? "Online" : "Offline"} />
                    </div>
                    <div>
                      <div className="font-medium flex items-center gap-2">
                        {u.anime_name}
                        {online && <span className="text-[10px] text-emerald-400">online</span>}
                      </div>
                      <div className="text-[10px] text-zinc-600">{formatLastSeen(u.last_seen)}</div>
                    </div>
                  </td>
                  <td className="p-3 text-zinc-400">{u.real_name}</td>
                  <td className="p-3 text-zinc-400 font-mono text-xs">{u.email}</td>
                  <td className="p-3"><RoleTag role={u.role} /></td>
                  <td className="p-3 text-xs text-zinc-400 max-w-[220px] truncate">{(u.skills || []).join(", ") || "—"}</td>
                  <td className="p-3"><Badge tone={statusTone(status)}>{status}</Badge></td>
                  <td className="p-3">
                    <span className={`inline-flex items-center gap-1.5 text-xs ${online ? "text-emerald-400" : "text-zinc-500"}`}>
                      <span className={`w-2 h-2 rounded-full ${online ? "bg-emerald-400" : "bg-zinc-600"}`} />
                      {online ? "Online" : "Offline"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      {status === "deactivated" ? (
                        <button onClick={() => reactivate(u)} className="text-xs text-emerald-400 hover:text-emerald-300">Reactivate</button>
                      ) : (
                        <button onClick={() => deactivate(u)} data-testid={`deactivate-user-${u.id}`} className="text-xs text-amber-400 hover:text-amber-300">Deactivate</button>
                      )}
                      <button onClick={() => deleteUser(u)} data-testid={`delete-user-${u.id}`} className="text-xs text-red-400 hover:text-red-300">Delete</button>
                      {status === "invited" && <button onClick={() => copyInvite(u)} className="text-xs text-blue-400 hover:text-blue-300">Copy invite</button>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visibleUsers.length === 0 && (
              <tr><td colSpan="8" className="p-8 text-center text-zinc-500">No users match this view.</td></tr>
            )}
          </tbody>
        </table>
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
              <select data-testid="new-user-role" className={inp} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}>
                <option value="editor">Editor</option>
                <option value="client">Client</option>
              </select>
              <input className={inp} placeholder="Skills (comma separated)" value={f.skills} onChange={(e) => setF({ ...f, skills: e.target.value })} />
              <input className={inp} placeholder="Avatar URL (optional)" value={f.avatar_url} onChange={(e) => setF({ ...f, avatar_url: e.target.value })} />
              <input type="number" className={inp} placeholder="Charge per project" value={f.charge_per_project} onChange={(e) => setF({ ...f, charge_per_project: e.target.value })} />
              {err && <div className="text-red-400 text-sm">{err}</div>}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setOpen(false)} className="flex-1 border border-white/10 rounded-xl py-2 text-sm hover:bg-white/5">Cancel</button>
                <button data-testid="submit-create-user" onClick={invite} disabled={busy} className="flex-1 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50" style={{ background: BLUE }}>{busy ? "Sending…" : "Send Invite"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
