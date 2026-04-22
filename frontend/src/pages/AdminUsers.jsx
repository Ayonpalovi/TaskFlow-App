import { useEffect, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api, formatApiError } from "../lib/api";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [f, setF] = useState({ email: "", password: "", real_name: "", role: "editor", skills: "", avatar_url: "" });

  const load = async () => {
    const { data } = await api.get("/users");
    setUsers(data.filter(u => u.role !== "admin"));
  };
  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr("");
    try {
      await api.post("/users", { ...f, skills: f.skills.split(",").map(s => s.trim()).filter(Boolean) });
      setOpen(false); setF({ email: "", password: "", real_name: "", role: "editor", skills: "", avatar_url: "" });
      load();
    } catch (e) { setErr(formatApiError(e?.response?.data?.detail)); }
  };

  const remove = async (id) => {
    if (!confirm("Delete user?")) return;
    await api.delete(`/users/${id}`); load();
  };

  const inp = "w-full bg-zinc-900 border border-white/10 rounded-md px-3 py-2 text-sm";

  return (
    <Layout allowed={["admin"]}>
      <PageHeader label="Admin / Team" title="Team & Clients" subtitle="Manage editors and client accounts.">
        <button data-testid="create-user-button" onClick={() => setOpen(true)} className="px-4 py-2 bg-white text-black text-sm font-medium rounded-md hover:bg-zinc-200">+ New Account</button>
      </PageHeader>

      <div className="border border-white/10 rounded-md bg-zinc-900/30 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/5">
            <tr className="text-left label-xs text-zinc-400">
              <th className="p-3">Anon Name</th><th className="p-3">Real Name</th><th className="p-3">Email</th>
              <th className="p-3">Role</th><th className="p-3">Skills</th><th className="p-3">Status</th><th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id} className="border-t border-white/5" data-testid={`user-row-${u.id}`}>
                <td className="p-3 flex items-center gap-2">
                  {u.avatar_url && <img src={u.avatar_url} className={`w-7 h-7 object-cover ${u.role === "editor" ? "rounded-md" : "rounded-full"}`} alt="" />}
                  <span className="font-medium">{u.anime_name}</span>
                </td>
                <td className="p-3 text-zinc-400">{u.real_name}</td>
                <td className="p-3 text-zinc-400 font-mono text-xs">{u.email}</td>
                <td className="p-3"><Badge tone={u.role}>{u.role}</Badge></td>
                <td className="p-3 text-xs text-zinc-400">{(u.skills || []).join(", ") || "—"}</td>
                <td className="p-3">{u.online ? <span className="text-emerald-400 text-xs">● online</span> : <span className="text-zinc-600 text-xs">○ offline</span>}</td>
                <td className="p-3"><button onClick={() => remove(u.id)} data-testid={`delete-user-${u.id}`} className="text-xs text-red-400 hover:text-red-300">Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={() => setOpen(false)}>
          <div className="bg-zinc-950 border border-white/10 rounded-md w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-semibold mb-4">Create Account</h3>
            <div className="space-y-3">
              <input data-testid="new-user-email" className={inp} placeholder="Email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} />
              <input data-testid="new-user-password" type="password" className={inp} placeholder="Password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} />
              <input data-testid="new-user-name" className={inp} placeholder="Real Name" value={f.real_name} onChange={e => setF({ ...f, real_name: e.target.value })} />
              <select data-testid="new-user-role" className={inp} value={f.role} onChange={e => setF({ ...f, role: e.target.value })}>
                <option value="editor">Editor</option><option value="client">Client</option>
              </select>
              <input className={inp} placeholder="Skills (comma separated)" value={f.skills} onChange={e => setF({ ...f, skills: e.target.value })} />
              <input className={inp} placeholder="Avatar URL (optional)" value={f.avatar_url} onChange={e => setF({ ...f, avatar_url: e.target.value })} />
              {err && <div className="text-red-400 text-sm">{err}</div>}
              <div className="flex gap-2 pt-2">
                <button onClick={() => setOpen(false)} className="flex-1 border border-white/10 rounded-md py-2 text-sm hover:bg-white/5">Cancel</button>
                <button data-testid="submit-create-user" onClick={create} className="flex-1 bg-white text-black rounded-md py-2 text-sm font-medium hover:bg-zinc-200">Create</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
