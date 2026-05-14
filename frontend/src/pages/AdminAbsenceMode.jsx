import { useEffect, useMemo, useState } from "react";
import Layout, { PageHeader, Badge } from "../components/Layout";
import { api, formatApiError } from "../lib/api";

const ALL_PERMISSIONS = [
  ["view_projects", "View active projects"],
  ["assign_projects", "Assign projects to team members"],
  ["update_status", "Update project statuses"],
  ["review_files", "Review uploaded files"],
  ["reply_clients", "Reply to client messages"],
  ["approve_revisions", "Approve normal revision requests"],
  ["manage_deadlines", "Manage deadlines"],
  ["send_back", "Send tasks back to team members"],
  ["notify_admin", "Notify Owner/Admin"],
  ["view_workload", "View team workload"],
  ["view_client_progress", "View client project progress"],
];

const DEFAULT_ALLOWED = ALL_PERMISSIONS.map(([key]) => key);

function formatDateTime(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

export default function AdminAbsenceMode() {
  const [mode, setMode] = useState(null);
  const [moderators, setModerators] = useState([]);
  const [notice, setNotice] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", real_name: "" });
  const [form, setForm] = useState({
    moderator_id: "",
    duration_hours: 24,
    allowed_permissions: DEFAULT_ALLOWED,
    restricted_permissions: [],
    note: "",
  });

  const active = !!mode?.active;

  const selectedModerator = useMemo(() => {
    return moderators.find((item) => item.id === form.moderator_id) || null;
  }, [moderators, form.moderator_id]);

  const load = async () => {
    const [modeRes, usersRes] = await Promise.all([
      api.get("/absence-mode"),
      api.get("/users?role=moderator"),
    ]);
    const modeData = modeRes.data || {};
    const moderatorData = Array.isArray(usersRes.data) ? usersRes.data : [];
    setMode(modeData);
    setModerators(moderatorData);

    if (modeData.active) {
      setForm({
        moderator_id: modeData.moderator_id || "",
        duration_hours: 24,
        allowed_permissions: modeData.allowed_permissions || DEFAULT_ALLOWED,
        restricted_permissions: modeData.restricted_permissions || [],
        note: modeData.note || "",
      });
    } else if (!form.moderator_id && moderatorData.length > 0) {
      setForm((prev) => ({ ...prev, moderator_id: moderatorData[0].id }));
    }
  };

  useEffect(() => {
    load().catch((error) => setErr(formatApiError(error?.response?.data?.detail || error.message)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePermission = (key) => {
    setForm((prev) => {
      const isAllowed = prev.allowed_permissions.includes(key);
      const allowed = isAllowed
        ? prev.allowed_permissions.filter((item) => item !== key)
        : [...prev.allowed_permissions, key];
      const restricted = isAllowed
        ? [...new Set([...prev.restricted_permissions, key])]
        : prev.restricted_permissions.filter((item) => item !== key);
      return { ...prev, allowed_permissions: allowed, restricted_permissions: restricted };
    });
  };

  const enableMode = async () => {
    setErr("");
    setNotice("");
    if (!form.moderator_id) {
      setErr("Select a Moderator before enabling Absence Mode.");
      return;
    }
    try {
      setBusy(true);
      const payload = {
        ...form,
        duration_hours: Number(form.duration_hours) || 24,
      };
      const { data } = await api.put("/absence-mode", payload);
      setMode(data);
      setNotice("Absence Mode is active. Moderator can now manage limited operations.");
      await load();
    } catch (error) {
      setErr(formatApiError(error?.response?.data?.detail || error.message));
    } finally {
      setBusy(false);
    }
  };

  const disableMode = async () => {
    setErr("");
    setNotice("");
    try {
      setBusy(true);
      await api.delete("/absence-mode");
      setNotice("Absence Mode has been turned off. Owner/Admin has resumed full operations.");
      await load();
    } catch (error) {
      setErr(formatApiError(error?.response?.data?.detail || error.message));
    } finally {
      setBusy(false);
    }
  };

  const inviteModerator = async () => {
    setErr("");
    setNotice("");
    try {
      setBusy(true);
      const { data } = await api.post("/absence-mode/moderators/invite", inviteForm);
      setInviteOpen(false);
      setInviteForm({ email: "", real_name: "" });
      setNotice(`Moderator invite created. Copy this setup link and send it manually: ${data.invite_url}`);
      await load();
    } catch (error) {
      setErr(formatApiError(error?.response?.data?.detail || error.message));
    } finally {
      setBusy(false);
    }
  };

  const input = "w-full rounded-xl border border-white/10 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500";

  return (
    <Layout allowed={["admin"]}>
      <PageHeader
        label="Admin / Absence Mode"
        title="Absence Mode"
        subtitle="Select a temporary Agency Manager to keep operations moving while the Owner/Admin is absent."
      >
        <button onClick={() => setInviteOpen(true)} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-white/5">
          + Invite Moderator
        </button>
      </PageHeader>

      {active && (
        <div className="mb-5 rounded-2xl border border-blue-500/30 bg-blue-500/10 px-5 py-4 text-blue-100 shadow-[0_0_35px_rgba(0,81,255,.15)]">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">Absence Mode Active — Moderator is managing operations.</div>
              <div className="mt-1 text-xs text-blue-200/70">Ends: {formatDateTime(mode?.ends_at)} · Moderator: {mode?.moderator_name || mode?.moderator?.display_name || "Selected Moderator"}</div>
            </div>
            <Badge tone="blue">Active</Badge>
          </div>
        </div>
      )}

      {notice && <div className="mb-4 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm text-blue-100 break-all">{notice}</div>}
      {err && <div className="mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">{err}</div>}

      <div className="grid gap-5 lg:grid-cols-[1.1fr,.9fr]">
        <section className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Temporary operations control</h2>
              <p className="mt-1 text-sm text-zinc-500">Moderator can only use the permissions selected here. Owner-level access stays protected.</p>
            </div>
            <Badge tone={active ? "blue" : "default"}>{active ? "Running" : "Inactive"}</Badge>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="text-sm text-zinc-300">
              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-zinc-500">Select Moderator</span>
              <select className={input} value={form.moderator_id} onChange={(e) => setForm({ ...form, moderator_id: e.target.value })}>
                <option value="">Choose Moderator</option>
                {moderators.map((moderator) => (
                  <option key={moderator.id} value={moderator.id}>
                    {moderator.real_name || moderator.display_name || moderator.email} · {moderator.status || "active"}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-zinc-300">
              <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-zinc-500">Access duration</span>
              <select className={input} value={form.duration_hours} onChange={(e) => setForm({ ...form, duration_hours: e.target.value })}>
                <option value={6}>6 hours</option>
                <option value={12}>12 hours</option>
                <option value={24}>24 hours</option>
                <option value={48}>48 hours</option>
                <option value={168}>7 days</option>
              </select>
            </label>
          </div>

          <label className="mt-4 block text-sm text-zinc-300">
            <span className="mb-2 block text-xs uppercase tracking-[0.2em] text-zinc-500">Optional absence note</span>
            <textarea className={input} rows={4} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Example: I am away today. Handle normal revisions and urgent deadlines, but notify me for payment or ownership issues." />
          </label>

          <div className="mt-6">
            <div className="mb-3 text-xs uppercase tracking-[0.2em] text-zinc-500">Allowed permissions</div>
            <div className="grid gap-3 md:grid-cols-2">
              {ALL_PERMISSIONS.map(([key, label]) => {
                const checked = form.allowed_permissions.includes(key);
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => togglePermission(key)}
                    className={`rounded-xl border p-3 text-left text-sm transition-all ${checked ? "border-blue-500/30 bg-blue-500/10 text-blue-100" : "border-white/10 bg-black/20 text-zinc-400"}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] ${checked ? "border-blue-400 bg-blue-500 text-white" : "border-white/10"}`}>{checked ? "✓" : ""}</span>
                      <span>{label}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <button disabled={busy || !selectedModerator} onClick={enableMode} className="flex-1 rounded-xl bg-white px-4 py-3 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50">
              {busy ? "Saving..." : active ? "Update Absence Mode" : "Enable Absence Mode"}
            </button>
            <button disabled={busy || !active} onClick={disableMode} className="flex-1 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50">
              Turn Off Absence Mode
            </button>
          </div>
        </section>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5">
            <h2 className="text-lg font-semibold">Protected owner-level actions</h2>
            <p className="mt-1 text-sm text-zinc-500">Moderator can never access these actions through Absence Mode.</p>
            <div className="mt-4 space-y-2 text-sm text-zinc-300">
              {[
                "Permanently delete clients or team members",
                "Delete project history",
                "Change payment settings",
                "Change platform settings",
                "Transfer ownership",
                "Invite new admins",
                "Modify owner-level permissions",
                "Remove the Owner/Admin account",
              ].map((item) => (
                <div key={item} className="rounded-xl border border-white/10 bg-black/20 px-3 py-2">🔒 {item}</div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-900/30 p-5">
            <h2 className="text-lg font-semibold">Moderator accounts</h2>
            <div className="mt-4 space-y-3">
              {moderators.map((moderator) => (
                <div key={moderator.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{moderator.real_name || moderator.display_name || moderator.email}</div>
                      <div className="text-xs text-zinc-500">{moderator.email}</div>
                    </div>
                    <Badge tone={moderator.status === "deactivated" ? "bad" : moderator.status === "invited" ? "blue" : "good"}>{moderator.status || "active"}</Badge>
                  </div>
                </div>
              ))}
              {moderators.length === 0 && <div className="text-sm text-zinc-500">No Moderator accounts yet. Invite one first.</div>}
            </div>
          </div>
        </aside>
      </div>

      {inviteOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onClick={() => setInviteOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-5">
              <div className="label-xs mb-2 text-zinc-500">Temporary manager</div>
              <h3 className="text-xl font-semibold">Invite Moderator</h3>
              <p className="mt-1 text-sm text-zinc-500">This creates a limited Agency Manager account for Absence Mode.</p>
            </div>
            <div className="space-y-3">
              <input className={input} placeholder="Email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} />
              <input className={input} placeholder="Real name" value={inviteForm.real_name} onChange={(e) => setInviteForm({ ...inviteForm, real_name: e.target.value })} />
              <div className="flex gap-2 pt-2">
                <button onClick={() => setInviteOpen(false)} className="flex-1 rounded-xl border border-white/10 py-2 text-sm hover:bg-white/5">Cancel</button>
                <button onClick={inviteModerator} disabled={busy} className="flex-1 rounded-xl bg-white py-2 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50">{busy ? "Creating..." : "Create Invite"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
